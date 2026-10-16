export type ProductCodeFields = {
  productCode?: string | null;
  markazCode?: string | null;
  supplierCode?: string | null;
  originalDescription?: string | null;
  markazProductUrl?: string | null;
};

export function cleanMarkazTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*[—-]\s*PKR\s*[\d,]+(?:\.\d+)?\s*[–—-]\s*Markaz/gi, "")
    .replace(/\s*PKR\s*[\d,]+(?:\.\d+)?\s*/gi, " ")
    .replace(/\s*[–—-]\s*Markaz\s*$/gi, "")
    .replace(/\s*-\s*Markaz\s*$/gi, "")
    .replace(/\bMarkaz\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ")
    .trim();
}

export function extractProductCode(description: string): string | null {
  const match = description.match(/Product Code:\s*([A-Z0-9-]+)/i);
  return match?.[1]?.trim() ?? null;
}

export function cleanProductDescription(description: string): string {
  return description
    .replace(/Product Code:\s*[A-Z0-9-]+/gi, "")
    .replace(/Note:\s*There might be an error[\s\S]*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanCustomerProduct<T extends object>(product: T): T {
  const customerProduct = { ...product };
  const fields = customerProduct as T & ProductCodeFields & {
    description?: unknown;
    title?: unknown;
    name?: unknown;
  };
  delete fields.productCode;
  delete fields.markazCode;
  delete fields.supplierCode;
  delete fields.originalDescription;
  delete fields.markazProductUrl;
  if (typeof fields.description === "string") {
    fields.description = cleanProductDescription(fields.description);
  }
  if (typeof fields.title === "string") {
    fields.title = cleanMarkazTitle(fields.title);
  }
  if (typeof fields.name === "string") {
    fields.name = cleanMarkazTitle(fields.name);
  }
  return customerProduct;
}
