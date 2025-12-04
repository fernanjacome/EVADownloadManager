import React from "react";
import "./AboutModal.css";

export default function ErrorsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Errores comunes</h2>
        <ul>
          <li>
            <strong>IDs duplicados</strong> → Cambia el valor del atributo{" "}
            <code>Id</code> o <code>Code</code>.
          </li>
          <li>
            <strong>XML inválido en línea X, columna Y</strong> → Revisa
            etiquetas mal cerradas o mal formateadas.
          </li>
          <li>
            <strong>Falta estructura raíz</strong> → Asegúrate de que el XML
            empiece con <code>&lt;Download&gt;</code>.
          </li>
        </ul>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
