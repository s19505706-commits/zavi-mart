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
export type ProductCategory = string;

export function normalizeCategory(value: string): ProductCategory | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || value.trim().length > 100) return null;
  if (normalized === "women" || normalized === "women's" || normalized === "womens") return "Fashion";
  return CATEGORY_DEFINITIONS.find(({ id, name }) =>
    id.toLowerCase() === normalized || name.toLowerCase() === normalized
  )?.name ?? value.trim();
}

export function getCategoryId(value: ProductCategory): string {
  const normalized = value.trim().toLocaleLowerCase();
  const definition = CATEGORY_DEFINITIONS.find(({ id, name }) =>
    id.toLocaleLowerCase() === normalized || name.toLocaleLowerCase() === normalized
  );
  return definition?.id ?? value.trim().toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
