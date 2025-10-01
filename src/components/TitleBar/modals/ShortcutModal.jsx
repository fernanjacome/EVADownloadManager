import React from "react";
import "./AboutModal.css";

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Atajos de teclado</h2>
        <ul>
          <li>
            <strong>Ctrl + B</strong> → Enfocar la búsqueda en la barra lateral.
          </li>
          <li>
            <strong>Ctrl + S</strong> → Guardar cambios del XML.
          </li>
          <li>
            <strong>Ctrl + F</strong> → Despliega barra de busqueda dentro del
            editor.
          </li>
          <li>
            <strong>Ctrl + (WheelUp/WheelDown)</strong> → Control de zoom dentro
            del editor.
          </li>
        </ul>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
