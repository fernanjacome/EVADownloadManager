import React from "react";
import { FaFileUpload, FaPlus } from "react-icons/fa";
import "./EmptyState.css";

export default function EmptyState({ onLoadClick, onNewClick }) {
  return (
    <div className="empty-state">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="120"
        height="120"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="empty-icon"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M12 4v16m8-8H4"
        />
      </svg>

      <h2>No hay XML cargado</h2>
      <p>Comienza cargando un archivo o crea uno nuevo.</p>

      <div className="empty-actions">
        <button className="btn-primary" onClick={onLoadClick}>
          <FaFileUpload /> Cargar XML
        </button>
        <button className="btn-secondary" onClick={onNewClick}>
          <FaPlus /> Nuevo XML
        </button>
      </div>
    </div>
  );
}
