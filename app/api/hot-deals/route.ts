import { handleApiError } from "../../../lib/api-utils";
import { getHotDeals, getPublicHotDeals } from "../../../lib/hot-deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const storedDeals = await getHotDeals();
    const publicDeals = getPublicHotDeals(storedDeals);
    const curatedDeals = publicDeals.map((deal) => {
      const isBundle = deal.dealType === "bundle";
      const image = deal.bundleImage || deal.productImage || deal.products[0]?.image || "";
      return {
        _id: isBundle ? deal.id : deal.productId,
        id: isBundle ? deal.id : deal.productId,
        title: isBundle ? deal.bundleTitle : deal.productName,
        name: isBundle ? deal.bundleTitle : deal.productName,
        category: deal.category,
        price: deal.dealPrice,
        originalPrice: deal.originalTotalPrice,
        oldPrice: deal.originalTotalPrice,
        image,
        images: isBundle
          ? deal.products.map((product) => product.image).filter(Boolean)
          : image ? [image] : [],
        badge: deal.badgeText,
        hotDealLabel: deal.badgeText,
        customTitle: deal.customTitle,
        isHotDeal: true,
        isFeatured: true,
        priority: deal.priority,
        hotDealId: deal.id,
        dealType: deal.dealType,
        bundleTitle: deal.bundleTitle,
        bundleImage: deal.bundleImage,
        productIds: deal.productIds,
        dealProducts: deal.products,
        discountPercent: deal.discountPercent,
        validTill: deal.validTill
      };
    });
    return Response.json({ products: curatedDeals }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/hot-deals failed");
  }
}
