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
  inputRef, // 👈 nuevo
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.focus(); // se autoenfoca al montarse
    }
  }, [inputRef]);

  return (
    <div className="search-bar">
      <BiSearch className="search-icon" />
      <input
        ref={inputRef} // 👈 conectamos ref
        type="text"
        placeholder="Buscar..."
        value={query}
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
