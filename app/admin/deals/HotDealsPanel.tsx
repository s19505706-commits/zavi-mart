"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AdminCard from "../../../components/admin/AdminCard";
import AdminPageHeader from "../../../components/admin/AdminPageHeader";
import AdminTable from "../../../components/admin/AdminTable";
import styles from "../departments/departments.module.css";
import dealStyles from "./hot-deals.module.css";

type ProductOption = {
  id: string;
  title: string;
  image: string;
  category: string;
  price: number;
};

type DealProduct = {
  productId: string;
  title: string;
  image: string;
  category: string;
  originalPrice: number;
};

type HotDeal = {
  id: string;
  dealType: "single" | "bundle";
  productId: string;
  productIds: string[];
  products: DealProduct[];
  productName: string;
  productImage: string;
  category: string;
  bundleTitle: string;
  bundleImage: string;
  originalPrice: number;
  originalTotalPrice: number;
  dealPrice: number;
  discountPercent: number;
  discountType: "percent" | "fixed";
  discountValue: number;
  badgeText: string;
  customTitle: string;
  priority: number;
  showOnHomepage: boolean;
  isActive: boolean;
  validTill: string | null;
  createdAt: string;
  updatedAt: string;
};

type HotDealForm = {
  dealType: "single" | "bundle";
  bundleTitle: string;
  bundleImage: string;
  dealPrice: number;
  discountType: "percent" | "fixed";
  discountValue: number;
  badgeText: string;
  customTitle: string;
  priority: number;
  showOnHomepage: boolean;
  isActive: boolean;
  validTill: string | null;
};

type RecordValue = Record<string, unknown>;

