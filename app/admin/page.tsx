"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Download,
  PackageCheck,
  Search,
  ShoppingCart,
  Users
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import styles from "./dashboard.module.css";

type Summary = {
  totalIncome: number;
  netIncome: number;
  totalRevenue: number;
  profitMargin: number;
  totalOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  returns: number;
  pendingOrders: number;
  codOrders: number;
  delivered: number;
  cancelled: number;
  avgOrderValue: number;
};

type DashboardData = {
  summary: Summary;
  monthlyData: Array<{ month: string; revenue: number; income: number; profit: number }>;
  salesByCategory: Array<{ name: string; value: number }>;
  topSellingProducts: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    profit: number;
  }>;
  recentOrders: Array<{
    orderId: string;
    customerName: string;
    total: number;
    profit: number;
    status: string;
    createdAt: string;
  }>;
  lowStock: Array<{ id: string; name: string; category: string; stock: number; price: number }>;
  codStats: { orders: number; total: number; collected: number; pending: number; collectionRate: number };
  customerStats: { total: number; repeat: number; newThisMonth: number };
};

const categoryColors = ["#4787ff", "#19b886", "#ffb547", "#9164f6", "#f36c82", "#24b8cb"];

function formatMoney(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "—";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  loading,
  featured = false
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof CircleDollarSign;
  loading: boolean;
  featured?: boolean;
}) {
  return (
    <article className={`${styles.statCard} ${featured ? styles.featuredCard : ""}`}>
      <div className={styles.statCardTop}>
        <span>{label}</span>
        <span className={styles.statIcon}><Icon size={18} aria-hidden="true" /></span>
      </div>
      {loading ? <span className={styles.skeletonValue} aria-label="Loading" /> : <strong>{value}</strong>}
      <small>{sublabel}</small>
    </article>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.tableSkeleton} aria-label="Loading dashboard data">
      {Array.from({ length: rows }, (_, index) => <span key={index} />)}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedDates, setAppliedDates] = useState({ from: "", to: "" });

  const loadStats = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/admin/stats${params.size ? `?${params}` : ""}`, {
        cache: "no-store"
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !isRecord(result.summary)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Could not load dashboard statistics.");
      }
      setData(result as unknown as DashboardData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats("", "");
  }, [loadStats]);

  const recentOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.recentOrders ?? []).filter((order) =>
      !query || `${order.orderId} ${order.customerName} ${order.status}`.toLocaleLowerCase().includes(query)
    );
  }, [data?.recentOrders, search]);

  function applyDateFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedDates({ from: dateFrom, to: dateTo });
    void loadStats(dateFrom, dateTo);
  }

  function exportReport() {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Income", data.summary.totalIncome],
      ["Net Income", data.summary.netIncome],
      ["Total Revenue", data.summary.totalRevenue],
      ["Profit Margin (%)", data.summary.profitMargin.toFixed(2)],
      ["Total Orders", data.summary.totalOrders],
      ["Returns", data.summary.returns],
      [],
      ["Order ID", "Customer", "Date", "Status", "Revenue", "Profit"],
      ...recentOrders.map((order) => [
        order.orderId, order.customerName, order.createdAt, order.status, order.total, order.profit
      ])
    ];
    const csv = rows.map((row) => row.map((value) =>
      `"${String(value ?? "").replaceAll("\"", "\"\"")}"`
    ).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zavimart-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;
  const overviewCards = [
    ["Total Products", summary ? String(summary.totalProducts) : "—", "Products in the catalog", Boxes],
    ["Orders", summary ? String(summary.totalOrders) : "—", "Local and MongoDB orders", ShoppingCart],
    ["Low Stock (<5)", summary ? String(summary.lowStockProducts) : "—", "Products needing restock", PackageCheck],
    ["Revenue", summary ? formatMoney(summary.totalRevenue) : "—", "All order revenue", CircleDollarSign]
  ] as const;

  return (
    <div className={styles.dashboardShell}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.breadcrumb}>Workspace / <strong>Overview</strong></p>
            <h1>Welcome back, Admin</h1>
            <p className={styles.subheading}>Here&apos;s what&apos;s happening with your store today.</p>
          </div>
          <div className={styles.topActions}>
            <label className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders..."
                aria-label="Search recent orders"
              />
            </label>
            <div className={styles.filterActions}>
              <form className={styles.dateFilter} onSubmit={applyDateFilter}>
                <CalendarDays size={17} aria-hidden="true" />
                <input type="date" aria-label="From date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                <span>to</span>
                <input type="date" aria-label="To date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                <button type="submit" disabled={loading}>Apply</button>
              </form>
              <button className={styles.exportButton} type="button" onClick={exportReport} disabled={!data}>
                <Download size={16} /> Export report
              </button>
            </div>
          </div>
        </header>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {appliedDates.from || appliedDates.to
          ? <p className={styles.filterNote}>Showing orders {appliedDates.from || "from the beginning"} to {appliedDates.to || "today"}.</p>
          : null}

        <section className={styles.metricGridPrimary} aria-label="Store overview">
          {overviewCards.map(([label, value, hint, icon], index) => (
            <StatCard key={label} label={label} value={value} sublabel={hint} icon={icon}
              loading={loading} featured={index === 0} />
          ))}
        </section>

        <section className={styles.chartGrid} aria-label="Sales charts">
          <article className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><h2>Revenue vs Income vs Profit</h2><p>Last 6 months</p></div>
              <span className={styles.liveBadge}>Monthly</span>
            </div>
            {loading ? <div className={styles.chartSkeleton} /> : (
              <div className={styles.lineChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.monthlyData ?? []} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8190a7", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8190a7", fontSize: 11 }}
                      tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} width={42} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4e8cff" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="income" name="Income" stroke="#19b886" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#ffb547" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className={styles.chartLegend}>
              <span><i className={styles.blueDot} /> Revenue</span>
              <span><i className={styles.greenDot} /> Income</span>
              <span><i className={styles.orangeDot} /> Profit</span>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeading}><div><h2>Sales by Category</h2><p>Product sales mix</p></div></div>
            {loading ? <div className={styles.chartSkeleton} /> : data?.salesByCategory.length ? (
              <div className={styles.pieArea}>
                <div className={styles.pieChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.salesByCategory} dataKey="value" nameKey="name" innerRadius={58}
                        outerRadius={88} paddingAngle={3}>
                        {data.salesByCategory.map((entry, index) => (
                          <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className={styles.categoryLegend}>
                  {data.salesByCategory.slice(0, 5).map((category, index) => (
                    <li key={category.name}>
                      <span><i style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />{category.name}</span>
                      <strong>{formatMoney(category.value)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className={styles.empty}>No category sales yet.</p>}
          </article>
        </section>

        <section className={styles.bottomGrid} aria-label="Store operations">
          <div className={styles.leftTables}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div><h2>Top Selling Products</h2><p>Ranked by units sold</p></div>
                <Link href="/admin/products">View products</Link>
              </div>
              {loading ? <TableSkeleton /> : data?.topSellingProducts.length ? (
                <div className={styles.tableScroll}>
                  <table>
                    <thead><tr><th>Product</th><th>Category</th><th>Sold</th><th>Revenue</th></tr></thead>
                    <tbody>{data.topSellingProducts.map((product) => (
                      <tr key={product.id || product.name}>
                        <td><strong>{product.name}</strong><small>{product.id}</small></td>
                        <td>{product.category}</td><td>{product.quantity}</td><td>{formatMoney(product.revenue)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className={styles.empty}>Sales appear here when orders are available.</p>}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div><h2>Recent Orders with Profit</h2><p>Latest customer activity</p></div>
                <Link href="/admin/orders">All orders</Link>
              </div>
              {loading ? <TableSkeleton rows={5} /> : recentOrders.length ? (
                <div className={styles.tableScroll}>
                  <table>
                    <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Revenue</th><th>Profit</th></tr></thead>
                    <tbody>{recentOrders.map((order) => (
                      <tr key={order.orderId}>
                        <td><strong>{order.orderId}</strong></td><td>{order.customerName}</td>
                        <td>{formatDate(order.createdAt)}</td><td><span className={`${styles.status} ${styles[`status_${order.status}`] ?? ""}`}>{order.status}</span></td>
                        <td>{formatMoney(order.total)}</td><td>{formatMoney(order.profit)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className={styles.empty}>No recent orders match this search.</p>}
            </article>
          </div>

          <div className={styles.rightPanels}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}><div><h2>Low Stock</h2><p>Products with fewer than 5 units</p></div><Boxes size={18} /></div>
              {loading ? <TableSkeleton rows={3} /> : data?.lowStock.length ? (
                <ul className={styles.stockList}>{data.lowStock.map((product) => (
                  <li key={product.id}>
                    <span className={styles.stockProduct}><strong>{product.name}</strong><small>{product.category}</small></span>
                    <span className={product.stock <= 3 ? styles.stockCritical : styles.stockLow}>{product.stock} left</span>
                  </li>
                ))}</ul>
              ) : <p className={styles.empty}>All products are well stocked.</p>}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}><div><h2>COD Collection</h2><p>Cash on delivery payments</p></div><CircleDollarSign size={18} /></div>
              {loading ? <TableSkeleton rows={2} /> : (
                <div className={styles.codDetails}>
                  <div className={styles.codAmount}>{formatMoney(data?.codStats.collected ?? 0)}<small> collected</small></div>
                  <div className={styles.progressTrack}><span style={{ width: `${Math.min(100, data?.codStats.collectionRate ?? 0)}%` }} /></div>
                  <div className={styles.codLabels}><span>{(data?.codStats.collectionRate ?? 0).toFixed(0)}% collected</span><strong>{formatMoney(data?.codStats.pending ?? 0)} pending</strong></div>
                  <small>{data?.codStats.orders ?? 0} COD orders</small>
                </div>
              )}
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}><div><h2>Customer Stats</h2><p>Customer activity overview</p></div><Users size={18} /></div>
              {loading ? <TableSkeleton rows={3} /> : (
                <div className={styles.customerStats}>
                  <div><span>Total customers</span><strong>{data?.customerStats.total ?? 0}</strong></div>
                  <div><span>Repeat customers</span><strong>{data?.customerStats.repeat ?? 0}</strong></div>
                  <div><span>New in last 30 days</span><strong>{data?.customerStats.newThisMonth ?? 0}</strong></div>
                </div>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
