export type WishlistProduct = {
  id: string;
  title: string;
  category?: string;
  image?: string;
  price?: number;
  originalPrice?: number | null;
  href?: string;
};

export const WISHLIST_STORAGE_KEY = "zavimart-wishlist";

function isWishlistProduct(value: unknown): value is WishlistProduct {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    "id" in value && typeof value.id === "string" &&
    "title" in value && typeof value.title === "string" &&
    (!("category" in value) || typeof value.category === "string") &&
    (!("image" in value) || typeof value.image === "string") &&
    (!("price" in value) || (typeof value.price === "number" && Number.isFinite(value.price))) &&
    (!("originalPrice" in value) || value.originalPrice === null ||
      (typeof value.originalPrice === "number" && Number.isFinite(value.originalPrice))) &&
    (!("href" in value) || typeof value.href === "string");
}

export function readWishlist(): WishlistProduct[] {
  const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error("The saved wishlist has an invalid format.");
  return parsed.filter(isWishlistProduct);
}

export function saveWishlist(products: WishlistProduct[]): void {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event("zavimart_wishlist_updated"));
}

export function toggleWishlistProduct(product: WishlistProduct): { products: WishlistProduct[]; added: boolean } {
  const products = readWishlist();
  const exists = products.some((item) => item.id === product.id);
  const updated = exists
    ? products.filter((item) => item.id !== product.id)
    : [...products, product];
  saveWishlist(updated);
  return { products: updated, added: !exists };
}

export function removeWishlistProduct(id: string): WishlistProduct[] {
  const updated = readWishlist().filter((product) => product.id !== id);
  saveWishlist(updated);
  return updated;
}
