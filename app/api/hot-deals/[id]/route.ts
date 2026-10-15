import { handleApiError } from "../../../../lib/api-utils";
import { getHotDeals } from "../../../../lib/hot-deals";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deal = (await getHotDeals()).find((item) =>
      item.id === id &&
      item.dealType === "bundle" &&
      item.isActive &&
      (!item.validTill || Date.parse(item.validTill) > Date.now())
    );
    if (!deal) return Response.json({ error: "This bundle deal is no longer available." }, { status: 404 });
    return Response.json({
      deal: {
        hotDealId: deal.id,
        dealType: deal.dealType,
        title: deal.bundleTitle,
        bundleTitle: deal.bundleTitle,
        bundleImage: deal.bundleImage,
        price: deal.dealPrice,
        originalPrice: deal.originalTotalPrice,
        discountPercent: deal.discountPercent,
        badge: deal.badgeText,
        validTill: deal.validTill,
        dealProducts: deal.products
      }
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/hot-deals/[id] failed");
  }
}
