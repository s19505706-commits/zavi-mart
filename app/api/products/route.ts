import mongoose from "mongoose";
import { connectToDatabase } from "../../../lib/mongodb";
import { ApiError, escapeRegex, handleApiError, isRecord, parseLimit, requireAdmin, readJsonBody } from "../../../lib/api-utils";
import { parseProductInput, slugify } from "../../../lib/product-input";
import { getCategoryId, normalizeCategory } from "../../../lib/product-categories";
import { MOCK_PRODUCTS } from "../../../lib/mock-products";
import { assertLocalStoreWritesAllowed } from "../../../lib/vercel-store";
import { serializeProduct } from "../../../lib/product-response";
import Product from "../../../models/Product";
import {
  getLocalMarkazProducts,
  getStoredLocalMarkazProducts,
  getTrackedMarkazProducts
} from "../../../lib/local-markaz-products";
import {
  deleteLocalProduct,
  getLocalProductStore,
  getStaticProduct,
  upsertLocalProduct,
  type StoredProduct
} from "../../../lib/local-products";
import { cleanCustomerProduct, extractProductCode } from "../../../lib/product-codes";
import { validateProductClassification } from "../../../lib/department-category-store";
import { getFlashDeals } from "../../../lib/flash-deals";
import { mergeCatalogProducts } from "../../../lib/product-catalog";
import {
  archiveDeletedProduct,
  getProductImportSource,
  isProductImportSource,
  logProductDealAdditions,
  logProductHistory
} from "../../../lib/product-history";

type ProductListItem = {
  _id: string;
  id?: string;
  title: string;
  name?: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  isActive?: boolean;
  isFlashDeal?: boolean;
  createdAt?: Date | string;
  [key: string]: unknown;
};

function noStoreJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedId = url.searchParams.get("id")?.trim();
    const includeAdminFields = url.searchParams.get("includeAdminFields") === "true";
    if (url.searchParams.has("includeAdminFields") &&
        url.searchParams.get("includeAdminFields") !== "true" &&
        url.searchParams.get("includeAdminFields") !== "false") {
      throw new ApiError("includeAdminFields must be true or false.", 400);
    }
    if (includeAdminFields) {
      const authError = requireAdmin(request);
      if (authError) return authError;
    }
    const filter: Record<string, unknown> = {};
    const categoryValue = url.searchParams.get("category")?.trim();
    const departmentId = url.searchParams.get("departmentId")?.trim();
    const categoryId = url.searchParams.get("categoryId")?.trim();
    const search = url.searchParams.get("search")?.trim();
    if (departmentId && departmentId.length > 100) {
      throw new ApiError("departmentId must be 100 characters or fewer.", 400);
    }
    if (categoryId && categoryId.length > 100) {
      throw new ApiError("categoryId must be 100 characters or fewer.", 400);
    }
    const newArrivalsOnly = url.searchParams.get("newArrivals");
    if (newArrivalsOnly && newArrivalsOnly !== "true" && newArrivalsOnly !== "false") {
      throw new ApiError("newArrivals must be true or false.", 400);
    }
    const flashDealsOnly = url.searchParams.get("flashDeals");
    if (flashDealsOnly && flashDealsOnly !== "true" && flashDealsOnly !== "false") {
      throw new ApiError("flashDeals must be true or false.", 400);
    }

    if (categoryValue) {
      const category = normalizeCategory(categoryValue);
      if (!category) throw new ApiError("category must be a non-empty string of 100 characters or fewer.", 400);
      filter.category = category;
    }
    if (departmentId) filter.departmentId = departmentId;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      if (search.length > 100) throw new ApiError("search must be 100 characters or fewer.", 400);
      filter.title = { $regex: escapeRegex(search), $options: "i" };
    }

    if (newArrivalsOnly === "true") filter.isNewArrival = true;

    const limit = parseLimit(url.searchParams.get("limit"));
    const rawOffset = url.searchParams.get("offset");
    const offset = rawOffset === null ? 0 : Number(rawOffset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) {
      throw new ApiError("offset must be a non-negative integer no greater than 100000.", 400);
    }
    filter.isActive = { $ne: false };
    const connection = await connectToDatabase();
    if (connection && !requestedId) {
      await Product.updateMany(
        { $or: [{ ratings: 0 }, { ratings: { $exists: false } }] },
        { $set: { ratings: 4.5, reviews: 100 } }
      );
    }

    const [store, localMarkazProducts, databaseProducts] = await Promise.all([
      getLocalProductStore(),
      getStoredLocalMarkazProducts(),
      connection
        ? requestedId
          ? mongoose.isValidObjectId(requestedId)
            ? Product.findOne({ _id: requestedId, isActive: { $ne: false } })
            : Product.findOne({ slug: requestedId, isActive: { $ne: false } })
          : Product.find(filter).sort({ createdAt: -1 })
        : Promise.resolve([])
    ]);
    const databaseList = Array.isArray(databaseProducts)
      ? databaseProducts.map((product): ProductListItem => serializeProduct(product, includeAdminFields))
      : databaseProducts
        ? [serializeProduct(databaseProducts, includeAdminFields) as ProductListItem]
        : [];
    const catalogProducts = mergeCatalogProducts<ProductListItem>([
      databaseList,
      store.products.map((product) => ({ ...product }) as ProductListItem),
      localMarkazProducts.map((product) => ({ ...product }) as ProductListItem),
      getTrackedMarkazProducts().map((product) => ({ ...product }) as ProductListItem)
    ], MOCK_PRODUCTS.map((product) => ({ ...product }) as ProductListItem));
    const now = Date.now();
    const activeFlashProductIds = flashDealsOnly === "true"
      ? new Set((await getFlashDeals()).filter((deal) =>
        deal.isActive && Date.parse(deal.startTime) <= now && Date.parse(deal.endTime) > now &&
        deal.soldCount < deal.stockLimit
      ).flatMap((deal) => [deal.productId, deal.productName.trim().toLocaleLowerCase()]))
      : null;
    const allProducts = catalogProducts.filter((product) =>
      product.isActive !== false &&
      !store.deletedIds.includes(product._id) &&
      (!departmentId || product.departmentId === departmentId) &&
      (!categoryId || product.categoryId === categoryId) &&
      (!filter.category || product.category === filter.category) &&
      (!search || product.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
      (newArrivalsOnly !== "true" || product.isNewArrival === true) &&
      (!activeFlashProductIds || activeFlashProductIds.has(product._id) ||
        (!!product.id && activeFlashProductIds.has(product.id)) ||
        activeFlashProductIds.has(product.title.trim().toLocaleLowerCase()))
    );

    if (requestedId) {
      const product = allProducts.find((entry) =>
        entry._id === requestedId || entry.id === requestedId || entry.slug === requestedId
      );
      return product
        ? noStoreJson({
          product: includeAdminFields
            ? {
              ...product,
              productCode: product.productCode || product.markazCode || product.supplierCode ||
                extractProductCode(typeof product.originalDescription === "string"
                  ? product.originalDescription
                  : typeof product.description === "string" ? product.description : ""),
              markazCode: product.markazCode || product.productCode || product.supplierCode || null,
              supplierCode: product.supplierCode || product.productCode || product.markazCode || null
            }
            : cleanCustomerProduct(product)
        })
        : noStoreJson({ error: "Product not found." }, 404);
    }

    const mergedProducts = allProducts.sort((left, right) =>
      new Date(String(right.createdAt ?? 0)).getTime() - new Date(String(left.createdAt ?? 0)).getTime()
    ).slice(offset, offset + limit);
    return noStoreJson({
      products: includeAdminFields
        ? mergedProducts.map((product) => ({
          ...product,
          productCode: product.productCode || product.markazCode || product.supplierCode ||
            extractProductCode(typeof product.originalDescription === "string"
              ? product.originalDescription
              : typeof product.description === "string" ? product.description : ""),
          markazCode: product.markazCode || product.productCode || product.supplierCode || null,
          supplierCode: product.supplierCode || product.productCode || product.markazCode || null
        }))
        : mergedProducts.map((product) => cleanCustomerProduct(product)),
      usingDefaultAdminKey: !process.env.VERCEL &&
        !process.env.ADMIN_KEY?.trim() && !process.env.ADMIN_ACCESS_KEY?.trim(),
      usingDemoMode: !process.env.MONGODB_URI?.trim()
    });
  } catch (error) {
    const response = handleApiError(error, "GET /api/products failed");
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const authError = requireAdmin(request, undefined, isRecord(body) ? body.adminKey : undefined);
    if (authError) return authError;

    if (!isRecord(body)) throw new ApiError("Product data must be a JSON object.", 400);
    const name = typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : body.title;
    const price = Number(body.price);
    const images = Array.isArray(body.images) && body.images.length > 0
      ? body.images
      : typeof body.image === "string" && body.image.trim()
        ? [body.image]
        : [];
    const categoryValue = typeof body.category === "string" && body.category.trim()
      ? body.category
      : "General";
    const category = normalizeCategory(categoryValue);
    if (!category) throw new ApiError("category must be a non-empty string of 100 characters or fewer.", 400);
    const sourceValue = body.importSource ?? body.source;
    if (sourceValue !== undefined && !isProductImportSource(sourceValue)) {
      throw new ApiError("source must be manual, local, markaz, csv, json, aliexpress, or bulk-import.", 400);
    }
    const source = isProductImportSource(sourceValue) ? sourceValue : "manual";
    if (body.sourceFileName !== undefined &&
        (typeof body.sourceFileName !== "string" || !body.sourceFileName.trim() || body.sourceFileName.length > 255)) {
      throw new ApiError("sourceFileName must be a non-empty string of 255 characters or fewer.", 400);
    }
    const sourceFileName = typeof body.sourceFileName === "string" ? body.sourceFileName.trim() : undefined;
    const originalPrice = body.originalPrice === undefined || body.originalPrice === null || body.originalPrice === ""
      ? price * 1.3
      : Number(body.originalPrice);
    const stock = body.stock === undefined || body.stock === null || body.stock === ""
      ? 10
      : Number(body.stock);
    const supplierPrice = body.supplierPrice === undefined || body.supplierPrice === null || body.supplierPrice === ""
      ? undefined
      : Number(body.supplierPrice);
    const costPrice = body.costPrice === undefined || body.costPrice === null || body.costPrice === ""
      ? supplierPrice ?? price * 0.7
      : Number(body.costPrice);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      throw new ApiError("costPrice must be a non-negative number.", 400);
    }
    const normalizedInput: Record<string, unknown> = {
      title: name,
      price,
      originalPrice,
      stock,
      category,
      images,
      description: typeof body.description === "string" ? body.description : name
    };
    for (const key of ["departmentId", "categoryId"] as const) {
      if (key in body) normalizedInput[key] = body[key];
    }
    for (const key of ["markazProductId", "markazProductUrl"] as const) {
      if (key in body) normalizedInput[key] = body[key];
    }
    for (const key of [
      "isFlashDeal",
      "isHotDeal",
      "flashDealDiscount",
      "flashDealExpiry",
      "hotDealLabel",
      "isFeatured",
      "isNewArrival",
      "ratings"
    ] as const) {
      if (key in body) normalizedInput[key] = body[key];
    }
    const input = parseProductInput(normalizedInput);
    await validateProductClassification(input);
    const title = input.title!;
    const markazProductUrl = typeof input.markazProductUrl === "string"
      ? input.markazProductUrl
      : undefined;
    const connection = await connectToDatabase();
    if (!connection) {
      assertLocalStoreWritesAllowed("Product");
    }
    if (supplierPrice !== undefined && (!Number.isFinite(supplierPrice) || supplierPrice < 0)) {
      throw new ApiError("supplierPrice must be a non-negative number.", 400);
    }

    const baseSlug = input.slug ?? slugify(title);
    if (!baseSlug) throw new ApiError("title must contain letters or numbers to generate a slug.", 400);
    let slug = baseSlug;
    if (connection && !input.slug) {
      let suffix = 2;
      while (await Product.exists({ slug })) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
    }

    const supplierId = typeof body.supplierId === "string" && body.supplierId.trim()
      ? body.supplierId.trim()
      : undefined;
    const supplierUrl = typeof body.supplierUrl === "string" && body.supplierUrl.trim()
      ? body.supplierUrl.trim()
      : undefined;
    const isSupplierProduct = body.isMarkazProduct === true || !!supplierId || !!supplierUrl ||
      supplierPrice !== undefined || Boolean(markazProductUrl);
    if (body.isDropship !== undefined && typeof body.isDropship !== "boolean") {
      throw new ApiError("isDropship must be a boolean.", 400);
    }
    if (!connection) {
      const id = new mongoose.Types.ObjectId().toHexString();
      const now = new Date().toISOString();
      const productPrice = input.price ?? price;
      const productImages = input.images ?? images;
      const localProduct: StoredProduct = {
        _id: id,
        id,
        title,
        name: title,
        slug,
        price: productPrice,
        originalPrice: input.originalPrice ?? null,
        oldPrice: input.originalPrice ?? productPrice,
        images: productImages,
        image: productImages[0] ?? "",
        category: input.category ?? category,
        categoryId: typeof input.categoryId === "string" ? input.categoryId : getCategoryId(category),
        departmentId: typeof input.departmentId === "string" ? input.departmentId : null,
        stock: input.stock ?? stock,
        description: typeof input.description === "string" ? input.description : title,
        isFlashDeal: input.isFlashDeal ?? false,
        isFeatured: input.isFeatured ?? false,
        isMarkazProduct: isSupplierProduct,
        isDropship: body.isDropship === true || Boolean(markazProductUrl),
        isActive: true,
        importSource: source,
        markazProductId: supplierId ?? null,
        markazProductUrl: supplierUrl ?? markazProductUrl ?? null,
        wholesalePrice: supplierPrice ?? null,
        sellingPrice: productPrice,
        profit: supplierPrice === undefined ? null : productPrice - supplierPrice,
        supplier: supplierUrl || markazProductUrl
          ? { name: "Supplier", productUrl: supplierUrl ?? markazProductUrl ?? "", info: "" }
          : null,
        costPrice,
        productCode: input.productCode ?? null,
        markazCode: input.markazCode ?? null,
        supplierCode: input.supplierCode ?? null,
        originalDescription: input.originalDescription ?? null,
        originalMarkazTitle: input.originalMarkazTitle ?? null,
        ratings: input.ratings ?? 0,
        rating: input.ratings ?? 0,
        reviews: 100,
        badge: input.isFlashDeal ? "Flash deal" : input.isFeatured ? "Featured" : "",
        createdAt: now,
        updatedAt: now,
        isHotDeal: input.isHotDeal ?? false,
        flashDealDiscount: input.flashDealDiscount ?? 0,
        flashDealExpiry: input.flashDealExpiry?.toISOString() ?? null,
        hotDealLabel: input.hotDealLabel ?? "",
        isNewArrival: input.isNewArrival ?? false,
        dealEndDate: input.dealEndDate?.toISOString() ?? null,
        discountPercent: input.discountPercent ?? 0,
        brand: input.brand ?? "",
        sku: input.sku ?? "",
        hasVariants: input.hasVariants ?? false,
        variantOptions: input.variantOptions ?? [],
        variants: input.variants ?? [],
        variantCombinations: input.variantCombinations ?? []
      };
      const savedProduct = await upsertLocalProduct(localProduct);
      await logProductHistory(
        source === "manual" ? "created" : "imported",
        savedProduct,
        source,
        sourceFileName
      );
      await logProductDealAdditions(savedProduct, undefined, source);
      return Response.json({
        product: savedProduct,
        storage: "local",
        message: "Saved using preview storage; configure MONGODB_URI for durable storage."
      }, { status: 201 });
    }

    const product = await Product.create({
      ...input,
      costPrice,
      slug,
      isActive: true,
      importSource: source,
      isMarkazProduct: isSupplierProduct,
      isDropship: body.isDropship === true || Boolean(input.markazProductUrl),
      ...(supplierPrice !== undefined
        ? { wholesalePrice: supplierPrice, sellingPrice: input.price, profit: input.price! - supplierPrice }
        : {}),
      ...(supplierId ? { markazProductId: supplierId } : {}),
      ...(supplierUrl || input.markazProductUrl
        ? { supplier: { name: "Supplier", productUrl: supplierUrl ?? input.markazProductUrl, info: "" } }
        : {})
    });
    const serializedProduct = serializeProduct(product, true);
    await logProductHistory(source === "manual" ? "created" : "imported", serializedProduct, source, sourceFileName);
    await logProductDealAdditions(serializedProduct, undefined, source);
    return Response.json({ product: serializedProduct }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/products failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody(request);
    const authError = requireAdmin(request, undefined, isRecord(body) ? body.adminKey : undefined);
    if (authError) return authError;
    if (!isRecord(body) || typeof body._id !== "string" || !mongoose.isValidObjectId(body._id)) {
      throw new ApiError("A valid product ID is required.", 400);
    }

    const updateData = { ...body };
    delete updateData._id;
    delete updateData.adminKey;
    const updates = parseProductInput(updateData, true);
    await validateProductClassification(updates);
    const connection = await connectToDatabase();
    if (!connection) {
      throw new ApiError("MONGODB_URI missing. Add it to .env.local file", 500);
    }

    const previousProduct = updates.isFlashDeal === true || updates.isHotDeal === true
      ? await Product.findById(body._id)
      : null;
    const product = await Product.findByIdAndUpdate(body._id, updates, {
      new: true,
      runValidators: true
    });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    const serializedProduct = serializeProduct(product, true);
    await logProductHistory("updated", serializedProduct, getProductImportSource(serializedProduct));
    await logProductDealAdditions(serializedProduct, previousProduct, getProductImportSource(serializedProduct));
    return Response.json({ product: serializedProduct });
  } catch (error) {
    return handleApiError(error, "PATCH /api/products failed");
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !mongoose.isValidObjectId(id)) {
    return Response.json({ error: "A valid product ID is required." }, { status: 400 });
  }

  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
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
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/products failed");
  }
}
