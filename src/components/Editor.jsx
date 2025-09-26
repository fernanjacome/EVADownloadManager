import React, { useEffect, useRef } from "react";
import CodeMirror, { EditorView, keymap } from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { searchKeymap } from "@codemirror/search";
import { EditorSelection } from "@codemirror/state";
import { FaSave, FaUndo, FaEdit, FaEye } from "react-icons/fa";
import "./Editor.css";

export default function Editor({
  code,
  onChange,
  highlightId,
  editMode,
  setEditMode,
  onSave,
  onRestoreSaved,
  onRestoreOriginal,
  canSave,
  canRestoreSaved,
  canRestoreOriginal,
  dirty,
}) {
  const viewRef = useRef(null);

  // --- Atajo Ctrl+S / Cmd+S ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // evita el diálogo de guardar del navegador
        if (canSave) {
          onSave();
        }
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

  return (
    <div className="editor-container">
      {/* ───── Barra de herramientas ───── */}
      <div className="editor-toolbar">
        <button className="btn-save" onClick={onSave} disabled={!canSave}>
          <FaSave /> Guardar
        </button>

        <button className="toggle-edit" onClick={() => setEditMode(!editMode)}>
          {editMode ? (
            <>
              <FaEye /> Lectura
            </>
          ) : (
            <>
              <FaEdit /> Edición
            </>
          )}
        </button>

        <button
          className="btn-restore"
          onClick={onRestoreSaved}
          disabled={!canRestoreSaved}
        >
          <FaUndo /> Restaurar último guardado
        </button>

        <button
          className="btn-restore"
          onClick={onRestoreOriginal}
          disabled={!canRestoreOriginal}
        >
          <FaUndo /> Restaurar archivo original
        </button>

        {dirty && <span className="editor-dirty">Cambios sin guardar</span>}
      </div>

      {/* ───── Editor ───── */}
      <CodeMirror
        value={code}
        height="100%"
        theme="dark"
        extensions={[
          xml(),
          keymap.of([
            {
              key: "Mod-s", // Ctrl+S / Cmd+S
              run: () => {
                if (canSave) onSave();
                return true; // evita default
              },
            },
            {
              key: "Mod-f", // Ctrl+F / Cmd+F
              run: () => {
                const searchInput = document.querySelector(
                  ".sidebar-search input"
                );
                if (searchInput) searchInput.focus();
                return true; // evita buscador de CodeMirror
              },
            },
          ]),
          keymap.of([]), // 👈 sobreescribe con keymap vacío
        ].filter(Boolean)}
        editable={editMode}
        className={editMode ? "editor-code" : "editor-code read-only"}
        onChange={(val) => onChange(val)}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />
    </div>
  );
}
