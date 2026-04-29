import React from "react";
import { FaCheckCircle, FaPlayCircle, FaServer } from "react-icons/fa";
import "./AboutModal.css";

export default function CompileInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal module-help-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Compilador</h2>

        <div className="about-body module-help-body">
          <p className="about-intro">
            Este modulo envia el XML actual al servicio de compilacion. Se usa cuando el
            archivo ya esta revisado y quieres generar la imagen o validar el resultado
            final desde el servidor.
          </p>

          <div className="about-module-grid">
            <div className="about-section">
              <h3 className="about-section-title">
                <FaCheckCircle className="about-section-icon" />
                <span>Antes de compilar</span>
              </h3>
              <ul>
                <li>Debes tener un XML abierto.</li>
                <li>Servidor y puerto deben apuntar al compilador correcto.</li>
                <li>La API <code>Extreme.EVA.APICompiler</code> debe estar disponible.</li>
              </ul>
            </div>

            <div className="about-section">
              <h3 className="about-section-title">
                <FaServer className="about-section-icon" />
                <span>Campos principales</span>
              </h3>
              <ul>
                <li><strong>Servidor</strong>: equipo donde corre el compilador.</li>
                <li><strong>Puerto</strong>: puerto del servicio.</li>
                <li><strong>BAT</strong>: proceso o script remoto.</li>
                <li><strong>ID</strong>: identificador de la imagen o compilacion.</li>
              </ul>
            </div>
          </div>

          <div className="about-section about-section-wide">
            <h3 className="about-section-title">
              <FaPlayCircle className="about-section-icon" />
              <span>Como usarlo</span>
            </h3>
            <ol className="about-steps">
              <li>Revisa el XML y asegurate de que ya este listo.</li>
              <li>Confirma servidor, puerto, BAT e ID.</li>
              <li>Ejecuta la compilacion.</li>
              <li>Si algo falla, revisa la consola del modulo.</li>
            </ol>
          </div>

          <p className="about-note">
            Si hay cambios sin guardar, la aplicacion intenta guardarlos antes de compilar.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
