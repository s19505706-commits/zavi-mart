import mongoose from "mongoose";
import { ApiError, handleApiError, requireAdmin, readJsonBody } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { parseProductInput } from "../../../../lib/product-input";
import { serializeProduct } from "../../../../lib/product-response";
import { MOCK_PRODUCTS } from "../../../../lib/mock-products";
import Product from "../../../../models/Product";
import { getLocalMarkazProducts } from "../../../../lib/local-markaz-products";

type RouteContext = { params: Promise<{ id: string }> };

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
    if (!connection) {
      await getLocalMarkazProducts();
      const product = MOCK_PRODUCTS.find((entry) => entry.id === id || entry.slug === id);
      if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
      return Response.json({ product });
    }

    const product = await Product.findById(id);
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product: serializeProduct(product) });
  } catch (error) {
    return handleApiError(error, "GET /api/products/[id] failed");
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    validateId(id);
    const updates = parseProductInput(await readJsonBody(request), true);
    const connection = await connectToDatabase();
    if (!connection) throw new ApiError("Product updates require a configured MongoDB database.", 503);

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ product: serializeProduct(product) });
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
    if (!connection) throw new ApiError("Product deletion requires a configured MongoDB database.", 503);

    const product = await Product.findByIdAndDelete(id);
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    return Response.json({ message: "Product deleted.", id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/products/[id] failed");
  }
}
