import React from "react";
import "./AboutModal.css";

export default function FormatModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Formato válido para XML</h2>
        <p>El archivo debe respetar esta estructura mínima:</p>
        <pre className="xml-sample">
          {`<?xml version="1.0" encoding="utf-8"?>
<Download>
  <States>...</States>
  <Screens>...</Screens>
  <Fits>...</Fits>
  <General>...</General>
</Download>`}
        </pre>
        <p>
          Siempre debe comenzar con la cabecera <code>&lt;?xml ... ?&gt;</code>{" "}
          y contener el nodo raíz <code>&lt;Download&gt;</code>.
        </p>
        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
