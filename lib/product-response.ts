import type { ProductDocument } from "../models/Product";
import { getCategoryId } from "./product-categories";
import { cleanMarkazTitle, cleanProductDescription, extractProductCode } from "./product-codes";
import { normalizeVariantCombinations, normalizeVariantDefinitions } from "./markaz-variants";

export function serializeProduct(product: ProductDocument, includeAdminFields = false) {
  const id = product._id.toString();
  const categoryId = getCategoryId(product.category);
  const productCode = product.productCode || product.markazCode || product.supplierCode ||
    extractProductCode(product.originalDescription || product.description);
  const variants = normalizeVariantDefinitions(product.variants);
  const variantCombinations = normalizeVariantCombinations(
    (product.variantCombinations ?? []).map((combination) =>
      combination.toObject({ flattenMaps: true })
    )
  );

  return {
    _id: id,
    id,
    title: cleanMarkazTitle(product.title),
    name: cleanMarkazTitle(product.title),
    slug: product.slug,
    price: product.price,
    originalPrice: product.originalPrice ?? null,
    oldPrice: product.originalPrice ?? product.price,
    images: product.images,
    image: product.images[0] ?? "",
    category: product.category,
    departmentId: product.departmentId ?? null,
    categoryId: product.categoryId ?? categoryId ?? null,
    stock: product.stock,
    hasVariants: product.hasVariants === true || variants.length > 0,
    variantOptions: product.variantOptions ?? [],
    variants,
    variantCombinations,
    description: cleanProductDescription(product.description),
    ...(includeAdminFields ? {
      costPrice: product.costPrice ?? null,
      productCode: productCode ?? null,
      markazCode: product.markazCode || productCode || null,
      supplierCode: product.supplierCode || productCode || null,
      originalDescription: product.originalDescription ?? (productCode ? product.description : null),
      originalMarkazTitle: product.originalMarkazTitle ?? null,
      markazTitle: product.originalMarkazTitle ?? null
    } : {}),
    isFlashDeal: product.isFlashDeal,
    isHotDeal: product.isHotDeal,
    flashDealDiscount: product.flashDealDiscount ?? 0,
    flashDealExpiry: product.flashDealExpiry?.toISOString() ?? null,
    hotDealLabel: product.hotDealLabel ?? "",
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    dealEndDate: product.dealEndDate?.toISOString() ?? null,
    discountPercent: product.discountPercent ?? 0,
    brand: product.brand ?? "",
    sku: product.sku ?? "",
    isMarkazProduct: product.isMarkazProduct,
    isDropship: product.isDropship === true,
    isActive: product.isActive !== false,
    importSource: product.importSource ?? "manual",
    markazProductId: product.markazProductId ?? null,
    ...(includeAdminFields ? { markazProductUrl: product.markazProductUrl ?? null } : {}),
    wholesalePrice: product.wholesalePrice ?? null,
    sellingPrice: product.sellingPrice ?? null,
    profit: product.profit ?? null,
    supplier: product.supplier ?? null,
    ratings: product.ratings || 4.5,
    rating: product.ratings || 4.5,
    reviews: product.reviews || 100,
    badge: product.isNewArrival ? "New" : "",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}
