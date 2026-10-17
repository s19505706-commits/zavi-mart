import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import {
  createFlashDeal,
  deleteFlashDeal,
  getFlashDeals,
  parseFlashDealInput,
  updateFlashDeal
} from "../../../../lib/flash-deals";
import { logProductHistory } from "../../../../lib/product-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const deals = await getFlashDeals();
    return Response.json({
      deals,
      stats: {
        activeDeals: deals.filter((deal) =>
          deal.isActive && Date.parse(deal.endTime) > Date.now()
        ).length,
        totalSold: deals.reduce((total, deal) => total + deal.soldCount, 0),
        nextEndTime: deals
          .filter((deal) => deal.isActive && Date.parse(deal.endTime) > Date.now())
          .map((deal) => deal.endTime)
          .sort()[0] ?? null
      }
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/flash-deals failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const input = parseFlashDealInput(await readJsonBody(request));
    const deal = await createFlashDeal(input);
    await logProductHistory("flash-deal-added", {
      _id: deal.productId,
      title: deal.productName,
      isFlashDeal: true,
      flashDealDiscount: deal.discountPercent,
      flashDealExpiry: deal.endTime
    }, "manual");
    return Response.json({ success: true, deal }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/flash-deals failed");
  }
}

export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string") {
      throw new ApiError("A valid flash deal id is required.", 400);
    }
    const id = body.id.trim();
    if (!mongoose.isValidObjectId(id) && !/^[\da-f-]{36}$/i.test(id)) {
      throw new ApiError("A valid flash deal id is required.", 400);
    }
    const previousDeal = (await getFlashDeals()).find((deal) => deal.id === id);
    const input = typeof body.isActive === "boolean" && Object.keys(body).every((key) => key === "id" || key === "isActive")
      ? { isActive: body.isActive }
      : parseFlashDealInput(body);
    const deal = await updateFlashDeal(id, input);
    if (!deal) return Response.json({ error: "Flash deal not found." }, { status: 404 });
    if (deal.isActive && previousDeal?.isActive === false) {
      await logProductHistory("flash-deal-added", {
        _id: deal.productId,
        title: deal.productName,
        isFlashDeal: true,
        flashDealDiscount: deal.discountPercent,
        flashDealExpiry: deal.endTime
      }, "manual");
    }
    return Response.json({ success: true, deal });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/flash-deals failed");
  }
}

export async function DELETE(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string") {
      throw new ApiError("A valid flash deal id is required.", 400);
    }
    const id = body.id.trim();
    if (!mongoose.isValidObjectId(id) && !/^[\da-f-]{36}$/i.test(id)) {
      throw new ApiError("A valid flash deal id is required.", 400);
    }
    if (!await deleteFlashDeal(id)) return Response.json({ error: "Flash deal not found." }, { status: 404 });
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/flash-deals failed");
  }
}
