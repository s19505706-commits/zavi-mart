import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, requireAdmin, readJsonBody } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { getCategoryId, normalizeCategory } from "../../../../lib/product-categories";
import { slugify } from "../../../../lib/product-input";
import { MOCK_PRODUCTS } from "../../../../lib/mock-products";
import { getLocalMarkazProducts, saveLocalMarkazProduct } from "../../../../lib/local-markaz-products";
import { serializeProduct } from "../../../../lib/product-response";
import Product from "../../../../models/Product";
import { isProductImportSource, logProductHistory, type ProductImportSource } from "../../../../lib/product-history";
import { cleanMarkazTitle, cleanProductDescription, extractProductCode } from "../../../../lib/product-codes";
import { validateProductClassification } from "../../../../lib/department-category-store";
import { normalizeVariantCombinations, normalizeVariantDefinitions } from "../../../../lib/markaz-variants";

export const runtime = "nodejs";

function parseWebUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 2048) {
    throw new ApiError(`${field} must be a valid URL.`, 400);
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported URL protocol.");
    }
    return url.toString();
  } catch {
    throw new ApiError(`${field} must be a valid HTTP or HTTPS URL.`, 400);
  }
}

function isSupplierProductPage(value: string): boolean {
  const url = new URL(value);
  return ["markaz.app", "www.markaz.app"].includes(url.hostname.toLowerCase()) &&
    /\/(?:shop\/)?products?\//i.test(url.pathname);
}

