"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./customer-profile.module.css";

type ProfileOrder = {
  id: string;
  date: string;
  products: Array<{ id: string; name: string; qty: number }>;
  total: number;
  status: string;
};

type ProfileReview = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  customerPhone: string;
  customerEmail: string;
  comment: string;
  rating: number;
  createdAt: string;
  isVerifiedPurchase: boolean;
  verifiedPurchaseDate: string;
  adminReply: string;
  adminReplyDate: string;
};

type ProductImage = { id: string; title: string; image: string };
type Tab = "orders" | "reviews" | "replies";
type CustomerIdentity = { name: string; phone: string; email: string };

type Props = {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  reviewId?: string;
  onClose: () => void;
  adminKey?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}

function formatRs(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
}

function storedAdminKey(): string {
  try {
    return sessionStorage.getItem("zavimart-admin-key")?.trim() || "";
  } catch {
    return "";
  }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function matchesIdentity(
  record: Record<string, unknown>,
  identity: CustomerIdentity
): boolean {
  const customer = isRecord(record.customer) ? record.customer : {};
  const recordPhone = text(record.customerPhone || customer.phone);
  const recordEmail = text(record.customerEmail || customer.email);
  return (!!identity.phone && !!recordPhone &&
      normalizePhone(identity.phone) === normalizePhone(recordPhone)) ||
    (!!identity.email && !!recordEmail &&
      normalizeName(identity.email) === normalizeName(recordEmail));
}

export default function CustomerProfileModal({
  customerName,
  customerPhone = "",
  customerEmail = "",
  reviewId = "",
  onClose,
  adminKey: providedAdminKey
}: Props) {
  const [orders, setOrders] = useState<ProfileOrder[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [contact, setContact] = useState({ phone: customerPhone, email: customerEmail });
  const [tab, setTab] = useState<Tab>("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState("");
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [replyError, setReplyError] = useState("");
  const currentAdminKey = providedAdminKey?.trim() || storedAdminKey();
  const identity: CustomerIdentity = { name: customerName, phone: customerPhone, email: customerEmail };

  useEffect(() => {
    let cancelled = false;
    setContact({ phone: customerPhone, email: customerEmail });
    const headers = { "x-admin-key": currentAdminKey };
    const load = async () => {
      setLoading(true);
      setError("");
      const [ordersResult, commentsResult, productsResult] = await Promise.allSettled([
        fetch(`/api/orders?_=${Date.now()}`, { headers, cache: "no-store" }).then(async (response) => {
          const value: unknown = await response.json();
          if (!response.ok || !isRecord(value) || !Array.isArray(value.orders)) {
            throw new Error(isRecord(value) && typeof value.error === "string" ? value.error : "Could not load orders.");
          }
          return value.orders;
        }),
        fetch(`/api/comments?_=${Date.now()}`, { cache: "no-store" }).then(async (response) => {
          const value: unknown = await response.json();
          if (!response.ok) throw new Error("Could not load reviews.");
          return Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.comments) ? value.comments : [];
        }),
        fetch(`/api/products?limit=100&_=${Date.now()}`, { cache: "no-store" }).then(async (response) => {
          const value: unknown = await response.json();
          if (!response.ok || !isRecord(value) || !Array.isArray(value.products)) return [];
          return value.products;
        })
      ]);

      if (cancelled) return;

      const productRows = productsResult.status === "fulfilled"
        ? productsResult.value.flatMap((value): ProductImage[] => {
          if (!isRecord(value)) return [];
          const id = text(value._id || value.id);
          const title = text(value.title || value.name);
          const image = text(value.image) || (Array.isArray(value.images) ? text(value.images[0]) : "");
          return id ? [{ id, title, image }] : [];
        })
        : [];
      const matchingOrders = ordersResult.status === "fulfilled"
        ? ordersResult.value.flatMap((value): ProfileOrder[] => {
          if (!isRecord(value) || (!identity.phone && !identity.email) || !matchesIdentity(value, identity)) return [];
          const rawProducts = Array.isArray(value.products) ? value.products : Array.isArray(value.items) ? value.items : [];
          const orderProducts = rawProducts.flatMap((item): ProfileOrder["products"] => {
            if (!isRecord(item)) return [];
            const quantity = Number(item.qty ?? item.quantity ?? 1);
            if (!Number.isInteger(quantity) || quantity < 1) return [];
            return [{
              id: text(item.productId || item.id),
              name: text(item.name || item.title) || "Product",
              qty: quantity
            }];
          });
          return [{
            id: text(value.orderId || value.id || value._id) || "Order",
            date: text(value.date || value.createdAt),
            products: orderProducts,
            total: Number(value.total ?? value.amount ?? value.subtotal ?? 0) || 0,
            status: text(value.status || value.orderStatus) || "pending"
          }];
        })
        : [];
      matchingOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(matchingOrders);
      if (ordersResult.status === "rejected") setError(ordersResult.reason instanceof Error ? ordersResult.reason.message : "Could not load orders.");
      else {
        const matchedOrder = ordersResult.value.find((value) =>
          isRecord(value) && (identity.phone || identity.email) && matchesIdentity(value, identity)
        );
        if (isRecord(matchedOrder)) {
          const customer = isRecord(matchedOrder.customer) ? matchedOrder.customer : {};
          setContact({
            phone: text(matchedOrder.customerPhone || customer.phone) || customerPhone,
            email: text(matchedOrder.customerEmail || customer.email) || customerEmail
          });
        }
      }

      const matchingReviews = commentsResult.status === "fulfilled"
        ? commentsResult.value.flatMap((value): ProfileReview[] => {
          if (!isRecord(value)) return [];
          const commentMatchesIdentity = (identity.phone || identity.email) && matchesIdentity(value, identity);
          if (!commentMatchesIdentity && !(reviewId && text(value.id) === reviewId)) return [];
          const productId = text(value.productId);
          const product = productRows.find((entry) => entry.id === productId) ??
            productRows.find((entry) => normalizeName(entry.title) === normalizeName(text(value.productName)));
          const verified = value.isVerifiedPurchase === true;
          const verifiedOrder = verified
            ? matchingOrders.find((order) => order.products.some((item) => item.id === productId))
            : undefined;
          return [{
            id: text(value.id),
            productId,
            productName: text(value.productName) || product?.title || "Product",
            productImage: product?.image ?? "",
            customerPhone: text(value.customerPhone),
            customerEmail: text(value.customerEmail),
            comment: text(value.comment),
            rating: Number(value.rating) || 0,
            createdAt: text(value.createdAt),
            isVerifiedPurchase: verified,
            verifiedPurchaseDate: verifiedOrder?.date ?? "",
            adminReply: text(value.adminReply),
            adminReplyDate: text(value.adminReplyDate)
          }];
        })
        : [];
      setReviews(matchingReviews);
      if (commentsResult.status === "rejected" && !error) {
        setError(commentsResult.reason instanceof Error ? commentsResult.reason.message : "Could not load reviews.");
      }
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [customerName, customerPhone, customerEmail, reviewId, currentAdminKey]);

  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const averageRating = useMemo(() => reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0, [reviews]);
  const repliedReviews = useMemo(() => reviews.filter((review) => review.adminReply), [reviews]);

  async function submitReply(event: FormEvent<HTMLFormElement>, review: ProfileReview) {
    event.preventDefault();
    const adminReply = replyText.trim();
    if (!adminReply || savingReply) return;
    setSavingReply(true);
    setReplyError("");
    const adminReplyDate = new Date().toISOString();
    try {
      const response = await fetch("/api/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": currentAdminKey },
        body: JSON.stringify({ commentId: review.id, adminReply, adminReplyDate })
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !isRecord(result.comment)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not save the reply.");
      }
      setReviews((current) => current.map((entry) => entry.id === review.id
        ? { ...entry, adminReply, adminReplyDate }
        : entry));
      setReplyText("");
      setReplyingTo("");
    } catch (saveError) {
      setReplyError(saveError instanceof Error ? saveError.message : "Could not save the reply.");
    } finally {
      setSavingReply(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customerProfileTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Customer profile</span>
            <h2 id="customerProfileTitle">{customerName}</h2>
            {(contact.phone || contact.email) && <p>{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>}
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close customer profile">×</button>
        </header>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <section className={styles.stats} aria-label="Customer stats">
          <article><span>Total Orders</span><strong>{orders.length}</strong></article>
          <article><span>Total Spent</span><strong>{formatRs(totalSpent)}</strong></article>
          <article><span>Reviews Given</span><strong>{reviews.length}</strong></article>
          <article><span>Avg Rating Given</span><strong>{averageRating ? `${averageRating.toFixed(1)} ★` : "—"}</strong></article>
        </section>

        <div className={styles.tabs} role="tablist" aria-label="Customer history">
          <button type="button" role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")}>Orders</button>
          <button type="button" role="tab" aria-selected={tab === "reviews"} onClick={() => setTab("reviews")}>Reviews & Ratings</button>
          <button type="button" role="tab" aria-selected={tab === "replies"} onClick={() => setTab("replies")}>Admin Replies</button>
        </div>

        {loading ? (
          <p className={styles.emptyState}>Loading customer history...</p>
        ) : tab === "orders" ? (
          orders.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.orderTable}>
                <thead><tr><th>Order ID</th><th>Date</th><th>Products</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr key={`${order.id}-${index}`}>
                      <td>{order.id}</td>
                      <td>{formatDate(order.date)}</td>
                      <td>{order.products.map((product) => `${product.name} × ${product.qty}`).join(", ") || "—"}</td>
                      <td>{formatRs(order.total)}</td>
                      <td>{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className={styles.emptyState}>New Customer — no orders yet.</p>
        ) : tab === "reviews" ? (
          reviews.length ? (
            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <article className={styles.reviewCard} key={review.id}>
                  <div className={styles.reviewProduct}>
                    {review.productImage
                      ? <Image src={review.productImage} alt="" width={52} height={52} unoptimized />
                      : <span className={styles.imageFallback} aria-hidden="true">★</span>}
                    <div>
                      <strong>{review.productName}</strong>
                      <span className={styles.stars} aria-label={`${review.rating} out of 5 stars`}>
                        {"★".repeat(Math.max(0, Math.min(5, review.rating)))}
                      </span>
                    </div>
                    <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                  </div>
                  <p className={styles.reviewText}>{review.comment}</p>
                  <p className={review.isVerifiedPurchase ? styles.verifiedPurchase : styles.unverifiedPurchase}>
                    {review.isVerifiedPurchase
                      ? `✅ Verified Buyer${review.verifiedPurchaseDate
                        ? ` - Purchased on ${new Date(review.verifiedPurchaseDate).toLocaleDateString()}`
                        : ""}`
                      : "⚠️ Unverified - No order found for this phone"}
                  </p>
                  {review.adminReply ? (
                    <p className={styles.replyDisplay}>
                      <strong>You replied:</strong> {review.adminReply}
                      <time dateTime={review.adminReplyDate}>{formatDate(review.adminReplyDate)}</time>
                    </p>
                  ) : replyingTo === review.id ? (
                    <form className={styles.replyForm} onSubmit={(event) => void submitReply(event, review)}>
                      <label>
                        Write reply to customer
                        <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} maxLength={2000} required />
                      </label>
                      {replyError && <p className={styles.error} role="alert">{replyError}</p>}
                      <div>
                        <button className={styles.primaryButton} type="submit" disabled={savingReply}>
                          {savingReply ? "Sending..." : "Send Reply"}
                        </button>
                        <button className={styles.cancelButton} type="button" onClick={() => {
                          setReplyingTo("");
                          setReplyText("");
                          setReplyError("");
                        }}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button className={styles.replyButton} type="button" onClick={() => {
                      setReplyingTo(review.id);
                      setReplyText("");
                      setReplyError("");
                    }}>Reply</button>
                  )}
                </article>
              ))}
            </div>
          ) : <p className={styles.emptyState}>No reviews found for this customer.</p>
        ) : (
          repliedReviews.length ? (
            <div className={styles.reviewList}>
              {repliedReviews.map((review) => (
                <article className={styles.reviewCard} key={review.id}>
                  <strong>{review.productName}</strong>
                  <p className={styles.reviewText}>{review.comment}</p>
                  <p className={styles.replyDisplay}>
                    <strong>You replied:</strong> {review.adminReply}
                    <time dateTime={review.adminReplyDate}>{formatDate(review.adminReplyDate)}</time>
                  </p>
                </article>
              ))}
            </div>
          ) : <p className={styles.emptyState}>No admin replies yet.</p>
        )}
      </section>
    </div>
  );
}
