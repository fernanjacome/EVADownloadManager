import NotificationCustom from "./Notification";

export default function NotificationContainer({
  notifications,
  removeNotification,
}) {
  return (
    <div className="notification-container">
      {[...notifications].reverse().map((n) => (
        <NotificationCustom
          key={n.id}
          type={n.type}
          message={n.message}
          onClose={() => removeNotification(n.id)}
        />
      ))}
    </div>
  );
}
