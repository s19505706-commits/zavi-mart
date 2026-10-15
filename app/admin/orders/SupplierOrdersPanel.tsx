"use client";

import { useEffect, useState } from "react";
import styles from "../supplier-orders/supplier-orders.module.css";

type SupplierProduct = {
  productId: string;
  name: string;
  qty: number;
  markazProductId: string;
  markazProductUrl: string;
  isMarkazProduct: boolean;
  supplierName: string;
  selectedVariants: Record<string, string>;
  variantId: string;
};

type SupplierOrder = {
  id: string;
  orderId: string;
  date: string;
  customerName: string;
  phone: string;
  alternatePhone: string;
  city: string;
  areaSector: string;
  streetAddress: string;
  fullAddress: string;
  products: SupplierProduct[];
  supplierOrderedOnMarkaz: boolean;
};

const ADMIN_KEY = "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function markazUrl(value: string): string {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && /(^|\.)markaz\./i.test(url.hostname)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function parseSupplierOrder(value: unknown): SupplierOrder | null {
  if (!isRecord(value)) return null;
  const orderId = textValue(value.orderId || value.id || value._id);
  if (!orderId) return null;
  const customer = isRecord(value.customer) ? value.customer : {};
  const products = (Array.isArray(value.products) ? value.products : Array.isArray(value.items) ? value.items : [])
    .flatMap((entry): SupplierProduct[] => {
      if (!isRecord(entry)) return [];
      const supplier = isRecord(entry.supplier) ? entry.supplier : {};
      const supplierName = textValue(supplier.name);
      const url = textValue(entry.markazProductUrl || entry.supplierUrl || supplier.productUrl);
      const id = textValue(entry.markazProductId);
      const selectedVariants = isRecord(entry.selectedVariants)
        ? Object.fromEntries(Object.entries(entry.selectedVariants)
          .filter(([, option]) => typeof option === "string")
          .map(([name, option]) => [name, String(option)]))
        : {};
      const imported = entry.isMarkazProduct === true || Boolean(supplierName || id || markazUrl(url));
      if (!imported) return [];
      const qty = Number(entry.qty ?? entry.quantity ?? 1);
      if (!Number.isInteger(qty) || qty < 1) return [];
      return [{
        productId: textValue(entry.productId || entry.id),
        name: textValue(entry.title || entry.name, "Imported supplier product"),
        qty,
        markazProductId: id,
        markazProductUrl: markazUrl(url),
        isMarkazProduct: entry.isMarkazProduct === true,
        supplierName,
        selectedVariants,
        variantId: textValue(entry.variantId)
      }];
    });
  if (!products.length) return null;

  const streetAddress = textValue(value.streetAddress || customer.streetAddress);
  const areaSector = textValue(value.areaSector || customer.areaSector);
  const city = textValue(value.customerCity || value.city || customer.city);
  const fallbackAddress = textValue(customer.address);
  const fullAddress = textValue(value.fullAddress || customer.fullAddress) ||
    [streetAddress, areaSector, city].filter(Boolean).join(", ") ||
    [fallbackAddress, city].filter(Boolean).join(", ");

  return {
    id: textValue(value._id || value.id || orderId),
    orderId,
    date: textValue(value.createdAt || value.date),
    customerName: textValue(value.customerName || customer.name, "Customer"),
    phone: textValue(value.customerPhone || value.phone || customer.phone),
    alternatePhone: textValue(value.alternatePhone || customer.alternatePhone),
    city,
    areaSector,
    streetAddress: streetAddress || fallbackAddress,
    fullAddress,
    products,
    supplierOrderedOnMarkaz: value.supplierOrderedOnMarkaz === true
  };
}

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.startsWith("3")) return `92${digits}`;
  return digits;
}

