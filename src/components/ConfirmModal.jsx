import React from "react";
import "./TitleBar/modals/AboutModal.css"; // reutiliza los mismos estilos

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) {
  if (!isOpen) return null;

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>

        <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
          <button
            className="about-close"
            style={{ background: "#d9534f" }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirmar
          </button>
          <button className="about-close" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
