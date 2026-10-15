"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../products.module.css";

type AdminProduct = {
  id: string;
  title: string;
  category: string;
  price: number;
  stock: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState("");
  const [highlightSearch, setHighlightSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const querySearch = new URLSearchParams(window.location.search).get("search")?.trim() ?? "";
    setSearch(querySearch);
    setHighlightSearch(querySearch);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products?limit=100", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.products)) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load products.");
        }
        const loadedProducts = result.products.flatMap((entry): AdminProduct[] => {
          if (!isRecord(entry) || typeof entry.title !== "string" ||
              typeof entry.price !== "number" || typeof entry.stock !== "number") return [];
          const id = typeof entry._id === "string"
            ? entry._id
            : typeof entry.id === "string" ? entry.id : "";
          if (!id) return [];
          return [{
            id,
            title: entry.title,
            category: typeof entry.category === "string" ? entry.category : "",
            price: entry.price,
            stock: entry.stock
          }];
        });
        if (!cancelled) setProducts(loadedProducts);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return products.filter((product) =>
      !normalizedSearch ||
      `${product.title} ${product.id}`.toLocaleLowerCase().includes(normalizedSearch)
    );
  }, [products, search]);

  return (
    <main className={`${styles.page} admin-content`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ZaviMart operations</span>
          <h1>Products</h1>
          <p>Search the catalog and open a product from a notification.</p>
        </div>
        <Link className={styles.backLink} href="/admin/products">Product management</Link>
      </header>

      <section className={styles.panel} aria-labelledby="productsHeading">
        <div className={styles.panelHeading}>
          <h2 id="productsHeading">Product catalog</h2>
          <span>{visibleProducts.length} products</span>
        </div>
        <label className={styles.searchLabel}>
          Search products
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product name or ID"
          />
        </label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading ? (
          <p className={styles.empty}>Loading products...</p>
        ) : visibleProducts.length === 0 ? (
          <p className={styles.empty}>No products match your search.</p>
        ) : (
          <ul className={styles.list}>
            {visibleProducts.map((product) => (
              <li
                className={`${styles.productRow} ${
                  highlightSearch && `${product.title} ${product.id}`.toLocaleLowerCase()
                    .includes(highlightSearch.toLocaleLowerCase())
                    ? styles.highlightedProduct
                    : ""
                }`}
                key={product.id}
              >
                <div>
                  <strong>{product.title}</strong>
                  <span>{product.category} · Rs {product.price.toLocaleString("en-PK")} · Stock {product.stock}</span>
                </div>
                <code>{product.id}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
