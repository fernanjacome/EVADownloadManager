import React from "react";
import { FaInfoCircle } from "react-icons/fa";
import "./AboutModal.css";

export default function AboutModal({
  isOpen,
  onClose,
  snowEnabled,
  toggleSnow,
}) {
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
            <strong>EVA Studio 2026</strong> es una aplicación diseñada para
            gestionar y organizar <em>downloads</em> específicamente construidos
            para integrarse con <strong>EVA</strong>. Integra modulos como
            <strong> Pantallas</strong>, <strong>Compilador</strong> y{" "}
            <strong>Remoto</strong> para facilitar el desarrollo en el
            ecosistema EVA.
          </p>
        </div>

        <div className="about-footer">
          <p className="about-version">Versión 1.1.0</p>
          <p className="about-signature">Extreme Visual Appliance</p>
        </div>

        <button className="about-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
