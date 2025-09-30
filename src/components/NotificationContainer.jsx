import React from "react";
import Notification from "./Notification";
import "./Notification.css";

export default function NotificationContainer({
  notifications,
  removeNotification,
}) {
  return (
    <div className="notification-container">
      {notifications.map((n) => (
        <Notification
          key={n.id}
          type={n.type}
          message={n.message}
          onClose={() => removeNotification(n.id)}
        />
      ))}
    </div>
  );
}
