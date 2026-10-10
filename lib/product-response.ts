import type { ProductDocument } from "../models/Product";
import { getCategoryId } from "./product-categories";

export function serializeProduct(product: ProductDocument) {
  const id = product._id.toString();
  const categoryId = getCategoryId(product.category);

  return {
    _id: id,
    id,
    title: product.title,
    name: product.title,
    slug: product.slug,
    price: product.price,
    originalPrice: product.originalPrice ?? null,
    oldPrice: product.originalPrice ?? product.price,
    images: product.images,
    image: product.images[0] ?? "",
    category: product.category,
    categoryId,
    stock: product.stock,
    description: product.description,
    isFlashDeal: product.isFlashDeal,
    isFeatured: product.isFeatured,
    isMarkazProduct: product.isMarkazProduct,
    isActive: product.isActive !== false,
    markazProductId: product.markazProductId ?? null,
    wholesalePrice: product.wholesalePrice ?? null,
    sellingPrice: product.sellingPrice ?? null,
    profit: product.profit ?? null,
    supplier: product.supplier ?? null,
    ratings: product.ratings || 4.5,
    rating: product.ratings || 4.5,
    reviews: product.reviews || 100,
    badge: product.isFlashDeal ? "Flash deal" : product.isFeatured ? "Featured" : "",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}