export default function SupplierOrdersPanel() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders", {
      headers: { "x-admin-key": ADMIN_KEY },
      cache: "no-store"
    }).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !Array.isArray(result.orders)) {
        const message = isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load supplier orders.";
        throw new Error(message);
      }
      const supplierOrders = result.orders
        .map(parseSupplierOrder)
        .filter((order): order is SupplierOrder => order !== null);
      if (!cancelled) setOrders(supplierOrders);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load supplier orders.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyDetails(label: string, value: string) {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch (copyError) {
      console.error(`Could not copy supplier order ${label.toLocaleLowerCase()}.`, copyError);
      setCopyMessage("Clipboard access failed. Please copy the details manually.");
    }
  }

  async function markOrdered(order: SupplierOrder) {
    setSavingOrderId(order.orderId);
    setError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
        body: JSON.stringify({ supplierOrderedOnMarkaz: true })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not update supplier order status.");
      }
      setOrders((current) => current.map((entry) => entry.orderId === order.orderId
        ? { ...entry, supplierOrderedOnMarkaz: true }
        : entry));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update supplier order status.");
    } finally {
      setSavingOrderId("");
    }
  }

  return (
    <section className={styles.page} aria-label="Supplier orders for Markaz">
      <header className={styles.header}>
        <span className={styles.eyebrow}>Supplier fulfillment</span>
        <h1>Supplier Orders - Markaz Fulfillment</h1>
        <p>Open imported items in Markaz, copy delivery details, and track orders placed with the supplier.</p>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {copyMessage && <p className={styles.notice} role="status">{copyMessage}</p>}
      {loading ? <p className={styles.empty}>Loading supplier orders...</p> : orders.length === 0 ? (
        <p className={styles.empty}>No orders with imported supplier products yet.</p>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => {
            const whatsappText = `Hello ${order.customerName}, we are processing your ZaviMart order ${order.orderId}.`;
            const whatsappUrl = whatsappNumber(order.phone)
              ? `https://wa.me/${whatsappNumber(order.phone)}?text=${encodeURIComponent(whatsappText)}`
              : "";
            const allDetails = [
              `Customer name: ${order.customerName}`,
              `Phone: ${order.phone || "—"}`,
              `Alternate phone: ${order.alternatePhone || "—"}`,
              `City: ${order.city || "—"}`,
              `Area / Sector: ${order.areaSector || "—"}`,
              `Street address: ${order.streetAddress || "—"}`,
              `Full address: ${order.fullAddress || "—"}`,
              "",
              "Products:",
              ...order.products.map((product) =>
                `${product.qty} x ${product.name}${Object.keys(product.selectedVariants).length
                  ? ` (${Object.entries(product.selectedVariants).map(([name, value]) => `${name}: ${value}`).join(", ")})`
                  : ""}${product.variantId ? ` (Variant ID: ${product.variantId})` : ""}${product.markazProductId ? ` (Markaz ID: ${product.markazProductId})` : ""}`
              )
            ].join("\n");

            return (
              <article className={styles.orderCard} key={order.orderId}>
                <div className={styles.orderHeading}>
                  <div>
                    <h2>{order.orderId}</h2>
                    <time dateTime={order.date}>{order.date ? new Date(order.date).toLocaleString() : "Date unavailable"}</time>
                  </div>
                  <span className={order.supplierOrderedOnMarkaz ? styles.orderedBadge : styles.pendingBadge}>
                    {order.supplierOrderedOnMarkaz ? "Ordered on Markaz" : "Not ordered"}
                  </span>
                </div>

                <section className={styles.section} aria-label="Supplier products">
                  <h3>Products</h3>
                  {order.products.map((product, index) => {
                    const searchUrl = `https://www.markaz.app/search?${new URLSearchParams({ q: product.name })}`;
                    return (
                      <div className={styles.product} key={`${product.productId}-${index}`}>
                        <div>
                          <strong>{product.name}</strong>
                          <span>Qty: {product.qty}{product.supplierName ? ` · ${product.supplierName}` : ""}</span>
                          {Object.keys(product.selectedVariants).length > 0 && (
                            <span>Options: {Object.entries(product.selectedVariants).map(([name, value]) => `${name}: ${value}`).join(" · ")}</span>
                          )}
                          {product.variantId && <span>Variant ID: {product.variantId}</span>}
                        </div>
                        {product.markazProductUrl ? (
                          <a className={styles.secondaryButton} href={product.markazProductUrl} target="_blank" rel="noopener noreferrer">
                            Open in Markaz App
                          </a>
                        ) : (
                          <a className={styles.secondaryButton} href={searchUrl} target="_blank" rel="noopener noreferrer">
                            Search on Markaz
                          </a>
                        )}
                      </div>
                    );
                  })}
                </section>

                <section className={styles.section} aria-label="Customer details for Markaz">
                  <h3>Customer details for copy-paste</h3>
                  <div className={styles.copyGrid}>
                    {[
                      ["Customer name", order.customerName],
                      ["Phone", order.phone],
                      ["City", order.city],
                      ["Area / Sector", order.areaSector],
                      ["Street address", order.streetAddress]
                    ].map(([label, value]) => (
                      <div className={styles.copyRow} key={label}>
                        <span>{label}<strong>{value || "—"}</strong></span>
                        <button type="button" className={styles.secondaryButton} disabled={!value}
                          onClick={() => void copyDetails(label, value)}>Copy</button>
                      </div>
                    ))}
                  </div>
                  <label className={styles.fullDetails}>
                    Full formatted details for Markaz
                    <textarea readOnly rows={9} value={allDetails} />
                  </label>
                  <button type="button" className={styles.primaryButton} onClick={() => void copyDetails("All details", allDetails)}>
                    Copy All Details
                  </button>
                </section>

                <div className={styles.actions}>
                  {whatsappUrl
                    ? <a className={styles.whatsappButton} href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp Customer</a>
                    : <span className={styles.muted}>No customer phone number</span>}
                  <button type="button" className={styles.primaryButton}
                    disabled={order.supplierOrderedOnMarkaz || savingOrderId === order.orderId}
                    onClick={() => void markOrdered(order)}>
                    {order.supplierOrderedOnMarkaz ? "Ordered on Markaz" : savingOrderId === order.orderId ? "Saving..." : "Mark as Ordered on Markaz"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
