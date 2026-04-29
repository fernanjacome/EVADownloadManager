import React from "react";
import { FaFolderOpen, FaImages, FaSyncAlt } from "react-icons/fa";
import "./AboutModal.css";

export default function ScreensInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal module-help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pantallas</h2>

        <div className="about-body module-help-body">
          <p className="about-intro">
            Este modulo muestra los HTML reales de una carpeta. Sirve para revisar si una
            pantalla existe, si abre bien y si corresponde con lo que esta usando el XML.
          </p>

          <div className="about-module-grid">
            <div className="about-section">
              <h3 className="about-section-title">
                <FaFolderOpen className="about-section-icon" />
                <span>Como trabajar aqui</span>
              </h3>
              <ol className="about-steps">
                <li>Selecciona la carpeta donde estan las pantallas.</li>
                <li>Revisa la lista y elige la que quieres abrir.</li>
                <li>Usa el visor para validar contenido, tamano y estilo general.</li>
              </ol>
            </div>

            <div className="about-section">
              <h3 className="about-section-title">
                <FaSyncAlt className="about-section-icon" />
                <span>Cuando refrescar</span>
              </h3>
              <ul>
                <li>Si cambiaste la ruta manualmente.</li>
                <li>Si editaste HTML, CSS o JS fuera de la app.</li>
                <li>Si parece que estas viendo una version anterior.</li>
              </ul>
            </div>
          </div>

          <div className="about-section about-section-wide">
            <h3 className="about-section-title">
              <FaImages className="about-section-icon" />
              <span>Importante</span>
            </h3>
            <ul>
              <li>La lista depende de la carpeta cargada, no del XML.</li>
              <li>Puedes revisar pantallas aunque todavia no esten referenciadas en el flujo.</li>
              <li>Si llegas desde XML o Flujos, la app intenta abrir directamente la pantalla asociada.</li>
            </ul>
          </div>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
