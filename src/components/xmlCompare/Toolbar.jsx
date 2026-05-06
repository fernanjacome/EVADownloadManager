import React from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaCompressAlt,
  FaCopy,
  FaRegCommentDots,
  FaUndo,
} from "react-icons/fa";

export default function Toolbar({
  options,
  setOptions,
  onPickLeft,
  onPickRight,
  onUseCurrent,
  onPrev,
  onNext,
  onToggleCollapse,
  onRestoreOriginal,
  collapseEqualBlocks,
}) {
  const toggle = (key) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="xml-compare-toolbar">
      <div className="xml-toolbar-group">
        <button
          type="button"
          className="xml-tool-btn"
          onClick={onPickLeft}
          title="Cargar XML izquierdo"
        >
          <SplitSideIcon side="left" /> Izquierda
        </button>
        <button
          type="button"
          className="xml-tool-btn"
          onClick={onPickRight}
          title="Cargar XML derecho"
        >
          <SplitSideIcon side="right" /> Derecha
        </button>
        <div
          className="xml-current-split"
          title="Usar el XML actual en un lado del comparador"
        >
          <span>
            <FaCopy /> XML actual
          </span>
          <button type="button" onClick={() => onUseCurrent("left")}>
            {"<"}
          </button>
          <button type="button" onClick={() => onUseCurrent("right")}>
            {">"}
          </button>
        </div>
      </div>

      <div className="xml-toolbar-group compact">
        <button
          type="button"
          className="xml-tool-btn icon-only"
          onClick={onPrev}
          title="Diferencia anterior"
        >
          <FaArrowUp />
        </button>
        <button
          type="button"
          className="xml-tool-btn icon-only"
          onClick={onNext}
          title="Siguiente diferencia"
        >
          <FaArrowDown />
        </button>
        <button
          type="button"
          className={`xml-tool-btn icon-only ${collapseEqualBlocks ? "active" : ""}`}
          onClick={onToggleCollapse}
          title="Colapsar o expandir bloques XML sin cambios"
        >
          <FaCompressAlt />
        </button>
        <button
          type="button"
          className="xml-tool-btn"
          onClick={onRestoreOriginal}
          title="Restaurar ambos XML al estado original cargado"
        >
          <FaUndo /> Original
        </button>
      </div>

      <div className="xml-toolbar-options">
        <label title="Ignorar diferencias de espacios">
          <input
            type="checkbox"
            checked={options.ignoreWhitespace}
            onChange={() => toggle("ignoreWhitespace")}
          />
          <FaCompressAlt /> Espacios
        </label>
        <label title="Ignorar comentarios XML">
          <input
            type="checkbox"
            checked={options.ignoreComments}
            onChange={() => toggle("ignoreComments")}
          />
          <FaRegCommentDots /> Comentarios
        </label>
        <label title="Comparacion sensible a mayusculas">
          <input
            type="checkbox"
            checked={options.caseSensitive}
            onChange={() => toggle("caseSensitive")}
          />
          Aa
        </label>
      </div>
    </div>
  );
}

function SplitSideIcon({ side }) {
  return (
    <span className={`xml-split-side-icon is-${side}`} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}
