import React, { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { EditorSelection, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, keymap } from "@codemirror/view";
import { xml } from "@codemirror/lang-xml";
import { foldEffect, foldedRanges, unfoldEffect } from "@codemirror/language";
import { autocompletion, nextSnippetField, prevSnippetField, snippet } from "@codemirror/autocomplete";
import { indentLess, indentMore } from "@codemirror/commands";
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
import { EVA_SNIPPET_DEFINITIONS } from "../../utils/evaSnippetData";
import "./CodeEditor.css";

const NAVIGABLE_XML_CONTAINER_TAGS = ["State", "Screen", "Fit", "Tran", "TranMap", "Error"];
const NAVIGABLE_XML_FALLBACK_TAGS = ["Param"];

function findCurrentXmlElementRange(docText, cursorPos) {
  const safePos = Math.max(0, Math.min(cursorPos ?? 0, docText.length));

  const findRangeForTags = (tags) => {
    const beforeCursor = docText.slice(0, safePos + 1);
    const candidates = tags
      .map((tag) => {
        const open = beforeCursor.lastIndexOf(`<${tag}`);
        return open === -1 ? null : { tag, open };
      })
      .filter(Boolean)
      .sort((a, b) => b.open - a.open);

    for (const candidate of candidates) {
      const charAfter = docText[candidate.open + candidate.tag.length + 1] ?? "";
      if (!/[\s>/]/.test(charAfter)) continue;

      const openEnd = docText.indexOf(">", candidate.open);
      if (openEnd === -1 || /\/\s*>$/.test(docText.slice(candidate.open, openEnd + 1))) {
        continue;
      }

      const closeTag = `</${candidate.tag}>`;
      const close = docText.indexOf(closeTag, openEnd + 1);
      if (close === -1) continue;

      const elementEnd = close + closeTag.length;
      if (safePos <= elementEnd) {
        return { from: candidate.open, to: elementEnd, tag: candidate.tag };
      }
    }

    return null;
  };

  return findRangeForTags(NAVIGABLE_XML_CONTAINER_TAGS) || findRangeForTags(NAVIGABLE_XML_FALLBACK_TAGS);
}

function findAllNavigableRanges(docText, stateFrom, stateTo) {
  const stateText = docText.slice(stateFrom, stateTo);
  const ranges = [];

  // 1. Attribute values from the opening tag <State Id="..." Comment="...">
  const openTagMatch = stateText.match(/^<[A-Za-z]\w*\b([^>]*)>/);
  if (openTagMatch) {
    const tagName = openTagMatch[0].match(/^<([A-Za-z]\w*)/)?.[1] || "";
    const attrsStr = openTagMatch[1];
    const attrOffset = openTagMatch[0].length - 1 - attrsStr.length;
    const attrPattern = /\b(\w+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = attrPattern.exec(attrsStr)) !== null) {
      if (tagName === "Param" && m[1] === "Key") continue;
      const value = m[2];
      if (!value) continue;
      const quoteOffset = m[0].indexOf('"') + 1;
      const from = stateFrom + attrOffset + m.index + quoteOffset;
      ranges.push({ from, to: from + value.length });
    }
  }

  // 2. Param element values <Param Key="...">VALUE</Param>
  const paramPattern = /<Param\b[^>]*>([^<]*)<\/Param>/g;
  let paramMatch;
  while ((paramMatch = paramPattern.exec(stateText)) !== null) {
    const rawValue = paramMatch[1];
    const pOpenTagEnd = paramMatch[0].indexOf('>');
    const absValueStart = stateFrom + paramMatch.index + pOpenTagEnd + 1;
    const trimmed = rawValue.trim();
    const leadingLen = trimmed ? rawValue.search(/\S/) : 0;
    const from = absValueStart + Math.max(0, leadingLen);
    ranges.push({ from, to: from + trimmed.length });
  }

  return ranges;
}

