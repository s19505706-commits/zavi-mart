"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ProductCard from "../../components/ProductCard";
import { addCartItem, readCart, saveCart } from "../../lib/cart";

type SearchProduct = {
  _id: string;
  title: string;
  category: string;
  price: number;
  originalPrice?: number | null;
  image: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProducts(value: unknown): SearchProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): SearchProduct[] =>
    isRecord(item) && typeof item._id === "string" && typeof item.title === "string" &&
      typeof item.category === "string" && typeof item.price === "number"
      ? [{
        _id: item._id,
        title: item.title,
        category: item.category,
        price: item.price,
        originalPrice: typeof item.originalPrice === "number" ? item.originalPrice : null,
        image: typeof item.image === "string" ? item.image : ""
      }]
      : []
  );
}

export default function SearchResults({ query }: { query: string }) {
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/products?search=${encodeURIComponent(normalizedQuery)}&limit=100`, {
      cache: "no-store",
      signal: controller.signal
    }).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok || !isRecord(result) || !Array.isArray(result.products)) {
        throw new Error("Search results could not be loaded.");
      }
      setProducts(parseProducts(result.products));
    }).catch((loadError: unknown) => {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      console.error("Could not load search results.", loadError);
      setError(loadError instanceof Error ? loadError.message : "Search results could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [query]);

  function addToCart(product: SearchProduct) {
    try {
      saveCart(addCartItem(readCart(), {
        id: product._id,
        productId: product._id,
        name: product.title,
        image: product.image,
        price: product.price
      }));
      toast.success(`${product.title} added to your cart.`);
    } catch (cartError) {
      console.error("Could not add the search result to the cart.", cartError);
      toast.error("This product could not be added to your cart.");
    }
  }

  return (
    <main className="catalog-page">
      <nav className="department-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span aria-hidden="true">›</span><span aria-current="page">Search</span>
      </nav>
      <header className="catalog-page-heading">
        <span className="section-eyebrow">Search ZaviMart</span>
        <h1>Results for “{query}”</h1>
        {!loading && !error && <p>{products.length} products found</p>}
      </header>
      {error ? <p role="alert">{error}</p> : loading ? (
        <p role="status">Searching products…</p>
      ) : products.length ? (
        <div className="department-product-grid">
          {products.map((product, index) => (
            <ProductCard
              key={product._id}
              product={{
                id: product._id,
                title: product.title,
                category: product.category,
                image: product.image,
                price: product.price,
                originalPrice: product.originalPrice
              }}
              priority={index < 4}
              onAddToCart={() => addToCart(product)}
            />
          ))}
        </div>
      ) : (
        <section className="homepage-products-empty">
          <h2>No matching products</h2>
          <p>Try another product name or browse all departments.</p>
          <Link href="/">Browse the store</Link>
        </section>
      )}
    </main>
  );
}
