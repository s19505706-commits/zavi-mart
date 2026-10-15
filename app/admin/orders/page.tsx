"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomerProfileModal from "../CustomerProfileModal";
import { LEGACY_PRODUCT_NAMES } from "./legacy-product-names";
import SupplierOrdersPanel from "./SupplierOrdersPanel";
import AdminCard from "../../../components/admin/AdminCard";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import styles from "./orders.module.css";

type CatalogProduct = {
  id: string;
  title: string;
  image: string;
  price: number;
  profit: number | null;
  wholesalePrice: number | null;
  category: string;
};

type OrderProduct = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image: string;
  profit: number;
};

type AdminOrder = {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  products: OrderProduct[];
  total: number;
  profit: number;
  date: string;
  status: string;
};

type ProductSummary = {
  key: string;
  productId: string;
  name: string;
  image: string;
  qty: number;
  revenue: number;
  orders: number;
};

const ADMIN_KEY = "";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function productFromCatalog(id: string, name: string, products: CatalogProduct[]): CatalogProduct | undefined {
  const normalizedName = name.trim().toLocaleLowerCase();
  const exactMatch = products.find((product) => product.id === id) ??
    products.find((product) => product.title.trim().toLocaleLowerCase() === normalizedName);
  if (exactMatch) return exactMatch;

  const orderWords = new Set(normalizedName.split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  return products
    .map((product) => {
      const productWords = new Set(product.title.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
      const overlap = [...orderWords].filter((word) => productWords.has(word)).length;
      return { product, score: orderWords.size ? overlap / Math.max(orderWords.size, productWords.size) : 0 };
    })
    .filter(({ score }) => score >= 0.5)
    .sort((left, right) => right.score - left.score)[0]?.product;
}

function parseOrder(value: unknown, catalog: CatalogProduct[]): AdminOrder | null {
  if (!isRecord(value)) return null;
  const orderId = textValue(value.orderId || value.id || value._id);
  if (!orderId) return null;

  const customer = isRecord(value.customer) ? value.customer : {};
  const rawProducts = Array.isArray(value.products)
    ? value.products
    : Array.isArray(value.items)
      ? value.items
      : [];
  const products = rawProducts.flatMap((rawProduct): OrderProduct[] => {
    if (!isRecord(rawProduct)) return [];
    const productId = textValue(rawProduct.productId || rawProduct.id);
    const providedName = textValue(rawProduct.name || rawProduct.title);
    const name = providedName || LEGACY_PRODUCT_NAMES[productId] || `Product ${productId || "unknown"}`;
    const catalogProduct = productFromCatalog(productId, name, catalog);
    const price = Number(rawProduct.price ?? rawProduct.unitPrice ?? catalogProduct?.price ?? 0);
    const qty = Number(rawProduct.qty ?? rawProduct.quantity ?? 1);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(qty) || qty < 1) return [];
    const savedProfit = [rawProduct.profit, rawProduct.productProfit, rawProduct.markazProfit]
      .find((candidate): candidate is number =>
        typeof candidate === "number" && Number.isFinite(candidate) && candidate !== 0
      );
    const itemProfit = savedProfit ?? catalogProduct?.profit ??
      (catalogProduct?.wholesalePrice !== null && catalogProduct?.wholesalePrice !== undefined
        ? price - catalogProduct.wholesalePrice
        : 0);
    return [{
      productId: catalogProduct?.id ?? productId,
      name: catalogProduct?.title ?? name,
      price,
      qty,
      image: textValue(rawProduct.image, catalogProduct?.image ?? ""),
      profit: itemProfit
    }];
  });
  const total = Number(value.total ?? value.amount ?? value.subtotal ?? 0);
  if (!Number.isFinite(total) || total < 0) return null;
  const status = textValue(value.status || value.orderStatus, "pending");

  return {
    id: textValue(value._id || value.id || orderId),
    orderId,
    customerName: textValue(value.customerName || customer.name, "Customer"),
    customerPhone: textValue(value.customerPhone || customer.phone),
    customerEmail: textValue(value.customerEmail || customer.email),
    customerAddress: textValue(value.fullAddress || customer.fullAddress) ||
      [
        customer.streetAddress,
        customer.areaSector,
        customer.streetAddress || customer.areaSector ? "" : customer.address,
        customer.city,
        customer.postalCode
      ].filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .join(", "),
    products,
    total,
    profit: typeof value.profit === "number" && value.profit !== 0
      ? value.profit
      : products.reduce((sum, product) => sum + product.profit * product.qty, 0),
    date: textValue(value.date || value.createdAt),
    status: status.toLocaleLowerCase().includes("deliver") ? "delivered" : status.toLocaleLowerCase()
  };
}

function formatRs(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
}

function dateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function OrdersHistoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"customer" | "supplier">("customer");
  const [adminKey, setAdminKey] = useState(ADMIN_KEY);
  const adminKeyRef = useRef(ADMIN_KEY);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone: string; email: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersResponse, productsResponse] = await Promise.all([
        fetch(`/api/orders?_=${Date.now()}`, {
          headers: { "x-admin-key": adminKeyRef.current.trim() || ADMIN_KEY },
          cache: "no-store"
        }),
        fetch(`/api/products?limit=100&_=${Date.now()}`, { cache: "no-store" })
      ]);
      const [ordersResult, productsResult]: [unknown, unknown] = await Promise.all([
        ordersResponse.json(),
        productsResponse.json()
      ]);
      if (!ordersResponse.ok || !isRecord(ordersResult) || !Array.isArray(ordersResult.orders)) {
        throw new Error(isRecord(ordersResult) && typeof ordersResult.error === "string"
          ? ordersResult.error
          : "Could not load orders.");
      }
      if (!productsResponse.ok || !isRecord(productsResult) || !Array.isArray(productsResult.products)) {
        throw new Error(isRecord(productsResult) && typeof productsResult.error === "string"
          ? productsResult.error
          : "Could not load the product catalog.");
      }

      const loadedCatalog = productsResult.products.flatMap((entry): CatalogProduct[] => {
        if (!isRecord(entry) || typeof entry.title !== "string") return [];
        const id = textValue(entry._id || entry.id);
        const image = textValue(entry.image) || (Array.isArray(entry.images) ? textValue(entry.images[0]) : "");
        return id ? [{
          id,
          title: entry.title,
          image,
          price: typeof entry.price === "number" ? entry.price : 0,
          profit: typeof entry.profit === "number" ? entry.profit : null,
          wholesalePrice: typeof entry.wholesalePrice === "number" ? entry.wholesalePrice : null,
          category: textValue(entry.category)
        }] : [];
      });
      setCatalog(loadedCatalog);
      setOrders(ordersResult.orders
        .map((order) => parseOrder(order, loadedCatalog))
        .filter((order): order is AdminOrder => order !== null));
      setMessage("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function syncTabFromUrl() {
      const url = new URL(window.location.href);
      const tab = url.searchParams.get("tab");
      setActiveTab(tab === "supplier" ? "supplier" : "customer");
      if (tab !== "customer" && tab !== "supplier") {
        url.searchParams.set("tab", "customer");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }

    syncTabFromUrl();
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const customerSearch = query.get("search");
    if (customerSearch) setSearch(customerSearch);
  }, []);

  function selectTab(tab: "customer" | "supplier") {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setActiveTab(tab);
  }

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !normalizedSearch ||
        `${order.orderId} ${order.customerName} ${order.customerPhone} ${order.customerEmail}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      const matchesDate = !dateFilter || dateKey(order.date) === dateFilter;
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [dateFilter, orders, search, statusFilter]);

  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const productsSold = orders.reduce((sum, order) =>
      sum + order.products.reduce((productSum, product) => productSum + product.qty, 0), 0
    );
    return {
      totalOrders: orders.length,
      revenue,
      productsSold,
      averageOrderValue: orders.length ? revenue / orders.length : 0
    };
  }, [orders]);

  const productSummary = useMemo(() => {
    const summary = new Map<string, ProductSummary>();
    for (const order of orders) {
      const productKeysInOrder = new Set<string>();
      for (const product of order.products) {
        const key = product.productId || product.name.toLocaleLowerCase();
        const current = summary.get(key) ?? {
          key,
          productId: product.productId,
          name: product.name,
          image: product.image,
          qty: 0,
          revenue: 0,
          orders: 0
        };
        current.qty += product.qty;
        current.revenue += product.price * product.qty;
        if (!productKeysInOrder.has(key)) {
          current.orders += 1;
          productKeysInOrder.add(key);
        }
        if (!current.image && product.image) current.image = product.image;
        summary.set(key, current);
      }
    }
    return [...summary.values()].sort((left, right) => right.qty - left.qty);
  }, [orders]);

  async function updateStatus(order: AdminOrder, status: string) {
    setUpdatingOrderId(order.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKeyRef.current.trim() || ADMIN_KEY
        },
        body: JSON.stringify({ status })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not update order status.");
      }
      setOrders((current) => current.map((entry) =>
        entry.id === order.id ? { ...entry, status } : entry
      ));
      setMessage(`Order ${order.orderId} marked ${status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update order status.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  return (
    <main className={`${styles.page} admin-content`}>
      <AdminPageHeader
        title="Orders History"
        description="Review customer orders and track fulfillment."
        searchValue={search}
        searchPlaceholder="Customer, phone, email or order ID"
        onSearchChange={setSearch}
      />

      <div className={styles.tabs} role="tablist" aria-label="Order types">
        <button
          className={activeTab === "customer" ? styles.activeTab : styles.tab}
          id="customer-orders-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "customer"}
          aria-controls="customer-orders-panel"
          onClick={() => selectTab("customer")}
        >
          Customer Orders ({orders.length})
        </button>
        <button
          className={activeTab === "supplier" ? styles.activeTab : styles.tab}
          id="supplier-orders-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "supplier"}
          aria-controls="supplier-orders-panel"
          onClick={() => selectTab("supplier")}
        >
          Supplier Orders - Markaz
        </button>
      </div>

      {activeTab === "customer" ? (
        <div id="customer-orders-panel" role="tabpanel" aria-labelledby="customer-orders-tab">
      <label className={styles.adminKeyControl}>
        Admin API key
        <input
          type="password"
          autoComplete="off"
          value={adminKey}
          onChange={(event) => {
            setAdminKey(event.target.value);
            adminKeyRef.current = event.target.value;
          }}
        />
      </label>

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}
      {message && <p className={styles.successMessage} role="status">{message}</p>}

      <section className={styles.statsGrid} aria-label="Order statistics">
        <article className={styles.statCard}><span>Total Orders</span><strong>{stats.totalOrders}</strong></article>
        <article className={styles.statCard}><span>Total Revenue</span><strong>{formatRs(stats.revenue)}</strong></article>
        <article className={styles.statCard}><span>Total Products Sold</span><strong>{stats.productsSold}</strong></article>
        <article className={styles.statCard}><span>Average Order Value</span><strong>{formatRs(stats.averageOrderValue)}</strong></article>
      </section>

      <AdminCard as="section" className={styles.panel} aria-labelledby="ordersHeading">
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Fulfillment</span>
            <h2 id="ordersHeading">All orders</h2>
          </div>
          <div className={styles.panelActions}>
            <span className={styles.resultCount}>{filteredOrders.length} shown</span>
            <button className={styles.secondaryButton} type="button" onClick={() => void loadData()} disabled={loading}>
              <span aria-hidden="true">↻</span> {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        <div className={styles.filters}>
          <label>
            Date
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="awaiting_payment">Awaiting payment</option>
              <option value="awaiting_easypaisa_transfer">Awaiting Easypaisa transfer</option>
              <option value="pay_on_delivery">Pay on delivery</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p className={styles.emptyState}>Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <p className={styles.emptyState}>No orders match these filters.</p>
        ) : (
          <div className={styles.orderList}>
            {filteredOrders.map((order) => (
              <article className={styles.orderCard} key={order.id}>
                <div className={styles.orderMain}>
                  <div className={styles.orderIdentity}>
                    <strong>{order.orderId}</strong>
                    <button
                      className={styles.backLink}
                      type="button"
                      onClick={() => setSelectedCustomer({
                        name: order.customerName,
                        phone: order.customerPhone,
                        email: order.customerEmail
                      })}
                    >
                      {order.customerName}
                    </button>
                    <small>{order.customerPhone || order.customerEmail || "Contact details not provided"}</small>
                  </div>
                  <div className={styles.orderMeta}>
                    <time dateTime={order.date || undefined}>
                      {order.date && Number.isFinite(new Date(order.date).getTime())
                        ? new Date(order.date).toLocaleString()
                        : "Date not available"}
                    </time>
                    <strong>{formatRs(order.total)}</strong>
                    <span className={styles.orderProfit}>Profit: {formatRs(order.profit)}</span>
                    <span className={`${styles.statusBadge} ${styles[`status_${order.status}`] ?? styles.status_pending}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <p className={styles.itemsLine}>
                  {order.products.length
                    ? order.products.map((product) => `${product.name} x${product.qty}`).join(", ")
                    : "No product details available"}
                </p>
                <div className={styles.orderActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => router.push(`/admin/orders/${encodeURIComponent(order.id)}`)}
                  >
                    View details
                  </button>
                  {order.status === "pending" && (
                    <span className={styles.pendingFulfillment}>Need to place in Markaz</span>
                  )}
                  {order.status === "processing" && (
                    <button
                      className={styles.deliveredButton}
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => {
                        if (window.confirm(`Mark order ${order.orderId} as Delivered?`)) {
                          void updateStatus(order, "delivered");
                        }
                      }}
                    >
                      {updatingOrderId === order.id ? "Saving..." : "✓ Mark as Delivered"}
                    </button>
                  )}
                  {order.status !== "pending" && order.status !== "processing" && (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => void updateStatus(
                        order,
                        order.status === "delivered" ? "pending" : "delivered"
                      )}
                    >
                      {updatingOrderId === order.id
                        ? "Saving..."
                        : order.status === "delivered" ? "Mark as Pending" : "Mark as Delivered"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminCard>

      <AdminCard as="section" className={styles.panel} aria-labelledby="productSummaryHeading">
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Catalog performance</span>
            <h2 id="productSummaryHeading">Product-wise sales</h2>
          </div>
          <span className={styles.resultCount}>{productSummary.length} products</span>
        </div>
        {productSummary.length === 0 ? (
          <p className={styles.emptyState}>Product sales will appear here when orders are available.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.summaryTable}>
              <thead>
                <tr><th>Product</th><th>Orders</th><th>Qty ordered</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {productSummary.map((product) => {
                  const catalogProduct = productFromCatalog(product.productId, product.name, catalog);
                  const href = catalogProduct
                    ? `/product/${encodeURIComponent(catalogProduct.id)}`
                    : `/?product=${encodeURIComponent(product.productId || product.name)}`;
                  return (
                    <tr key={product.key}>
                      <td>
                        <Link className={styles.productLink} href={href}>
                          {product.image
                              ? <Image src={product.image} alt="" width={42} height={42} unoptimized />
                            : <span className={styles.imagePlaceholder} aria-hidden="true">—</span>}
                          <span>{product.name}</span>
                        </Link>
                      </td>
                      <td>{product.orders}</td>
                      <td>{product.qty}</td>
                      <td>{formatRs(product.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {selectedCustomer && (
        <CustomerProfileModal
          customerName={selectedCustomer.name}
          customerPhone={selectedCustomer.phone}
          customerEmail={selectedCustomer.email}
          adminKey={adminKey}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
        </div>
      ) : (
        <div id="supplier-orders-panel" role="tabpanel" aria-labelledby="supplier-orders-tab">
          <SupplierOrdersPanel />
        </div>
      )}
    </main>
  );
}
