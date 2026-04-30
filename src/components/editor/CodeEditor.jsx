import React, { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { EditorSelection } from "@codemirror/state";
import { xml } from "@codemirror/lang-xml";
import { foldEffect, foldedRanges, unfoldEffect } from "@codemirror/language";
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  search,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import {
  FaCopy,
  FaProjectDiagram,
  FaRedo,
  FaSearch,
  FaSearchMinus,
  FaSearchPlus,
} from "react-icons/fa";
import { MdContentPaste, MdOutlineSelectAll, MdOutlineSmartDisplay } from "react-icons/md";
import SearchBar from "../utils/SearchBar";
import { evaXmlDark, notepadPlus } from "../../utils/notepadPlusTheme";
import { groupOrder, sidebarConfig } from "../../utils/sidebarConfig";
import "./CodeEditor.css";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPresentXmlFoldGroups(xmlDoc) {
  if (!xmlDoc) return [];

  return groupOrder
    .map((parentTag) => {
      const config = sidebarConfig[parentTag];
      if (!config?.childTag) return null;

      const count = xmlDoc.querySelectorAll(`${parentTag} > ${config.childTag}`).length;
      if (!count) return null;

      return {
        parentTag,
        childTag: config.childTag,
        label: config.label || parentTag,
        count,
      };
    })
    .filter(Boolean);
}

function findXmlChildFoldRanges(source, group) {
  const text = String(source || "");
  const parentPattern = new RegExp(`<${group.parentTag}\\b[^>]*>[\\s\\S]*?<\\/${group.parentTag}>`, "gi");
  const ranges = [];
  let parentMatch;

  while ((parentMatch = parentPattern.exec(text))) {
    const parentStart = parentMatch.index;
    const parentText = parentMatch[0];
    const childPattern = new RegExp(
      `<${group.childTag}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${group.childTag}>)`,
      "gi"
    );
    let childMatch;

    while ((childMatch = childPattern.exec(parentText))) {
      const childText = childMatch[0];
      if (/\/>\s*$/i.test(childText)) continue;

      const openMatch = childText.match(new RegExp(`^<${group.childTag}\\b[^>]*>`, "i"));
      const closeTag = `</${group.childTag}>`;
      const closeIndex = childText.toLowerCase().lastIndexOf(closeTag.toLowerCase());
      if (!openMatch || closeIndex === -1) continue;

      const blockFrom = parentStart + childMatch.index;
      const blockTo = blockFrom + childText.length;
      const from = blockFrom + openMatch[0].length;
      const to = blockFrom + closeIndex;
      if (to > from) ranges.push({ from, to, blockFrom, blockTo });
    }
  }

  return ranges;
}

export default function CodeEditor({
  code,
  onChange,
  navigationRequest,
  onSave,
  canSave,
  editable,
  syncKey = "left",
  onFocus,
  viewMode,
  theme,
  editorViewState,
  setEditorViewState,
  xmlDoc,
  onOpenFlowState,
  onOpenScreenForState,
}) {
  const viewRef = useRef(null);
  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const restoreDoneRef = useRef(false);
  const suppressPersistRef = useRef(true);
  const contextMenuRef = useRef(null);
  const handledNavigationSeqRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchState, setSearchState] = useState({
    query: "",
    replaceText: "",
    matchCase: false,
    useRegex: false,
    wholeWord: false,
  });
  const [searchMetrics, setSearchMetrics] = useState({ total: 0, current: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const foldGroups = useMemo(() => getPresentXmlFoldGroups(xmlDoc), [xmlDoc]);

  const getXmlFoldRanges = (group = null) => {
    const source = viewRef.current?.state.doc.toString() || code || "";
    const groups = group ? [group] : foldGroups;
    return groups.flatMap((item) => findXmlChildFoldRanges(source, item));
  };

  const foldXmlRanges = (ranges) => {
    const view = viewRef.current;
    const effects = ranges
      .filter((range) => range?.to > range?.from)
      .map((range) => foldEffect.of({ from: range.from, to: range.to }));
    if (!view || effects.length === 0) return;

    view.dispatch({ effects });
    view.focus();
    setContextMenu(null);
  };

  const unfoldXmlRanges = (ranges) => {
    const view = viewRef.current;
    const effects = ranges
      .filter((range) => range?.to > range?.from)
      .map((range) => unfoldEffect.of({ from: range.from, to: range.to }));
    if (!view || effects.length === 0) return;

    view.dispatch({ effects });
    view.focus();
    setContextMenu(null);
  };

  const hasFoldedXmlRange = (ranges) => {
    const view = viewRef.current;
    if (!view || !ranges.length) return false;

    let hasFolded = false;
    foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
      if (hasFolded) return;
      hasFolded = ranges.some((range) => range.from === from && range.to === to);
    });

    return hasFolded;
  };

  const toggleXmlFoldGroup = (group) => {
    const ranges = getXmlFoldRanges(group);
    if (!ranges.length) return;

    if (hasFoldedXmlRange(ranges)) {
      unfoldXmlRanges(ranges);
      return;
    }

    foldXmlRanges(ranges);
  };

  const openEditorContextMenu = (event) => {
    const view = viewRef.current;
    if (!view) return;

    event.preventDefault();
    event.stopPropagation();

    const pos =
      view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
      view.state.selection.main.from;
    const stateContext = getXmlContextAtPosition(code, pos);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      pos,
      stateContext,
      submenuSide: event.clientX > window.innerWidth - 560 ? "left" : "right",
    });
  };

  const getXmlContextAtPosition = (source, position) => {
    const text = String(source || "");
    const safePos = Math.max(0, Math.min(position ?? 0, text.length));

    const screenOpen = text.lastIndexOf("<Screen", safePos);
    if (screenOpen !== -1) {
      const screenClose = text.indexOf("</Screen>", screenOpen);
      if (screenClose !== -1 && safePos <= screenClose + 9) {
        const screenChunk = text.slice(screenOpen, screenClose + 9);
        const idMatch = screenChunk.match(/<Screen\b[^>]*Id=["']([^"']+)["'][^>]*>/i);
        if (idMatch?.[1]) {
          const resourceMatch = screenChunk.match(
            /<Param\b[^>]*Key=["']Resource["'][^>]*>([^<]*)<\/Param>/i
          );

          return {
            kind: "screen",
            screenId: idMatch[1],
            resource: resourceMatch?.[1]?.trim?.() || "",
          };
        }
      }
    }

    const stateOpen = text.lastIndexOf("<State", safePos);
    if (stateOpen === -1) return null;

    const stateClose = text.indexOf("</State>", stateOpen);
    if (stateClose === -1 || safePos > stateClose + 8) return null;

    const stateChunk = text.slice(stateOpen, stateClose + 8);
    const idMatch = stateChunk.match(/<State\b[^>]*Id=["']([^"']+)["'][^>]*>/i);
    if (!idMatch?.[1]) return null;

    const screenMatch = stateChunk.match(
      /<Param\b[^>]*Key=["']Screen["'][^>]*>([^<]*)<\/Param>/i
    );

    return {
      kind: "state",
      stateId: idMatch[1],
      screenId: screenMatch?.[1]?.trim?.() || "",
    };
  };

  const openSearchWindow = (withReplace = false) => {
    const view = viewRef.current;
    if (!view) return;

    const sel = view.state.selection.main;
    if (sel.from !== sel.to) {
      const selectedText = view.state.doc.sliceString(sel.from, sel.to);
      const nextState = { ...searchState, query: selectedText };
      setSearchState(nextState);
      setShowSearch(true);
      if (withReplace) setShowReplace(true);
      setTimeout(() => {
        applySearch(nextState, { moveToFirst: true });
        (withReplace ? replaceInputRef : searchInputRef).current?.focus();
      }, 0);
      return;
    }

    setShowSearch(true);
    if (withReplace) {
      setShowReplace(true);
      setTimeout(() => replaceInputRef.current?.focus(), 0);
    }
  };

  const buildQuery = (state) =>
    new SearchQuery({
      search: state.query,
      replace: state.replaceText,
      caseSensitive: state.matchCase,
      regexp: state.useRegex,
      wholeWord: state.wholeWord,
    });

  const updateSearchMetrics = (view, query = buildQuery(searchState)) => {
    if (!view || !query.search || !query.valid) {
      setSearchMetrics({ total: 0, current: 0 });
      return;
    }

    const cursor = query.getCursor(view.state);
    const matches = [];
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      matches.push(next.value);
    }

    if (matches.length === 0) {
      setSearchMetrics({ total: 0, current: 0 });
      return;
    }

    const selection = view.state.selection.main;
    let current = matches.findIndex(
      (match) => match.from === selection.from && match.to === selection.to
    );

    if (current === -1) {
      current = matches.findIndex((match) => match.from >= selection.from);
      if (current === -1) current = 0;
    }

    setSearchMetrics({ total: matches.length, current });
  };

  const syncSearchToView = (nextState, options = {}) => {
    const { moveToFirst = true } = options;
    const view = viewRef.current;
    if (!view) return;

    const query = buildQuery(nextState);
    view.dispatch({
      effects: setSearchQuery.of(query),
    });

    if (moveToFirst && query.search && query.valid) {
      const cursor = query.getCursor(view.state);
      const first = cursor.next();
      if (!first.done) {
        view.dispatch({
          selection: EditorSelection.range(first.value.from, first.value.to),
          effects: EditorView.scrollIntoView(first.value.from, { y: "center" }),
        });
      }
    }

    updateSearchMetrics(view, query);
  };

  const applySearch = (nextState, options = {}) => {
    setSearchState(nextState);
    syncSearchToView(nextState, options);
  };

  const nextMatch = () => {
    if (!viewRef.current) return;
    findNext(viewRef.current);
    centerCurrentSelection(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const prevMatch = () => {
    if (!viewRef.current) return;
    findPrevious(viewRef.current);
    centerCurrentSelection(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const replaceCurrent = () => {
    if (!viewRef.current) return;
    replaceNext(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const replaceEveryMatch = () => {
    if (!viewRef.current) return;
    replaceAll(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const selectAllOccurrences = () => {
    if (!viewRef.current) return;
    selectMatches(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const centerCurrentSelection = (view) => {
    if (!view) return;
    const selection = view.state.selection.main;
    view.dispatch({
      selection: EditorSelection.range(selection.from, selection.to),
      effects: EditorView.scrollIntoView(selection.from, { y: "center" }),
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (canSave) onSave();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openSearchWindow(false);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        openSearchWindow(true);
      }

      if (e.key === "F3") {
        e.preventDefault();
        e.shiftKey ? prevMatch() : nextMatch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSave, onSave, searchState]);

  const navigateToRequest = (request) => {
    const view = viewRef.current;
    if (!request || !view) return;
    if (viewMode !== "code") return;
    if (request.target && request.target !== syncKey) return;
    const pos = Number(request.pos);
    if (!Number.isFinite(pos)) return;

    suppressPersistRef.current = true;
    restoreDoneRef.current = true;

    requestAnimationFrame(() => {
      const activeView = viewRef.current;
      if (!activeView) return;

      activeView.focus();
      activeView.dispatch({
        selection: EditorSelection.single(pos),
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });

      requestAnimationFrame(() => {
        const settledView = viewRef.current;
        if (!settledView) return;

        handledNavigationSeqRef.current = request.seq;
        suppressPersistRef.current = false;
        if (typeof setEditorViewState !== "function") return;

        setEditorViewState((prev) => ({
          ...(prev || {}),
          cursor: pos,
          scrollTop: settledView.scrollDOM.scrollTop,
          syncKey,
        }));
      });
    });
  };

  const tryConsumeNavigationRequest = (request) => {
    if (!request?.seq) return false;
    if (handledNavigationSeqRef.current === request.seq) return true;
    if (!viewRef.current) return false;
    navigateToRequest(request);
    return true;
  };

  useEffect(() => {
    tryConsumeNavigationRequest(navigationRequest);
  }, [navigationRequest?.seq, navigationRequest?.pos, syncKey, viewMode]);

  useEffect(() => {
    restoreDoneRef.current = false;
    suppressPersistRef.current = true;
  }, [syncKey, code]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) setFontSize((s) => Math.min(26, s + 1));
        else setFontSize((s) => Math.max(8, s - 1));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [showSearch]);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!contextMenuRef.current) return;
      if (contextMenuRef.current.contains(event.target)) return;
      setContextMenu(null);
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!showSearch || !viewRef.current) return;
    syncSearchToView(searchState, { moveToFirst: false });
  }, [
    showSearch,
    searchState.query,
    searchState.matchCase,
    searchState.useRegex,
    searchState.wholeWord,
  ]);

  const fontSizeTheme = useMemo(
    () =>
      EditorView.theme(
        {
          ".cm-scroller": { fontSize: `${fontSize}px` },
        },
        { dark: true }
      ),
    [fontSize]
  );

  useEffect(() => {
    if (!viewRef.current) return;

    const dom = viewRef.current.dom;
    const handleFocus = () => {
      if (typeof onFocus === "function") onFocus(syncKey);
    };

    dom.addEventListener("focusin", handleFocus);
    return () => dom.removeEventListener("focusin", handleFocus);
  }, [onFocus, syncKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || restoreDoneRef.current) return;
    if (viewMode !== "code") return;
    if (
      navigationRequest?.seq &&
      handledNavigationSeqRef.current !== navigationRequest.seq
    ) return;

    const nextCursor = Number(editorViewState?.cursor ?? 0);
    const nextScrollTop = Number(editorViewState?.scrollTop ?? 0);
    const targetKey = editorViewState?.syncKey;
    if (targetKey && targetKey !== syncKey) return;

    const safeCursor = Math.max(0, Math.min(nextCursor, view.state.doc.length));

    requestAnimationFrame(() => {
      if (!viewRef.current || restoreDoneRef.current) return;

      view.dispatch({
        selection: EditorSelection.single(safeCursor),
        effects: EditorView.scrollIntoView(safeCursor, { y: "center" }),
      });
      view.scrollDOM.scrollTop = Math.max(0, nextScrollTop);
      restoreDoneRef.current = true;
      requestAnimationFrame(() => {
        suppressPersistRef.current = false;
      });
    });
  }, [editorViewState, syncKey, viewMode, code, navigationRequest]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const handleContextMenu = (event) => {
      openEditorContextMenu(event);
    };

    view.dom.addEventListener("contextmenu", handleContextMenu, true);
    return () => view.dom.removeEventListener("contextmenu", handleContextMenu, true);
  }, [code]);

  return (
    <div
      className="editor-container"
      onContextMenuCapture={(event) => {
        openEditorContextMenu(event);
      }}
    >
      {showSearch && (
        <SearchBar
          query={searchState.query}
          replaceText={searchState.replaceText}
          matchCase={searchState.matchCase}
          useRegex={searchState.useRegex}
          wholeWord={searchState.wholeWord}
          showReplace={showReplace}
          total={searchMetrics.total}
          current={searchMetrics.current}
          inputRef={searchInputRef}
          replaceInputRef={replaceInputRef}
          onQueryChange={(value) => setSearchState({ ...searchState, query: value })}
          onReplaceTextChange={(value) => {
            const next = { ...searchState, replaceText: value };
            setSearchState(next);
          }}
          onToggleReplace={() => setShowReplace((prev) => !prev)}
          onToggleMatchCase={() =>
            setSearchState({ ...searchState, matchCase: !searchState.matchCase })
          }
          onToggleRegex={() =>
            setSearchState({ ...searchState, useRegex: !searchState.useRegex })
          }
          onToggleWholeWord={() =>
            setSearchState({ ...searchState, wholeWord: !searchState.wholeWord })
          }
          onNext={nextMatch}
          onPrev={prevMatch}
          onReplaceOne={replaceCurrent}
          onReplaceAll={replaceEveryMatch}
          onSelectAll={selectAllOccurrences}
          onClose={() => {
            setShowSearch(false);
            setShowReplace(false);
          }}
          theme={theme}
        />
      )}

      <CodeMirror
        value={code}
        height="100%"
        theme={theme === "dark" ? evaXmlDark : notepadPlus}
        extensions={[
          xml(),
          fontSizeTheme,
          search({ top: true }),
          EditorView.domEventHandlers({
            keydown: (_, event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
                event.preventDefault();
                openSearchWindow(false);
                return true;
              }

              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {
                event.preventDefault();
                openSearchWindow(true);
                return true;
              }

              if (event.key === "F3") {
                event.preventDefault();
                event.shiftKey ? prevMatch() : nextMatch();
                return true;
              }

              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet) {
              updateSearchMetrics(update.view);
            }

            if (
              typeof setEditorViewState === "function" &&
              !suppressPersistRef.current &&
              (update.selectionSet || update.docChanged || update.viewportChanged)
            ) {
              const nextCursor = update.state.selection.main.from;
              const nextScrollTop = update.view.scrollDOM.scrollTop;

              setEditorViewState((prev) => {
                if (
                  prev?.cursor === nextCursor &&
                  prev?.scrollTop === nextScrollTop &&
                  prev?.syncKey === syncKey
                ) {
                  return prev;
                }

                return {
                  ...(prev || {}),
                  cursor: nextCursor,
                  scrollTop: nextScrollTop,
                  syncKey,
                };
              });
            }
          }),
        ]}
        basicSetup={{
          highlightSelectionMatches: true,
          searchKeymap: false,
        }}
        editable={editable}
        className={`editor-code ${!editable ? "read-only" : ""}`}
        onChange={(val) => editable && onChange(val)}
        onCreateEditor={(view) => {
          viewRef.current = view;
          view.dispatch({
            effects: setSearchQuery.of(buildQuery(searchState)),
          });
          updateSearchMetrics(view, buildQuery(searchState));
          tryConsumeNavigationRequest(navigationRequest);
        }}
      />

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={`editor-context-menu ${
            contextMenu.submenuSide === "left" ? "submenu-left" : ""
          }`}
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 280),
            top: Math.min(contextMenu.y, window.innerHeight - 240),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="editor-context-item"
            onClick={async () => {
              const view = viewRef.current;
              if (!view) return;
              const selection = view.state.selection.main;
              const text = view.state.doc.sliceString(selection.from, selection.to);
              if (text) {
                await navigator.clipboard.writeText(text);
              }
              setContextMenu(null);
            }}
          >
            <FaCopy />
            Copiar
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={async () => {
              const view = viewRef.current;
              if (!view) return;
              const text = await navigator.clipboard.readText();
              const selection = view.state.selection.main;
              view.dispatch({
                changes: { from: selection.from, to: selection.to, insert: text },
                selection: EditorSelection.single(selection.from + text.length),
              });
              setContextMenu(null);
            }}
          >
            <MdContentPaste />
            Pegar
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              const view = viewRef.current;
              if (!view) return;
              view.dispatch({
                selection: EditorSelection.single(0, view.state.doc.length),
              });
              setContextMenu(null);
            }}
          >
            <MdOutlineSelectAll />
            Seleccionar todo
          </button>
          <button
            type="button"
            className="editor-context-item"
            onClick={() => {
              setContextMenu(null);
              openSearchWindow(false);
            }}
          >
            <FaSearch />
            Buscar...
          </button>

          {foldGroups.length ? (
            <>
              <div className="editor-context-separator" />
              <div className="editor-context-submenu-wrap">
                <button type="button" className="editor-context-item editor-context-submenu-trigger">
                  <span>Plegar / Desplegar</span>
                  <small>{">"}</small>
                </button>
                <div className="editor-context-submenu">
                  {foldGroups.map((group) => (
                    <button
                      type="button"
                      className="editor-context-item editor-fold-group"
                      key={`${group.parentTag}-${group.childTag}`}
                      onClick={() => toggleXmlFoldGroup(group)}
                      title={`Plegar o desplegar ${group.label}`}
                    >
                      <span>{group.label}</span>
                      <small>{group.count}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {contextMenu.stateContext?.stateId ? (
            <>
              <div className="editor-context-separator" />
              <button
                type="button"
                className="editor-context-item"
                onClick={() => {
                  onOpenFlowState?.(contextMenu.stateContext.stateId);
                  setContextMenu(null);
                }}
              >
                <FaProjectDiagram />
                Ir al flujo
              </button>
              {contextMenu.stateContext.screenId ? (
                <button
                  type="button"
                  className="editor-context-item"
                  onClick={() => {
                    onOpenScreenForState?.(contextMenu.stateContext.stateId);
                    setContextMenu(null);
                  }}
                >
                  <MdOutlineSmartDisplay />
                  Abrir pantalla
                </button>
              ) : null}
            </>
          ) : null}

          {contextMenu.stateContext?.kind === "screen" && contextMenu.stateContext.screenId ? (
            <>
              <div className="editor-context-separator" />
              <button
                type="button"
                className="editor-context-item"
                onClick={() => {
                  onOpenScreenForState?.({ screenId: contextMenu.stateContext.screenId });
                  setContextMenu(null);
                }}
              >
                <MdOutlineSmartDisplay />
                Abrir pantalla
              </button>
            </>
          ) : null}
        </div>
      )}

      <div className="editor-fontsize">
        <button
          onClick={() => setFontSize((s) => Math.min(26, s + 2))}
          title="Aumentar tamaño"
        >
          <FaSearchPlus />
        </button>
        <button
          onClick={() => setFontSize((s) => Math.max(8, s - 2))}
          title="Disminuir tamaño"
        >
          <FaSearchMinus />
        </button>
        <button onClick={() => setFontSize(15)} title="Restablecer tamaño">
          <FaRedo />
        </button>
      </div>
    </div>
  );
}
