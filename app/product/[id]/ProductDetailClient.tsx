"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import ProductCard from "../../../components/ProductCard";
import {
  addCartItem,
  readCart,
  saveCart
} from "../../../lib/cart";
import {
  findMatchingVariantCombination,
  getVariantAttribute,
  isVariantCombinationInStock,
  normalizeVariantCombinations,
  normalizeVariantDefinitions,
  type ProductVariantCombination,
  type ProductVariantDefinition
} from "../../../lib/markaz-variants";
import styles from "./product.module.css";

type ProductDetails = {
  _id: string;
  title: string;
  name?: string;
  price: number;
  originalPrice?: number | null;
  image?: string;
  images?: string[];
  imageUrls?: string[];
  category: string;
  categoryId?: string | null;
  departmentId?: string | null;
  description?: string;
  stock: number;
  hasVariants?: boolean;
  variantOptions?: unknown[];
  variants?: ProductVariantDefinition[];
  variantCombinations?: ProductVariantCombination[];
};

type ProductComment = {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  comment: string;
  rating: number;
  createdAt: string;
  isVerifiedPurchase?: boolean;
  adminReply?: string;
  adminReplyDate?: string;
};

type ShippingSettings = {
  freeDeliveryEnabled: boolean;
  minAmountForFree: number;
  shippingFee: number;
};

type VariantSectionProps = {
  variants: ProductVariantDefinition[];
  selected: Record<string, string>;
  getAvailableOptions: (optionName: string) => string[];
  onSelect: (optionName: string, value: string) => void;
};

