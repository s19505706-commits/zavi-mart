import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import {
  createHotDeal,
  deleteHotDeal,
  getHotDeals,
  parseHotDealInput,
  updateHotDeal
} from "../../../../lib/hot-deals";
import { logProductHistory } from "../../../../lib/product-history";

export const runtime = "nodejs";

function validId(id: string): boolean {
  return mongoose.isValidObjectId(id) || /^[\da-f-]{36}$/i.test(id);
}

function hasConflictingProduct(
  deals: Awaited<ReturnType<typeof getHotDeals>>,
  productIds: string[],
  exceptId?: string
): boolean {
  const selected = new Set(productIds);
  return deals.some((deal) =>
    deal.id !== exceptId && deal.productIds.some((productId) => selected.has(productId))
  );
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    return Response.json({ deals: await getHotDeals() }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/hot-deals failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const input = parseHotDealInput(await readJsonBody(request));
    if (hasConflictingProduct(await getHotDeals(), input.productIds)) {
      throw new ApiError("A selected product already belongs to another curated hot deal.", 409);
    }
    const deal = await createHotDeal(input);
    await Promise.all(deal.products.map((product) => logProductHistory("hot-deal-added", {
      _id: product.productId,
      title: product.title,
      isHotDeal: true,
      hotDealLabel: deal.badgeText
    }, "manual")));
    return Response.json({ success: true, deal }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/hot-deals failed");
  }
}

export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !validId(body.id.trim())) {
      throw new ApiError("A valid hot deal id is required.", 400);
    }
    const id = body.id.trim();
    let update: ReturnType<typeof parseHotDealInput> | { isActive: boolean } | { priority: number };
    let addedProducts: ReturnType<typeof parseHotDealInput>["products"] = [];
    if (Object.keys(body).every((key) => key === "id" || key === "isActive") &&
        typeof body.isActive === "boolean") {
      update = { isActive: body.isActive };
    } else if (Object.keys(body).every((key) => key === "id" || key === "priority")) {
      const priority = Number(body.priority);
      if (!Number.isInteger(priority) || priority < 1 || priority > 100000) {
        throw new ApiError("Priority must be a whole number from 1 to 100,000.", 400);
      }
      update = { priority };
    } else {
      const input = parseHotDealInput(body);
      const currentDeals = await getHotDeals();
      const existing = currentDeals.find((deal) => deal.id === id);
      if (hasConflictingProduct(currentDeals, input.productIds, id)) {
        throw new ApiError("A selected product already belongs to another curated hot deal.", 409);
      }
      addedProducts = input.products.filter((product) => !existing?.productIds.includes(product.productId));
      update = input;
    }
    const deal = await updateHotDeal(id, update);
    if (!deal) return Response.json({ error: "Hot deal not found." }, { status: 404 });
    if (addedProducts.length) {
      await Promise.all(addedProducts.map((product) => logProductHistory("hot-deal-added", {
        _id: product.productId,
        title: product.title,
        isHotDeal: true,
        hotDealLabel: deal.badgeText
      }, "manual")));
    }
    return Response.json({ success: true, deal });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/hot-deals failed");
  }
}

export async function DELETE(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !validId(body.id.trim())) {
      throw new ApiError("A valid hot deal id is required.", 400);
    }
    const id = body.id.trim();
    if (!await deleteHotDeal(id)) return Response.json({ error: "Hot deal not found." }, { status: 404 });
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/hot-deals failed");
  }
}
