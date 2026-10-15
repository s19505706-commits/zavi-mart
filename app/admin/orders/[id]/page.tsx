"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEGACY_PRODUCT_NAMES } from "../legacy-product-names";
import fulfillmentStyles from "./markaz-fulfillment.module.css";
import styles from "./order.module.css";

type OrderDetails = {
  orderId: string;
  status: string;
  date: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function catalogIdForLegacyProduct(id: string): string {
  if (!LEGACY_PRODUCT_NAMES[id] || !/^\d+$/.test(id)) return id;
  return Number(id).toString(16).padStart(24, "0");
}

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

export default function AdminOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [savingDelivered, setSavingDelivered] = useState(false);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState("");
  const [fulfillmentMessage, setFulfillmentMessage] = useState("");
  const [fulfillmentError, setFulfillmentError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/orders", {
        headers: { "x-admin-key": "" },
        cache: "no-store"
      }),
      fetch("/api/products?includeAdminFields=true&limit=100", {
        headers: { "x-admin-key": "" },
        cache: "no-store"
      })
    ]).then(async ([ordersResponse, catalogResponse]) => {
        const [result, catalogResult]: unknown[] = await Promise.all([
          ordersResponse.json(),
          catalogResponse.json()
        ]);
        if (!ordersResponse.ok || !isRecord(result) || !Array.isArray(result.orders)) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load order details.");
        }
        if (!catalogResponse.ok || !isRecord(catalogResult) || !Array.isArray(catalogResult.products)) {
          throw new Error(isRecord(catalogResult) && typeof catalogResult.error === "string"
            ? catalogResult.error
            : "Could not load product mapping details.");
        }
        const catalog = catalogResult.products.flatMap((entry): Array<{
          id: string;
          title: string;
          price: number;
          costPrice: number | null;
          wholesalePrice: number | null;
          profit: number | null;
          markazProductId: string;
          markazProductUrl: string;
        }> => isRecord(entry) && typeof entry._id === "string" && typeof entry.title === "string"
          ? [{
            id: typeof entry.id === "string" ? entry.id : entry._id,
            title: entry.title,
            price: typeof entry.price === "number" ? entry.price : 0,
            costPrice: typeof entry.costPrice === "number" ? entry.costPrice : null,
            wholesalePrice: typeof entry.wholesalePrice === "number" ? entry.wholesalePrice : null,
            profit: typeof entry.profit === "number" ? entry.profit : null,
            markazProductId: typeof entry.markazProductId === "string" ? entry.markazProductId : "",
            markazProductUrl: typeof entry.markazProductUrl === "string" ? entry.markazProductUrl : ""
          }]
          : []);
        const match = result.orders.find((entry) =>
          isRecord(entry) && [entry.orderId, entry.id, entry._id]
            .some((value) => typeof value === "string" && value === id)
        );
        if (!isRecord(match)) throw new Error("Order not found.");
        const customer = isRecord(match.customer) ? match.customer : {};
        const customerCity = [
          match.customerCity,
          match.city,
          customer.city
        ].find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? "";
        const addressSource = [
          match.fullAddress,
          customer.fullAddress,
          match.customerAddress,
          customer.address
        ].find((value): value is string => typeof value === "string" && Boolean(value.trim())) ?? "";
        const addressParts = addressSource.split(",").map((part) => part.trim()).filter(Boolean);
        if (customerCity && addressParts.at(-1)?.toLocaleLowerCase() === customerCity.toLocaleLowerCase()) {
          addressParts.pop();
        }
        const storedArea = [
          match.areaSector,
          match.area,
          match.customerAreaSector,
          customer.areaSector,
          customer.area
        ].find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? "";
        const customerAreaSector = storedArea || (addressParts.length > 1 ? addressParts.at(-1) ?? "" : "");
        const storedStreetAddress = [
          match.streetAddress,
          customer.streetAddress
        ].find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? "";
        const fallbackStreetAddress = customerAreaSector &&
          addressParts.at(-1)?.toLocaleLowerCase() === customerAreaSector.toLocaleLowerCase()
          ? addressParts.slice(0, -1).join(", ")
          : addressParts.join(", ");
        const customerStreetAddress = storedStreetAddress ||
          fallbackStreetAddress ||
          (typeof customer.address === "string" ? customer.address.trim() : "");
        const orderItems = Array.isArray(match.products) && match.products.length
          ? match.products
          : Array.isArray(match.items) ? match.items : [];
        const products = orderItems.flatMap((entry) => {
          if (!isRecord(entry)) return [];
          const rawId = entry.productId || entry.id;
          const itemId = typeof rawId === "string" || typeof rawId === "number"
            ? String(rawId)
            : rawId && typeof rawId === "object" && "toString" in rawId
              ? String(rawId)
              : "";
          const suppliedName = typeof entry.title === "string"
            ? entry.title
            : typeof entry.name === "string" ? entry.name : LEGACY_PRODUCT_NAMES[itemId] ?? "";
          const catalogProduct = catalog.find((product) =>
            product.id === itemId ||
            product.title.trim().toLocaleLowerCase() === suppliedName.trim().toLocaleLowerCase()
          );
          const name = suppliedName || catalogProduct?.title || `Product ${itemId || "unknown"}`;
          const quantity = entry.qty ?? entry.quantity;
          const price = typeof entry.price === "number"
            ? entry.price
            : typeof entry.unitPrice === "number" ? entry.unitPrice : catalogProduct?.price;
          if (typeof quantity !== "number" || typeof price !== "number") return [];
          const savedProfit = [entry.profit, entry.productProfit, entry.markazProfit]
            .find((value): value is number => typeof value === "number" && Number.isFinite(value) && value !== 0);
          const savedCostPrice = [entry.costPrice, entry.wholesalePrice]
            .find((value): value is number => typeof value === "number" && Number.isFinite(value));
          const catalogProfit = catalogProduct?.profit ??
            (catalogProduct && (catalogProduct.costPrice !== null || catalogProduct.wholesalePrice !== null)
              ? price - (catalogProduct.costPrice ?? catalogProduct.wholesalePrice ?? price)
              : 0);
          const itemProfit = savedProfit ?? (savedCostPrice !== undefined
            ? price - savedCostPrice
            : catalogProfit);
          const itemCostPrice = savedCostPrice ?? price - itemProfit;
          return [{
            productId: catalogProduct?.id ?? catalogIdForLegacyProduct(itemId),
            name: catalogProduct?.title ?? name,
            qty: quantity,
            price,
            profit: itemProfit,
            costPrice: itemCostPrice,
            markazProductId: typeof entry.markazProductId === "string" && entry.markazProductId
              ? entry.markazProductId
              : catalogProduct?.markazProductId ?? "",
            markazProductUrl: typeof entry.markazProductUrl === "string" && entry.markazProductUrl
              ? entry.markazProductUrl
              : catalogProduct?.markazProductUrl ?? ""
          }];
        });
        const parsedOrder: OrderDetails = {
          orderId: typeof match.orderId === "string" ? match.orderId : id,
          profit: typeof match.profit === "number" && match.profit !== 0
            ? match.profit
            : products.reduce((sum, product) => sum + product.profit * product.qty, 0),
          sellingPrice: products.reduce((sum, product) => sum + product.price * product.qty, 0),
          purchasePrice: products.reduce((sum, product) => sum + product.costPrice * product.qty, 0),
          customerName: typeof customer.name === "string" && customer.name.trim()
            ? customer.name.trim()
            : typeof match.customerName === "string" ? match.customerName : "Customer",
          customerPhone: typeof match.customerPhone === "string"
            ? match.customerPhone
            : typeof match.phone === "string" ? match.phone
              : typeof customer.phone === "string" ? customer.phone : "",
          customerAlternatePhone: typeof match.alternatePhone === "string"
            ? match.alternatePhone
            : typeof customer.alternatePhone === "string" ? customer.alternatePhone : "",
          customerEmail: typeof match.customerEmail === "string"
            ? match.customerEmail
            : typeof customer.email === "string" ? customer.email : "",
          customerAddress: typeof match.fullAddress === "string"
            ? match.fullAddress
            : typeof customer.fullAddress === "string" ? customer.fullAddress
              : typeof match.customerAddress === "string" ? match.customerAddress
              : [
                customerStreetAddress,
                customerAreaSector,
                customerCity
              ]
                .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
                .join(", "),
          customerCity,
          customerAreaSector,
          customerStreetAddress,
          status: typeof match.status === "string" ? match.status : "pending",
          date: typeof match.date === "string"
            ? match.date
            : typeof match.createdAt === "string" ? match.createdAt : "",
          total: typeof match.total === "number"
            ? match.total
            : typeof match.amount === "number" ? match.amount
              : typeof match.subtotal === "number" ? match.subtotal : 0,
          products
        };
        if (!cancelled) setOrder(parsedOrder);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load order details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function markAsDelivered() {
    if (!order || savingDelivered) return;
    setSavingDelivered(true);
    setDeliveryError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.orderId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ""
        },
        body: JSON.stringify({ status: "delivered" })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not mark the order as delivered.");
      }
      setOrder((current) => current ? { ...current, status: "delivered" } : current);
    } catch (updateError) {
      setDeliveryError(updateError instanceof Error ? updateError.message : "Could not mark the order as delivered.");
    } finally {
      setSavingDelivered(false);
    }
  }

  async function copyCustomerField(label: string, value: string) {
    setFulfillmentError("");
    setFulfillmentMessage("");
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setFulfillmentError(`Could not copy ${label.toLocaleLowerCase()}. Please copy it manually.`);
      return;
    }

    if (label === "Street / Full Address" && order?.status === "pending") {
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
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not update the order status.");
        }
        setOrder((current) => current ? { ...current, status: "processing" } : current);
        setFulfillmentMessage("Street / Full Address Copied. Order status updated to processing.");
      } catch (statusError) {
        setFulfillmentError(statusError instanceof Error
          ? `Address copied, but status could not be updated: ${statusError.message}`
          : "Address copied, but status could not be updated.");
      }
      return;
    }

    setFulfillmentMessage(`${label} Copied.`);
  }

  async function saveMarkazLink(index: number, product: OrderDetails["products"][number]) {
    const key = `${product.productId}-${index}`;
    const markazProductUrl = (linkDrafts[key] ?? product.markazProductUrl).trim();
    if (!isMarkazUrl(markazProductUrl)) {
      setFulfillmentError("Enter a valid URL from a Markaz domain.");
      setFulfillmentMessage("");
      return;
    }
    if (!product.productId) {
      setFulfillmentError("This order item has no product ID, so its Markaz link cannot be saved to the catalog.");
      setFulfillmentMessage("");
      return;
    }

    setSavingKey(key);
    setFulfillmentError("");
    setFulfillmentMessage("");
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
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not save the Markaz product link.");
      }
      setOrder((current) => current ? {
        ...current,
        products: current.products.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, markazProductUrl } : entry
        )
      } : current);
      setFulfillmentMessage(`Saved Markaz link for ${product.name}.`);
    } catch (saveError) {
      setFulfillmentError(saveError instanceof Error
        ? saveError.message
        : "Could not save the Markaz product link.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <Link href="/admin/orders" className={styles.backLink}>← Back to orders</Link>
      <h1>Order details</h1>
      {loading ? <p>Loading order...</p> : error ? (
        <p className={styles.error} role="alert">{error}</p>
      ) : order ? (
        <div className={styles.layout}>
          <section className={styles.panel}>
            <h2>{order.orderId}</h2>
            <dl className={styles.details}>
              <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
              <div><dt>Phone</dt><dd>{order.customerPhone || "—"}</dd></div>
              <div><dt>Alternate phone</dt><dd>{order.customerAlternatePhone || "—"}</dd></div>
              <div><dt>Email</dt><dd>{order.customerEmail || "—"}</dd></div>
              <div><dt>Status</dt><dd>{order.status}</dd></div>
              <div><dt>Date</dt><dd>{order.date ? new Date(order.date).toLocaleString() : "—"}</dd></div>
              <div><dt>Total</dt><dd>Rs {order.total.toLocaleString("en-PK")}</dd></div>
              <div><dt>Address</dt><dd>{order.customerAddress || "—"}</dd></div>
              <div><dt>City</dt><dd>{order.customerCity || "—"}</dd></div>
              <div><dt>Area / Sector</dt><dd>{order.customerAreaSector || "—"}</dd></div>
              <div><dt>Street address</dt><dd>{order.customerStreetAddress || "—"}</dd></div>
            </dl>
            {order.status === "processing" && (
              <div className={styles.deliveryPrompt}>
                <p className={styles.deliveryPromptTitle}>📦 Order Processing Me Hai</p>
                <p className={styles.deliveryPromptText}>Jab Markaz app me Delivered show ho, button dabayein.</p>
                {deliveryError && <p className={styles.error} role="alert">{deliveryError}</p>}
                <button
                  className={styles.markDeliveredButton}
                  type="button"
                  disabled={savingDelivered}
                  onClick={() => {
                    if (window.confirm(`Mark order ${order.orderId} as Delivered?`)) {
                      void markAsDelivered();
                    }
                  }}
                >
                  {savingDelivered ? "Saving..." : "✅ Mark as Delivered - Customer ko mil gaya"}
                </button>
              </div>
            )}
            <h3>Products</h3>
            {order.products.length ? (
              <ul className={styles.products}>
                {order.products.map((product, index) => (
                  <li key={`${product.productId}-${index}`}>
                    <span>{product.name} × {product.qty}</span>
                    <strong>Rs {(product.price * product.qty).toLocaleString("en-PK")}</strong>
                  </li>
                ))}
              </ul>
            ) : <p>No product details are available for this order.</p>}
          </section>
          <aside className={fulfillmentStyles.panel} aria-labelledby="markaz-fulfillment-heading">
            <header className={fulfillmentStyles.header}>
              <span className={fulfillmentStyles.eyebrow}>Fulfill this order</span>
              <h2 id="markaz-fulfillment-heading">🚀 Markaz Fulfillment Kit</h2>
              <p>Open each mapped item and paste the customer details to place the order.</p>
            </header>

            <section className={fulfillmentStyles.autoPlaceSection} aria-label="Automatic Markaz order placement">
              <button className={`${fulfillmentStyles.primaryButton} ${fulfillmentStyles.autoPlaceUnavailable}`} type="button" disabled>
                🚀 Auto Place in Markaz (Not configured)
              </button>
              <p>Automatic placement requires a verified Markaz seller API and server credentials. Use the manual copy fields below.</p>
            </section>

            <section className={fulfillmentStyles.productSection} aria-labelledby="markaz-products-heading">
              <h3 id="markaz-products-heading">Products</h3>
              {order.products.length ? order.products.map((product, index) => {
                const key = `${product.productId}-${index}`;
                const productUrl = isMarkazUrl(product.markazProductUrl) ? product.markazProductUrl : "";
                const searchUrl = `https://www.markaz.app/search?${new URLSearchParams({ q: product.name })}`;
                return (
                  <article className={fulfillmentStyles.product} key={key}>
                    <div className={fulfillmentStyles.productHeading}>
                      <strong>{product.name}</strong>
                      <span>Qty {product.qty}</span>
                    </div>
                    {product.markazProductId && <small>Markaz ID: {product.markazProductId}</small>}
                    {productUrl ? (
                      <a className={fulfillmentStyles.openLink} href={productUrl} target="_blank" rel="noreferrer">
                        Open in Markaz App
                      </a>
                    ) : (
                      <>
                        <p className={fulfillmentStyles.warning}>Markaz link not set - fulfillment will be slow.</p>
                        <label className={fulfillmentStyles.linkInput}>
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
                        <div className={fulfillmentStyles.productActions}>
                          <button
                            className={fulfillmentStyles.primaryButton}
                            type="button"
                            disabled={savingKey === key}
                            onClick={() => void saveMarkazLink(index, product)}
                          >
                            {savingKey === key ? "Saving..." : "Save Markaz Link"}
                          </button>
                          <a className={fulfillmentStyles.searchLink} href={searchUrl} target="_blank" rel="noreferrer">
                            Search on Markaz
                          </a>
                        </div>
                      </>
                    )}
                  </article>
                );
              }) : <p className={fulfillmentStyles.muted}>No order items are available.</p>}
            </section>

            <section className={fulfillmentStyles.copySection} aria-labelledby="markaz-copy-heading">
              <h3 id="markaz-copy-heading">Copy for Markaz - one field at a time</h3>
              <div className={fulfillmentStyles.copyFields}>
                {[
                  { label: "Full Name", value: order.customerName },
                  { label: "Phone Number", value: order.customerPhone },
                  { label: "City", value: order.customerCity },
                  { label: "Area / Sector", value: order.customerAreaSector },
                  { label: "Street / Full Address", value: order.customerStreetAddress || order.customerAddress }
                ].map(({ label, value }) => (
                  <div className={fulfillmentStyles.copyField} key={label}>
                    <div className={fulfillmentStyles.copyFieldValue}>
                      <span>{label}</span>
                      <strong>{value || "—"}</strong>
                    </div>
                    <button
                      className={fulfillmentStyles.copyFieldButton}
                      type="button"
                      disabled={!value}
                      onClick={() => void copyCustomerField(label, value)}
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
              <div className={fulfillmentStyles.profitSummary}>
                <div className={fulfillmentStyles.profitCard}>
                  <div className={fulfillmentStyles.profitDetails}>
                    <span>💰 Aapka Profit (Is Order Par)</span>
                    <strong>Rs {order.profit.toLocaleString("en-PK")}</strong>
                    <small>
                      Sale: Rs {order.sellingPrice.toLocaleString("en-PK")} - Cost: Rs {order.purchasePrice.toLocaleString("en-PK")}
                    </small>
                  </div>
                  <span className={fulfillmentStyles.profitBadge}>Profit</span>
                </div>
              </div>
              <ol className={fulfillmentStyles.guide}>
                <li>Select the city: <strong>{order.customerCity || "—"}</strong>.</li>
                <li>Search for and select the area: <strong>{order.customerAreaSector || "—"}</strong>.</li>
                <li>Paste the name, phone number, and street address into their separate fields.</li>
              </ol>
              <p className={fulfillmentStyles.copyNote}>Copy and paste each customer field separately in Markaz.</p>
            </section>

            {fulfillmentError && <p className={fulfillmentStyles.error} role="alert">{fulfillmentError}</p>}
            {fulfillmentMessage && <p className={fulfillmentStyles.success} role="status">{fulfillmentMessage}</p>}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
