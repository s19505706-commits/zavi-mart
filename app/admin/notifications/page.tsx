"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerProfileModal from "../CustomerProfileModal";
import styles from "./notifications.module.css";

type Notification = {
  id: string;
  type: "new_order" | "new_comment" | "low_stock";
  title: string;
  message: string;
  productName: string;
  productId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  commentId: string;
  orderId: string;
  isRead: boolean;
  createdAt: string;
};

type CustomerOrder = {
  id: string;
  date: string;
  total: number;
  status: string;
  products: Array<{ name: string; qty: number }>;
};

type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  orders: CustomerOrder[];
};

type NotificationReview = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productName: string;
  productId: string;
  comment: string;
};

type Filter = "all" | "orders" | "comments";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Date unavailable";
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function extractPhone(message: string): string {
  const parenthesizedValue = message.match(/\(([^)]*\d[^)]*)\)/)?.[1];
  if (parenthesizedValue) return parenthesizedValue.trim();
  return message.match(/(?:\+?\d[\d\s().-]*){7,}/)?.[0]?.trim() ?? "";
}

function sameContact(
  customer: { phone: string; email: string },
  phone: string,
  email: string
): boolean {
  return (!!phone && !!customer.phone && normalizePhone(phone) === normalizePhone(customer.phone)) ||
    (!!email && !!customer.email && email.trim().toLocaleLowerCase() === customer.email.trim().toLocaleLowerCase());
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
      productId: typeof entry.productId === "string" ? entry.productId : "",
      customerName: typeof entry.customerName === "string" ? entry.customerName : "",
      customerPhone: typeof entry.customerPhone === "string" ? entry.customerPhone : "",
      customerEmail: typeof entry.customerEmail === "string" ? entry.customerEmail : "",
      commentId: typeof entry.commentId === "string" ? entry.commentId : "",
      orderId: typeof entry.orderId === "string" ? entry.orderId : "",
      isRead: entry.isRead === true,
      createdAt: entry.createdAt
    }];
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [reviewComments, setReviewComments] = useState<NotificationReview[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/notifications?_=${Date.now()}`, {
        headers: { "x-admin-key": "" },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !Array.isArray(result.notifications)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load notifications.");
      }
      setNotifications(parseNotifications(result.notifications));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customers?_=${Date.now()}`, {
      headers: { "x-admin-key": "" },
      cache: "no-store"
    })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.customers)) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load customer profiles.");
        }
        const profiles = result.customers.flatMap((entry): CustomerProfile[] => {
          if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.name !== "string") return [];
          const orders = Array.isArray(entry.orders) ? entry.orders.flatMap((order): CustomerOrder[] => {
            if (!isRecord(order) || typeof order.id !== "string") return [];
            return [{
              id: order.id,
              date: typeof order.date === "string" ? order.date : "",
              total: typeof order.total === "number" ? order.total : 0,
              status: typeof order.status === "string" ? order.status : "pending",
              products: Array.isArray(order.products) ? order.products.flatMap((product) => {
                if (!isRecord(product) || typeof product.name !== "string") return [];
                return [{
                  name: product.name,
                  qty: typeof product.qty === "number" ? product.qty : 1
                }];
              }) : []
            }];
          }) : [];
          return [{
            id: entry.id,
            name: entry.name,
            phone: typeof entry.phone === "string" ? entry.phone : "",
            email: typeof entry.email === "string" ? entry.email : "",
            totalOrders: typeof entry.totalOrders === "number" ? entry.totalOrders : orders.length,
            totalSpent: typeof entry.totalSpent === "number" ? entry.totalSpent : 0,
            firstOrderDate: typeof entry.firstOrderDate === "string" ? entry.firstOrderDate : "",
            lastOrderDate: typeof entry.lastOrderDate === "string" ? entry.lastOrderDate : "",
            orders
          }];
        });
        if (!cancelled) setCustomers(profiles);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load customer profiles.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?_=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        const entries = Array.isArray(result)
          ? result
          : isRecord(result) && Array.isArray(result.comments) ? result.comments : [];
        if (!response.ok) throw new Error("Could not load review identities.");
        const reviews = entries.flatMap((entry): NotificationReview[] => {
          if (!isRecord(entry) || typeof entry.id !== "string") return [];
          return [{
            id: entry.id,
            customerName: typeof entry.customerName === "string" ? entry.customerName : "",
            customerPhone: typeof entry.customerPhone === "string" ? entry.customerPhone : "",
            customerEmail: typeof entry.customerEmail === "string" ? entry.customerEmail : "",
            productName: typeof entry.productName === "string" ? entry.productName : "",
            productId: typeof entry.productId === "string" ? entry.productId : "",
            comment: typeof entry.comment === "string" ? entry.comment : ""
          }];
        });
        if (!cancelled) setReviewComments(reviews);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load review identities.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: notifications.length,
      unread: notifications.filter((notification) => !notification.isRead).length,
      today: notifications.filter((notification) => new Date(notification.createdAt).toDateString() === today).length
    };
  }, [notifications]);

  const visibleNotifications = useMemo(() => notifications.filter((notification) => {
    if (filter === "orders") return notification.type === "new_order";
    if (filter === "comments") return notification.type === "new_comment";
    return true;
  }), [filter, notifications]);

  async function markRead(id: string) {
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": "" },
        body: JSON.stringify({ id })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Could not mark notification as read.");
      setNotifications((current) =>
        current.map((notification) => notification.id === id ? { ...notification, isRead: true } : notification)
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not mark notification as read.");
    }
  }

  async function markAllRead() {
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": "" },
        body: JSON.stringify({ markAllRead: true })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Could not mark notifications as read.");
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not mark notifications as read.");
    }
  }

  async function deleteNotification(id: string) {
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-key": "" },
        body: JSON.stringify({ id })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error
        : "Could not delete notification.");
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete notification.");
    }
  }

  function findReview(notification: Notification): NotificationReview | null {
    if (notification.commentId) {
      return reviewComments.find((review) => review.id === notification.commentId) ?? null;
    }
    const name = notification.customerName.trim().toLocaleLowerCase();
    const productName = notification.productName.trim().toLocaleLowerCase();
    const candidates = reviewComments.filter((review) =>
      review.customerName.trim().toLocaleLowerCase() === name &&
      (!productName || review.productName.trim().toLocaleLowerCase() === productName)
    );
    const contentMatches = candidates.filter((review) => {
      const snippet = review.comment.slice(0, 50);
      return !!snippet && notification.message.includes(snippet);
    });
    if (contentMatches.length === 1) return contentMatches[0];
    return candidates.length === 1 ? candidates[0] : null;
  }

  function findCustomer(notification: Notification): CustomerProfile | null {
    if (notification.type === "new_order") {
      if (notification.orderId) {
        const matchedOrderCustomer = customers.find((customer) =>
          customer.orders.some((order) => order.id === notification.orderId)
        );
        if (matchedOrderCustomer) return matchedOrderCustomer;
      }
      return customers.find((customer) =>
        sameContact(customer, notification.customerPhone, notification.customerEmail)
      ) ?? null;
    }
    const review = findReview(notification);
    const phone = notification.customerPhone || review?.customerPhone || "";
    const email = notification.customerEmail || review?.customerEmail || "";
    if (!phone && !email) return null;
    return customers.find((customer) => sameContact(customer, phone, email)) ?? null;
  }

  function handleViewDetails(notification: Notification) {
    if (!notification.isRead) void markRead(notification.id);
    const review = notification.type === "new_comment" ? findReview(notification) : null;
    const productId = notification.productId || review?.productId || "";
    if (notification.type === "new_comment" || productId) {
      const productSearch = notification.productName || review?.productName || productId;
      router.push(`/admin/products?search=${encodeURIComponent(productSearch)}`);
      return;
    }
    if (notification.type === "new_order" && notification.orderId) {
      router.push(`/admin/orders/${encodeURIComponent(notification.orderId)}`);
      return;
    }
    if (notification.type === "new_order") {
      router.push(`/admin/orders?search=${encodeURIComponent(notification.customerName)}`);
    }
  }

  function handleViewCustomerProfile(notification: Notification) {
    if (!notification.isRead) void markRead(notification.id);
    const review = notification.type === "new_comment" ? findReview(notification) : null;
    const phone = notification.customerPhone || review?.customerPhone || extractPhone(notification.message);
    const search = phone || notification.customerName || notification.customerEmail;
    router.push(`/admin/customers?search=${encodeURIComponent(search)}`);
  }

  async function openCustomerProfile(notification: Notification) {
    setSelectedNotification(notification);
    if (!notification.isRead) await markRead(notification.id);
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ZaviMart operations</span>
          <h1>Notification Center</h1>
          <p>Stay up to date with store orders, reviews, and inventory.</p>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.statsGrid} aria-label="Notification statistics">
        <article className={styles.statCard}><span>Total</span><strong>{stats.total}</strong></article>
        <article className={styles.statCard}><span>Unread</span><strong>{stats.unread}</strong></article>
        <article className={styles.statCard}><span>Today</span><strong>{stats.today}</strong></article>
      </section>

      <section className={styles.panel} aria-labelledby="notificationsHeading">
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Activity feed</span>
            <h2 id="notificationsHeading">All notifications</h2>
          </div>
          <button className={styles.primaryButton} type="button" onClick={() => void markAllRead()} disabled={!stats.unread}>
            Mark all as read
          </button>
        </div>

        <div className={styles.filters} role="group" aria-label="Filter notifications">
          {(["all", "orders", "comments"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? styles.activeFilter : styles.filterButton}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : value === "orders" ? "Orders" : "Comments"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className={styles.emptyState}>Loading notifications...</p>
        ) : visibleNotifications.length === 0 ? (
          <p className={styles.emptyState}>No notifications in this category.</p>
        ) : (
          <div className={styles.list}>
            {visibleNotifications.map((notification) => (
              <article
                className={`${styles.notificationCard} ${notification.isRead ? "" : styles.unreadCard}`}
                key={notification.id}
                role="button"
                tabIndex={0}
                aria-label={`View customer profile for ${notification.customerName || "notification"}`}
                onClick={() => void openCustomerProfile(notification)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openCustomerProfile(notification);
                  }
                }}
              >
                <span className={styles.icon} aria-hidden="true">
                  {notification.type === "new_order" ? "📦" :
                    notification.type === "new_comment" ? "💬" : "⚠️"}
                </span>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationHeading}>
                    <h3>{notification.title}</h3>
                    {!notification.isRead && <span className={styles.unreadLabel}>Unread</span>}
                  </div>
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleViewDetails(notification);
                  }}>View Details</button>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleViewCustomerProfile(notification);
                  }}>View Customer Profile</button>
                  {!notification.isRead && (
                    <button type="button" onClick={(event) => {
                      event.stopPropagation();
                      void markRead(notification.id);
                    }}>Mark read</button>
                  )}
                  <button className={styles.deleteButton} type="button" onClick={(event) => {
                    event.stopPropagation();
                    void deleteNotification(notification.id);
                  }}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedNotification && (
        (() => {
          const customer = findCustomer(selectedNotification);
          const review = selectedNotification.type === "new_comment" ? findReview(selectedNotification) : null;
          return (
            <CustomerProfileModal
              customerName={customer?.name || selectedNotification.customerName || "Customer profile unavailable"}
              customerPhone={customer?.phone || selectedNotification.customerPhone || review?.customerPhone || ""}
              customerEmail={customer?.email || selectedNotification.customerEmail || review?.customerEmail || ""}
              reviewId={review?.id || selectedNotification.commentId}
              onClose={() => setSelectedNotification(null)}
            />
          );
        })()
      )}
    </main>
  );
}
