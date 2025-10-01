import React from "react";
import "./AboutModal.css";

export default function FilesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Gestión de archivos</h2>
        <ul>
          <li>
            <strong>Nuevo XML </strong> → Genera un archivo base{" "}
            <code>default.xml</code>.
          </li>
          <li>
            <strong>Cargar XML / Importar</strong> → Abre un archivo local
            válido.
          </li>
          <li>
            <strong>Eliminar XML</strong> → Limpia el área de trabajo.
          </li>
          <li>
            <strong>Exportar XML</strong> → Descarga el archivo editado.
          </li>
        </ul>
        <p className="about-note">
          El nombre del archivo cargado siempre aparece en la barra superior.
        </p>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
