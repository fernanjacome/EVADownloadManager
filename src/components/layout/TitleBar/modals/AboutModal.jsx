import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import "./AboutModal.css";

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <FaInfoCircle className="about-icon" />
          <h2>Version</h2>
        </div>

        <div className="about-body">
          <p>
            <strong>EVA Studio 2026</strong> te deja trabajar el XML, revisar el flujo,
            ver las pantallas y compilar, todo sin estar saltando entre varias herramientas.
          </p>
          <p>
            La idea es simple: cargas un download, lo editas, navegas entre sus partes y vuelves
            a abrir la app justo como la dejaste.
          </p>
        </div>

        <div className="about-footer">
          <p className="about-version">Version 1.1.0</p>
          <p className="about-signature">Extreme Visual Appliance</p>
        </div>

        <button className="about-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