function navigateXmlParamValues(view, direction) {
  const docText = view.state.doc.toString();
  const sel = view.state.selection.main;
  const cursorPos = sel.head;
  const elementRange = findCurrentXmlElementRange(docText, cursorPos);
  if (!elementRange) return false;
  const valueRanges = findAllNavigableRanges(docText, elementRange.from, elementRange.to);
  if (!valueRanges.length) return false;
  const currentIndex = valueRanges.findIndex(
    (r) => (sel.from === r.from && sel.to === r.to) || (cursorPos >= r.from && cursorPos <= r.to)
  );
  if (currentIndex === -1) return false;
  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % valueRanges.length
      : (currentIndex - 1 + valueRanges.length) % valueRanges.length;
  const target = valueRanges[nextIndex];
  view.dispatch({
    selection: EditorSelection.range(target.from, target.to),
    effects: EditorView.scrollIntoView(target.from, { y: 'nearest' }),
  });
  return true;
}

const snippetNavigationKeymap = Prec.highest(
  keymap.of([
    { key: "Tab", run: (view) => nextSnippetField(view) || navigateXmlParamValues(view, 'next') || indentMore(view) },
    { key: "Shift-Tab", run: (view) => prevSnippetField(view) || navigateXmlParamValues(view, 'prev') || indentLess(view) },
  ])
);

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

function makeSnippetCompletion({ label, detail, info, type = "snippet", template, tagTemplate }) {
  const normalizeSnippetFields = (source) => {
    let fieldIndex = 1;
    return String(source || "").replace(/\$\{([A-Za-z_][\w.-]*)\}/g, (_, name) => {
      return `\${${fieldIndex++}:${name}}`;
    });
  };

  return {
    label,
    type,
    detail,
    info,
    boost: 4,
    apply: (view, completion, from, to) => {
      const before = view.state.doc.sliceString(Math.max(0, from - 1), from);
      const useTemplate = before === "<" && tagTemplate ? tagTemplate : template;
      snippet(normalizeSnippetFields(useTemplate))(view, completion, from, to);
    },
  };
}

function normalizeCompletionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getFuzzyScore(query, option) {
  const normalizedQuery = normalizeCompletionText(query);
  if (!normalizedQuery) return 0;

  const label = normalizeCompletionText(option.label);
  const detail = normalizeCompletionText(option.detail);
  const searchable = `${label}${detail}`;

  if (label.startsWith(normalizedQuery)) return 120 - label.length;
  if (label.includes(normalizedQuery)) return 90 - label.indexOf(normalizedQuery);

  let cursor = 0;
  let score = 0;
  for (const char of normalizedQuery) {
    const foundAt = searchable.indexOf(char, cursor);
    if (foundAt === -1) return Number.NEGATIVE_INFINITY;
    score += foundAt === cursor ? 4 : 1;
    cursor = foundAt + 1;
  }

  return score;
}

const USER_SNIPPETS_KEY = "eva_user_snippets";
const SYSTEM_OVERRIDES_KEY = "eva_system_snippet_overrides";

