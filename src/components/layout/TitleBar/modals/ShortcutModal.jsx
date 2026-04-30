import React from "react";
import "./AboutModal.css";

export default function ShortcutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Atajos</h2>

        <div className="about-body">
          <ul>
            <li>
              <strong>Ctrl + S</strong> guarda el XML
            </li>
            <li>
              <strong>Ctrl + F</strong> abre la búsqueda
            </li>
            <li>
              <strong>Ctrl + /</strong> comenta o descomenta
            </li>
            <li>
              <strong>Ctrl + rueda</strong> hace zoom
            </li>
            <li>
              <strong>Ctrl + B</strong> enfoca la búsqueda del sidebar
            </li>
          </ul>

          <p className="about-note">
            Si un atajo no funciona, revisa en qué módulo está el foco.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
