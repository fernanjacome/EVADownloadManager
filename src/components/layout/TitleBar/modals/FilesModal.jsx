import React from "react";
import "./AboutModal.css";

export default function FilesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Archivos</h2>

        <div className="about-body">
          <p>
            Desde aqui cargas un XML, empiezas uno nuevo o limpias lo que tienes abierto en la ventana actual.
          </p>

          <ul>
            <li><strong>Nuevo XML</strong> te crea una base para empezar rapido.</li>
            <li><strong>Cargar XML</strong> abre un archivo existente.</li>
            <li><strong>Guardar</strong> escribe los cambios reales en disco.</li>
            <li><strong>Eliminar XML</strong> limpia solo esta ventana.</li>
          </ul>

          <p className="about-note">
            Aunque cierres la app, el workspace intenta volver a abrirse como lo dejaste.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
