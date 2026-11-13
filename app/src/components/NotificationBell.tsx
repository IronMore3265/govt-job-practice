"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import Link from "@/components/NavLink";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import type { NotificationView } from "@/lib/notifications";

// Bell in the top bar with a yellow unread count (pattern from the MSc site's NotificationBell).
// The panel lists new signups and reported questions, newest first, unread ones marked with a chip.
// Notifications are in-app only, so new ones show on the next page load.
export function NotificationBell({ items, unread }: { items: NotificationView[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className="notif-wrap" ref={box}>
      <button
        type="button"
        className="bell"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="ico" aria-hidden="true" />
        {unread ? (
          <span className="bell-count" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="notif-panel card-orange-sm" role="dialog" aria-label="Notifications">
          <div className="between">
            <p className="label label-orange">Notifications</p>
            {unread ? (
              <button type="button" className="btn-link small" disabled={pending} onClick={() => startTransition(() => markAllNotificationsRead())}>
                {pending ? "Marking..." : "Mark all read"}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="small muted">Nothing yet. New signups and reported questions show up here.</p>
          ) : (
            <div className="notif-list">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className={`notif-item${n.unread ? " notif-unread" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (n.unread) startTransition(() => markNotificationRead(n.id));
                  }}
                >
                  <span className="between">
                    <span className="notif-title small">{n.title}</span>
                    {n.unread ? <span className="chip chip-now">New</span> : null}
                  </span>
                  <span className="small">{n.detail}</span>
                  <span className="small muted">{n.when}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
