import mongoose from "mongoose";
import { ApiError, handleApiError, requireAdmin, readJsonBody } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { parseProductInput } from "../../../../lib/product-input";
import { serializeProduct } from "../../../../lib/product-response";
import Product from "../../../../models/Product";
import { getLocalMarkazProducts } from "../../../../lib/local-markaz-products";
import {
  deleteLocalProduct,
  getLocalProductStore,
  getStaticProduct,
  upsertLocalProduct
} from "../../../../lib/local-products";
import {
  archiveDeletedProduct,
  getProductImportSource,
  logProductDealAdditions,
  logProductHistory,
} from "../../../../lib/product-history";
import { cleanCustomerProduct } from "../../../../lib/product-codes";
import { validateProductClassification } from "../../../../lib/department-category-store";

type RouteContext = { params: Promise<{ id: string }> };

function noStoreJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function validateId(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError("Product id is invalid.", 400);
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    validateId(id);
    const connection = await connectToDatabase();
    const [store, localMarkazProducts, databaseProduct] = await Promise.all([
      getLocalProductStore(),
      getLocalMarkazProducts(),
      connection ? Product.findById(id) : Promise.resolve(null)
    ]);
    const product = databaseProduct
      ? serializeProduct(databaseProduct)
      : store.products.find((entry) => entry._id === id || entry.id === id) ??
        localMarkazProducts.find((entry) => entry._id === id || entry.id === id) ??
        getStaticProduct(id);
    if (!product || store.deletedIds.includes(id)) {
      return noStoreJson({ error: "Product not found." }, 404);
    }
    return noStoreJson({ product: cleanCustomerProduct(product) });
  } catch (error) {
    const response = handleApiError(error, "GET /api/products/[id] failed");
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    validateId(id);
    const updates = parseProductInput(await readJsonBody(request), true);
    await validateProductClassification(updates);
    const connection = await connectToDatabase();
    if (connection) {
      const previousProduct = updates.isFlashDeal === true || updates.isHotDeal === true
        ? await Product.findById(id)
        : null;
      const product = await Product.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true
      });
      if (product) {
        const serializedProduct = serializeProduct(product, true);
        await logProductHistory("updated", serializedProduct, getProductImportSource(serializedProduct));
        await logProductDealAdditions(
          serializedProduct,
          previousProduct,
          getProductImportSource(serializedProduct)
        );
        return Response.json({ product: serializedProduct });
      }
    }

    const store = await getLocalProductStore();
    const localMarkazProducts = await getLocalMarkazProducts();
    const existingProduct = store.products.find((entry) => entry._id === id || entry.id === id) ??
      localMarkazProducts.find((entry) => entry._id === id || entry.id === id) ??
      getStaticProduct(id);
    if (!existingProduct) return Response.json({ error: "Product not found." }, { status: 404 });

    const images = updates.images ?? existingProduct.images;
    const title = updates.title ?? existingProduct.title;
    const price = updates.price ?? existingProduct.price;
    const updatedProduct = await upsertLocalProduct({
      ...existingProduct,
      ...updates,
      _id: existingProduct._id,
      id: existingProduct.id,
      title,
      name: title,
      slug: updates.slug ?? existingProduct.slug,
      price,
      originalPrice: updates.originalPrice === undefined ? existingProduct.originalPrice : updates.originalPrice,
      oldPrice: updates.originalPrice === undefined ? existingProduct.oldPrice : updates.originalPrice ?? price,
      images,
      image: images[0] ?? "",
      category: updates.category ?? existingProduct.category,
      stock: updates.stock ?? existingProduct.stock,
      description: updates.description ?? existingProduct.description,
      isFlashDeal: updates.isFlashDeal ?? existingProduct.isFlashDeal,
      isHotDeal: updates.isHotDeal ?? existingProduct.isHotDeal ?? false,
      flashDealDiscount: updates.flashDealDiscount ?? existingProduct.flashDealDiscount ?? 0,
      flashDealExpiry: updates.flashDealExpiry === undefined
        ? existingProduct.flashDealExpiry ?? null
        : updates.flashDealExpiry?.toISOString() ?? null,
      hotDealLabel: updates.hotDealLabel ?? existingProduct.hotDealLabel ?? "",
      isFeatured: updates.isFeatured ?? existingProduct.isFeatured,
      isNewArrival: updates.isNewArrival ?? existingProduct.isNewArrival ?? false,
      dealEndDate: updates.dealEndDate === undefined
        ? existingProduct.dealEndDate ?? null
        : updates.dealEndDate?.toISOString() ?? null,
      discountPercent: updates.discountPercent ?? existingProduct.discountPercent ?? 0,
      brand: updates.brand ?? existingProduct.brand ?? "",
      sku: updates.sku ?? existingProduct.sku ?? "",
      ratings: updates.ratings ?? existingProduct.ratings,
      rating: updates.ratings ?? existingProduct.rating,
      badge: (updates.isFlashDeal ?? existingProduct.isFlashDeal)
        ? "Flash deal"
        : (updates.isFeatured ?? existingProduct.isFeatured)
          ? "Featured"
          : "",
      updatedAt: new Date().toISOString()
    });
    await logProductHistory("updated", updatedProduct, getProductImportSource(updatedProduct));
    await logProductDealAdditions(updatedProduct, existingProduct, getProductImportSource(updatedProduct));
    return Response.json({ product: updatedProduct });
  } catch (error) {
    return handleApiError(error, "PUT /api/products/[id] failed");
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const authError = requireAdmin(_request);
  if (authError) return authError;

  try {
    const { id } = await params;
    validateId(id);
    const connection = await connectToDatabase();
    const product = connection ? await Product.findById(id) : null;
    const [store, localMarkazProducts] = await Promise.all([getLocalProductStore(), getLocalMarkazProducts()]);
    const localProduct = store.deletedIds.includes(id)
      ? undefined
      : store.products.find((entry) => entry._id === id || entry.id === id) ??
        localMarkazProducts.find((entry) => entry._id === id || entry.id === id) ??
        getStaticProduct(id);
    if ((!product || product.isActive === false) && !localProduct) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }
    const snapshot = product ? serializeProduct(product, true) : localProduct;
    if (!snapshot) return Response.json({ error: "Product not found." }, { status: 404 });
    const source = getProductImportSource(snapshot);
    await archiveDeletedProduct(snapshot);
    await logProductHistory("deleted", snapshot, source);
    if (product) await Product.findByIdAndUpdate(id, { isActive: false });
    await deleteLocalProduct(id);
    return Response.json({ message: "Product deleted.", id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/products/[id] failed");
  }
}
