export type CartItem = {
  id: string;
  productId?: string;
  bundleId?: string;
  checkoutProductId?: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  selectedVariants?: Record<string, string>;
  variantId?: string;
};

export const CART_STORAGE_KEY = "zavimart-next-cart";
const LEGACY_CART_STORAGE_KEYS = ["zavimart-cart", "cart"] as const;
const CART_UPDATED_EVENT = "cartUpdated";
const CART_UPDATED_LEGACY_EVENT = "zavimart_cart_updated";

export const CHECKOUT_PRODUCTS_BY_CART_ID: Record<string, { id: number; name: string; price: number }> = {
  "starter-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "starter-accessory": { id: 15, name: "Anker 20W USB-C Fast Charger", price: 4999 },
  "flash-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "flash-accessory": { id: 15, name: "Anker 20W USB-C Fast Charger", price: 4999 },
  "flash-electronics": { id: 17, name: "JBL Portable Bluetooth Speaker", price: 14999 },
  "flash-fashion": { id: 2, name: "Khaadi Lawn Printed Set", price: 4999 },
  "flash-home": { id: 6, name: "Premium Cotton Bedsheet Set", price: 3999 },
  "flash-beauty": { id: 4, name: "Hydrating Face Serum", price: 2499 },
  "flash-appliances": { id: 3, name: "Braun Air Fryer 4.2L", price: 28999 },
  "flash-health": { id: 7, name: "Dettol Hygiene Kit", price: 1599 },
  "flash-groceries": { id: 12, name: "Golden Basmati Rice 10kg", price: 2999 },
  "hot-mobile": { id: 1, name: "Samsung Galaxy A35 5G", price: 74999 },
  "hot-accessory": { id: 16, name: "Magnetic Phone Case", price: 1999 },
  "hot-electronics": { id: 5, name: "AirPods Pro 2", price: 57999 },
  "hot-fashion": { id: 11, name: "Nike Air Max Runner", price: 8999 },
  "hot-home": { id: 22, name: "Decorative Table Lamp", price: 4999 },
  "hot-beauty": { id: 23, name: "Daily Moisturizing Cream", price: 1899 },
  "hot-appliances": { id: 28, name: "Cordless Stick Vacuum", price: 24999 },
  "hot-health": { id: 29, name: "Digital Blood Pressure Monitor", price: 5999 },
  "hot-groceries": { id: 25, name: "Premium Green Tea 100 Bags", price: 899 }
};

export const STARTER_CART_ITEMS: CartItem[] = [
  {
    id: "starter-mobile",
    checkoutProductId: 1,
    name: "Samsung Galaxy A35 5G",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=320&q=80",
    price: 74999,
    quantity: 1
  },
  {
    id: "starter-accessory",
    checkoutProductId: 15,
    name: "Anker 20W USB-C Fast Charger",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=320&q=80",
    price: 4999,
    quantity: 1
  }
];

function isCartItem(value: unknown): value is CartItem {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    "id" in value && typeof value.id === "string" &&
    "name" in value && typeof value.name === "string" &&
    "image" in value && typeof value.image === "string" &&
    "price" in value && typeof value.price === "number" && Number.isFinite(value.price) && value.price >= 0 &&
    "quantity" in value && typeof value.quantity === "number" && Number.isInteger(value.quantity) && value.quantity > 0;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string");
}

export function parseCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CartItem[] => {
    if (isCartItem(item)) return [item];
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const legacy = item as Record<string, unknown>;
    const quantity = typeof legacy.quantity === "number" ? legacy.quantity : legacy.qty;
    const name = typeof legacy.name === "string" ? legacy.name : legacy.title;
    if (
      typeof legacy.id !== "string" ||
      typeof name !== "string" ||
      typeof legacy.image !== "string" ||
      typeof legacy.price !== "number" ||
      !Number.isFinite(legacy.price) ||
      legacy.price < 0 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) return [];
    return [{
      id: legacy.id,
      ...(typeof legacy.productId === "string" ? { productId: legacy.productId } : {}),
      ...(typeof legacy.bundleId === "string" ? { bundleId: legacy.bundleId } : {}),
      name,
      image: legacy.image,
      price: legacy.price,
      quantity,
      ...(typeof legacy.checkoutProductId === "number" ? { checkoutProductId: legacy.checkoutProductId } : {}),
      ...(isStringRecord(legacy.selectedVariants)
        ? { selectedVariants: legacy.selectedVariants }
        : {}),
      ...(typeof legacy.variantId === "string" ? { variantId: legacy.variantId } : {})
    }];
  });
}

export function readCart(): CartItem[] {
  const saved = localStorage.getItem(CART_STORAGE_KEY);
  if (saved !== null) return parseCart(JSON.parse(saved));

  for (const key of LEGACY_CART_STORAGE_KEYS) {
    const legacySaved = localStorage.getItem(key);
    if (legacySaved === null) continue;
    const items = parseCart(JSON.parse(legacySaved));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    for (const legacyKey of LEGACY_CART_STORAGE_KEYS) {
      localStorage.removeItem(legacyKey);
    }
    dispatchCartUpdated();
    return items;
  }
  return [];
}

function dispatchCartUpdated(): void {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  window.dispatchEvent(new Event(CART_UPDATED_LEGACY_EVENT));
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  dispatchCartUpdated();
}

export function addCartItem(
  items: CartItem[],
  product: Omit<CartItem, "quantity">,
  quantity = 1
): CartItem[] {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Cart quantity must be a positive integer.");
  }
  const variantKey = JSON.stringify(Object.fromEntries(
    Object.entries(product.selectedVariants ?? {}).sort(([left], [right]) => left.localeCompare(right))
  ));
  const existing = items.find((item) =>
    item.id === product.id &&
    JSON.stringify(Object.fromEntries(
      Object.entries(item.selectedVariants ?? {}).sort(([left], [right]) => left.localeCompare(right))
    )) === variantKey
  );
  if (existing) {
    return items.map((item) => item === existing
      ? { ...item, quantity: item.quantity + quantity }
      : item);
  }
  return [...items, { ...product, quantity }];
}

export function updateCartItemQuantity(items: CartItem[], id: string, quantity: number): CartItem[] {
  if (!Number.isInteger(quantity)) throw new Error("Cart quantity must be an integer.");
  return items.map((item) => item.id === id
    ? { ...item, quantity: Math.max(1, quantity) }
    : item);
}

export function removeCartItem(items: CartItem[], id: string): CartItem[] {
  return items.filter((item) => item.id !== id);
}

export function clearCart(): void {
  localStorage.removeItem(CART_STORAGE_KEY);
  for (const key of LEGACY_CART_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  dispatchCartUpdated();
}
