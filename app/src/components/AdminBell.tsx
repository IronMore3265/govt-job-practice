import { NotificationBell } from "@/components/NotificationBell";
import { loadNotifications } from "@/lib/notifications";

// Loads the signed-in admin's notifications on the server and hands them to the bell.
export async function AdminBell() {
  const { items, unread } = await loadNotifications();
  return <NotificationBell items={items} unread={unread} />;
}
