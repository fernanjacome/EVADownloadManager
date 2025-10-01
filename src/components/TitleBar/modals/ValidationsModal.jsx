import React from "react";
import "./AboutModal.css";

export default function ValidationsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Validaciones que realiza la aplicación</h2>
        <ul>
          <li>
            Verifica que el XML esté bien formado y sin errores de sintaxis.
          </li>
          <li>
            Controla que no existan <strong>IDs duplicados</strong> en secciones
            como <code>States</code>, <code>Screens</code> o <code>Fits</code>.
          </li>
          <li>
            Asegura que cada archivo tenga la estructura raíz{" "}
            <code>&lt;Download&gt;</code>.
          </li>
          <li>
            Confirma que se puedan exportar los cambios sin corromper el
            archivo.
          </li>
        </ul>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
