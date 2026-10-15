"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LEGACY_PRODUCT_NAMES } from "../legacy-product-names";
import MarkazFulfillmentKit, { type FulfillmentOrder } from "./MarkazFulfillmentKit";
import styles from "./order.module.css";

type OrderDetails = FulfillmentOrder & {
  status: string;
  date: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function catalogIdForLegacyProduct(id: string): string {
  if (!LEGACY_PRODUCT_NAMES[id] || !/^\d+$/.test(id)) return id;
  return Number(id).toString(16).padStart(24, "0");
}

export default function AdminOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [savingDelivered, setSavingDelivered] = useState(false);

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
          <MarkazFulfillmentKit
            key={order.orderId}
            order={order}
            onStatusChange={(status) => setOrder((current) =>
              current ? { ...current, status } : current
            )}
          />
        </div>
      ) : null}
    </main>
  );
}