const EMPTY_FORM: HotDealForm = {
  dealType: "single",
  bundleTitle: "",
  bundleImage: "",
  dealPrice: 0,
  discountType: "percent",
  discountValue: 20,
  badgeText: "Hot Deal",
  customTitle: "",
  priority: 1,
  showOnHomepage: true,
  isActive: true,
  validTill: null
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMoney(price: number): string {
  return `Rs ${price.toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "Invalid date";
}

function formatLocalDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusFor(deal: HotDeal): string {
  if (!deal.isActive) return "Inactive";
  if (deal.validTill && Date.parse(deal.validTill) <= Date.now()) return "Expired";
  return "Active";
}

function parseProducts(value: unknown): ProductOption[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  return value.products.flatMap((entry): ProductOption[] => {
    if (!isRecord(entry)) return [];
    const id = typeof entry._id === "string" ? entry._id : typeof entry.id === "string" ? entry.id : "";
    const title = typeof entry.title === "string" ? entry.title : "";
    const price = typeof entry.price === "number" ? entry.price : Number(entry.price);
    if (!id || !title || !Number.isFinite(price) || price <= 0) return [];
    const images = Array.isArray(entry.images) ? entry.images : [];
    return [{
      id,
      title,
      image: typeof entry.image === "string" ? entry.image
        : typeof images[0] === "string" ? images[0] : "",
      category: typeof entry.category === "string" ? entry.category : "General",
      price
    }];
  });
}

function parseDeals(value: unknown): HotDeal[] {
  if (!isRecord(value) || !Array.isArray(value.deals)) return [];
  return value.deals.filter((entry): entry is HotDeal =>
    isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.productId === "string" &&
    typeof entry.productName === "string" &&
    typeof entry.productImage === "string" &&
    typeof entry.category === "string" &&
    typeof entry.originalPrice === "number" &&
    typeof entry.dealPrice === "number" &&
    typeof entry.badgeText === "string" &&
    typeof entry.priority === "number" &&
    typeof entry.showOnHomepage === "boolean" &&
    typeof entry.isActive === "boolean"
  ).map((entry) => {
    const products = Array.isArray(entry.products) ? entry.products as DealProduct[] : [{
      productId: entry.productId,
      title: entry.productName,
      image: entry.productImage,
      category: entry.category,
      originalPrice: entry.originalPrice
    }];
    return {
      ...entry,
      dealType: entry.dealType === "bundle" ? "bundle" : "single",
      productIds: Array.isArray(entry.productIds) ? entry.productIds as string[] : products.map((product) => product.productId),
      products,
      bundleTitle: typeof entry.bundleTitle === "string" ? entry.bundleTitle : "",
      bundleImage: typeof entry.bundleImage === "string" ? entry.bundleImage : "",
      originalTotalPrice: typeof entry.originalTotalPrice === "number" ? entry.originalTotalPrice : entry.originalPrice,
      discountPercent: typeof entry.discountPercent === "number" ? entry.discountPercent : 0,
      discountType: entry.discountType === "fixed" ? "fixed" : "percent",
      discountValue: typeof entry.discountValue === "number" ? entry.discountValue : 0,
      customTitle: typeof entry.customTitle === "string" ? entry.customTitle : "",
      validTill: typeof entry.validTill === "string" ? entry.validTill : null,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : ""
    };
  });
}

export default function HotDealsPage() {
  const [deals, setDeals] = useState<HotDeal[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HotDealForm>(EMPTY_FORM);

  const loadData = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { "x-admin-key": key };
      const [dealResponse, productResponse] = await Promise.all([
        fetch("/api/admin/deals?type=hot", { cache: "no-store", headers }),
        fetch("/api/products?includeAdminFields=true&limit=100", { cache: "no-store", headers })
      ]);
      const [dealResult, productResult]: unknown[] = await Promise.all([
        dealResponse.json(),
        productResponse.json()
      ]);
      if (!dealResponse.ok || !isRecord(dealResult)) {
        throw new Error(isRecord(dealResult) && typeof dealResult.error === "string"
          ? dealResult.error : "Could not load hot deals.");
      }
      if (!productResponse.ok || !isRecord(productResult)) {
        throw new Error(isRecord(productResult) && typeof productResult.error === "string"
          ? productResult.error : "Could not load products.");
      }
      setDeals(parseDeals(dealResult));
      setProducts(parseProducts(productResult));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load hot deals.");
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleDeals = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return deals.filter((deal) =>
      `${deal.productName} ${deal.bundleTitle} ${deal.badgeText} ${deal.customTitle}`.toLocaleLowerCase().includes(query)
    );
  }, [deals, search]);
  const orderedDeals = useMemo(
    () => [...deals].sort((left, right) => left.priority - right.priority),
    [deals]
  );
  const filteredProducts = products.filter((product) =>
    product.title.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase())
  );
  const selectedProducts = selectedProductIds.map((id) => products.find((product) => product.id === id));
  const originalTotal = selectedProducts.reduce((total, product) => total + (product?.price ?? 0), 0);
  const singleDealPrice = form.discountType === "percent"
    ? Math.round(originalTotal * (1 - form.discountValue / 100))
    : Math.round(originalTotal - form.discountValue);
  const effectiveDealPrice = form.dealType === "bundle" ? form.dealPrice : singleDealPrice;
  const requiredCount = form.dealType === "bundle" ? 2 : 1;
  const populatedProductIds = selectedProductIds.filter(Boolean);
  const canSubmit = populatedProductIds.length >= requiredCount &&
    selectedProductIds.slice(0, requiredCount).every(Boolean) &&
    new Set(populatedProductIds).size === populatedProductIds.length &&
    Number.isFinite(effectiveDealPrice) && effectiveDealPrice > 0 && effectiveDealPrice < originalTotal &&
    (form.dealType !== "bundle" || !!form.bundleTitle.trim());

  function changeDealType(dealType: "single" | "bundle") {
    setForm((current) => ({ ...current, dealType }));
    setSelectedProductIds((current) => {
      if (dealType === "single") return [current.find(Boolean) ?? ""];
      return current.length >= 2 ? current : [...current, ...Array.from({ length: 2 - current.length }, () => "")];
    });
  }

  function openCreate() {
    setEditingId(null);
    setProductSearch("");
    setSelectedProductIds([""]);
    setForm({ ...EMPTY_FORM, priority: Math.max(0, ...deals.map((deal) => deal.priority)) + 1 });
    setError("");
    setModalOpen(true);
  }

  function openEdit(deal: HotDeal) {
    setEditingId(deal.id);
    setProductSearch("");
    setSelectedProductIds(deal.products.map((product) => product.productId));
    setForm({
      dealType: deal.dealType,
      bundleTitle: deal.bundleTitle,
      bundleImage: deal.bundleImage,
      dealPrice: deal.dealPrice,
      discountType: deal.discountType,
      discountValue: deal.discountValue,
      badgeText: deal.badgeText,
      customTitle: deal.customTitle,
      priority: deal.priority,
      showOnHomepage: deal.showOnHomepage,
      isActive: deal.isActive,
      validTill: deal.validTill
    });
    setError("");
    setModalOpen(true);
  }

  function addProductSlot() {
    if (selectedProductIds.length < 4) setSelectedProductIds((current) => [...current, ""]);
  }

  function removeProductSlot(index: number) {
    setSelectedProductIds((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function sendDeal(method: "POST" | "PUT", body: RecordValue, successMessage: string) {
    const response = await fetch("/api/admin/deals?type=hot", {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey.trim() || ""
      },
      body: JSON.stringify(body)
    });
    const result: unknown = await response.json();
    if (!response.ok || !isRecord(result)) {
      throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error : "The hot deal could not be updated.");
    }
    setToast(successMessage);
    await loadData(adminKey.trim() || "");
  }

  async function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError(form.dealType === "bundle"
        ? "Choose 2–4 different products and enter a bundle price below their original total."
        : "Choose a product and enter a valid discount.");
      return;
    }
    const chosenProducts = selectedProducts.filter((product): product is ProductOption => !!product);
    const productsSnapshot: DealProduct[] = chosenProducts.map((product) => ({
      productId: product.id,
      title: product.title,
      image: product.image,
      category: product.category,
      originalPrice: product.price
    }));
    const firstProduct = chosenProducts[0];
    const payload: RecordValue = {
      id: editingId,
      dealType: form.dealType,
      productId: firstProduct.id,
      productName: chosenProducts.map((product) => product.title).join(" + "),
      productImage: firstProduct.image,
      category: firstProduct.category,
      products: productsSnapshot,
      bundleTitle: form.bundleTitle.trim(),
      bundleImage: form.bundleImage.trim(),
      originalPrice: originalTotal,
      discountType: form.dealType === "bundle" ? "fixed" : form.discountType,
      discountValue: form.dealType === "bundle" ? originalTotal - form.dealPrice : form.discountValue,
      dealPrice: form.dealType === "bundle" ? form.dealPrice : undefined,
      badgeText: form.badgeText,
      customTitle: form.customTitle,
      priority: form.priority,
      showOnHomepage: form.showOnHomepage,
      isActive: form.isActive,
      validTill: form.validTill
    };
    setSaving(true);
    setError("");
    try {
      await sendDeal(editingId ? "PUT" : "POST", payload,
        editingId ? "Hot deal updated" : "Hot deal created");
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this hot deal.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDeal(deal: HotDeal) {
    setError("");
    try {
      await sendDeal("PUT", { id: deal.id, isActive: !deal.isActive }, deal.isActive ? "Hot deal paused" : "Hot deal activated");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update this hot deal.");
    }
  }

  async function updatePriority(deal: HotDeal, direction: -1 | 1) {
    const ordered = [...deals].sort((left, right) => left.priority - right.priority);
    const index = ordered.findIndex((entry) => entry.id === deal.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    setError("");
    try {
      await sendDeal("PUT", { id: deal.id, priority: neighbor.priority }, "Hot deal priority updated");
      await sendDeal("PUT", { id: neighbor.id, priority: deal.priority }, "Hot deal priority updated");
    } catch (priorityError) {
      setError(priorityError instanceof Error ? priorityError.message : "Could not update deal priority.");
    }
  }

  async function removeDeal(deal: HotDeal) {
    if (!window.confirm(`Delete the hot deal "${deal.bundleTitle || deal.productName}"?`)) return;
    setError("");
    try {
      const response = await fetch("/api/admin/deals?type=hot", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim() || ""
        },
        body: JSON.stringify({ id: deal.id })
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error : "Could not delete this hot deal.");
      setToast("Hot deal deleted");
      await loadData(adminKey.trim() || "");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this hot deal.");
    }
  }

  return (
    <main className={styles.page}>
      <AdminPageHeader
        title="Hot Deals"
        count={visibleDeals.length}
        description="Create single-product offers or bundles."
        searchValue={search}
        searchPlaceholder="Search hot deals..."
        onSearchChange={setSearch}
        action={<button className={styles.primaryButton} type="button" onClick={openCreate}>+ Add Deal</button>}
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

      <AdminCard as="section" className={styles.panel} aria-labelledby="hotDealsHeading">
        <div className={styles.panelHeading}>
          <h2 id="hotDealsHeading">Curated hot deals</h2>
          <span>{visibleDeals.length} deals</span>
        </div>
        <label className={styles.search}>
          Search hot deals
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product, badge, or title" />
        </label>
        {error && !modalOpen && <p className={styles.error} role="alert">{error}</p>}
        {loading ? <p className={styles.empty}>Loading hot deals...</p> : visibleDeals.length === 0 ? (
          <p className={styles.empty}>No curated hot deals yet. Add products to feature an offer on the homepage.</p>
        ) : (
          <AdminTable className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Image</th><th>Title</th><th>Type</th><th>Products</th><th>Original</th><th>Deal Price / Savings</th><th>Priority</th><th>Homepage?</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {visibleDeals.map((deal) => (
                  <tr key={deal.id}>
                    <td>
                      {deal.bundleImage ? <img className={styles.categoryImage} src={deal.bundleImage} alt="" /> : (
                        <div className={dealStyles.bundleCollage}>
                          {deal.products.slice(0, 4).map((product) => product.image
                            ? <img key={product.productId} src={product.image} alt="" />
                            : <span key={product.productId}>—</span>)}
                        </div>
                      )}
                    </td>
                    <td><strong>{deal.bundleTitle || deal.productName}</strong>{deal.customTitle && <small>{deal.customTitle}</small>}</td>
                    <td><span className={dealStyles.badge}>{deal.dealType === "bundle" ? `BUNDLE ×${deal.products.length}` : "SINGLE"}</span></td>
                    <td><small>{deal.products.map((product) => product.title).join(" + ")}</small></td>
                    <td>{formatMoney(deal.originalTotalPrice)}</td>
                    <td><strong>{formatMoney(deal.dealPrice)}</strong><small className={dealStyles.strike}>{formatMoney(deal.originalTotalPrice)} · save {formatMoney(deal.originalTotalPrice - deal.dealPrice)} ({deal.discountPercent}% OFF)</small></td>
                    <td>
                      <div className={dealStyles.priorityCell}>
                        <strong>{deal.priority}</strong>
                        <div>
                          <button type="button" aria-label={`Move ${deal.bundleTitle || deal.productName} up`} disabled={deals.length < 2 || orderedDeals[0]?.id === deal.id} onClick={() => void updatePriority(deal, -1)}>↑</button>
                          <button type="button" aria-label={`Move ${deal.bundleTitle || deal.productName} down`} disabled={deals.length < 2 || orderedDeals.at(-1)?.id === deal.id} onClick={() => void updatePriority(deal, 1)}>↓</button>
                        </div>
                      </div>
                    </td>
                    <td><span className={deal.showOnHomepage ? styles.statusActive : styles.statusInactive}>{deal.showOnHomepage ? "Yes" : "No"}</span></td>
                    <td><span className={statusFor(deal) === "Active" ? styles.statusActive : styles.statusInactive}>{statusFor(deal)}</span><small>{deal.validTill ? `Till ${formatDate(deal.validTill)}` : "No expiry"}</small></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" onClick={() => openEdit(deal)}>Edit</button>
                        <button type="button" onClick={() => void toggleDeal(deal)}>{deal.isActive ? "Pause" : "Activate"}</button>
                        <button type="button" className={styles.deleteButton} onClick={() => void removeDeal(deal)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTable>
        )}
      </AdminCard>

      {modalOpen && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setModalOpen(false);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="hotDealModalHeading">
            <header className={styles.modalHeading}>
              <h2 id="hotDealModalHeading">{editingId ? "Edit Hot Deal" : "Add New Hot Deal"}</h2>
              <button type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)} disabled={saving}>×</button>
            </header>
            <form className={styles.form} onSubmit={submitDeal}>
              <fieldset className={`${styles.fullWidth} ${dealStyles.dealTypeChoices}`}>
                <legend>Deal Type</legend>
                <label><input type="radio" name="dealType" checked={form.dealType === "single"} onChange={() => changeDealType("single")} /> Single Product Deal</label>
                <label><input type="radio" name="dealType" checked={form.dealType === "bundle"} onChange={() => changeDealType("bundle")} /> Bundle Deal (2–4 Products Combo)</label>
              </fieldset>

              {form.dealType === "bundle" && (
                <h3 className={`${dealStyles.bundleHeading} ${styles.fullWidth}`}>Build Your Bundle Deal (2–4 Products)</h3>
              )}
              <label className={styles.fullWidth}>
                Search products
                <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products by name" />
              </label>
              {selectedProductIds.map((productId, index) => {
                const selected = products.find((product) => product.id === productId);
                return (
                  <label className={`${styles.fullWidth} ${dealStyles.productSelector}`} key={`product-${index}`}>
                    {form.dealType === "bundle" ? `Product Selector ${index + 1}${index > 1 ? " (optional)" : " *required"}` : "Select Product"}
                    <select
                      required={index < requiredCount}
                      value={productId}
                      onChange={(event) => setSelectedProductIds((current) =>
                        current.map((id, currentIndex) => currentIndex === index ? event.target.value : id)
                      )}
                    >
                      <option value="">Choose a product ({filteredProducts.length} available)</option>
                      {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.title} — {formatMoney(product.price)}</option>)}
                    </select>
                    {selected && <span className={dealStyles.selectorPrice}>{selected.title} · {formatMoney(selected.price)}</span>}
                    {index > 1 && <button className={dealStyles.removeProduct} type="button" onClick={() => removeProductSlot(index)}>Remove</button>}
                  </label>
                );
              })}
              {form.dealType === "bundle" && selectedProductIds.length < 4 && (
                <button className={`${styles.secondaryButton} ${styles.fullWidth}`} type="button" onClick={addProductSlot}>+ Add More Product</button>
              )}

              {selectedProducts.some(Boolean) && (
                <div className={`${dealStyles.selectedProducts} ${styles.fullWidth}`}>
                  {selectedProducts.map((product, index) => product && (
                    <div className={dealStyles.selectedProduct} key={`${product.id}-${index}`}>
                      {product.image && <img src={product.image} alt="" />}
                      <span>{product.title}<small>{formatMoney(product.price)}</small></span>
                      <button
                        className={dealStyles.removeProduct}
                        type="button"
                        aria-label={`Remove ${product.title} from deal`}
                        onClick={() => setSelectedProductIds((current) =>
                          current.map((id, currentIndex) => currentIndex === index ? "" : id)
                        )}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {form.dealType === "bundle" ? (
                <>
                  <label>
                    Bundle Deal Title
                    <input maxLength={120} required value={form.bundleTitle} onChange={(event) => setForm((current) => ({ ...current, bundleTitle: event.target.value }))} placeholder="Beauty Combo Deal" />
                  </label>
                  <label>
                    Bundle Image URL (optional)
                    <input type="url" value={form.bundleImage} onChange={(event) => setForm((current) => ({ ...current, bundleImage: event.target.value }))} placeholder="Auto collage when empty" />
                  </label>
                  <label>
                    Total Original Price
                    <input readOnly value={originalTotal || ""} />
                  </label>
                  <label>
                    Bundle Deal Price
                    <input type="number" min="0.01" step="0.01" required value={form.dealPrice || ""} onChange={(event) => setForm((current) => ({ ...current, dealPrice: Number(event.target.value) }))} />
                  </label>
                  <p className={`${dealStyles.pricePreview} ${styles.fullWidth}`}>
                    You save <strong>{formatMoney(Math.max(0, originalTotal - form.dealPrice))}</strong>
                    {" "}({originalTotal > 0 && form.dealPrice > 0 ? Math.max(0, Math.round((1 - form.dealPrice / originalTotal) * 100)) : 0}% OFF)
                  </p>
                </>
              ) : (
                <>
                  <label>
                    Discount Type
                    <select value={form.discountType} onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as HotDealForm["discountType"], discountValue: event.target.value === "percent" ? 20 : 500 }))}>
                      <option value="percent">Discount %</option><option value="fixed">Fixed Price Off (Rs)</option>
                    </select>
                  </label>
                  <label>
                    {form.discountType === "percent" ? "Discount %" : "Fixed Discount (Rs)"}
                    <input type="number" min="0.01" step="0.01" required value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: Number(event.target.value) }))} />
                  </label>
                  <p className={`${dealStyles.pricePreview} ${styles.fullWidth}`}>Hot deal price: <strong>{singleDealPrice > 0 ? formatMoney(singleDealPrice) : "—"}</strong></p>
                </>
              )}

              <label>
                Badge
                <select value={form.badgeText} onChange={(event) => setForm((current) => ({ ...current, badgeText: event.target.value }))}>
                  <option>Hot Deal</option><option>Best Seller</option><option>Trending</option><option>Combo Deal</option><option>Buy Together &amp; Save</option>
                </select>
              </label>
              <label>
                Custom Title (optional)
                <input maxLength={120} value={form.customTitle} onChange={(event) => setForm((current) => ({ ...current, customTitle: event.target.value }))} placeholder="Today's Best Deal" />
              </label>
              <label>
                Priority Order
                <input type="number" min="1" max="100000" step="1" required value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value) }))} />
              </label>
              <label>
                Valid Till
                <input type="date" value={formatLocalDate(form.validTill)} onChange={(event) => setForm((current) => ({ ...current, validTill: event.target.value ? new Date(`${event.target.value}T23:59:59`).toISOString() : null }))} />
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.showOnHomepage} onChange={(event) => setForm((current) => ({ ...current, showOnHomepage: event.target.checked }))} />
                Show on Homepage
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                Is Active
              </label>
              {error && <p className={`${styles.error} ${styles.fullWidth}`} role="alert">{error}</p>}
              <div className={`${styles.formActions} ${styles.fullWidth}`}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving || !canSubmit}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Hot Deal"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {toast && <div className={styles.toast} role="status" aria-live="polite">{toast}</div>}
    </main>
  );
}