function loadSystemOverrides() {
  try {
    const raw = localStorage.getItem(SYSTEM_OVERRIDES_KEY);
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function loadUserSnippets() {
  try {
    const raw = localStorage.getItem(USER_SNIPPETS_KEY);
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s?.label && s?.template)
      .map((s) =>
        makeSnippetCompletion({
          label: s.label,
          detail: s.detail || "Snippet",
          template: s.template,
        })
      );
  } catch {
    return [];
  }
}

function getFilteredXmlSnippets(query, systemSnippets, userSnippets = []) {
  const all = [...systemSnippets, ...userSnippets];
  if (!query) return all;

  const matches = all
    .map((option) => ({
      option,
      score: getFuzzyScore(query, option),
    }))
    .filter((item) => item.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score)
    .map(({ option, score }) => ({
      ...option,
      boost: score,
    }));

  return matches.length ? matches : all;
}

const EVA_XML_SNIPPETS = EVA_SNIPPET_DEFINITIONS.map(makeSnippetCompletion);

const PREVIEW_PRIORITY_KEYS = ["Screen", "GoodState", "ErrorState", "TimeoutState", "CancelState", "Buffer", "BuffName", "BuffValue", "OperCodeKey", "NextStateContinue"];

function createEvaXmlCompletionSource({ automaticMinLength = 3, systemSnippets = EVA_XML_SNIPPETS, userSnippets = [] } = {}) {
  return (context) => {
    const word = context.matchBefore(/[A-Za-z0-9_:-]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    const query = context.state.doc.sliceString(word.from, word.to);
    if (!context.explicit && query.length < automaticMinLength) return null;

    return {
      from: word.from,
      options: getFilteredXmlSnippets(query, systemSnippets, userSnippets),
      filter: false,
    };
  };
}

function findXmlDefinitionPosition(source, kind, id) {
  const escapedId = escapeRegex(id);
  const tag = kind === "screen" ? "Screen" : "State";
  const pattern = new RegExp(`<${tag}\\b[^>]*Id=["']${escapedId}["'][^>]*>`, "i");
  const match = String(source || "").match(pattern);
  return match?.index ?? null;
}

function getXmlReferenceAtPosition(source, position) {
  const text = String(source || "");
  const safePos = Math.max(0, Math.min(position ?? 0, text.length));
  const paramPattern = /<Param\b[^>]*Key=["']([^"']+)["'][^>]*>([^<]*)<\/Param>/gi;
  let match;

  while ((match = paramPattern.exec(text))) {
    const full = match[0];
    const key = match[1];
    const value = match[2]?.trim?.() || "";
    if (!value) continue;

    const valueStartInMatch = full.indexOf(match[2]);
    const valueFrom = match.index + valueStartInMatch;
    const leadingSpace = match[2].search(/\S/);
    const trimmedFrom = valueFrom + Math.max(0, leadingSpace);
    const trimmedTo = trimmedFrom + value.length;
    const linkFrom = match.index;
    const linkTo = match.index + full.length;
    if (safePos < linkFrom || safePos > linkTo) continue;

    if (/Screen/i.test(key)) {
      return { kind: "screen", id: value, from: linkFrom, to: linkTo };
    }

    if (/State/i.test(key) || /^(Chip|Track)$/i.test(key)) {
      return { kind: "state", id: value, from: linkFrom, to: linkTo };
    }
  }

  return null;
}

const xmlReferenceLinkEffect = StateEffect.define();

const xmlReferenceLinkDecoration = Decoration.mark({
  class: "cm-xml-reference-link",
});

const xmlReferenceLinkField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(xmlReferenceLinkEffect)) {
        const range = effect.value;
        next = range ? Decoration.set([xmlReferenceLinkDecoration.range(range.from, range.to)]) : Decoration.none;
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function createXmlReferenceLinkHover(onPreviewRef, previewEnabledRef) {
  let lastPointer = null;

  const setReferenceLink = (view, pointer, active) => {
    if (!active || !pointer) {
      view.dispatch({ effects: xmlReferenceLinkEffect.of(null) });
      onPreviewRef?.current?.(null);
      return;
    }

    const pos = view.posAtCoords(pointer);
    const reference = pos == null ? null : getXmlReferenceAtPosition(view.state.doc.toString(), pos);
    view.dispatch({
      effects: xmlReferenceLinkEffect.of(reference ? { from: reference.from, to: reference.to } : null),
    });
    onPreviewRef?.current?.(reference && previewEnabledRef?.current !== false ? { reference, x: pointer.x, y: pointer.y } : null);
  };

  const clearReferenceLink = (_, view) => {
    view.dispatch({ effects: xmlReferenceLinkEffect.of(null) });
    onPreviewRef?.current?.(null);
  };

  return EditorView.domEventHandlers({
    mousemove: (event, view) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      setReferenceLink(view, lastPointer, event.ctrlKey || event.metaKey);
      return false;
    },
    mouseleave: clearReferenceLink,
    keydown: (event, view) => {
      if (event.key === "Control" || event.key === "Meta") {
        setReferenceLink(view, lastPointer, true);
      }
      return false;
    },
    keyup: (event, view) => {
      if (event.key === "Control" || event.key === "Meta") clearReferenceLink(event, view);
      return false;
    },
    blur: clearReferenceLink,
  });
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
  splitView = false,
  xmlDoc,
  onOpenFlowState,
  onOpenScreenForState,
  suggestionSettings,
}) {
  const viewRef = useRef(null);
  const searchInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const restoreDoneRef = useRef(false);
  const suppressPersistRef = useRef(true);
  const contextMenuRef = useRef(null);
  const handledNavigationSeqRef = useRef(null);
  const scrollPersistFrameRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);
  const [showSearch, setShowSearch] = useState(false);
  const [userSnippets, setUserSnippets] = useState(() => loadUserSnippets());
  const [systemOverrides, setSystemOverrides] = useState(() => loadSystemOverrides());
  const [ctrlPreview, setCtrlPreview] = useState(null);
  const ctrlPreviewRef = useRef(null);
  ctrlPreviewRef.current = setCtrlPreview;
  const statePreviewEnabled = suggestionSettings?.statePreview !== false;
  const statePreviewEnabledRef = useRef(true);
  statePreviewEnabledRef.current = statePreviewEnabled;

  useEffect(() => {
    const reload = () => {
      setUserSnippets(loadUserSnippets());
      setSystemOverrides(loadSystemOverrides());
    };
    window.addEventListener("eva-snippets-updated", reload);
    return () => window.removeEventListener("eva-snippets-updated", reload);
  }, []);
  const [showReplace, setShowReplace] = useState(false);
  const [searchState, setSearchState] = useState({
    query: "",
    replaceText: "",
    matchCase: false,
    wholeWord: false,
  });
  const [searchMetrics, setSearchMetrics] = useState({ total: 0, current: 0, allSelected: false });
  const [contextMenu, setContextMenu] = useState(null);
  const [foldSubmenuOpen, setFoldSubmenuOpen] = useState(false);
  const foldGroups = useMemo(() => getPresentXmlFoldGroups(xmlDoc), [xmlDoc]);
  const activateSuggestionsOnTyping = suggestionSettings?.activation !== "manual";

  useEffect(() => {
    if (!statePreviewEnabled) setCtrlPreview(null);
  }, [statePreviewEnabled]);

  const getSavedViewState = (state = editorViewState) => {
    const keyedState = state?.editors?.[syncKey];
    if (keyedState) {
      return {
        cursor: Number(keyedState.cursor ?? 0),
        scrollTop: Number(keyedState.scrollTop ?? 0),
        scrollLeft: Number(keyedState.scrollLeft ?? 0),
      };
    }

    if (splitView && state?.syncKey && state.syncKey !== syncKey) return null;

    return {
      cursor: Number(state?.cursor ?? 0),
      scrollTop: Number(state?.scrollTop ?? 0),
      scrollLeft: Number(state?.scrollLeft ?? 0),
    };
  };

  const persistCurrentViewState = (view, extra = {}) => {
    if (!view || typeof setEditorViewState !== "function") return;

    const nextCursor = view.state.selection.main.from;
    const nextScrollTop = view.scrollDOM.scrollTop;
    const nextScrollLeft = view.scrollDOM.scrollLeft;

    setEditorViewState((prev) => {
      const prevEditors = prev?.editors || {};
      const prevKeyState = prevEditors[syncKey] || {};
      const nextKeyState = {
        ...prevKeyState,
        cursor: nextCursor,
        scrollTop: nextScrollTop,
        scrollLeft: nextScrollLeft,
      };
      const nextLastNavSeq = extra.lastNavSeq ?? prev?.lastNavSeq;

      if (
        prev?.cursor === nextCursor &&
        prev?.scrollTop === nextScrollTop &&
        prev?.scrollLeft === nextScrollLeft &&
        prev?.syncKey === syncKey &&
        prev?.lastNavSeq === nextLastNavSeq &&
        prevKeyState.cursor === nextCursor &&
        prevKeyState.scrollTop === nextScrollTop &&
        prevKeyState.scrollLeft === nextScrollLeft
      ) {
        return prev;
      }

      return {
        ...(prev || {}),
        cursor: nextCursor,
        scrollTop: nextScrollTop,
        scrollLeft: nextScrollLeft,
        syncKey,
        lastNavSeq: nextLastNavSeq,
        editors: {
          ...prevEditors,
          [syncKey]: nextKeyState,
        },
      };
    });
  };

  const finishRestoreCycle = () => {
    restoreDoneRef.current = true;
    requestAnimationFrame(() => {
      suppressPersistRef.current = false;
    });
  };

  const restoreSavedViewState = (view) => {
    if (!view || viewMode !== "code" || restoreDoneRef.current) return false;

    const savedState = getSavedViewState();
    if (!savedState) {
      finishRestoreCycle();
      return false;
    }

    const nextCursor = Number(savedState.cursor ?? 0);
    const nextScrollTop = Number(savedState.scrollTop ?? 0);
    const nextScrollLeft = Number(savedState.scrollLeft ?? 0);
    const safeCursor = Math.max(0, Math.min(nextCursor, view.state.doc.length));

    requestAnimationFrame(() => {
      const activeView = viewRef.current;
      if (!activeView || restoreDoneRef.current) return;

      activeView.dispatch({
        selection: EditorSelection.single(safeCursor),
        effects: EditorView.scrollIntoView(safeCursor, { y: "center" }),
      });
      requestAnimationFrame(() => {
        const settledView = viewRef.current;
        if (!settledView || restoreDoneRef.current) return;
        settledView.scrollDOM.scrollTop = Math.max(0, nextScrollTop);
        settledView.scrollDOM.scrollLeft = Math.max(0, nextScrollLeft);
        finishRestoreCycle();
      });
    });

    return true;
  };

  const isNavigationPendingForEditor = (request) => {
    if (!request?.seq) return false;
    if (request.target && request.target !== syncKey) return false;
    if (handledNavigationSeqRef.current === request.seq) return false;
    if (editorViewState?.lastNavSeq === request.seq) return false;
    return true;
  };

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
    setFoldSubmenuOpen(false);
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
      regexp: false,
      wholeWord: state.wholeWord,
    });

  const updateSearchMetrics = (view, query = buildQuery(searchState)) => {
    if (!view || !query.search || !query.valid) {
      setSearchMetrics({ total: 0, current: 0, allSelected: false });
      return;
    }

    const cursor = query.getCursor(view.state);
    const matches = [];
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
      matches.push(next.value);
    }

    if (matches.length === 0) {
      setSearchMetrics({ total: 0, current: 0, allSelected: false });
      return;
    }

    const selection = view.state.selection.main;
    const selectionRanges = view.state.selection.ranges;
    const allSelected =
      selectionRanges.length === matches.length &&
      matches.every((match, index) => {
        const range = selectionRanges[index];
        return range?.from === match.from && range?.to === match.to;
      });
    let current = matches.findIndex(
      (match) => match.from === selection.from && match.to === selection.to
    );

    if (current === -1) {
      current = matches.findIndex((match) => match.from >= selection.from);
      if (current === -1) current = 0;
    }

    setSearchMetrics({ total: matches.length, current, allSelected });
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
    syncSearchToView(searchState, { moveToFirst: false });
    replaceNext(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const replaceEveryMatch = () => {
    if (!viewRef.current) return;
    syncSearchToView(searchState, { moveToFirst: false });
    replaceAll(viewRef.current);
    updateSearchMetrics(viewRef.current);
  };

  const selectAllOccurrences = () => {
    if (!viewRef.current) return;
    if (searchMetrics.allSelected) {
      const selection = viewRef.current.state.selection.main;
      viewRef.current.dispatch({
        selection: EditorSelection.single(selection.from),
      });
      updateSearchMetrics(viewRef.current);
      return;
    }
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

  const jumpToXmlReference = (view, reference) => {
    if (!view || !reference?.id) return false;

    const source = view.state.doc.toString();
    const targetPos = findXmlDefinitionPosition(source, reference.kind, reference.id);
    if (targetPos == null) return false;

    suppressPersistRef.current = true;
    restoreDoneRef.current = true;
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(targetPos),
      effects: EditorView.scrollIntoView(targetPos, { y: "center" }),
    });

    requestAnimationFrame(() => {
      suppressPersistRef.current = false;
      persistCurrentViewState(view);
    });

    return true;
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
        persistCurrentViewState(settledView, { lastNavSeq: request.seq });
      });
    });
  };

  const tryConsumeNavigationRequest = (request) => {
    if (!request?.seq) return false;
    if (handledNavigationSeqRef.current === request.seq) return false;
    if (editorViewState?.lastNavSeq === request.seq) {
      handledNavigationSeqRef.current = request.seq;
      return false;
    }
    if (request.target && request.target !== syncKey) return false;
    if (!viewRef.current) return false;
    navigateToRequest(request);
    return true;
  };

  useEffect(() => {
    tryConsumeNavigationRequest(navigationRequest);
  }, [navigationRequest?.seq, navigationRequest?.pos, editorViewState?.lastNavSeq, syncKey, viewMode]);

  useEffect(() => {
    restoreDoneRef.current = false;
    suppressPersistRef.current = true;
  }, [syncKey]);

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
      setFoldSubmenuOpen(false);
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        setFoldSubmenuOpen(false);
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
    searchState.replaceText,
    searchState.matchCase,
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
  const effectiveSystemSnippets = useMemo(() => {
    if (Object.keys(systemOverrides).length === 0) return EVA_XML_SNIPPETS;
    return EVA_SNIPPET_DEFINITIONS.map((def) => {
      const ov = systemOverrides[def.label];
      return makeSnippetCompletion(ov ? { ...def, ...ov } : def);
    });
  }, [systemOverrides]);

  const evaXmlAutocomplete = useMemo(
    () =>
      autocompletion({
        override: [createEvaXmlCompletionSource({ automaticMinLength: 3, systemSnippets: effectiveSystemSnippets, userSnippets })],
        activateOnTyping: activateSuggestionsOnTyping,
        maxRenderedOptions: 14,
        tooltipClass: () => "eva-xml-completion",
      }),
    [activateSuggestionsOnTyping, userSnippets, effectiveSystemSnippets]
  );

  const xmlRefHoverExt = useMemo(() => createXmlReferenceLinkHover(ctrlPreviewRef, statePreviewEnabledRef), []);

  const ctrlPreviewInfo = useMemo(() => {
    if (!statePreviewEnabled || !ctrlPreview || !xmlDoc) return null;
    const { reference, x, y } = ctrlPreview;

    if (reference.kind === "state") {
      const node = Array.from(xmlDoc.querySelectorAll("States > State")).find(
        (el) => el.getAttribute("Id") === reference.id
      );
      if (!node) return null;
      const allParams = Array.from(node.querySelectorAll("Param")).map((p) => [
        p.getAttribute("Key") || "",
        p.textContent?.trim() || "",
      ]);
      const prioritized = PREVIEW_PRIORITY_KEYS.flatMap((k) => {
        const match = allParams.find(([key]) => key === k);
        return match ? [match] : [];
      });
      const rest = allParams.filter(([k]) => !PREVIEW_PRIORITY_KEYS.includes(k));
      const params = [...prioritized, ...rest].slice(0, 6);
      return { kind: "state", id: reference.id, type: node.getAttribute("Type") || "-", comment: node.getAttribute("Comment") || "", params, x, y };
    }

    if (reference.kind === "screen") {
      const node = Array.from(xmlDoc.querySelectorAll("Screens > Screen")).find(
        (el) => el.getAttribute("Id") === reference.id
      );
      if (!node) return null;
      const resource = node.querySelector("Param[Key='Resource']")?.textContent?.trim() || "";
      const comment = node.getAttribute("Comment") || "";
      return { kind: "screen", id: reference.id, comment, resource, x, y };
    }

    return null;
  }, [statePreviewEnabled, ctrlPreview, xmlDoc]);

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
    return () => {
      if (scrollPersistFrameRef.current != null) {
        cancelAnimationFrame(scrollPersistFrameRef.current);
        scrollPersistFrameRef.current = null;
      }
      const view = viewRef.current;
      if (!view || suppressPersistRef.current) return;
      persistCurrentViewState(view);
    };
  }, [setEditorViewState, syncKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const handleScroll = () => {
      if (suppressPersistRef.current) return;
      if (scrollPersistFrameRef.current != null) return;

      scrollPersistFrameRef.current = requestAnimationFrame(() => {
        scrollPersistFrameRef.current = null;
        persistCurrentViewState(view);
      });
    };

    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      if (scrollPersistFrameRef.current != null) {
        cancelAnimationFrame(scrollPersistFrameRef.current);
        scrollPersistFrameRef.current = null;
      }
    };
  }, [setEditorViewState, syncKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || restoreDoneRef.current) return;
    if (viewMode !== "code") return;
    if (isNavigationPendingForEditor(navigationRequest)) return;
    restoreSavedViewState(view);
  }, [editorViewState, syncKey, viewMode, navigationRequest]);

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
          wholeWord={searchState.wholeWord}
          showReplace={showReplace}
          total={searchMetrics.total}
          current={searchMetrics.current}
          selectAllActive={searchMetrics.allSelected}
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
          snippetNavigationKeymap,
          xml(),
          fontSizeTheme,
          xmlReferenceLinkField,
          xmlRefHoverExt,
          evaXmlAutocomplete,
          search({ top: true }),
          EditorView.domEventHandlers({
            mousedown: (event, view) => {
              if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;

              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos == null) return false;

              const reference = getXmlReferenceAtPosition(view.state.doc.toString(), pos);
              if (!reference) return false;

              event.preventDefault();
              event.stopPropagation();
              jumpToXmlReference(view, reference);
              return true;
            },
            keydown: (event) => {
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
              persistCurrentViewState(update.view);
            }
          }),
        ]}
        basicSetup={{
          highlightSelectionMatches: true,
          autocompletion: false,
          searchKeymap: false,
          indentWithTab: false,
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
          const navigationStarted = tryConsumeNavigationRequest(navigationRequest);
          if (!navigationStarted) restoreSavedViewState(view);
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
              <div
                className={`editor-context-submenu-wrap ${foldSubmenuOpen ? "open" : ""}`}
                onMouseEnter={() => setFoldSubmenuOpen(true)}
              >
                <button type="button" className="editor-context-item editor-context-submenu-trigger">
                  <span>Plegar / Desplegar</span>
                  <small>{">"}</small>
                </button>
                <div className="editor-context-submenu">
                  <button
                    type="button"
                    className="editor-context-item editor-fold-group"
                    onClick={() => toggleXmlFoldGroup()}
                    title="Plegar o desplegar todos los bloques XML"
                  >
                    <span>Todos</span>
                    <small>{foldGroups.reduce((total, group) => total + group.count, 0)}</small>
                  </button>
                  <div className="editor-context-separator compact" />
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

      {ctrlPreviewInfo && (() => {
        const PANEL_W = 280;
        const PANEL_OFFSET_X = 18;
        const PANEL_OFFSET_Y = 22;
        const left = Math.min(
          Math.max(8, ctrlPreviewInfo.x + PANEL_OFFSET_X),
          window.innerWidth - PANEL_W - 8
        );
        const top = Math.min(
          Math.max(8, ctrlPreviewInfo.y + PANEL_OFFSET_Y),
          window.innerHeight - 60
        );
        return (
          <div
            className="cm-ctrl-preview"
            style={{ left, top, width: PANEL_W }}
          >
            <div className="cm-ctrl-preview-head">
              <strong>
                {ctrlPreviewInfo.kind === "state"
                  ? (ctrlPreviewInfo.comment || `State ${ctrlPreviewInfo.id}`)
                  : (ctrlPreviewInfo.comment || `Screen ${ctrlPreviewInfo.id}`)}
              </strong>
              <span>
                {ctrlPreviewInfo.kind === "state"
                  ? `State ${ctrlPreviewInfo.id} · ${ctrlPreviewInfo.type}`
                  : `Screen ${ctrlPreviewInfo.id}`}
              </span>
            </div>
            <div className="cm-ctrl-preview-params">
              {ctrlPreviewInfo.kind === "state" && ctrlPreviewInfo.params.map(([key, val]) => (
                <div key={key} className="cm-ctrl-preview-row">
                  <span>{key}</span>
                  <strong>{val || "—"}</strong>
                </div>
              ))}
              {ctrlPreviewInfo.kind === "screen" && ctrlPreviewInfo.resource && (
                <div className="cm-ctrl-preview-row">
                  <span>Resource</span>
                  <strong>{ctrlPreviewInfo.resource}</strong>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
