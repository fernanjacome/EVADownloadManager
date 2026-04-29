import React from "react";
import "./AboutModal.css";

export default function ValidationsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Validaciones</h2>

        <div className="about-body">
          <p>
            La app revisa lo basico para ayudarte a no romper el XML sin darte cuenta.
          </p>

          <ul>
            <li>Que el XML este bien formado.</li>
            <li>Que exista la estructura base esperada.</li>
            <li>Que no tengas IDs duplicados en secciones importantes.</li>
          </ul>

          <p className="about-note">
            Esto ayuda bastante, pero no reemplaza revisar el flujo real y las pantallas cuando el cambio es grande.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