function VariantSection({ variants, selected, getAvailableOptions, onSelect }: VariantSectionProps) {
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});

  return (
    <section className={styles.variantSelector} aria-label="Choose product options">
      {variants.map((variant) => {
        const expanded = expandedOptions[variant.name] === true;
        const availableOptions = getAvailableOptions(variant.name);
        const visibleOptions = expanded
          ? variant.options
          : variant.options.slice(0, 4);
        const selectedOption = selected[variant.name];
        const displayedOptions = !expanded && selectedOption && !visibleOptions.includes(selectedOption)
          ? [...visibleOptions, selectedOption]
          : visibleOptions;
        const hiddenCount = variant.options.length - displayedOptions.length;

        return (
          <div
            className={styles.variantField}
            key={variant.name}
            role="group"
            aria-label={`${variant.name}${variant.required ? ", required" : ""}`}
          >
            <span className={styles.variantLegend}>
              {variant.name} :
            </span>
            <div className={styles.variantOptions}>
              {displayedOptions.map((option) => {
                const isSelected = selectedOption === option;
                const isAvailable = availableOptions.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.variantOption} ${isSelected ? styles.selectedVariantOption : ""} ${!isAvailable ? styles.unavailableVariantOption : ""}`}
                    disabled={!isAvailable}
                    onClick={() => onSelect(variant.name, option)}
                    aria-pressed={isSelected}
                  >
                    {option}
                  </button>
                );
              })}
              {!expanded && hiddenCount > 0 && (
                <button
                  type="button"
                  className={styles.moreVariants}
                  onClick={() => setExpandedOptions((current) => ({ ...current, [variant.name]: true }))}
                  aria-label={`Show ${hiddenCount} more ${variant.name} options`}
                >
                  +More variants
                </button>
              )}
            </div>
            {expanded && variant.options.length > 4 && (
              <button
                type="button"
                className={styles.showLessVariants}
                onClick={() => setExpandedOptions((current) => ({ ...current, [variant.name]: false }))}
              >
                Show less
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductDetails(value: unknown): value is ProductDetails {
  return isRecord(value) &&
    typeof value._id === "string" &&
    typeof value.title === "string" &&
    typeof value.price === "number" &&
    typeof value.category === "string" &&
    typeof value.stock === "number" &&
    (value.variants === undefined || Array.isArray(value.variants)) &&
    (value.variantCombinations === undefined || Array.isArray(value.variantCombinations)) &&
    (value.images === undefined || (Array.isArray(value.images) && value.images.every((image) => typeof image === "string"))) &&
    (value.imageUrls === undefined || (Array.isArray(value.imageUrls) && value.imageUrls.every((image) => typeof image === "string")));
}

function usableImageUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && (url.hostname === "markaz.app" || url.hostname.endsWith(".markaz.app"))) {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return value;
  }
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductDetails[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [rating, setRating] = useState(5);
  const [quantity, setQuantity] = useState(1);
  const [shipping, setShipping] = useState<ShippingSettings | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [variantError, setVariantError] = useState("");

  useEffect(() => {
    if (!variantError) return;
    const timeout = window.setTimeout(() => setVariantError(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [variantError]);

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
        setProduct({
          ...candidate,
          variants: normalizeVariantDefinitions(candidate.variants),
          variantCombinations: normalizeVariantCombinations(candidate.variantCombinations)
        });
        setSelectedImage(0);
        setFailedImages([]);
        setQuantity(1);
        setSelectedVariants({});
        setVariantError("");
        setAdded(false);
        setRating(5);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load this product.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    setRelatedProducts([]);
    const controller = new AbortController();
    const relatedParams = new URLSearchParams({ limit: "100" });
    if (product.departmentId) relatedParams.set("departmentId", product.departmentId);
    else if (product.categoryId) relatedParams.set("categoryId", product.categoryId);
    else relatedParams.set("department", product.category);
    fetch(`/api/products?${relatedParams}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.products)) {
          throw new Error("Could not load related products.");
        }
        const matching = result.products
          .filter(isProductDetails)
          .filter((candidate) => candidate._id !== product._id)
          .filter((candidate) =>
            Boolean(product.categoryId && candidate.categoryId === product.categoryId) ||
            Boolean(product.departmentId && candidate.departmentId === product.departmentId) ||
            candidate.category.toLocaleLowerCase() === product.category.toLocaleLowerCase()
          )
          .slice(0, 4);
        setRelatedProducts(matching);
      })
      .catch((relatedError: unknown) => {
        if (relatedError instanceof Error && relatedError.name === "AbortError") return;
        console.error("Could not load related products.", relatedError);
      });
    return () => controller.abort();
  }, [product]);

  useEffect(() => {
    function updateCartCount() {
      setCartCount(readCart().reduce((count, item) => count + item.quantity, 0));
    }

    updateCartCount();
    window.addEventListener("storage", updateCartCount);
    window.addEventListener("cartUpdated", updateCartCount);
    window.addEventListener("zavimart_cart_updated", updateCartCount);
    return () => {
      window.removeEventListener("storage", updateCartCount);
      window.removeEventListener("cartUpdated", updateCartCount);
      window.removeEventListener("zavimart_cart_updated", updateCartCount);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/shipping", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) ||
            typeof result.freeDeliveryEnabled !== "boolean" ||
            typeof result.minAmountForFree !== "number" ||
            typeof result.shippingFee !== "number") {
          throw new Error("The shipping settings response was invalid.");
        }
        setShipping({
          freeDeliveryEnabled: result.freeDeliveryEnabled,
          minAmountForFree: result.minAmountForFree,
          shippingFee: result.shippingFee
        });
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        console.warn("Could not load shipping settings for the product page.", loadError);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!product) return;
    const controller = new AbortController();
    fetch(`/api/comments?productId=${encodeURIComponent(product._id)}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        let result: unknown;
        try {
          result = await response.json();
        } catch (parseError) {
          console.warn("Could not parse product reviews; showing an empty list.", parseError);
          setComments([]);
          return;
        }
        const commentsArray = Array.isArray(result)
          ? result
          : isRecord(result) && Array.isArray(result.comments)
            ? result.comments
            : [];
        if (!response.ok) {
          console.warn(`Product reviews request failed with status ${response.status}; showing an empty list.`);
          setComments([]);
          return;
        }
        setComments(commentsArray.flatMap((entry): ProductComment[] => {
          if (!isRecord(entry) || typeof entry.id !== "string" ||
              typeof entry.customerName !== "string" || typeof entry.comment !== "string" ||
              typeof entry.rating !== "number" || typeof entry.createdAt !== "string") return [];
          return [{
            id: entry.id,
            customerName: entry.customerName,
            customerPhone: typeof entry.customerPhone === "string" ? entry.customerPhone : "",
            customerEmail: typeof entry.customerEmail === "string" ? entry.customerEmail : "",
            comment: entry.comment,
            rating: entry.rating,
            createdAt: entry.createdAt,
            isVerifiedPurchase: entry.isVerifiedPurchase === true,
            adminReply: typeof entry.adminReply === "string" ? entry.adminReply : "",
            adminReplyDate: typeof entry.adminReplyDate === "string" ? entry.adminReplyDate : ""
          }];
        }));
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        console.warn("Could not load product reviews; showing an empty list.", loadError);
        setComments([]);
      });
    return () => controller.abort();
  }, [product]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product || reviewSubmitting) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setReviewSubmitting(true);
    setReviewError("");
    setReviewMessage("");
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product._id,
          productName: product.name || product.title,
          customerName: String(form.get("customerName") ?? "").trim(),
          ...(String(form.get("customerContact") ?? "").includes("@")
            ? { customerEmail: String(form.get("customerContact") ?? "").trim() }
            : { customerPhone: String(form.get("customerContact") ?? "").trim() }),
          purchaseClaimed: form.get("purchaseClaimed") === "on",
          rating: Number(form.get("rating")),
          comment: String(form.get("comment") ?? "").trim()
        })
      });
      let result: unknown = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.warn("Could not parse the review submission response.", parseError);
      }
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : `Could not submit your review (HTTP ${response.status}).`);
      }
      if (!isRecord(result) || !isRecord(result.comment)) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "The review was saved, but the server returned an invalid response.");
      }
      const newComment = result.comment;
      if (typeof newComment.id !== "string" || typeof newComment.customerName !== "string" ||
          typeof newComment.comment !== "string" || typeof newComment.rating !== "number" ||
          typeof newComment.createdAt !== "string") {
        throw new Error("The review response was invalid.");
      }
      const savedComment: ProductComment = {
        id: newComment.id,
        customerName: newComment.customerName,
        customerPhone: typeof newComment.customerPhone === "string" ? newComment.customerPhone : "",
        customerEmail: typeof newComment.customerEmail === "string" ? newComment.customerEmail : "",
        comment: newComment.comment,
        rating: newComment.rating,
        createdAt: newComment.createdAt,
        isVerifiedPurchase: newComment.isVerifiedPurchase === true
      };
      setComments((current) => [savedComment, ...current]);
      formElement.reset();
      setRating(5);
      setReviewMessage("Review submitted!");
    } catch (submitError) {
      setReviewError(submitError instanceof Error && submitError.message
        ? submitError.message
        : "Could not submit your review. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  function addToCart(goToCheckout = false) {
    if (!product || product.stock <= 0) return;
    const variants = product.variants ?? [];
    if (product.hasVariants && variants.length === 0) {
      setVariantError("Required options could not be loaded for this product. Please contact support before ordering.");
      return;
    }
    const missingVariants = variants.filter((variant) => variant.required && !selectedVariants[variant.name]);
    if (missingVariants.length) {
      setVariantError(`Please select ${missingVariants.map((variant) => variant.name).join(", ")}`);
      return;
    }
    const matchedVariant = findMatchingVariantCombination(product.variantCombinations ?? [], selectedVariants);
    if ((product.variantCombinations?.length ?? 0) > 0 && !matchedVariant) {
      setVariantError("That variant combination is unavailable. Please choose another option.");
      return;
    }
    if (matchedVariant && !isVariantCombinationInStock(matchedVariant)) {
      setVariantError("That variant is out of stock. Please choose another option.");
      return;
    }
    if (matchedVariant?.stock !== undefined && quantity > matchedVariant.stock) {
      setVariantError(`Only ${matchedVariant.stock} of this variant are available.`);
      return;
    }
    setVariantError("");
    const image = product.image || product.images?.[0] || product.imageUrls?.[0] || "";
    const current = readCart();
    const variantKey = JSON.stringify(Object.fromEntries(Object.entries(selectedVariants).sort(([a], [b]) => a.localeCompare(b))));
    const existing = current.find((item) =>
      (item.productId ?? item.id) === product._id &&
      JSON.stringify(Object.fromEntries(Object.entries(item.selectedVariants ?? {}).sort(([a], [b]) => a.localeCompare(b)))) === variantKey
    );
    if (existing && existing.quantity + quantity > product.stock) {
      setVariantError(`Only ${product.stock - existing.quantity} more of this product are available.`);
      return;
    }
    const next = addCartItem(current, {
      id: `${product._id}:${variantKey}`,
      productId: product._id,
      name: product.name || product.title,
      image,
      price: product.price,
      ...(Object.keys(selectedVariants).length ? { selectedVariants: { ...selectedVariants } } : {}),
      ...(matchedVariant?.id || matchedVariant?.sku
        ? { variantId: matchedVariant.id || matchedVariant.sku }
        : {})
    }, quantity);
    try {
      saveCart(next);
    } catch (cartError) {
      console.error("Could not save the cart.", cartError);
      toast.error("Your cart could not be saved. Please try again.");
      return;
    }
    setCartCount(next.reduce((count, item) => count + item.quantity, 0));
    setAdded(true);
    toast.success(`${product.name || product.title} added to your cart.`);
    if (goToCheckout) router.push("/cart");
  }

  function addRelatedProduct(related: ProductDetails) {
    try {
      const next = addCartItem(readCart(), {
        id: related._id,
        productId: related._id,
        name: related.name || related.title,
        image: related.image || related.images?.[0] || related.imageUrls?.[0] || "",
        price: related.price
      });
      saveCart(next);
      toast.success(`${related.name || related.title} added to your cart.`);
    } catch (cartError) {
      console.error("Could not add a related product to the cart.", cartError);
      toast.error("This product could not be added to your cart.");
    }
  }

  function getAvailableOptions(optionName: string): string[] {
    const definition = product?.variants?.find((variant) => variant.name === optionName);
    if (!definition) return [];
    const combinations = product?.variantCombinations ?? [];
    if (!combinations.length) return definition.options;
    const matching = combinations.filter((combination) =>
      isVariantCombinationInStock(combination) &&
      Object.entries(selectedVariants).every(([name, value]) =>
        name === optionName || getVariantAttribute(combination.attributes, name) === value
      )
    );
    return [...new Set(matching
      .map((combination) => getVariantAttribute(combination.attributes, optionName))
      .filter((value): value is string => typeof value === "string"))];
  }

  function selectVariant(optionName: string, optionValue: string) {
    setSelectedVariants((current) => {
      const next = { ...current, [optionName]: optionValue };
      for (const definition of product?.variants ?? []) {
        if (definition.name === optionName || next[definition.name] === undefined) continue;
        const hasAvailableCombination = (product?.variantCombinations ?? []).some((combination) =>
          isVariantCombinationInStock(combination) &&
          Object.entries(next).every(([name, value]) =>
            name === definition.name || getVariantAttribute(combination.attributes, name) === value
          ) &&
          getVariantAttribute(combination.attributes, definition.name) === next[definition.name]
        );
        if (!hasAvailableCombination) delete next[definition.name];
      }
      return next;
    });
    setVariantError("");
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

  const image = product.image || product.images?.[0] || product.imageUrls?.[0] || "";
  const allImages = [...new Set(
    [...(product.images ?? []), ...(product.imageUrls ?? []), ...(image ? [image] : [])]
      .map((imageUrl) => imageUrl.trim())
      .filter(Boolean)
      .map(usableImageUrl)
  )];
  const currentImage = allImages[selectedImage] || image;
  const freeDelivery = !!shipping?.freeDeliveryEnabled &&
    product.price * quantity >= (shipping?.minAmountForFree ?? Number.POSITIVE_INFINITY);
  const shippingMessage = !shipping
    ? "Delivery details unavailable"
    : freeDelivery
      ? "Free Delivery"
      : shipping.freeDeliveryEnabled
        ? `Rs ${shipping.shippingFee.toLocaleString("en-PK")} delivery`
        : `Rs ${shipping.shippingFee.toLocaleString("en-PK")} shipping`;
  const reviewRating = comments.length
    ? comments.reduce((total, comment) => total + comment.rating, 0) / comments.length
    : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.backButton} onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <Link href="/" className={styles.brand} aria-label="ZaviMart home">
            <span className={styles.brandIcon}><ShoppingCart size={15} aria-hidden="true" /></span>
            <span>ZaviMart</span>
          </Link>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.headerIconButton} aria-label="Search products">
            <Search size={16} aria-hidden="true" />
          </Link>
          <Link href="/cart" className={styles.headerIconButton} aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart size={16} aria-hidden="true" />
            {cartCount > 0 && <span className={styles.headerCartCount}>{cartCount}</span>}
          </Link>
        </div>
      </header>
      <article className={styles.product}>
        <div className={styles.gallery}>
          <div className={styles.imagePanel}>
            {currentImage && !failedImages.includes(currentImage)
              ? (
                <Image
                  src={currentImage}
                  alt={product.name || product.title}
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 760px) 100vw, 50vw"
                  onError={() => setFailedImages((current) =>
                    current.includes(currentImage) ? current : [...current, currentImage]
                  )}
                />
              )
              : <div className={styles.noImage}>Image unavailable</div>}
          </div>
          {allImages.length > 1 && (
            <div className={styles.thumbnails} aria-label="Product images">
              {allImages.map((imageUrl, index) => (
                <button
                  className={`${styles.thumbnail} ${selectedImage === index ? styles.selectedThumbnail : ""}`}
                  key={`${imageUrl}-${index}`}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  aria-label={`Show product image ${index + 1}`}
                  aria-pressed={selectedImage === index}
                >
                  {failedImages.includes(imageUrl)
                    ? <span className={styles.thumbnailFallback}>Image unavailable</span>
                    : (
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="80px"
                        loading="lazy"
                        onError={() => setFailedImages((current) =>
                          current.includes(imageUrl) ? current : [...current, imageUrl]
                        )}
                      />
                    )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.details}>
          <p className={styles.category}>{product.category}</p>
          <h1>{product.name || product.title}</h1>
          {comments.length > 0 ? (
            <p className={styles.rating} aria-label={`Rated ${reviewRating.toFixed(1)} out of 5`}>
              <span aria-hidden="true">★ {reviewRating.toFixed(1)}</span>
              <span className={styles.reviews}>({comments.length} reviews)</span>
            </p>
          ) : (
            <p className={styles.reviewPrompt}>No reviews yet - Be the first to review</p>
          )}
          <div className={styles.price}>
            <strong>Rs {product.price.toLocaleString("en-PK")}</strong>
            {product.originalPrice && product.originalPrice > product.price && (
              <del>Rs {product.originalPrice.toLocaleString("en-PK")}</del>
            )}
          </div>
          <p className={styles.description}>{product.description || "Product details coming soon."}</p>
          <dl className={styles.facts}>
            <div><dt>Category</dt><dd>{product.category}</dd></div>
            <div><dt>Stock</dt><dd>{product.stock} available</dd></div>
            <div><dt>Delivery</dt><dd>2–3 days</dd></div>
            <div><dt>Shipping</dt><dd>{shippingMessage}</dd></div>
          </dl>
          <section className={styles.reviewsSection} aria-labelledby="reviewsHeading">
            <div className={styles.reviewsHeading}>
              <h2 id="reviewsHeading">Reviews & Ratings</h2>
              <span>{comments.length} {comments.length === 1 ? "review" : "reviews"}</span>
            </div>
            <form className={styles.reviewForm} onSubmit={submitReview}>
              <label>
                <span className={styles.visuallyHidden}>Your name</span>
                <input name="customerName" maxLength={120} placeholder="Your name" aria-label="Your name" required />
              </label>
              <label>
                <span className={styles.visuallyHidden}>Phone or email used for your order</span>
                <input
                  name="customerContact"
                  type="text"
                  autoComplete="off"
                  maxLength={254}
                  placeholder="Phone/Email for order verify"
                  aria-label="Phone or email used for your order"
                  required
                />
              </label>
              <fieldset className={styles.ratingField}>
                <legend className={styles.visuallyHidden}>Rating</legend>
                <input type="hidden" name="rating" value={rating} />
                <div className={styles.ratingChoices} aria-label="Choose a rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      aria-pressed={rating === star}
                    >
                      <span aria-hidden="true" className={star <= rating ? styles.activeStar : ""}>★</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className={styles.purchaseClaim}>
                <input name="purchaseClaimed" type="checkbox" />
                Purchased
              </label>
              <label className={styles.reviewComment}>
                <span className={styles.visuallyHidden}>Write your review</span>
                <input name="comment" maxLength={2000} placeholder="Write your review..." aria-label="Write your review" required />
              </label>
              {reviewError && <p className={styles.reviewError} role="alert">{reviewError}</p>}
              {reviewMessage && <p className={styles.reviewSuccess} role="status">{reviewMessage}</p>}
              <button className={styles.reviewButton} type="submit" disabled={reviewSubmitting}>
                {reviewSubmitting ? "Posting..." : "Post"}
              </button>
            </form>
            <div className={styles.reviewList}>
              {comments.map((comment) => (
                <article className={styles.reviewCard} key={comment.id}>
                  <div className={styles.reviewCardHeading}>
                    <strong>{comment.customerName}</strong>
                    <span aria-label={`${comment.rating} out of 5 stars`}>{"★".repeat(comment.rating)}</span>
                  </div>
                  {comment.isVerifiedPurchase && <span className={styles.verifiedBadge}>Verified Buyer</span>}
                  <p>{comment.comment}</p>
                  <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
                  {comment.adminReply && (
                    <p className={styles.storeReply}>
                      <strong>Store Reply:</strong> {comment.adminReply}
                      {comment.adminReplyDate && (
                        <time dateTime={comment.adminReplyDate}>
                          {new Date(comment.adminReplyDate).toLocaleDateString()}
                        </time>
                      )}
                    </p>
                  )}
                </article>
              ))}
              {!comments.length && <p className={styles.noReviews}>No reviews yet - Be the first to review.</p>}
            </div>
          </section>
        </div>
        <aside className={styles.buyBox} aria-label="Purchase options">
          <p className={styles.buyPrice}>
            Rs {product.price.toLocaleString("en-PK")}
            <span className={freeDelivery ? styles.freeDelivery : ""}>• {shippingMessage}</span>
          </p>
          {(product.variants?.length ?? 0) > 0 && (
            <VariantSection
              variants={product.variants ?? []}
              selected={selectedVariants}
              getAvailableOptions={getAvailableOptions}
              onSelect={selectVariant}
            />
          )}
          {(product.variants?.length ?? 0) > 0 && variantError && (
            <p className={styles.variantError} role="alert">{variantError}</p>
          )}
          <div className={styles.quantitySection}>
            <p className={styles.quantityLabel}>Quantity</p>
            <div className={styles.quantityControl} aria-label="Quantity">
              <div className={styles.quantityStepper}>
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))} disabled={quantity >= product.stock} aria-label="Increase quantity">+</button>
              </div>
              <span className={styles.stockText}>{product.stock} available</span>
            </div>
          </div>
          {variantError && !(product.variants?.length) && <p className={styles.variantError} role="alert">{variantError}</p>}
          <button type="button" className={styles.buyButton} onClick={() => addToCart()} disabled={product.stock <= 0}>
            {added ? "Added to cart" : "Add to Cart"}
          </button>
          <button type="button" className={styles.codButton} onClick={() => addToCart(true)} disabled={product.stock <= 0}>
            Buy Now - COD
          </button>
          <ul className={styles.purchaseBenefits}>
            <li>Cash on Delivery</li>
            <li>7 Days Return</li>
            <li>Original Product</li>
          </ul>
          <Link href="/cart" className={styles.cartLink}>View cart</Link>
        </aside>
      </article>
      {relatedProducts.length > 0 && (
        <section className={styles.relatedSection} aria-labelledby="related-products-heading">
          <span className={styles.eyebrow}>More to explore</span>
          <h2 id="related-products-heading">Related products</h2>
          <div className={styles.relatedProductGrid}>
            {relatedProducts.map((related, index) => (
              <ProductCard
                key={related._id}
                product={{
                  id: related._id,
                  title: related.name || related.title,
                  category: related.category,
                  image: related.image || related.images?.[0] || related.imageUrls?.[0],
                  price: related.price,
                  originalPrice: related.originalPrice
                }}
                priority={index < 4}
                onAddToCart={() => addRelatedProduct(related)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
