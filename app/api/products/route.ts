import mongoose from "mongoose";
import { connectToDatabase } from "../../../lib/mongodb";
import { ApiError, escapeRegex, handleApiError, isRecord, parseLimit, requireAdmin, readJsonBody } from "../../../lib/api-utils";
import { parseProductInput, slugify } from "../../../lib/product-input";
import { normalizeCategory } from "../../../lib/product-categories";
import { filterMockProducts } from "../../../lib/mock-products";
import { serializeProduct } from "../../../lib/product-response";
import Product from "../../../models/Product";
import { getLocalMarkazProducts } from "../../../lib/local-markaz-products";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedId = url.searchParams.get("id")?.trim();
    const filter: Record<string, unknown> = {};
    const categoryValue = url.searchParams.get("category")?.trim();
    const search = url.searchParams.get("search")?.trim();

    if (categoryValue) {
      const category = normalizeCategory(categoryValue);
      if (!category) throw new ApiError("category must be one of the supported categories.", 400);
      filter.category = category;
    }
    if (search) {
      if (search.length > 100) throw new ApiError("search must be 100 characters or fewer.", 400);
      filter.title = { $regex: escapeRegex(search), $options: "i" };
    }

    const flashDeals = url.searchParams.get("flashDeals");
    if (flashDeals === "true") filter.isFlashDeal = true;
    else if (flashDeals && flashDeals !== "false") {
      throw new ApiError("flashDeals must be true or false.", 400);
    }

    const limit = parseLimit(url.searchParams.get("limit"));
    filter.isActive = { $ne: false };
    const connection = await connectToDatabase();
    if (!connection) {
      const localProducts = await getLocalMarkazProducts();
      if (requestedId) {
        const product = [...localProducts, ...filterMockProducts({})].find((entry) =>
          entry._id === requestedId || entry.id === requestedId || entry.slug === requestedId
        );
        return product
          ? Response.json({ product })
          : Response.json({ error: "Product not found." }, { status: 404 });
      }
      const products = filterMockProducts({
        category: filter.category as string | undefined,
        search,
        flashDeals: filter.isFlashDeal === true
      }).filter((product) => product.isActive !== false).slice(0, limit);
      return Response.json({
        products,
        usingDefaultAdminKey: !process.env.ZAVIMART_ADMIN_API_KEY?.trim() && !process.env.ADMIN_API_KEY?.trim(),
        usingDemoMode: !process.env.MONGODB_URI?.trim()
      });
    }

    if (requestedId) {
      const [product, localProducts] = await Promise.all([
        mongoose.isValidObjectId(requestedId)
          ? Product.findOne({ _id: requestedId, isActive: { $ne: false } })
          : Product.findOne({ slug: requestedId, isActive: { $ne: false } }),
        getLocalMarkazProducts()
      ]);
      if (product) return Response.json({ product: serializeProduct(product) });
      const localProduct = [...localProducts, ...filterMockProducts({})].find((entry) =>
        entry._id === requestedId || entry.id === requestedId || entry.slug === requestedId
      );
      return localProduct
        ? Response.json({ product: localProduct })
        : Response.json({ error: "Product not found." }, { status: 404 });
    }

    await Product.updateMany(
      {
        $or: [{ ratings: 0 }, { ratings: { $exists: false } }]
      },
      { $set: { ratings: 4.5, reviews: 100 } }
    );

    const [products, localProducts] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).limit(limit),
      getLocalMarkazProducts()
    ]);
    const filteredLocalProducts = localProducts.filter((product) =>
      product.isActive !== false &&
      (!filter.category || product.category === filter.category) &&
      (!search || product.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
      (filter.isFlashDeal !== true || product.isFlashDeal)
    );
    const mergedProducts = [
      ...products.map(serializeProduct),
      ...filteredLocalProducts
    ].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ).slice(0, limit);
    return Response.json({
      products: mergedProducts,
      usingDefaultAdminKey: !process.env.ZAVIMART_ADMIN_API_KEY?.trim() && !process.env.ADMIN_API_KEY?.trim(),
      usingDemoMode: !process.env.MONGODB_URI?.trim()
    });
  } catch (error) {
    return handleApiError(error, "GET /api/products failed");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const authError = requireAdmin(request, "zavi123", isRecord(body) ? body.adminKey : undefined);
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
    if (!category) throw new ApiError("category must be one of the supported categories.", 400);
    const originalPrice = body.originalPrice === undefined || body.originalPrice === null || body.originalPrice === ""
      ? price * 1.3
      : Number(body.originalPrice);
    const stock = body.stock === undefined || body.stock === null || body.stock === ""
      ? 10
      : Number(body.stock);
    const supplierPrice = body.supplierPrice === undefined || body.supplierPrice === null || body.supplierPrice === ""
      ? undefined
      : Number(body.supplierPrice);
    const normalizedInput: Record<string, unknown> = {
      title: name,
      price,
      originalPrice,
      stock,
      category,
      images,
      description: typeof body.description === "string" ? body.description : name
    };
    for (const key of ["isFlashDeal", "isFeatured", "ratings"] as const) {
      if (key in body) normalizedInput[key] = body[key];
    }
    const input = parseProductInput(normalizedInput);
    const title = input.title!;
    const connection = await connectToDatabase();
    if (!connection) {
      throw new ApiError("MONGODB_URI missing. Add it to .env.local file", 500);
    }
    if (supplierPrice !== undefined && (!Number.isFinite(supplierPrice) || supplierPrice < 0)) {
      throw new ApiError("supplierPrice must be a non-negative number.", 400);
    }

    const baseSlug = input.slug ?? slugify(title);
    if (!baseSlug) throw new ApiError("title must contain letters or numbers to generate a slug.", 400);
    let slug = baseSlug;
    if (!input.slug) {
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
    const isSupplierProduct = body.isMarkazProduct === true || !!supplierId || !!supplierUrl || supplierPrice !== undefined;
    const product = await Product.create({
      ...input,
      slug,
      isActive: true,
      isMarkazProduct: isSupplierProduct,
      ...(supplierPrice !== undefined
        ? { wholesalePrice: supplierPrice, sellingPrice: input.price, profit: input.price! - supplierPrice }
        : {}),
      ...(supplierId ? { markazProductId: supplierId } : {}),
      ...(supplierUrl ? { supplier: { name: "Supplier", productUrl: supplierUrl, info: "" } } : {})
    });
    return Response.json({ product: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/products failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody(request);
    const authError = requireAdmin(request, "zavi123", isRecord(body) ? body.adminKey : undefined);
    if (authError) return authError;
    if (!isRecord(body) || typeof body._id !== "string" || !mongoose.isValidObjectId(body._id)) {
      throw new ApiError("A valid product ID is required.", 400);
    }

    const updateData = { ...body };
    delete updateData._id;
    delete updateData.adminKey;
    const updates = parseProductInput(updateData, true);
    const connection = await connectToDatabase();
    if (!connection) {
      throw new ApiError("MONGODB_URI missing. Add it to .env.local file", 500);
    }

    const product = await Product.findByIdAndUpdate(body._id, updates, {
      new: true,
      runValidators: true
    });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product: serializeProduct(product) });
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
    if (!connection) {
      throw new ApiError("MONGODB_URI missing. Add it to .env.local file", 500);
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/products failed");
  }
}
