import React from "react";
import "./AboutModal.css";

export default function FormatModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Formato XML</h2>

        <div className="about-body">
          <p className="about-intro">
            Esta es la estructura base esperada para un download.
          </p>

          <pre className="xml-sample">{`<?xml version="1.0" encoding="utf-8"?>
<Download>
  <States>...</States>
  <Screens>...</Screens>
  <Fits>...</Fits>
  <General>...</General>
 <Transactions>...</Transactions>
   <TranMap>...</TranMap>
    <Errors>...</Errors>
</Download>`}</pre>

          <p className="about-note">
            Mantener el XML limpio y bien cerrado evita problemas en la
            navegación.
          </p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
