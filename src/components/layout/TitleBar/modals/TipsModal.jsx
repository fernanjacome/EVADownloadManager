import React from "react";
import "./AboutModal.css";

export default function TipsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Recomendaciones</h2>

        <div className="about-body">
          <p>
            Si vas a tocar bastante un download, lo que mejor suele funcionar es ir y venir entre XML, Flujos y Pantallas en vez de quedarse solo en una vista.
          </p>

          <ul>
            <li>Guarda una copia antes de cambios grandes.</li>
            <li>Usa comentarios claros en los states.</li>
            <li>Si algo se ve raro, primero revisa referencias y pantallas.</li>
          </ul>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
