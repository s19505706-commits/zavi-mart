import { ApiError, isRecord } from "./api-utils";
import { normalizeCategory, type ProductCategory } from "./product-categories";

export type ProductInput = {
  title?: string;
  slug?: string;
  price?: number;
  originalPrice?: number;
  images?: string[];
  category?: ProductCategory;
  stock?: number;
  description?: string;
  isFlashDeal?: boolean;
  isFeatured?: boolean;
  ratings?: number;
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
    input.title = value.title.trim();
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
    if (typeof value.category !== "string") {
      throw new ApiError("category must be one of the supported categories.", 400);
    }
    const category = normalizeCategory(value.category);
    if (!category) {
      throw new ApiError("category must be one of the supported categories.", 400);
    }
    input.category = category;
  } else if (!partial) {
    throw new ApiError("category is required.", 400);
  }

  if ("slug" in value) {
    if (typeof value.slug !== "string" || !slugify(value.slug)) {
      throw new ApiError("slug must contain letters or numbers.", 400);
    }
    input.slug = slugify(value.slug);
  }

  if ("originalPrice" in value) {
    if (
      typeof value.originalPrice !== "number" ||
      !Number.isFinite(value.originalPrice) ||
      value.originalPrice < 0
    ) {
      throw new ApiError("originalPrice must be a non-negative number.", 400);
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

  if ("description" in value) {
    if (typeof value.description !== "string") {
      throw new ApiError("description must be a string.", 400);
    }
    input.description = value.description.trim();
  }

  for (const key of ["isFlashDeal", "isFeatured"] as const) {
    if (key in value) {
      if (typeof value[key] !== "boolean") {
        throw new ApiError(`${key} must be a boolean.`, 400);
      }
      input[key] = value[key];
    }
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

  if (partial && Object.keys(input).length === 0) {
    throw new ApiError("At least one supported product field is required.", 400);
  }

  return input;
}
