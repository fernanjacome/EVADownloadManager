import React, { useEffect, useRef, useState, useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import SearchBar from "./SearchBar";
import { xml } from "@codemirror/lang-xml";
import { EditorSelection } from "@codemirror/state";
import { FaSearchPlus, FaSearchMinus, FaRedo } from "react-icons/fa";
import "./CodeEditor.css";

export default function CodeEditor({
  code,
  onChange,
  highlightId,
  onSave,
  canSave,
}) {
  const viewRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);
  const searchInputRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // --- Atajo Ctrl+S / Cmd+S ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (canSave) onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSave, onSave]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          // scroll up → aumentar
          setFontSize((s) => Math.min(26, s + 1));
        } else {
          // scroll down → disminuir
          setFontSize((s) => Math.max(8, s - 1));
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // --- Navegación desde Sidebar ---
  useEffect(() => {
    if (!highlightId || !viewRef.current) return;
    const [tag, id] = highlightId.split("-");
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
  }, [highlightId, code]);

  // --- Extension dinámica para cambiar font-size ---
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

  // Ctrl+F → abrir buscador
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        if (showSearch) {
          searchInputRef.current?.focus();
        } else {
          setShowSearch(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  const doSearch = (query) => {
    if (!query) {
      setMatches([]);
      setCurrentIndex(0);
      return;
    }
    const regex = new RegExp(query, "gi");
    let m,
      found = [];
    while ((m = regex.exec(code)) !== null) {
      found.push(m.index);
    }
    setMatches(found);
    setCurrentIndex(0);
    if (found.length > 0) goTo(found[0]);
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
        />
      )}
      <CodeMirror
        value={code}
        height="100%"
        theme="dark"
        extensions={[xml(), fontSizeTheme]}
        editable={true}
        className={"editor-code"}
        onChange={(val) => onChange(val)}
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
