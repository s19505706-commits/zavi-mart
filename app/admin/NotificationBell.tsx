"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./admin-notifications.module.css";

type Notification = {
  id: string;
  type: "new_order" | "new_comment" | "low_stock";
  title: string;
  message: string;
  productName: string;
  customerName: string;
  orderId: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationBellProps = {
  onBellActivate: () => void;
  onNewOrder: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNotifications(value: unknown): Notification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Notification[] => {
    if (!isRecord(entry) || typeof entry.id !== "string" ||
        typeof entry.title !== "string" || typeof entry.message !== "string" ||
        typeof entry.createdAt !== "string") return [];
    const type = entry.type === "new_order" || entry.type === "new_comment" || entry.type === "low_stock"
      ? entry.type
      : "low_stock";
    return [{
      id: entry.id,
      type,
      title: entry.title,
      message: entry.message,
      productName: typeof entry.productName === "string" ? entry.productName : "",
      customerName: typeof entry.customerName === "string" ? entry.customerName : "",
      orderId: typeof entry.orderId === "string" ? entry.orderId : "",
      isRead: entry.isRead === true,
      createdAt: entry.createdAt
    }];
  });
}

function timeAgo(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function NotificationBell({
  onBellActivate,
  onNewOrder,
  soundMuted,
  onToggleSound
}: NotificationBellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const adminKeyRef = useRef("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const seenUnreadIds = useRef<Set<string> | null>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications?unread=true&_=${Date.now()}`, {
        headers: { "x-admin-key": adminKeyRef.current.trim() || "" },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not update notification count.");
      }
      const unread = parseNotifications(result.notifications);
      if (seenUnreadIds.current === null) {
        seenUnreadIds.current = new Set(unread.map((notification) => notification.id));
      } else {
        const seenIds = seenUnreadIds.current;
        if (unread.some((notification) =>
          notification.type === "new_order" && !seenIds.has(notification.id)
        )) {
          onNewOrder();
        }
        for (const notification of unread) seenIds.add(notification.id);
      }
      setUnreadCount(unread.length);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not update notification count.");
    }
  }, [onNewOrder]);

  const loadAllNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications?_=${Date.now()}`, {
        headers: { "x-admin-key": adminKeyRef.current.trim() || "" },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load notifications.");
      }
      setNotifications(parseNotifications(result.notifications).slice(0, 10));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    }
  }, []);

  useEffect(() => {
    const savedKey = sessionStorage.getItem("zavimart-admin-key");
    if (savedKey) {
      adminKeyRef.current = savedKey;
      setAdminKey(savedKey);
      void loadUnreadCount();
      if (open) void loadAllNotifications();
    }
  }, [loadAllNotifications, loadUnreadCount, open]);

  useEffect(() => {
    void loadUnreadCount();
    if (open) void loadAllNotifications();
    const timer = window.setInterval(() => {
      void loadUnreadCount();
      if (open) void loadAllNotifications();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [loadAllNotifications, loadUnreadCount, open]);

  useEffect(() => {
    if (open) void loadAllNotifications();
  }, [loadAllNotifications, open]);

  async function markRead(id: string): Promise<void> {
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKeyRef.current.trim() || "" },
        body: JSON.stringify({ id })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not mark notification as read.");
      }
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
      await loadUnreadCount();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark notification as read.");
    }
  }

  async function openNotification(notification: Notification) {
    await markRead(notification.id);
    setOpen(false);
    router.push("/admin/notifications");
  }

  async function markAllRead() {
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKeyRef.current.trim() || "" },
        body: JSON.stringify({ markAllRead: true })
      });
      if (!response.ok) throw new Error("Could not mark notifications as read.");
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark notifications as read.");
    }
  }

  return (
    <div className={styles.bellWrap}>
      <button
        className={`${styles.bellButton} ${pathname.startsWith("/admin/notifications") ? styles.bellActive : ""}`}
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-current={pathname.startsWith("/admin/notifications") ? "page" : undefined}
        aria-expanded={open}
        onClick={() => {
          onBellActivate();
          setOpen((current) => !current);
        }}
      >
        <Bell size={21} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section className={styles.popover} aria-label="Recent notifications">
          <header className={styles.popoverHeader}>
            <strong>Notifications</strong>
            <div className={styles.popoverActions}>
              <button type="button" onClick={onToggleSound} aria-pressed={!soundMuted}>
                {soundMuted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
                Sound {soundMuted ? "off" : "on"}
              </button>
              <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
                Mark all as read
              </button>
            </div>
          </header>
          <label className={styles.keyControl}>
            Admin API key
            <input
              type="password"
              autoComplete="off"
              value={adminKey}
              onChange={(event) => {
                setAdminKey(event.target.value);
                adminKeyRef.current = event.target.value;
                sessionStorage.setItem("zavimart-admin-key", event.target.value);
              }}
            />
          </label>
          {error && <p className={styles.popoverError} role="alert">{error}</p>}
          {notifications.length === 0 ? (
            <p className={styles.noNotifications}>You’re all caught up.</p>
          ) : (
            <ul className={styles.notificationList}>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`${styles.notificationItem} ${notification.isRead ? "" : styles.notificationUnread}`}
                    type="button"
                    onClick={() => void openNotification(notification)}
                  >
                    <span className={styles.notificationIcon} aria-hidden="true">
                      {notification.type === "new_order" ? "📦" :
                        notification.type === "new_comment" ? "💬" : "⚠️"}
                    </span>
                    <span className={styles.notificationCopy}>
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time dateTime={notification.createdAt}>{timeAgo(notification.createdAt)}</time>
                    </span>
                    {!notification.isRead && <span className={styles.unreadDot} aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className={styles.viewAll} href="/admin/notifications" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
