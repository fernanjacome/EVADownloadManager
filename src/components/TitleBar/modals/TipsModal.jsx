import React from "react";
import "./AboutModal.css";

export default function TipsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Recomendaciones de uso</h2>
        <ul>
          <li>
            Guarda copias de respaldo de tus XML antes de modificarlos. Siempre
            puedes restaurarlo usando el boton{" "}
            <strong>Restaurar Original</strong>.
          </li>
          <li>
            Utiliza comentarios claros (<code>Comment</code>) para documentar
            cada estado o pantalla.
          </li>
          <li>Valida y formatea el XML desde la app antes de exportarlo.</li>
          <li>
            Usa nombres de archivo descriptivos para identificar descargas
            fácilmente.
          </li>
        </ul>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