function getProductIdFromUrl(value: string): string {
  const segments = new URL(value).pathname.split("/").filter(Boolean);
  const productIndex = segments.findIndex((segment) => segment.toLowerCase() === "product" || segment.toLowerCase() === "products");
  const productRoute = productIndex >= 0 ? segments[productIndex]?.toLowerCase() : "";
  const idSegment = productRoute === "product" ? segments.at(-1) : productRoute === "products" ? segments[productIndex + 1] : segments.at(-1);
  if (!idSegment || idSegment.toLowerCase() === "product" || idSegment.toLowerCase() === "products") return "";

  try {
    return decodeURIComponent(idSegment).slice(0, 1000);
  } catch {
    throw new ApiError("Supplier product URL contains an invalid product ID.", 400);
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const value = await readJsonBody(request);
    if (!isRecord(value)) throw new ApiError("Product data must be a JSON object.", 400);

    const submittedTitle = typeof value.title === "string" ? value.title.trim() : "";
    const suppliedOriginalTitle = value.originalMarkazTitle;
    if (suppliedOriginalTitle !== undefined && suppliedOriginalTitle !== null &&
        (typeof suppliedOriginalTitle !== "string" || suppliedOriginalTitle.length > 200)) {
      throw new ApiError("originalMarkazTitle must be a string of 200 characters or fewer, or null.", 400);
    }
    const originalMarkazTitle = typeof suppliedOriginalTitle === "string" && suppliedOriginalTitle.trim()
      ? suppliedOriginalTitle.trim()
      : submittedTitle;
    const title = cleanMarkazTitle(submittedTitle);
    if (!title || title.length > 200) throw new ApiError("title is required and must be 200 characters or fewer after removing supplier branding.", 400);

    const category = typeof value.category === "string" ? normalizeCategory(value.category) : null;
    if (!category) throw new ApiError("category must be a non-empty string of 100 characters or fewer.", 400);
    const departmentId = typeof value.departmentId === "string" ? value.departmentId : undefined;
    const categoryId = typeof value.categoryId === "string" ? value.categoryId : undefined;
    await validateProductClassification({ category, departmentId, categoryId });

    const markazUrl = parseWebUrl(value.markazUrl, "supplierUrl");
    const inferredSource: ProductImportSource = new URL(markazUrl).hostname.toLowerCase().includes("aliexpress")
      ? "aliexpress"
      : "bulk-import";
    if (value.source !== undefined && !isProductImportSource(value.source)) {
      throw new ApiError("source must be manual, local, markaz, csv, json, aliexpress, or bulk-import.", 400);
    }
    const importSource: ProductImportSource = isProductImportSource(value.source) ? value.source : inferredSource;
    if (value.sourceFileName !== undefined &&
        (typeof value.sourceFileName !== "string" || !value.sourceFileName.trim() || value.sourceFileName.length > 255)) {
      throw new ApiError("sourceFileName must be a non-empty string of 255 characters or fewer.", 400);
    }
    const sourceFileName = typeof value.sourceFileName === "string" ? value.sourceFileName.trim() : undefined;
    const wholesalePrice = value.wholesalePrice;
    const sellingPrice = value.sellingPrice;
    const costPrice = value.costPrice;
    if (typeof costPrice !== "number" || !Number.isFinite(costPrice) || costPrice < 0) {
      throw new ApiError("costPrice must be a non-negative number.", 400);
    }
    if (typeof wholesalePrice !== "number" || !Number.isFinite(wholesalePrice) || wholesalePrice < 0) {
      throw new ApiError("wholesalePrice must be a non-negative number.", 400);
    }
    if (typeof sellingPrice !== "number" || !Number.isFinite(sellingPrice) || sellingPrice < wholesalePrice) {
      throw new ApiError("sellingPrice must be a number greater than or equal to wholesalePrice.", 400);
    }

    const submittedImages = Array.isArray(value.images)
      ? value.images
      : typeof value.image === "string" && value.image.trim()
        ? [value.image]
        : [];
    if (submittedImages.length > 12) {
      throw new ApiError("images must contain no more than 12 image URLs.", 400);
    }
    const images = submittedImages
      .map((image, index) => parseWebUrl(image, `images[${index}]`))
      .filter((image) => !isSupplierProductPage(image));
    if (typeof value.image === "string" && value.image.trim()) {
      const primaryImage = parseWebUrl(value.image, "image");
      if (!isSupplierProductPage(primaryImage)) {
        images.unshift(primaryImage);
      }
    }
    const uniqueImages = [...new Set(images)];
    if (value.isNewArrival !== undefined && typeof value.isNewArrival !== "boolean") {
      throw new ApiError("isNewArrival must be a boolean.", 400);
    }
    const isNewArrival = value.isNewArrival === true;

    const stock = value.stock ?? 100;
    if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
      throw new ApiError("stock must be a non-negative integer.", 400);
    }
    const description = value.description ?? "";
    if (typeof description !== "string" || description.length > 5000) {
      throw new ApiError("description must be 5000 characters or fewer.", 400);
    }
    const originalDescription = value.originalDescription ?? description;
    if (typeof originalDescription !== "string" || originalDescription.length > 5000) {
      throw new ApiError("originalDescription must be 5000 characters or fewer.", 400);
    }
    const submittedProductCode = value.productCode;
    if (submittedProductCode !== undefined && submittedProductCode !== null &&
        (typeof submittedProductCode !== "string" ||
          submittedProductCode.length > 200 ||
          !/^[A-Z0-9-]+$/i.test(submittedProductCode.trim()))) {
      throw new ApiError("productCode must contain only letters, numbers, or hyphens, or be null.", 400);
    }
    const productCode = extractProductCode(originalDescription) ??
      (typeof submittedProductCode === "string" ? submittedProductCode.trim() : null);
    const cleanedDescription = cleanProductDescription(description);
    const rating = value.rating === undefined ? 4.5 : Number(value.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      throw new ApiError("rating must be a number from 0 to 5.", 400);
    }
    const reviews = value.reviews === undefined ? 100 : Number(value.reviews);
    if (!Number.isInteger(reviews) || reviews < 0) {
      throw new ApiError("reviews must be a non-negative integer.", 400);
    }
    if (value.variants !== undefined && (!Array.isArray(value.variants) || value.variants.length > 20)) {
      throw new ApiError("variants must contain no more than 20 attributes.", 400);
    }
    const variants = normalizeVariantDefinitions(value.variants ?? []);
    if (Array.isArray(value.variants) && variants.length !== value.variants.length) {
      throw new ApiError("Each variant requires a name and at least one valid option.", 400);
    }
    if (value.variantOptions !== undefined &&
        (!Array.isArray(value.variantOptions) || value.variantOptions.length > 20)) {
      throw new ApiError("variantOptions must contain no more than 20 options.", 400);
    }
    const variantOptions = Array.isArray(value.variantOptions) ? value.variantOptions : [];
    if (value.variantCombinations !== undefined &&
        (!Array.isArray(value.variantCombinations) || value.variantCombinations.length > 500)) {
      throw new ApiError("variantCombinations must contain no more than 500 entries.", 400);
    }
    const variantCombinations = normalizeVariantCombinations(value.variantCombinations ?? []);
    if (Array.isArray(value.variantCombinations) &&
        variantCombinations.length !== value.variantCombinations.length) {
      throw new ApiError("Each variant combination must include its attribute selections.", 400);
    }

    const supplierValue = value.supplier;
    if (supplierValue !== undefined && !isRecord(supplierValue)) {
      throw new ApiError("supplier must be an object.", 400);
    }
    const supplier = supplierValue as Record<string, unknown> | undefined;
    const supplierName = supplier?.name ?? "Supplier";
    const supplierInfo = supplier?.info ?? "";
    if (typeof supplierName !== "string" || !supplierName.trim() || supplierName.length > 120) {
      throw new ApiError("supplier.name must be 120 characters or fewer.", 400);
    }
    if (typeof supplierInfo !== "string" || supplierInfo.length > 1000) {
      throw new ApiError("supplier.info must be 1000 characters or fewer.", 400);
    }

    const suppliedMarkazProductId = value.markazProductId ?? "";
    if (typeof suppliedMarkazProductId !== "string" || suppliedMarkazProductId.length > 1000) {
      throw new ApiError("Supplier product ID must be a string of 1000 characters or fewer.", 400);
    }
    const trimmedMarkazProductId = suppliedMarkazProductId.trim();
    const markazProductIdValue = /^https?:\/\//i.test(trimmedMarkazProductId)
      ? getProductIdFromUrl(parseWebUrl(trimmedMarkazProductId, "supplierProductId")) || slugify(title)
      : trimmedMarkazProductId || getProductIdFromUrl(markazUrl) || slugify(title);

    const baseSlug = `markaz-${slugify(title)}`;
    if (baseSlug === "markaz-") {
      throw new ApiError("title must contain letters or numbers to generate a slug.", 400);
    }
    let slug = baseSlug;
    let suffix = 2;
    const connection = await connectToDatabase();
    if (!connection) {
      const localProducts = await getLocalMarkazProducts();
      const existingSlugs = new Set([...MOCK_PRODUCTS.map((product) => product.slug), ...localProducts.map((product) => product.slug)]);
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
    } else {
      while (await Product.exists({ slug })) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
    }

    const profit = sellingPrice - wholesalePrice;
    if (!connection) {
      const id = new mongoose.Types.ObjectId().toHexString();
      const now = new Date().toISOString();
      const image = uniqueImages[0] ?? "";
      const product = {
        _id: id,
        id,
        title,
        name: title,
        originalMarkazTitle,
        slug,
        price: sellingPrice,
        costPrice,
        originalPrice: null,
        oldPrice: sellingPrice,
        images: uniqueImages,
        image,
        category,
        departmentId: departmentId ?? null,
        categoryId: categoryId ?? getCategoryId(category),
        stock,
        hasVariants: variants.length > 0,
        variantOptions,
        variants,
        variantCombinations,
        description: cleanedDescription,
        productCode,
        markazCode: productCode,
        supplierCode: productCode,
        originalDescription: originalDescription.trim() || null,
        isFlashDeal: false,
        isFeatured: false,
        isMarkazProduct: true,
        isDropship: true,
        isActive: true,
        importSource,
        isNewArrival,
        markazProductId: markazProductIdValue,
        markazProductUrl: markazUrl,
        wholesalePrice,
        sellingPrice,
        profit,
        supplier: { name: supplierName.trim(), productUrl: markazUrl, info: supplierInfo.trim() },
        ratings: rating || 4.5,
        rating: rating || 4.5,
        reviews,
        badge: "New",
        createdAt: now,
        updatedAt: now
      };
      await saveLocalMarkazProduct(product);
      await logProductHistory("imported", product, importSource, sourceFileName);
      return Response.json({ product, storage: "local" });
    }

    const product = await Product.create({
      title,
      originalMarkazTitle,
      slug,
      category,
      departmentId: departmentId ?? null,
      categoryId: categoryId ?? null,
      price: sellingPrice,
      costPrice,
      sellingPrice,
      wholesalePrice,
      profit,
      markazProductId: markazProductIdValue,
      supplier: { name: supplierName.trim(), productUrl: markazUrl, info: supplierInfo.trim() },
      images: uniqueImages,
      stock,
      hasVariants: variants.length > 0,
      variantOptions,
      variants,
      variantCombinations,
      description: cleanedDescription,
      productCode,
      markazCode: productCode,
      supplierCode: productCode,
      originalDescription: originalDescription.trim() || null,
      isMarkazProduct: true,
      isDropship: true,
      isActive: true,
      importSource,
      isNewArrival,
      markazProductUrl: markazUrl,
      isFlashDeal: false,
      isFeatured: false,
      ratings: rating || 4.5,
      reviews
    });

    const serializedProduct = serializeProduct(product, true);
    await logProductHistory("imported", serializedProduct, importSource, sourceFileName);
    return Response.json({ product: serializedProduct, storage: "mongodb" }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "POST /api/products/import failed");
  }
}
