import React from "react";
import "./AboutModal.css";

export default function ErrorsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Errores comunes</h2>

        <div className="about-body">
          <p>
            Los errores mas tipicos suelen venir de XML mal cerrado, IDs repetidos o referencias que apuntan a algo que ya no existe.
          </p>

          <ul>
            <li>Si te habla de linea y columna, casi siempre es estructura XML.</li>
            <li>Si algo no navega bien, revisa IDs y estados destino.</li>
            <li>Si una pantalla no abre, revisa que el recurso HTML exista y este cargado.</li>
          </ul>

          <p className="about-note">
            Cuando no estes seguro, lo mas util suele ser revisar primero el XML y luego el modulo Flujos.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
