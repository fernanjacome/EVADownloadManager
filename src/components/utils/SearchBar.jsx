import { useEffect, useRef, useState } from "react";
import { FaExchangeAlt, FaGripLines, FaList, FaRegDotCircle } from "react-icons/fa";
import { BiSearch } from "react-icons/bi";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import "./SearchBar.css";

export default function SearchBar({
  query,
  replaceText,
  matchCase,
  wholeWord,
  showReplace,
  total = 0,
  current = 0,
  inputRef,
  replaceInputRef,
  onQueryChange,
  onReplaceTextChange,
  onToggleReplace,
  onToggleMatchCase,
  onToggleWholeWord,
  onNext,
  onPrev,
  onReplaceOne,
  onReplaceAll,
  onSelectAll,
  onClose,
  theme,
}) {
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState(() => {
    const preferredWidth = Math.min(560, Math.max(440, window.innerWidth - 36));
    return {
      x: Math.max(12, window.innerWidth - preferredWidth - 18),
      y: 88,
    };
  });

  useEffect(() => {
    inputRef?.current?.focus();
  }, [inputRef]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragStateRef.current) return;

      const { offsetX, offsetY, width, height } = dragStateRef.current;
      const nextX = Math.min(
        Math.max(12, event.clientX - offsetX),
        Math.max(12, window.innerWidth - width - 12)
      );
      const nextY = Math.min(
        Math.max(48, event.clientY - offsetY),
        Math.max(48, window.innerHeight - height - 12)
      );

      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => {
      dragStateRef.current = null;
      document.body.classList.remove("search-dragging");
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("search-dragging");
    };
  }, []);

  return (
    <div
      className={`search-bar search-bar-${theme === "light" ? "light" : "dark"}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <div
        className="search-window-bar"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const rect = event.currentTarget.parentElement.getBoundingClientRect();
          dragStateRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: rect.width,
            height: rect.height,
          };
          document.body.classList.add("search-dragging");
        }}
      >
        <div className="search-window-title">
          <FaGripLines />
          <span>Buscar en XML</span>
        </div>
        <span className="search-window-meta">
          {total > 0 ? `${current + 1} de ${total}` : "Sin resultados"}
        </span>
      </div>

      <div className="search-row primary">
        <div className="search-input-group">
          <BiSearch className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar en el XML"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.shiftKey ? onPrev() : onNext();
              }
            }}
          />
        </div>

        <div className="search-actions">
          <button title="Anterior" onClick={onPrev}>
            <FiChevronLeft />
          </button>
          <button title="Siguiente" onClick={onNext}>
            <FiChevronRight />
          </button>
          <button
            title={showReplace ? "Ocultar reemplazo" : "Mostrar reemplazo"}
            onClick={onToggleReplace}
          >
            <FaExchangeAlt />
            <span>{showReplace ? "Ocultar" : "Reemplazar"}</span>
          </button>
          <button title="Cerrar" onClick={onClose} className="close-btn">
            <FiX />
          </button>
        </div>
      </div>

      <div className="search-row options">
        <button
          className={`option-chip ${matchCase ? "active" : ""}`}
          onClick={onToggleMatchCase}
          title="Coincidir mayusculas y minusculas"
        >
          <span>Aa</span>
          <span>Mayus</span>
        </button>
        <button
          className={`option-chip ${wholeWord ? "active" : ""}`}
          onClick={onToggleWholeWord}
          title="Coincidir palabra completa"
        >
          <FaRegDotCircle />
          <span>Palabra</span>
        </button>
        <button className="option-chip" onClick={onSelectAll} title="Seleccionar coincidencias">
          <FaList />
          <span>Todas</span>
        </button>
      </div>

      {showReplace && (
        <div className="search-row replace">
          <div className="search-input-group replace-group">
            <FaExchangeAlt className="search-icon" />
            <input
              ref={replaceInputRef}
              type="text"
              placeholder="Reemplazar por"
              value={replaceText}
              onChange={(e) => onReplaceTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.shiftKey ? onReplaceAll() : onReplaceOne();
                }
              }}
            />
          </div>

          <div className="search-actions">
            <button onClick={onReplaceOne} title="Reemplazar coincidencia actual">
              Reemplazar
            </button>
            <button onClick={onReplaceAll} title="Reemplazar todas">
              Reemplazar todo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
