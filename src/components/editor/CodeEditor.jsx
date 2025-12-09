import React, { useEffect, useRef, useState, useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import SearchBar from "../utils/SearchBar";
import { xml } from "@codemirror/lang-xml";

import { EditorSelection } from "@codemirror/state";
import { FaSearchPlus, FaSearchMinus, FaRedo } from "react-icons/fa";
import "./CodeEditor.css";
import { notepadPlus } from "../../utils/notepadPlusTheme";

export default function CodeEditor({
  code,
  onChange,
  highlightId,
  onSave,
  canSave,
  editable,
  syncKey = "left",
  onFocus,
  viewMode,
  theme,
}) {
  const viewRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);
  const searchInputRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Atajo Ctrl+S / Cmd+S ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (canSave) onSave();
      }

      if (e.key === "F3") {
        e.preventDefault();
        nextMatch();
      }
      if (e.shiftKey && e.key === "F3") {
        e.preventDefault();
        prevMatch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSave, onSave]);

  // --- Scroll + Zoom con Ctrl + rueda ---
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

  // --- Navegación desde Sidebar ---
  useEffect(() => {
    if (!highlightId || !viewRef.current) return;
    if (viewMode !== "code") return;
    if (highlightId.target && highlightId.target !== syncKey) return;

    const [tag, id] = highlightId.id.split("-");
    const regex =
      tag === "General"
        ? new RegExp(`<Param[^>]*Key=["']${id}["'][^>]*>`, "i")
        : new RegExp(`<${tag}[^>]*${id}[^>]*>`, "i");

    const match = code.match(regex);
    if (match) {
      const pos = match.index ?? 0;
      const view = viewRef.current;
      view.dispatch({
        selection: EditorSelection.single(pos),
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
    }
  }, [highlightId, code, syncKey]);

  // --- Tema dinámico (font-size) ---
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

  // --- Atajo Ctrl+F ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();

        const view = viewRef.current;
        if (!view) return;

        const sel = view.state.selection.main;

        if (sel.from !== sel.to) {
          const selectedText = view.state.doc.sliceString(sel.from, sel.to);
          setSearchQuery(selectedText); // 1) guarda texto
        }

        setShowSearch(true);

        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }, 0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  useEffect(() => {
    doSearch(searchQuery);
  }, [searchQuery, code]);
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  // --- Funciones de búsqueda ---
  const doSearch = (query) => {
    if (!query) {
      setMatches([]);
      setCurrentIndex(0);
      return;
    }

    const safe = escapeRegex(query);
    const regex = new RegExp(safe, "gi");

    let m;
    let found = [];

    while ((m = regex.exec(code)) !== null) {
      found.push(m.index);
    }

    setMatches(found);
    setCurrentIndex(0);

    if (found.length > 0) {
      goTo(found[0]);
    }
  };

  const goTo = (pos) => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      selection: EditorSelection.single(pos),
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
  };

  const nextMatch = () => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    goTo(matches[next]);
  };

  const prevMatch = () => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    goTo(matches[prev]);
  };

  // --- Configurar CodeMirror ---
  useEffect(() => {
    if (!viewRef.current) return;

    const dom = viewRef.current.dom;
    const handleFocus = () => {
      if (typeof onFocus === "function") onFocus(syncKey);
    };

    dom.addEventListener("focusin", handleFocus);

    return () => {
      dom.removeEventListener("focusin", handleFocus);
    };
  }, [onFocus, syncKey]);

  return (
    <div className="editor-container">
      {showSearch && (
        <SearchBar
          onSearch={doSearch}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={() => setShowSearch(false)}
          total={matches.length}
          current={currentIndex}
          inputRef={searchInputRef}
          initialQuery={searchQuery}
          theme={theme}
        />
      )}

      <CodeMirror
        value={code}
        height="100%"
        theme={theme === "dark" ? "dark" : notepadPlus} // 👈 usa el prop theme
        extensions={[xml(), fontSizeTheme]}
        basicSetup={{
          highlightSelectionMatches: false,
          searchKeymap: false,
        }}
        editable={editable}
        className={`editor-code ${!editable ? "read-only" : ""}`}
        onChange={(val) => editable && onChange(val)}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />

      {/* Botones de Zoom */}
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
