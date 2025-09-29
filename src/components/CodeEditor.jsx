import React, { useEffect, useRef, useState, useMemo } from "react";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { EditorSelection } from "@codemirror/state";
import { FaSave, FaUndo, FaEdit, FaEye, FaAlignLeft } from "react-icons/fa";
import "./CodeEditor.css";

export default function CodeEditor({
  code,
  onChange,
  highlightId,
  editMode,
  onSave,
  canSave,
}) {
  const viewRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);

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

  return (
    <div className="editor-container">
      <CodeMirror
        value={code}
        height="100%"
        theme="dark"
        extensions={[
          xml(),
          fontSizeTheme,
          keymap.of([
            {
              key: "Mod-f",
              run: () => {
                const searchInput = document.querySelector(
                  ".sidebar-search input"
                );
                if (searchInput) searchInput.focus();
                return true;
              },
            },
          ]),
        ]}
        editable={editMode}
        className={editMode ? "editor-code" : "editor-code read-only"}
        onChange={(val) => onChange(val)}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />

      {/* Botones de Zoom */}
      <div className="editor-fontsize">
        <button onClick={() => setFontSize((s) => Math.min(26, s + 2))}>
          +
        </button>
        <button onClick={() => setFontSize((s) => Math.max(8, s - 2))}>
          -
        </button>
      </div>
    </div>
  );
}
