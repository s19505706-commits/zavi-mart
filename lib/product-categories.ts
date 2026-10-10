export const CATEGORY_DEFINITIONS = [
  { id: "mobiles", name: "Mobiles" },
  { id: "mobile accessories", name: "Mobile Accessories" },
  { id: "electronics", name: "Electronics" },
  { id: "fashion", name: "Fashion" },
  { id: "home", name: "Home & Living" },
  { id: "beauty", name: "Beauty" },
  { id: "appliances", name: "Appliances" },
  { id: "health", name: "Health" },
  { id: "groceries", name: "Groceries" },
  { id: "general", name: "General" }
] as const;

export const PRODUCT_CATEGORIES = CATEGORY_DEFINITIONS.map(({ name }) => name);
export type ProductCategory = (typeof CATEGORY_DEFINITIONS)[number]["name"];

export function normalizeCategory(value: string): ProductCategory | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "women" || normalized === "women's" || normalized === "womens") return "Fashion";
  return CATEGORY_DEFINITIONS.find(({ id, name }) =>
    id.toLowerCase() === normalized || name.toLowerCase() === normalized
  )?.name ?? null;
}

export function getCategoryId(value: ProductCategory): string {
  return CATEGORY_DEFINITIONS.find(({ name }) => name === value)?.id ?? "";
}
