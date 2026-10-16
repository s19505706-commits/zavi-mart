import { ApiError, isRecord } from "./api-utils";
import { normalizeCategory, type ProductCategory } from "./product-categories";
import { cleanMarkazTitle, cleanProductDescription } from "./product-codes";
import { normalizeVariantCombinations, normalizeVariantDefinitions } from "./markaz-variants";
import type { ProductVariantCombination, ProductVariantDefinition } from "./markaz-variants";

export type ProductInput = {
  title?: string;
  slug?: string;
  price?: number;
  originalPrice?: number | null;
  images?: string[];
  category?: ProductCategory;
  departmentId?: string | null;
  categoryId?: string | null;
  stock?: number;
  hasVariants?: boolean;
  variantOptions?: unknown[];
  variants?: ProductVariantDefinition[];
  variantCombinations?: ProductVariantCombination[];
  description?: string;
  originalMarkazTitle?: string | null;
  productCode?: string | null;
  markazCode?: string | null;
  supplierCode?: string | null;
  originalDescription?: string | null;
  markazProductId?: string | null;
  markazProductUrl?: string | null;
  isFlashDeal?: boolean;
  isHotDeal?: boolean;
  flashDealDiscount?: number;
  flashDealExpiry?: Date | null;
  hotDealLabel?: string;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  ratings?: number;
  discountPercent?: number;
  dealEndDate?: Date | null;
  brand?: string;
  sku?: string;
};

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseProductInput(value: unknown, partial = false): ProductInput {
  if (!isRecord(value)) {
    throw new ApiError("Product data must be a JSON object.", 400);
  }

  const input: ProductInput = {};

  if ("title" in value) {
    if (typeof value.title !== "string" || !value.title.trim()) {
      throw new ApiError("title must be a non-empty string.", 400);
    }
    const title = value.title.trim();
    input.title = cleanMarkazTitle(title);
    if (input.title !== title && /Markaz|\bPKR\s*[\d,]+/i.test(title)) {
      input.originalMarkazTitle = title;
    }
    if (!input.title) throw new ApiError("title must contain text after removing supplier branding.", 400);
  } else if (!partial) {
    throw new ApiError("title is required.", 400);
  }

  if ("price" in value) {
    if (typeof value.price !== "number" || !Number.isFinite(value.price) || value.price < 0) {
      throw new ApiError("price must be a non-negative number.", 400);
    }
    input.price = value.price;
  } else if (!partial) {
    throw new ApiError("price is required.", 400);
  }

  if ("category" in value) {
    if (typeof value.category !== "string" || !value.category.trim() || value.category.trim().length > 100) {
      throw new ApiError("category must be a non-empty string of 100 characters or fewer.", 400);
    }
    const category = normalizeCategory(value.category);
    if (!category) {
      throw new ApiError("category must be a non-empty string of 100 characters or fewer.", 400);
    }
    input.category = category;
  } else if (!partial) {
    throw new ApiError("category is required.", 400);
  }

  for (const key of ["departmentId", "categoryId"] as const) {
    if (key in value) {
      if (value[key] !== null && (typeof value[key] !== "string" || value[key].trim().length > 100)) {
        throw new ApiError(`${key} must be a string of 100 characters or fewer, or null.`, 400);
      }
      input[key] = typeof value[key] === "string" && value[key].trim() ? value[key].trim() : null;
    }
  }

  if ("slug" in value) {
    if (typeof value.slug !== "string" || !slugify(value.slug)) {
      throw new ApiError("slug must contain letters or numbers.", 400);
    }
    input.slug = slugify(value.slug);
  }

  if ("originalPrice" in value) {
    if (
      value.originalPrice !== null &&
      (typeof value.originalPrice !== "number" ||
        !Number.isFinite(value.originalPrice) ||
        value.originalPrice < 0)
    ) {
      throw new ApiError("originalPrice must be a non-negative number or null.", 400);
    }
    input.originalPrice = value.originalPrice;
  }

  if ("images" in value) {
    if (
      !Array.isArray(value.images) ||
      !value.images.every((image) => typeof image === "string" && image.trim())
    ) {
      throw new ApiError("images must be an array of non-empty strings.", 400);
    }
    input.images = value.images.map((image) => image.trim());
  }

  if ("stock" in value) {
    if (typeof value.stock !== "number" || !Number.isInteger(value.stock) || value.stock < 0) {
      throw new ApiError("stock must be a non-negative integer.", 400);
    }
    input.stock = value.stock;
  }

  if ("hasVariants" in value) {
    if (typeof value.hasVariants !== "boolean") {
      throw new ApiError("hasVariants must be a boolean.", 400);
    }
    input.hasVariants = value.hasVariants;
  }

  if ("variantOptions" in value) {
    if (!Array.isArray(value.variantOptions) || value.variantOptions.length > 20) {
      throw new ApiError("variantOptions must be an array containing no more than 20 options.", 400);
    }
    input.variantOptions = value.variantOptions;
  }

  if ("variants" in value) {
    if (!Array.isArray(value.variants) || value.variants.length > 20) {
      throw new ApiError("variants must be an array containing no more than 20 attributes.", 400);
    }
    const variants = normalizeVariantDefinitions(value.variants);
    if (variants.length !== value.variants.length) {
      throw new ApiError("Each variant requires a name and at least one valid option.", 400);
    }
    input.variants = variants;
    input.hasVariants = variants.length > 0;
  }

  if ("variantCombinations" in value) {
    if (!Array.isArray(value.variantCombinations) || value.variantCombinations.length > 500) {
      throw new ApiError("variantCombinations must contain no more than 500 entries.", 400);
    }
    const combinations = normalizeVariantCombinations(value.variantCombinations);
    if (combinations.length !== value.variantCombinations.length) {
      throw new ApiError("Each variant combination must include its attribute selections.", 400);
    }
    input.variantCombinations = combinations;
  }

  if ("description" in value) {
    if (typeof value.description !== "string") {
      throw new ApiError("description must be a string.", 400);
    }
    input.description = cleanProductDescription(value.description);
  }

  if ("originalMarkazTitle" in value) {
    if (value.originalMarkazTitle !== null &&
        (typeof value.originalMarkazTitle !== "string" || value.originalMarkazTitle.length > 200)) {
      throw new ApiError("originalMarkazTitle must be a string of 200 characters or fewer, or null.", 400);
    }
    input.originalMarkazTitle = typeof value.originalMarkazTitle === "string"
      ? value.originalMarkazTitle.trim()
      : value.originalMarkazTitle === null ? null : input.originalMarkazTitle ?? null;
  }

  for (const key of ["productCode", "markazCode", "supplierCode", "markazProductId"] as const) {
    if (key in value) {
      const maxLength = key === "markazProductId" ? 1000 : 200;
      if (value[key] !== null && (typeof value[key] !== "string" || value[key].length > maxLength)) {
        throw new ApiError(`${key} must be a string of ${maxLength} characters or fewer, or null.`, 400);
      }
      input[key] = typeof value[key] === "string" ? value[key].trim() : null;
    }
  }

  if ("markazProductUrl" in value) {
    if (value.markazProductUrl !== null &&
        (typeof value.markazProductUrl !== "string" || value.markazProductUrl.length > 2000)) {
      throw new ApiError("markazProductUrl must be a valid Markaz URL of 2000 characters or fewer, or null.", 400);
    }
    if (typeof value.markazProductUrl === "string" && value.markazProductUrl.trim()) {
      let url: URL;
      try {
        url = new URL(value.markazProductUrl.trim());
      } catch {
        throw new ApiError("Enter a valid Markaz product link.", 400);
      }
      const hostname = url.hostname.toLocaleLowerCase();
      const isMarkazHost = hostname === "markaz" ||
        hostname.startsWith("markaz.") ||
        hostname.endsWith(".markaz") ||
        hostname.includes(".markaz.");
      if (!["https:", "http:"].includes(url.protocol) || !isMarkazHost) {
        throw new ApiError("The product link must use a Markaz domain.", 400);
      }
      input.markazProductUrl = url.toString();
    } else {
      input.markazProductUrl = null;
    }
  }

  if ("originalDescription" in value) {
    if (value.originalDescription !== null &&
        (typeof value.originalDescription !== "string" || value.originalDescription.length > 5000)) {
      throw new ApiError("originalDescription must be a string of 5000 characters or fewer, or null.", 400);
    }
    input.originalDescription = typeof value.originalDescription === "string"
      ? value.originalDescription.trim()
      : null;
  }

  for (const key of ["isFlashDeal", "isHotDeal", "isFeatured", "isNewArrival"] as const) {
    if (key in value) {
      if (typeof value[key] !== "boolean") {
        throw new ApiError(`${key} must be a boolean.`, 400);
      }
      input[key] = value[key];
    }
  }

  if ("flashDealDiscount" in value) {
    if (
      typeof value.flashDealDiscount !== "number" ||
      !Number.isFinite(value.flashDealDiscount) ||
      value.flashDealDiscount < 0 ||
      value.flashDealDiscount > 100
    ) {
      throw new ApiError("flashDealDiscount must be a number from 0 to 100.", 400);
    }
    input.flashDealDiscount = value.flashDealDiscount;
  }

  if ("flashDealExpiry" in value) {
    if (value.flashDealExpiry === null) {
      input.flashDealExpiry = null;
    } else if (
      typeof value.flashDealExpiry === "string" &&
      Number.isFinite(Date.parse(value.flashDealExpiry))
    ) {
      input.flashDealExpiry = new Date(value.flashDealExpiry);
    } else {
      throw new ApiError("flashDealExpiry must be a valid date or null.", 400);
    }
  }

  if ("hotDealLabel" in value) {
    if (typeof value.hotDealLabel !== "string") {
      throw new ApiError("hotDealLabel must be a string.", 400);
    }
    input.hotDealLabel = value.hotDealLabel.trim();
  }

  if ("ratings" in value) {
    if (
      typeof value.ratings !== "number" ||
      !Number.isFinite(value.ratings) ||
      value.ratings < 0 ||
      value.ratings > 5
    ) {
      throw new ApiError("ratings must be a number from 0 to 5.", 400);
    }
    input.ratings = value.ratings;
  }

  if ("discountPercent" in value) {
    if (
      typeof value.discountPercent !== "number" ||
      !Number.isFinite(value.discountPercent) ||
      value.discountPercent < 0 ||
      value.discountPercent > 100
    ) {
      throw new ApiError("discountPercent must be a number from 0 to 100.", 400);
    }
    input.discountPercent = value.discountPercent;
  }

  if ("dealEndDate" in value) {
    if (value.dealEndDate === null) {
      input.dealEndDate = null;
    } else if (typeof value.dealEndDate === "string" && Number.isFinite(Date.parse(value.dealEndDate))) {
      input.dealEndDate = new Date(value.dealEndDate);
    } else {
      throw new ApiError("dealEndDate must be a valid date or null.", 400);
    }
  }

  for (const key of ["brand", "sku"] as const) {
    if (key in value) {
      if (typeof value[key] !== "string") {
        throw new ApiError(`${key} must be a string.`, 400);
      }
      input[key] = value[key].trim();
    }
  }

  if (partial && Object.keys(input).length === 0) {
    throw new ApiError("At least one supported product field is required.", 400);
  }

  return input;
}
