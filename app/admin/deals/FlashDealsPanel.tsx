"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AdminCard from "../../../components/admin/AdminCard";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTable from "../../../components/admin/AdminTable";
import styles from "../departments/departments.module.css";
import dealStyles from "./flash-deals.module.css";

type ProductOption = {
  id: string;
  title: string;
  image: string;
  price: number;
  originalPrice: number;
};

type FlashDeal = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  flashPrice: number;
  originalPrice: number;
  discountPercent: number;
  stockLimit: number;
  soldCount: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  badgeText: string;
};

type FlashDealForm = Omit<FlashDeal, "id" | "discountPercent" | "soldCount">;

type ApiProduct = Record<string, unknown>;

const EMPTY_FORM: FlashDealForm = {
  productId: "",
  productName: "",
  productImage: "",
  flashPrice: 0,
  originalPrice: 0,
  stockLimit: 50,
  startTime: "",
  endTime: "",
  isActive: true,
  badgeText: "Flash Sale"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toLocalDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMoney(amount: number): string {
  return `Rs ${amount.toLocaleString()}`;
}

function formatTimeLeft(value: string, now: number): string {
  const remaining = Date.parse(value) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "Ended";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m ${seconds}s`;
}

function getStatus(deal: FlashDeal, now: number): "Live" | "Upcoming" | "Expired" | "Inactive" {
  if (!deal.isActive) return "Inactive";
  if (Date.parse(deal.endTime) <= now) return "Expired";
  if (Date.parse(deal.startTime) > now) return "Upcoming";
  return "Live";
}

function parseProducts(value: unknown): ProductOption[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  return value.products.flatMap((value: unknown): ProductOption[] => {
    if (!isRecord(value)) return [];
    const entry: ApiProduct = value;
    const id = typeof entry._id === "string" ? entry._id : typeof entry.id === "string" ? entry.id : "";
    const title = typeof entry.title === "string" ? entry.title : "";
    const price = typeof entry.price === "number" ? entry.price : Number(entry.price);
    if (!id || !title || !Number.isFinite(price) || price <= 0) return [];
    const originalPrice = typeof entry.originalPrice === "number" && entry.originalPrice > price
      ? entry.originalPrice
      : price;
    const images = Array.isArray(entry.images) ? entry.images : [];
    const image = typeof entry.image === "string"
      ? entry.image
      : typeof images[0] === "string" ? images[0] : "";
    return [{ id, title, image, price, originalPrice }];
  });
}

function parseDeals(value: unknown): FlashDeal[] {
  if (!isRecord(value) || !Array.isArray(value.deals)) return [];
  return value.deals.filter((entry): entry is FlashDeal =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.productId === "string" &&
    typeof entry.productName === "string" &&
    typeof entry.productImage === "string" &&
    typeof entry.flashPrice === "number" &&
    typeof entry.originalPrice === "number" &&
    typeof entry.discountPercent === "number" &&
    typeof entry.stockLimit === "number" &&
    typeof entry.soldCount === "number" &&
    typeof entry.startTime === "string" &&
    typeof entry.endTime === "string" &&
    typeof entry.isActive === "boolean" &&
    typeof entry.badgeText === "string"
  );
}

export default function FlashDealsPage() {
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FlashDealForm>(EMPTY_FORM);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");

  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { "x-admin-key": key };
      const [dealResponse, productResponse] = await Promise.all([
        fetch("/api/admin/deals?type=flash", { cache: "no-store", headers }),
        fetch("/api/products?includeAdminFields=true&limit=100", { cache: "no-store", headers })
      ]);
      const [dealResult, productResult]: unknown[] = await Promise.all([
        dealResponse.json(),
        productResponse.json()
      ]);
      if (!dealResponse.ok || !isRecord(dealResult)) {
        throw new Error(isRecord(dealResult) && typeof dealResult.error === "string"
          ? dealResult.error : "Could not load flash deals.");
      }
      if (!productResponse.ok || !isRecord(productResult)) {
        throw new Error(isRecord(productResult) && typeof productResult.error === "string"
          ? productResult.error : "Could not load products.");
      }
      setDeals(parseDeals(dealResult));
      setProducts(parseProducts(productResult));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load flash deals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = sessionStorage.getItem("zavimart-admin-key")?.trim() || "";
    setAdminKey(key);
    void loadData(key);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleDeals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deals.filter((deal) =>
      `${deal.productName} ${deal.badgeText}`.toLocaleLowerCase().includes(query)
    );
  }, [deals, search]);
  const activeDeals = deals.filter((deal) => deal.isActive && Date.parse(deal.endTime) > now);
  const nextEnd = activeDeals.map((deal) => deal.endTime).sort()[0];
  const totalSold = deals.reduce((sum, deal) => sum + deal.soldCount, 0);
  const filteredProducts = products.filter((product) =>
    product.title.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase())
  );
  const selectedProduct = products.find((product) => product.id === form.productId);
  const discountPercent = form.originalPrice > 0
    ? Math.max(0, Math.round((1 - form.flashPrice / form.originalPrice) * 100))
    : 0;

  function openCreateModal() {
    const start = new Date();
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    setEditingId(null);
    setProductSearch("");
    setForm({
      ...EMPTY_FORM,
      startTime: toLocalDateTime(start),
      endTime: toLocalDateTime(end)
    });
    setError("");
    setModalOpen(true);
  }

  function openEditModal(deal: FlashDeal) {
    setEditingId(deal.id);
    setProductSearch("");
    setForm({
      productId: deal.productId,
      productName: deal.productName,
      productImage: deal.productImage,
      flashPrice: deal.flashPrice,
      originalPrice: deal.originalPrice,
      stockLimit: deal.stockLimit,
      startTime: toLocalDateTime(new Date(deal.startTime)),
      endTime: toLocalDateTime(new Date(deal.endTime)),
      isActive: deal.isActive,
      badgeText: deal.badgeText
    });
    setError("");
    setModalOpen(true);
  }

  function selectProduct(product: ProductOption) {
    const originalPrice = product.originalPrice;
    setForm((current) => ({
      ...current,
      productId: product.id,
      productName: product.title,
      productImage: product.image,
      originalPrice,
      flashPrice: Math.max(1, Math.round(originalPrice * 0.8))
    }));
  }

  async function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/deals?type=flash", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form)
      });
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : "Could not save this flash deal.");
      }
      setModalOpen(false);
      setToast(editingId ? "Flash deal updated" : "Flash deal created");
      await loadData(adminKey.trim() || "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this flash deal.");
    } finally {
      setSaving(false);
    }
  }

  async function endDeal(deal: FlashDeal) {
    try {
      const response = await fetch("/api/admin/deals?type=flash", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify({ id: deal.id, isActive: false })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error : "Could not end this flash deal.");
      setToast("Flash deal ended");
      await loadData(adminKey.trim() || "");
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : "Could not end this flash deal.");
    }
  }

  async function deleteDeal(deal: FlashDeal) {
    if (!window.confirm(`Delete the flash deal for "${deal.productName}"?`)) return;
    try {
      const response = await fetch("/api/admin/deals?type=flash", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify({ id: deal.id })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error : "Could not delete this flash deal.");
      setToast("Flash deal deleted");
      await loadData(adminKey.trim() || "");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this flash deal.");
    }
  }

  return (
    <main className={styles.page}>
      <AdminPageHeader
        title="Flash Deals"
        count={visibleDeals.length}
        description="Schedule limited-time prices and track deal performance."
        searchValue={search}
        searchPlaceholder="Search flash deals..."
        onSearchChange={setSearch}
        action={<button className={styles.primaryButton} type="button" onClick={openCreateModal}>+ Add Deal</button>}
      />

      <label className={styles.adminKey}>
        Admin API key
        <input
          type="password"
          value={adminKey}
          onChange={(event) => {
            setAdminKey(event.target.value);
            sessionStorage.setItem("zavimart-admin-key", event.target.value);
          }}
          onBlur={() => void loadData(adminKey.trim() || "")}
          autoComplete="current-password"
        />
      </label>

      <section className={dealStyles.stats} aria-label="Flash deal statistics">
        <article className={dealStyles.statCard}>
          <span>Active Flash Deals</span>
          <strong>{activeDeals.length}</strong>
        </article>
        <article className={dealStyles.statCard}>
          <span>Total Sold</span>
          <strong>{totalSold.toLocaleString()}</strong>
        </article>
        <article className={dealStyles.statCard}>
          <span>Time Left</span>
          <strong>{nextEnd ? formatTimeLeft(nextEnd, now) : "—"}</strong>
        </article>
      </section>

      <AdminCard as="section" className={styles.panel} aria-labelledby="flashDealsHeading">
        <div className={styles.panelHeading}>
          <h2 id="flashDealsHeading">All flash deals</h2>
          <span>{visibleDeals.length} deals</span>
        </div>
        <label className={styles.search}>
          Search flash deals
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product or badge"
          />
        </label>
        {error && !modalOpen && <p className={styles.error} role="alert">{error}</p>}
        {loading ? (
          <p className={styles.empty}>Loading flash deals...</p>
        ) : visibleDeals.length === 0 ? (
          <p className={styles.empty}>No flash deals yet. Add a product to start a campaign.</p>
        ) : (
          <AdminTable className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Flash Price / Original</th>
                  <th>Sold / Stock</th>
                  <th>Time Left</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeals.map((deal) => {
                  const status = getStatus(deal, now);
                  const progress = Math.min(100, Math.round((deal.soldCount / deal.stockLimit) * 100));
                  return (
                    <tr key={deal.id}>
                      <td>
                        <div className={dealStyles.productCell}>
                          {deal.productImage
                            ? <img src={deal.productImage} alt="" loading="lazy" />
                            : <span className={styles.imagePlaceholder}>—</span>}
                          <div><strong>{deal.productName}</strong><small>{deal.badgeText} · {deal.discountPercent}% OFF</small></div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatMoney(deal.flashPrice)}</strong>
                        <small className={dealStyles.strike}>{formatMoney(deal.originalPrice)}</small>
                      </td>
                      <td>
                        <div className={dealStyles.progressLabel}>{deal.soldCount} / {deal.stockLimit}</div>
                        <progress className={dealStyles.progress} value={progress} max="100" aria-label={`${progress}% of flash stock sold`} />
                      </td>
                      <td>
                        {status === "Upcoming"
                          ? `Starts in ${formatTimeLeft(deal.startTime, now)}`
                          : formatTimeLeft(deal.endTime, now)}
                      </td>
                      <td><span className={status === "Live" ? styles.statusActive : styles.statusInactive}>{status}</span></td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" onClick={() => openEditModal(deal)}>Edit</button>
                          {deal.isActive && status !== "Expired" && (
                            <button type="button" className={dealStyles.endButton} onClick={() => void endDeal(deal)}>End Now</button>
                          )}
                          <button type="button" className={styles.deleteButton} onClick={() => void deleteDeal(deal)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTable>
        )}
      </AdminCard>

      {modalOpen && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="flashDealModalHeading">
            <header className={styles.modalHeading}>
              <h2 id="flashDealModalHeading">{editingId ? "Edit Flash Deal" : "Add New Flash Deal"}</h2>
              <button type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)} disabled={saving}>×</button>
            </header>
            <form className={styles.form} onSubmit={submitDeal}>
              <label className={styles.fullWidth}>
                Search products
                <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Type a product name" />
                <select
                  value={form.productId}
                  onChange={(event) => {
                    const product = products.find((entry) => entry.id === event.target.value);
                    if (product) selectProduct(product);
                  }}
                  required
                >
                  <option value="">Select product ({filteredProducts.length} available)</option>
                  {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.title} — {formatMoney(product.price)}</option>)}
                </select>
              </label>
              {selectedProduct && (
                <div className={`${dealStyles.selectedProduct} ${styles.fullWidth}`}>
                  {selectedProduct.image && <img src={selectedProduct.image} alt="" loading="lazy" />}
                  <span>{form.productName || selectedProduct.title}</span>
                </div>
              )}
              <label>
                Flash Price
                <input type="number" min="0.01" step="0.01" required value={form.flashPrice || ""} onChange={(event) => setForm((current) => ({ ...current, flashPrice: Number(event.target.value) }))} />
              </label>
              <label>
                Original Price
                <input type="number" min="0.01" step="0.01" required value={form.originalPrice || ""} onChange={(event) => setForm((current) => ({ ...current, originalPrice: Number(event.target.value) }))} />
              </label>
              <p className={dealStyles.discountText}>Discount: <strong>{discountPercent}% OFF</strong></p>
              <label>
                Stock Limit
                <input type="number" min="1" max="1000000" step="1" required value={form.stockLimit} onChange={(event) => setForm((current) => ({ ...current, stockLimit: Number(event.target.value) }))} />
              </label>
              <label>
                Start Time
                <input type="datetime-local" required value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
              </label>
              <label>
                End Time
                <input type="datetime-local" required value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
              </label>
              <label>
                Badge Text
                <input maxLength={80} value={form.badgeText} onChange={(event) => setForm((current) => ({ ...current, badgeText: event.target.value }))} placeholder="Flash Sale" />
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                Is Active
              </label>
              {error && <p className={`${styles.error} ${styles.fullWidth}`} role="alert">{error}</p>}
              <div className={`${styles.formActions} ${styles.fullWidth}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving || !form.productId}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Flash Deal"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className={styles.toast} role="status" aria-live="polite">{toast}</div>}
    </main>
  );
}
