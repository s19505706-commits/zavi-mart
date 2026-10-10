"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import {
  CART_STORAGE_KEY,
  type CartItem
} from "../../../lib/cart";
import styles from "./product.module.css";

type ProductDetails = {
  _id: string;
  title: string;
  name?: string;
  price: number;
  originalPrice?: number | null;
  image?: string;
  images?: string[];
  category: string;
  description?: string;
  stock: number;
  rating?: number;
  ratings?: number | { average?: number; count?: number };
  reviews?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductDetails(value: unknown): value is ProductDetails {
  return isRecord(value) &&
    typeof value._id === "string" &&
    typeof value.title === "string" &&
    typeof value.price === "number" &&
    typeof value.category === "string" &&
    typeof value.stock === "number";
}

function readCart(): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value as CartItem[] : [];
  } catch (error) {
    console.error("Could not read the saved cart.", error);
    return [];
  }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/products?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = isRecord(result) && typeof result.error === "string"
            ? result.error
            : "Could not load this product.";
          throw new Error(message);
        }
        const candidate = isRecord(result) && "product" in result ? result.product : result;
        if (!isProductDetails(candidate)) throw new Error("The product response was invalid.");
        setProduct(candidate);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load this product.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  function addToCart() {
    if (!product) return;
    const image = product.image || product.images?.[0] || "";
    const current = readCart();
    const existing = current.find((item) => item.id === product._id);
    const next = existing
      ? current.map((item) => item.id === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, {
          id: product._id,
          name: product.name || product.title,
          image,
          price: product.price,
          quantity: 1
        }];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    setAdded(true);
  }

  if (loading) return <main className={styles.state}>Loading product...</main>;
  if (error || !product) {
    return (
      <main className={styles.state}>
        <p role="alert">{error || "Product not found."}</p>
        <Link href="/">Back to storefront</Link>
      </main>
    );
  }

  const image = product.image || product.images?.[0] || "";
  const rating = typeof product.rating === "number"
    ? product.rating
    : typeof product.ratings === "number"
      ? product.ratings
      : product.ratings?.average ?? 4.5;
  const reviews = product.reviews ?? (typeof product.ratings === "object" ? product.ratings.count : undefined) ?? 100;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="ZaviMart home">
          <ShoppingCart size={24} aria-hidden="true" />
          <span>ZaviMart</span>
        </Link>
        <button type="button" className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={17} aria-hidden="true" /> Back
        </button>
      </header>
      <article className={styles.product}>
        <div className={styles.imagePanel}>
          {image
            ? <Image src={image} alt={product.name || product.title} fill priority unoptimized sizes="(max-width: 760px) 100vw, 50vw" />
            : <div className={styles.noImage}>No image available</div>}
        </div>
        <div className={styles.details}>
          <p className={styles.category}>{product.category}</p>
          <h1>{product.name || product.title}</h1>
          <p className={styles.rating} aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
            <span aria-hidden="true">★</span> {rating.toFixed(1)}
            <span className={styles.reviews}>({reviews} reviews)</span>
          </p>
          <div className={styles.price}>
            <strong>Rs {product.price.toLocaleString("en-PK")}</strong>
            {product.originalPrice && product.originalPrice > product.price && (
              <del>Rs {product.originalPrice.toLocaleString("en-PK")}</del>
            )}
          </div>
          <p className={styles.description}>{product.description || "Product details coming soon."}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.addButton} onClick={addToCart}>
              {added ? "Added to cart" : "Add to Cart"}
            </button>
            <Link href="/cart" className={styles.cartLink}>View cart</Link>
          </div>
          <dl className={styles.facts}>
            <div><dt>Stock</dt><dd>{product.stock} available</dd></div>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Delivery</dt><dd>2–3 days</dd></div>
          </dl>
        </div>
      </article>
    </main>
  );
}
