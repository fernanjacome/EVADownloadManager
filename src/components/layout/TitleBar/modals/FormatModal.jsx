import React from "react";
import "./AboutModal.css";

export default function FormatModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Formato XML</h2>

        <div className="about-body">
          <p>
            Este apartado es para recordarte la base minima que la app espera en un download.
          </p>

          <pre className="xml-sample">{`<?xml version="1.0" encoding="utf-8"?>
<Download>
  <States>...</States>
  <Screens>...</Screens>
  <Fits>...</Fits>
  <General>...</General>
</Download>`}</pre>

          <p>
            No hace falta que todo tenga exactamente el mismo orden siempre, pero si conviene mantenerlo limpio y bien cerrado para que la navegacion no se rompa.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
