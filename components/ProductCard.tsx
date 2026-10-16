"use client";

import { useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./ProductCard.module.css";

export type ProductCardProduct = {
  id: string;
  title: string;
  category?: string;
  image?: string;
  images?: string[];
  price?: number;
  originalPrice?: number | null;
  discountPrice?: number | null;
  sellingPrice?: number;
  badge?: string;
  href?: string;
  isBundle?: boolean;
  bundleImages?: string[];
  bundleImage?: string;
};

type ProductCardProps = {
  product: ProductCardProduct;
  isAdded?: boolean;
  onAddToCart?: () => void;
  compact?: boolean;
  actionLabel?: string;
  priority?: boolean;
};

export default function ProductCard({
  product,
  isAdded = false,
  onAddToCart,
  compact = false,
  actionLabel,
  priority = false
}: ProductCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const images = product.images?.filter(Boolean).length
    ? product.images.filter(Boolean)
    : product.image ? [product.image] : [];
  const price = product.discountPrice ?? product.price ?? product.sellingPrice ?? 0;
  const originalPrice = product.originalPrice ??
    (product.discountPrice !== undefined && product.discountPrice !== null && product.discountPrice < (product.price ?? product.sellingPrice ?? 0)
      ? product.price ?? product.sellingPrice
      : null);
  const discountPercent = typeof originalPrice === "number" && originalPrice > price
    ? Math.round((originalPrice - price) / originalPrice * 100)
    : 0;
  const productHref = product.href ?? `/product/${encodeURIComponent(product.id)}`;
  const bundleImages = product.bundleImages?.filter(Boolean) ?? [];

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!cardRef.current || images.length <= 1) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const percentage = Math.min(0.999999, Math.max(0, (event.clientX - rect.left) / rect.width));
    setCurrentIndex(Math.floor(percentage * images.length));
  }

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <Link className={styles.imageLink} href={productHref}>
        <div
          ref={cardRef}
          className={styles.imagePanel}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setCurrentIndex(0);
          }}
          onMouseMove={handleMouseMove}
        >
          {product.isBundle && !product.bundleImage ? (
            <div className="grid h-full w-full grid-cols-2 gap-1 p-2">
              {(bundleImages.length ? bundleImages : images).slice(0, 4).map((image, index) => (
                <Image key={`${image}-${index}`} src={image} alt="" className="h-full w-full rounded object-cover" width={160} height={160} unoptimized priority={priority && index < 4} />
              ))}
            </div>
          ) : images[currentIndex] ? (
            <Image
              src={images[currentIndex]}
              alt={product.title}
              className={styles.image}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, 25vw"
              priority={priority}
            />
          ) : (
            <span className={styles.noImage}>No image available</span>
          )}
          {product.badge && <span className={styles.badge}>{product.badge}</span>}
          {discountPercent > 0 && <span className={styles.discountBadge}>{discountPercent}% OFF</span>}
          {images.length > 1 && isHovered && (
            <div className={styles.dots} aria-label={`Image ${currentIndex + 1} of ${images.length}`}>
              {images.map((image, index) => (
                <span
                  key={`${image}-${index}`}
                  className={`${styles.dot} ${index === currentIndex ? styles.activeDot : ""}`}
                />
              ))}
            </div>
          )}
          {images.length > 1 && !isHovered && (
            <span className={styles.imageCounter}>{images.length} Photos</span>
          )}
        </div>
      </Link>

      <div className={styles.content}>
        <p className={styles.category}>{product.category || "Beauty"}</p>
        <Link className={styles.titleLink} href={productHref}>
          <h3 className={styles.title}>{product.title}</h3>
        </Link>
        <p className={styles.price}>
          Rs {price.toLocaleString("en-PK")}
          {discountPercent > 0 && <del>Rs {originalPrice?.toLocaleString("en-PK")}</del>}
        </p>
        <p className={styles.availability}>Available From ZaviMart</p>
        {productHref.startsWith("/hot-deal/") ? (
          <Link className={styles.addButton} href={productHref}>{actionLabel ?? "View Bundle"}</Link>
        ) : (
          <button
            className={styles.addButton}
            type="button"
            disabled={isAdded || !onAddToCart}
            onClick={onAddToCart}
          >
            {isAdded ? "Added to cart" : actionLabel ?? "Add to cart"}
          </button>
        )}
      </div>
    </article>
  );
}
