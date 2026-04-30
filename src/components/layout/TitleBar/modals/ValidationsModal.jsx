import React from "react";
import "./AboutModal.css";

export default function ValidationsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Validaciones</h2>

        <div className="about-body">
          <p className="about-intro">
            Estas validaciones revisan lo básico para evitar errores en el XML.
          </p>

          <ul>
            <li>El XML está bien formado.</li>
            <li>La estructura base existe.</li>
            <li>No hay IDs duplicados en secciones importantes.</li>
          </ul>

          <p className="about-note">
            Sirve como apoyo, pero no reemplaza revisar el flujo completo cuando
            el cambio es grande.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
