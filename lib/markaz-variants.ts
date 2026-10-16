export type ProductVariantDefinition = {
  name: string;
  slug: string;
  required: boolean;
  options: string[];
};

export type ProductVariantCombination = {
  id?: string;
  sku?: string;
  stock?: number;
  image?: string;
  in_stock?: boolean;
  inStock?: boolean;
  attributes: Record<string, string>;
  [key: string]: unknown;
};

export type MarkazVariantData = {
  variantOptions: unknown[];
  variants: ProductVariantDefinition[];
  variantCombinations: ProductVariantCombination[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function variantSlug(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!isRecord(value)) return "";
  for (const key of ["label", "name", "value", "title", "option"]) {
    const text = textValue(value[key]);
    if (text) return text;
  }
  return "";
}

export function normalizeVariantDefinitions(value: unknown): ProductVariantDefinition[] {
  if (!Array.isArray(value)) return [];
  const variants: ProductVariantDefinition[] = [];
  for (const entry of value.slice(0, 20)) {
    if (!isRecord(entry)) continue;
    const name = textValue(entry.name ?? entry.attribute_name ?? entry.title ?? entry.label);
    const slug = variantSlug(typeof entry.slug === "string" ? entry.slug : name);
    const rawOptions = entry.values ?? entry.options ?? entry.terms ?? entry.value;
    const options = Array.isArray(rawOptions)
      ? [...new Set(rawOptions.map(textValue).filter(Boolean))].slice(0, 500)
      : [];
    if (!name || !slug || !options.length) continue;
    variants.push({ name: name.slice(0, 80), slug, required: entry.required !== false, options });
  }
  return variants;
}

function normalizeAttributes(value: unknown): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      const name = textValue(entry.name ?? entry.attribute_name ?? entry.slug);
      const option = textValue(entry.value ?? entry.option ?? entry.label ?? entry.selected);
      if (name && option) attributes[name] = option;
    }
    return attributes;
  }
  if (!isRecord(value)) return attributes;
  for (const [key, entry] of Object.entries(value)) {
    const option = textValue(entry);
    if (key && option) attributes[key] = option;
  }
  return attributes;
}

export function normalizeVariantCombinations(value: unknown): ProductVariantCombination[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((entry): ProductVariantCombination[] => {
    if (!isRecord(entry)) return [];
    const attributes = normalizeAttributes(entry.attributes ?? entry.attributeValues ?? entry.options ?? entry.variation);
    if (!Object.keys(attributes).length) return [];
    const rawId = entry.variant_id ?? entry.variantId ?? entry.id ?? entry._id ?? entry.sku_id ?? entry.skuCode;
    const id = typeof rawId === "string" || typeof rawId === "number" ? String(rawId).slice(0, 200) : undefined;
    const rawSku = entry.sku ?? entry.skuCode ?? entry.sku_code;
    const sku = typeof rawSku === "string" || typeof rawSku === "number" ? String(rawSku).slice(0, 200) : undefined;
    const rawStock = Number(entry.stock ?? entry.quantity ?? entry.inventory);
    const stock = Number.isInteger(rawStock) && rawStock >= 0 ? rawStock : undefined;
    const image = typeof entry.image === "string" ? entry.image.slice(0, 2048) : undefined;
    const inStock = typeof entry.in_stock === "boolean"
      ? entry.in_stock
      : typeof entry.inStock === "boolean"
        ? entry.inStock
        : typeof entry.available === "boolean"
          ? entry.available
          : undefined;
    return [{
      ...entry,
      ...(id ? { id } : {}),
      ...(sku ? { sku } : {}),
      ...(stock !== undefined ? { stock } : {}),
      ...(image ? { image } : {}),
      ...(inStock !== undefined ? { in_stock: inStock } : {}),
      attributes
    }];
  });
}

export function extractMarkazVariantData(value: unknown): MarkazVariantData {
  let best: MarkazVariantData = { variantOptions: [], variants: [], variantCombinations: [] };
  let nodesVisited = 0;
  const visit = (entry: unknown, depth: number) => {
    if (depth > 30 || nodesVisited++ > 20_000) return;
    if (Array.isArray(entry)) {
      entry.forEach((child) => visit(child, depth + 1));
      return;
    }
    if (!isRecord(entry)) return;

    const rawOptions = entry.options ?? entry.attributes ?? entry.variations;
    const options = normalizeVariantDefinitions(rawOptions);
    const variants = options.length ? options : normalizeVariantDefinitions(entry.variants);
    const rawCombinations = entry.variantCombinations ?? entry.variant_combinations ??
      entry.variants ?? entry.skus ?? entry.combinations;
    const combinations = normalizeVariantCombinations(rawCombinations);
    if (variants.length > best.variants.length ||
        (variants.length === best.variants.length && combinations.length > best.variantCombinations.length)) {
      best = {
        variantOptions: Array.isArray(rawOptions) ? rawOptions : [],
        variants,
        variantCombinations: combinations
      };
    }
    for (const child of Object.values(entry)) visit(child, depth + 1);
  };
  visit(value, 0);
  return best;
}

export function getVariantAttribute(
  attributes: Record<string, string> | undefined,
  name: string
): string | undefined {
  if (!attributes) return undefined;
  const target = variantSlug(name);
  const entry = Object.entries(attributes).find(([key]) => variantSlug(key) === target);
  return entry?.[1];
}

export function isVariantCombinationInStock(combination: ProductVariantCombination): boolean {
  return combination.in_stock !== false &&
    combination.inStock !== false &&
    combination.stock !== 0;
}

export function findMatchingVariantCombination(
  combinations: ProductVariantCombination[],
  selected: Record<string, string>
): ProductVariantCombination | undefined {
  return combinations.find((combination) =>
    Object.entries(selected).every(([key, value]) => getVariantAttribute(combination.attributes, key) === value)
  );
}
