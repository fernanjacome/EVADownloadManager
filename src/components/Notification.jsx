import React, { useEffect } from "react";
import "./Notification.css";

export default function Notification({ type = "info", message, onClose }) {
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     onClose();
  //   }, 4000); // se cierra en 4s
  //   return () => clearTimeout(timer);
  // }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      <button className="close-btn" onClick={onClose}>
        ✖
      </button>
    </div>
  );
}
