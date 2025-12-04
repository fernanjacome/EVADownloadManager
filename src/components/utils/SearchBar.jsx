import { useState, useEffect, useRef } from "react";
import { FaChevronUp, FaChevronDown, FaTimes } from "react-icons/fa";
import { BiSearch } from "react-icons/bi";
import "./SearchBar.css";

export default function SearchBar({
  onSearch,
  onNext,
  onPrev,
  onClose,
  total = 0,
  current = 0,
  inputRef,
  initialQuery = "",
  theme,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(initialQuery);

    if (inputRef?.current) {
      inputRef.current.focus();
    }
  }, [initialQuery, inputRef]);

  return (
    <div className="search-bar">
      <BiSearch className="search-icon" />
      <input
        ref={inputRef} // 👈 conectamos ref
        type="text"
        placeholder="Buscar..."
        value={query}
        className={theme == "light" ? "light" : "dark"}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
      />

      <span className="search-counter">
        {total > 0 ? `${current + 1} / ${total}` : "0 resultados"}
      </span>

      <button title="Anterior" onClick={onPrev}>
        <FaChevronUp />
      </button>
      <button title="Siguiente" onClick={onNext}>
        <FaChevronDown />
      </button>
      <button title="Cerrar" onClick={onClose} className="close-btn">
        <FaTimes />
      </button>
    </div>
  );
}
