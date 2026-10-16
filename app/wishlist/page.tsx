"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import ProductCard from "../../components/ProductCard";
import { readWishlist, type WishlistProduct } from "../../lib/wishlist";

export default function WishlistPage() {
  const router = useRouter();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncWishlist = () => {
      try {
        setProducts(readWishlist());
      } catch (error) {
        console.error("Could not load the wishlist.", error);
      } finally {
        setReady(true);
      }
    };
    syncWishlist();
    window.addEventListener("storage", syncWishlist);
    window.addEventListener("zavimart_wishlist_updated", syncWishlist);
    return () => {
      window.removeEventListener("storage", syncWishlist);
      window.removeEventListener("zavimart_wishlist_updated", syncWishlist);
    };
  }, []);

  return (
    <main className="catalog-page">
      <header className="wishlist-page-heading">
        <span className="wishlist-heading-icon"><Heart size={22} aria-hidden="true" /></span>
        <div>
          <span className="section-eyebrow">Saved for later</span>
          <h1>Your wishlist</h1>
          <p>{products.length} {products.length === 1 ? "product" : "products"}</p>
        </div>
      </header>
      {!ready ? <p role="status">Loading your wishlist…</p> : products.length ? (
        <div className="department-product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={() => router.push(product.href ?? `/product/${encodeURIComponent(product.id)}`)}
              actionLabel="View product"
            />
          ))}
        </div>
      ) : (
        <section className="homepage-products-empty">
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on a product to save it here.</p>
          <Link href="/">Explore products</Link>
        </section>
      )}
    </main>
  );
}
