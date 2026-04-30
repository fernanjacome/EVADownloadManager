import React from "react";
import { FaFolderOpen, FaImages, FaSyncAlt } from "react-icons/fa";
import "./AboutModal.css";

export default function ScreensInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className="about-modal module-help-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Pantallas</h2>

        <div className="about-body module-help-body">
          <p className="about-intro">
            Aquí puedes ver los HTML reales desde una carpeta y validar si
            coinciden con el XML.
          </p>

          <div className="about-module-grid">
            <div className="about-section">
              <h3 className="about-section-title">
                <FaFolderOpen className="about-section-icon" />
                <span>Uso</span>
              </h3>
              <ol className="about-steps">
                <li>Selecciona la carpeta.</li>
                <li>Elige una pantalla.</li>
                <li>Revisa su contenido en el visor.</li>
              </ol>
            </div>

            <div className="about-section">
              <h3 className="about-section-title">
                <FaSyncAlt className="about-section-icon" />
                <span>Refrescar</span>
              </h3>
              <ul>
                <li>Si cambiaste la ruta.</li>
                <li>Si editaste archivos fuera de la app.</li>
                <li>Si ves una versión desactualizada.</li>
              </ul>
            </div>
          </div>

          <div className="about-section about-section-wide">
            <h3 className="about-section-title">
              <FaImages className="about-section-icon" />
              <span>Notas</span>
            </h3>
            <ul>
              <li>La lista depende de la carpeta, no del XML.</li>
              <li>Puedes abrir pantallas sin referencia en el flujo.</li>
              <li>Desde XML o Flujos se intenta abrir la pantalla asociada.</li>
            </ul>
          </div>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
