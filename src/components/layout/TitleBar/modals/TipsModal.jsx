import React from "react";
import "./AboutModal.css";

export default function TipsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Recomendaciones</h2>

        <div className="about-body">
          <p className="about-intro">
            Para trabajar mejor con un download, combina XML, Flujos y
            Pantallas.
          </p>

          <ul>
            <li>Guarda una copia antes de cambios grandes.</li>
            <li>Usa comentarios claros en los states.</li>
            <li>Si algo no cuadra, revisa referencias y pantallas.</li>
          </ul>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
