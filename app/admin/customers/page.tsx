"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CustomerProfileModal from "../CustomerProfileModal";
import AdminCard from "../../../components/admin/AdminCard";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTable from "../../../components/admin/AdminTable";
import styles from "./customers.module.css";

type CustomerOrder = {
  id: string;
  date: string;
  total: number;
  status: string;
  products: Array<{ id: string; name: string; price: number; qty: number; image: string }>;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
  isNew: boolean;
  orders: CustomerOrder[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatRs(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "—";
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export default function CustomersPage() {
  const [adminKey, setAdminKey] = useState("");
  const adminKeyRef = useRef("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"totalSpent" | "totalOrders" | "recent">("totalSpent");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightSearch, setHighlightSearch] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/customers?_=${Date.now()}`, {
        headers: { "x-admin-key": adminKeyRef.current.trim() || "" },
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !Array.isArray(result.customers)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load customers.");
      }
      const loadedCustomers = result.customers.flatMap((entry): Customer[] => {
        if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.name !== "string" ||
            typeof entry.totalOrders !== "number" || typeof entry.totalSpent !== "number" ||
            !Array.isArray(entry.orders)) return [];
        const orders = entry.orders.flatMap((rawOrder): CustomerOrder[] => {
          if (!isRecord(rawOrder) || typeof rawOrder.id !== "string" ||
              typeof rawOrder.total !== "number" || !Array.isArray(rawOrder.products)) return [];
          return [{
            id: rawOrder.id,
            date: typeof rawOrder.date === "string" ? rawOrder.date : "",
            total: rawOrder.total,
            status: typeof rawOrder.status === "string" ? rawOrder.status : "pending",
            products: rawOrder.products.flatMap((rawProduct): CustomerOrder["products"] => {
              if (!isRecord(rawProduct) || typeof rawProduct.name !== "string" ||
                  typeof rawProduct.price !== "number" || typeof rawProduct.qty !== "number") return [];
              return [{
                id: typeof rawProduct.id === "string" ? rawProduct.id : "",
                name: rawProduct.name,
                price: rawProduct.price,
                qty: rawProduct.qty,
                image: typeof rawProduct.image === "string" ? rawProduct.image : ""
              }];
            })
          }];
        });
        return [{
          id: entry.id,
          name: entry.name,
          email: typeof entry.email === "string" ? entry.email : "",
          phone: typeof entry.phone === "string" ? entry.phone : "",
          totalOrders: entry.totalOrders,
          totalSpent: entry.totalSpent,
          firstOrderDate: typeof entry.firstOrderDate === "string" ? entry.firstOrderDate : "",
          lastOrderDate: typeof entry.lastOrderDate === "string" ? entry.lastOrderDate : "",
          isNew: entry.isNew === true,
          orders
        }];
      });
      setCustomers(loadedCustomers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const querySearch = new URLSearchParams(window.location.search).get("search")?.trim() ?? "";
    if (querySearch) {
      setSearch(querySearch);
      setHighlightSearch(querySearch);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  function matchesCustomerSearch(customer: Customer, value: string): boolean {
    const normalizedSearch = value.trim().toLocaleLowerCase();
    if (!normalizedSearch) return true;
    const textMatches = `${customer.name} ${customer.phone} ${customer.email}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
    const searchDigits = normalizePhone(normalizedSearch);
    const phoneDigits = normalizePhone(customer.phone);
    return textMatches || (!!searchDigits && phoneDigits.includes(searchDigits));
  }

  const stats = useMemo(() => {
    const newCustomers = customers.filter((customer) => customer.isNew).length;
    return {
      total: customers.length,
      newCustomers,
      returning: customers.filter((customer) => customer.totalOrders > 1).length,
      revenue: customers.reduce((sum, customer) => sum + customer.totalSpent, 0)
    };
  }, [customers]);

  const visibleCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return customers
      .filter((customer) => matchesCustomerSearch(customer, normalizedSearch))
      .sort((left, right) => {
        if (sortBy === "totalOrders") return right.totalOrders - left.totalOrders;
        if (sortBy === "recent") {
          return new Date(right.lastOrderDate).getTime() - new Date(left.lastOrderDate).getTime();
        }
        return right.totalSpent - left.totalSpent;
      });
  }, [customers, search, sortBy]);

  return (
    <main className={`${styles.page} admin-content`}>
      <AdminPageHeader
        title="Customer CRM"
        count={stats.total}
        description="Customer activity, purchase history, and loyalty."
        searchValue={search}
        searchPlaceholder="Name, phone, or email"
        onSearchChange={setSearch}
      />

      <label className={styles.keyControl}>
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

      {error && <p className={styles.error} role="alert">{error}</p>}

      <section className={styles.statsGrid} aria-label="Customer statistics">
        <article className={styles.statCard}><span>Total Customers</span><strong>{stats.total}</strong></article>
        <article className={styles.statCard}><span>New Customers (7 days)</span><strong>{stats.newCustomers}</strong></article>
        <article className={styles.statCard}><span>Returning Customers</span><strong>{stats.returning}</strong></article>
        <article className={styles.statCard}><span>Total Revenue by Customers</span><strong>{formatRs(stats.revenue)}</strong></article>
      </section>

      <AdminCard as="section" className={styles.panel} aria-labelledby="customerListHeading">
        <div className={styles.panelHeading}>
          <div>
            <span className={styles.eyebrow}>Customer directory</span>
            <h2 id="customerListHeading">All customers</h2>
          </div>
          <div className={styles.panelActions}>
            <span className={styles.resultCount}>{visibleCustomers.length} customers</span>
            <button className={styles.linkButton} type="button" onClick={() => void loadCustomers()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className={styles.controls}>
          <label>
            Sort by
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value="totalSpent">Total spent</option>
              <option value="totalOrders">Total orders</option>
              <option value="recent">Most recent</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className={styles.emptyState}>Loading customers...</p>
        ) : visibleCustomers.length === 0 ? (
          <p className={styles.emptyState}>No customers match your search.</p>
        ) : (
          <AdminTable className={styles.tableScroll}>
            <table className={styles.customerTable}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>First Order</th>
                  <th>Last Order</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className={`${styles.customerRow} ${
                      highlightSearch && matchesCustomerSearch(customer, highlightSearch)
                        ? styles.customerRowHighlighted
                        : ""
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCustomer(customer);
                      }
                    }}
                  >
                    <td>
                      <span className={styles.customerName}>{customer.name}</span>
                      <span className={`${styles.badge} ${
                        customer.isNew ? styles.badgeNew :
                        customer.totalOrders > 1 ? styles.badgeReturning : styles.badgeOneTime
                      }`}>
                        {customer.isNew ? "NEW" : customer.totalOrders > 1 ? "RETURNING" : "ONE-TIME"}
                      </span>
                    </td>
                    <td>{customer.phone || "—"}</td>
                    <td>{customer.email || "—"}</td>
                    <td>{customer.totalOrders}</td>
                    <td>{formatRs(customer.totalSpent)}</td>
                    <td>{formatDate(customer.firstOrderDate)}</td>
                    <td>{formatDate(customer.lastOrderDate)}</td>
                    <td className={styles.alertCell}>
                      {customer.isNew ? "🎉 New Customer - Send welcome!" :
                        customer.totalOrders > 3 ? "⭐ Loyal Customer" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
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
    </main>
  );
}
