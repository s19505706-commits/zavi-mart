"use client";

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

type MonthlyData = { month: string; revenue: number; income: number; profit: number };
type CategoryData = { name: string; value: number };

const categoryColors = ["#D4AF37", "#FFD700", "#b8941f", "#e9d28a", "#9d7c24", "#f5e6a3"];

function formatMoney(value: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value)}`;
}

export default function AdminSalesCharts({
  loading,
  monthlyData,
  salesByCategory
}: {
  loading: boolean;
  monthlyData: MonthlyData[];
  salesByCategory: CategoryData[];
}) {
  return (
    <section className={styles.chartGrid} aria-label="Sales charts">
      <article className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><h2>Revenue vs Income vs Profit</h2><p>Last 6 months</p></div>
          <span className={styles.liveBadge}>Monthly</span>
        </div>
        {loading ? <div className={styles.chartSkeleton} /> : (
          <div className={styles.lineChart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8190a7", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8190a7", fontSize: 11 }}
                  tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} width={42} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#D4AF37" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#FFD700" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#b8941f" strokeWidth={2.5} dot={false} />
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
        {loading ? <div className={styles.chartSkeleton} /> : salesByCategory.length ? (
          <div className={styles.pieArea}>
            <div className={styles.pieChart}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={salesByCategory} dataKey="value" nameKey="name" innerRadius={58}
                    outerRadius={88} paddingAngle={3}>
                    {salesByCategory.map((entry, index) => (
                      <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.categoryLegend}>
              {salesByCategory.slice(0, 5).map((category, index) => (
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
  );
}
