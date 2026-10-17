import mongoose from "mongoose";
import { handleApiError, isRecord, requireAdmin, readJsonBody } from "../../../lib/api-utils";
import { connectToDatabase } from "../../../lib/mongodb";
import {
  getDeletedProducts,
  getProductImportSource,
  logProductHistory,
  removeDeletedProduct,
  restoreDeletedProduct
} from "../../../lib/product-history";
import {
  clearLocalProductDeletion,
  deleteLocalProduct,
  restoreLocalProduct,
  toRestoredLocalProduct,
} from "../../../lib/local-products";
import Product from "../../../models/Product";
import { serializeProduct } from "../../../lib/product-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const deletedProducts = await getDeletedProducts();
    deletedProducts.sort((left, right) =>
      new Date(right.deletedAt).getTime() - new Date(left.deletedAt).getTime()
    );
    return Response.json({ deletedProducts }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/deleted-products failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.productId !== "string" || !body.productId.trim()) {
      return Response.json({ error: "productId is required." }, { status: 400 });
    }
    const productId = body.productId.trim();
    const archivedProduct = (await getDeletedProducts()).find((product) => product._id === productId);
    if (!archivedProduct) return Response.json({ error: "Deleted product not found." }, { status: 404 });

    const connection = await connectToDatabase();
    const databaseProduct = connection && mongoose.isValidObjectId(productId)
      ? await Product.findById(productId)
      : null;
    let restoredProduct: Record<string, unknown>;
    if (databaseProduct) {
      const restored = await Product.findByIdAndUpdate(productId, { isActive: true }, {
        new: true,
        runValidators: true
      });
      if (!restored) throw new Error("Could not restore the database product.");
      restoredProduct = serializeProduct(restored, true);
      await clearLocalProductDeletion(productId);
    } else {
      const localProduct = toRestoredLocalProduct(archivedProduct);
      if (!localProduct) return Response.json({ error: "Deleted product snapshot cannot be restored." }, { status: 422 });
      restoredProduct = await restoreLocalProduct(localProduct);
    }

    await logProductHistory("restored", restoredProduct, getProductImportSource(restoredProduct));
    await restoreDeletedProduct(productId);
    return Response.json({ success: true, product: restoredProduct });
  } catch (error) {
    return handleApiError(error, "POST /api/deleted-products failed");
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim();
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!productId) return Response.json({ error: "productId is required." }, { status: 400 });

  try {
    const archivedProduct = (await getDeletedProducts()).find((product) => product._id === productId);
    if (!archivedProduct) return Response.json({ error: "Deleted product not found." }, { status: 404 });
    const connection = await connectToDatabase();
    if (connection && mongoose.isValidObjectId(productId)) await Product.findByIdAndDelete(productId);
    await deleteLocalProduct(productId);
    await removeDeletedProduct(productId);
    return Response.json({ success: true, productId });
  } catch (error) {
    return handleApiError(error, "DELETE /api/deleted-products failed");
  }
}
