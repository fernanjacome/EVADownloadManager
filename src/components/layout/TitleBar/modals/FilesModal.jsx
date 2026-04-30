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
            Desde aqui cargas un XML, empiezas uno nuevo o limpias lo que tienes
            abierto en la ventana actual.
          </p>

          <ul>
            <li>
              <strong>Importar</strong> te permite cargar un archivo XML.
            </li>
            <li>
              <strong>Guardar</strong> escribe los cambios en el archivo.
            </li>
            <li>
              <strong>Eliminar</strong> limpia el archivo de esta ventana.
            </li>
          </ul>

          <p className="about-note">
            La aplicación guarda el estado del usuario automáticamente, al
            cerrar la aplicación y volver a abrirla, el workspace se cargara
            como estaba.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
