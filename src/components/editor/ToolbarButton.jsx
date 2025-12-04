import React from "react";
import "./ToolbarButton.css";

export default function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  title = "",
}) {
  return (
    <button
      className={`toolbar-btn custom-btn ${disabled ? "disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title || label}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {label && <span className="btn-label">{label}</span>}
    </button>
  );
}
