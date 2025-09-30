import NotificationCustom from "./NotificationCustom";

export default function NotificationContainer({
  notifications,
  removeNotification,
}) {
  const limited = [...notifications].slice(-5); // solo últimas 5
  return (
    <div className="notification-container">
      {limited.reverse().map((n) => (
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
