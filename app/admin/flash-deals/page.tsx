"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap } from "lucide-react";
import styles from "./flash-deals.module.css";

type FlashProduct = {
  id: string;
  title: string;
  image: string;
  price: number;
  isFlashDeal: boolean;
  flashDealDiscount: number;
  flashDealExpiry: string;
};

type ProductEdit = Pick<FlashProduct, "isFlashDeal" | "flashDealDiscount" | "flashDealExpiry">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseProducts(value: unknown): FlashProduct[] {
  if (!isRecord(value) || !Array.isArray(value.products)) return [];
  return value.products.flatMap((item): FlashProduct[] => {
    if (!isRecord(item)) return [];
    const id = typeof item._id === "string" ? item._id : typeof item.id === "string" ? item.id : "";
    const title = typeof item.title === "string" ? item.title : "";
    if (!id || !title) return [];
    const images = Array.isArray(item.images) ? item.images : [];
    return [{
      id,
      title,
      image: typeof item.image === "string" ? item.image : typeof images[0] === "string" ? images[0] : "",
      price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
      isFlashDeal: item.isFlashDeal === true,
      flashDealDiscount: typeof item.flashDealDiscount === "number" ? item.flashDealDiscount : 0,
      flashDealExpiry: typeof item.flashDealExpiry === "string" ? item.flashDealExpiry : ""
    }];
  });
}

export default function AdminFlashDealsPage() {
  const [products, setProducts] = useState<FlashProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductEdit>>({});
  const [adminKey, setAdminKey] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProducts = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/products?includeAdminFields=true&limit=100", {
        cache: "no-store",
        headers: { "x-admin-key": key }
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : "Could not load products.");
      }
      setProducts(parseProducts(result));
      setDrafts({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedKey = sessionStorage.getItem("zavimart-admin-key")?.trim() || "";
    setAdminKey(savedKey);
    void loadProducts(savedKey);
  }, [loadProducts]);

  function editFor(product: FlashProduct): ProductEdit {
    return drafts[product.id] ?? {
      isFlashDeal: product.isFlashDeal,
      flashDealDiscount: product.flashDealDiscount,
      flashDealExpiry: product.flashDealExpiry
    };
  }

  function patchDraft(product: FlashProduct, patch: Partial<ProductEdit>) {
    setDrafts((current) => ({
      ...current,
      [product.id]: { ...editFor(product), ...patch }
    }));
  }

  async function updateProduct(product: FlashProduct, changes: Partial<ProductEdit>) {
    const values = { ...editFor(product), ...changes };
    setSavingId(product.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim()
        },
        body: JSON.stringify({
          isFlashDeal: values.isFlashDeal,
          flashDealDiscount: values.flashDealDiscount,
          flashDealExpiry: values.flashDealExpiry
            ? new Date(values.flashDealExpiry).toISOString()
            : null
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error : "Could not update this product.");
      }
      setProducts((current) => current.map((entry) =>
        entry.id === product.id ? { ...entry, ...values } : entry
      ));
      setDrafts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setNotice(`${product.title} ${values.isFlashDeal ? "added to" : "removed from"} Flash Deals.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update this product.");
    } finally {
      setSavingId("");
    }
  }

  const visibleProducts = products.filter((product) =>
    product.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><Zap size={14} aria-hidden="true" /> HOMEPAGE PROMOTIONS</span>
          <h1>Flash Deals</h1>
          <p>Choose products for the Flash Deals section and manage their discount and expiry.</p>
        </div>
        <div className={styles.headerStats}>
          <strong>{products.filter((product) => product.isFlashDeal).length}</strong>
          <span>Products featured</span>
        </div>
      </header>

      <label className={styles.adminKey}>
        Admin API key
        <input
          type="password"
          value={adminKey}
          autoComplete="current-password"
          onChange={(event) => {
            setAdminKey(event.target.value);
            sessionStorage.setItem("zavimart-admin-key", event.target.value);
          }}
          onBlur={() => void loadProducts(adminKey.trim())}
        />
      </label>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="sr-only">Search products</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" />
        </label>
        <span>{visibleProducts.length} products</span>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.tableCard} aria-label="Flash deal products">
        {loading ? <p className={styles.empty}>Loading products…</p> : visibleProducts.length === 0 ? (
          <p className={styles.empty}>No products found.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr><th>Product</th><th>Price</th><th>Flash Deal</th><th>Discount %</th><th>Expiry</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const edit = editFor(product);
                  const saving = savingId === product.id;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className={styles.productCell}>
                          {product.image
                            ? <img src={product.image} alt="" loading="lazy" />
                            : <span className={styles.imagePlaceholder}>—</span>}
                          <span>{product.title}</span>
                        </div>
                      </td>
                      <td>Rs {product.price.toLocaleString("en-PK")}</td>
                      <td>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={edit.isFlashDeal}
                            disabled={saving}
                            onChange={(event) => {
                              const isFlashDeal = event.target.checked;
                              patchDraft(product, { isFlashDeal });
                              void updateProduct(product, { isFlashDeal });
                            }}
                          />
                          <span>{edit.isFlashDeal ? "On" : "Off"}</span>
                        </label>
                      </td>
                      <td>
                        <input
                          className={styles.discountInput}
                          aria-label={`Discount percentage for ${product.title}`}
                          type="number"
                          min="0"
                          max="100"
                          value={edit.flashDealDiscount}
                          onChange={(event) => patchDraft(product, { flashDealDiscount: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.expiryInput}
                          aria-label={`Flash deal expiry for ${product.title}`}
                          type="datetime-local"
                          value={toDateTimeLocal(edit.flashDealExpiry)}
                          onChange={(event) => patchDraft(product, { flashDealExpiry: event.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          className={styles.saveButton}
                          type="button"
                          disabled={saving}
                          onClick={() => void updateProduct(product, {})}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
