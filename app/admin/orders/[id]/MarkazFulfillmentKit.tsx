"use client";

import { useState } from "react";
import styles from "./markaz-fulfillment.module.css";

export type FulfillmentOrder = {
  orderId: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAlternatePhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerAreaSector: string;
  customerStreetAddress: string;
  total: number;
  profit: number;
  sellingPrice: number;
  purchasePrice: number;
  products: Array<{
    productId: string;
    name: string;
    qty: number;
    price: number;
    profit: number;
    costPrice: number;
    markazProductId: string;
    markazProductUrl: string;
  }>;
};

function isMarkazUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase();
    const isMarkazHost = hostname === "markaz" ||
      hostname.startsWith("markaz.") ||
      hostname.endsWith(".markaz") ||
      hostname.includes(".markaz.");
    return ["https:", "http:"].includes(url.protocol) && isMarkazHost;
  } catch {
    return false;
  }
}

export default function MarkazFulfillmentKit({
  order,
  onStatusChange
}: {
  order: FulfillmentOrder;
  onStatusChange: (status: string) => void;
}) {
  const [products, setProducts] = useState(order.products);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function copyField(label: string, value: string) {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(`Could not copy ${label.toLocaleLowerCase()}. Please copy it manually.`);
      return;
    }

    if (label === "Street / Full Address" && order.status === "pending") {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": ""
          },
          body: JSON.stringify({ status: "processing" })
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          const reason = typeof result === "object" && result !== null && "error" in result
            ? String(result.error)
            : "Could not update the order status.";
          throw new Error(reason);
        }
        onStatusChange("processing");
        setMessage("Street / Full Address Copied. Order status updated to processing.");
      } catch (statusError) {
        setError(statusError instanceof Error
          ? `Address copied, but status could not be updated: ${statusError.message}`
          : "Address copied, but status could not be updated.");
      }
      return;
    }

    setMessage(`${label} Copied.`);
  }

  async function saveMarkazLink(index: number, product: FulfillmentOrder["products"][number]) {
    const key = `${product.productId}-${index}`;
    const markazProductUrl = (linkDrafts[key] ?? product.markazProductUrl).trim();
    if (!isMarkazUrl(markazProductUrl)) {
      setError("Enter a valid URL from a Markaz domain.");
      setMessage("");
      return;
    }
    if (!product.productId) {
      setError("This order item has no product ID, so its Markaz link cannot be saved to the catalog.");
      setMessage("");
      return;
    }

    setSavingKey(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.productId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ""
        },
        body: JSON.stringify({
          markazProductId: product.markazProductId || null,
          markazProductUrl
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const reason = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Could not save the Markaz product link.";
        throw new Error(reason);
      }
      setProducts((current) => current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, markazProductUrl } : entry
      ));
      setMessage(`Saved Markaz link for ${product.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the Markaz product link.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <aside className={styles.panel} aria-labelledby="markaz-fulfillment-heading">
      <header className={styles.header}>
        <span className={styles.eyebrow}>Fulfill this order</span>
        <h2 id="markaz-fulfillment-heading">🚀 Markaz Fulfillment Kit</h2>
        <p>Open each mapped item and paste the customer details to place the order.</p>
      </header>

      <section className={styles.autoPlaceSection} aria-label="Automatic Markaz order placement">
        <button className={`${styles.primaryButton} ${styles.autoPlaceUnavailable}`} type="button" disabled>
          🚀 Auto Place in Markaz (Not configured)
        </button>
        <p>Automatic placement requires a verified Markaz seller API and server credentials. Use the manual copy fields below.</p>
      </section>

      <section className={styles.productSection} aria-labelledby="markaz-products-heading">
        <h3 id="markaz-products-heading">Products</h3>
        {products.length ? products.map((product, index) => {
          const key = `${product.productId}-${index}`;
          const productUrl = isMarkazUrl(product.markazProductUrl) ? product.markazProductUrl : "";
          const searchUrl = `https://www.markaz.app/search?${new URLSearchParams({ q: product.name })}`;
          return (
            <article className={styles.product} key={key}>
              <div className={styles.productHeading}>
                <strong>{product.name}</strong>
                <span>Qty {product.qty}</span>
              </div>
              {product.markazProductId && <small>Markaz ID: {product.markazProductId}</small>}
              {productUrl ? (
                <a className={styles.openLink} href={productUrl} target="_blank" rel="noreferrer">
                  Open in Markaz App
                </a>
              ) : (
                <>
                  <p className={styles.warning}>Markaz link not set - fulfillment will be slow.</p>
                  <label className={styles.linkInput}>
                    <span>Markaz Product Link</span>
                    <input
                      type="url"
                      value={linkDrafts[key] ?? ""}
                      onChange={(event) => setLinkDrafts((current) => ({
                        ...current,
                        [key]: event.target.value
                      }))}
                      placeholder="https://markaz.app.link/product/..."
                    />
                  </label>
                  <div className={styles.productActions}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={savingKey === key}
                      onClick={() => void saveMarkazLink(index, product)}
                    >
                      {savingKey === key ? "Saving..." : "Save Markaz Link"}
                    </button>
                    <a className={styles.searchLink} href={searchUrl} target="_blank" rel="noreferrer">
                      Search on Markaz
                    </a>
                  </div>
                </>
              )}
            </article>
          );
        }) : <p className={styles.muted}>No order items are available.</p>}
      </section>

      <section className={styles.copySection} aria-labelledby="markaz-copy-heading">
        <h3 id="markaz-copy-heading">Copy for Markaz - one field at a time</h3>
        <div className={styles.copyFields}>
          {[
            { label: "Full Name", value: order.customerName },
            { label: "Phone Number", value: order.customerPhone },
            { label: "City", value: order.customerCity },
            {
              label: "Area / Sector",
              value: order.customerAreaSector
            },
            { label: "Street / Full Address", value: order.customerStreetAddress || order.customerAddress }
          ].map(({ label, value }) => (
            <div className={styles.copyField} key={label}>
              <div className={styles.copyFieldValue}>
                <span>
                  {label}
                </span>
                <strong>{value || "—"}</strong>
              </div>
              <button
                className={styles.copyFieldButton}
                type="button"
                disabled={!value}
                onClick={() => void copyField(label, value)}
              >
                Copy
              </button>
            </div>
          ))}
        </div>
        <div className={styles.profitSummary}>
          <div className={styles.profitCard}>
            <div className={styles.profitDetails}>
              <span>💰 Aapka Profit (Is Order Par)</span>
              <strong>Rs {order.profit.toLocaleString("en-PK")}</strong>
              <small>
                Sale: Rs {order.sellingPrice.toLocaleString("en-PK")} - Cost: Rs {order.purchasePrice.toLocaleString("en-PK")}
              </small>
            </div>
            <span className={styles.profitBadge}>Profit</span>
          </div>
        </div>
        <ol className={styles.guide}>
          <li>Select the city: <strong>{order.customerCity || "—"}</strong>.</li>
          <li>Search for and select the area: <strong>{order.customerAreaSector || "—"}</strong>.</li>
          <li>Paste the name, phone number, and street address into their separate fields.</li>
        </ol>
        <p className={styles.copyNote}>Copy and paste each customer field separately in Markaz.</p>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
    </aside>
  );
}
