import React, { useEffect } from "react";
import "./NotificationCustom.css";

export default function NotificationCustom({
  type = "info",
  message,
  onClose,
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <span>{message}</span>
      <button className="close-btn" onClick={onClose}>
       x
      </button>
    </div>
  );
}
