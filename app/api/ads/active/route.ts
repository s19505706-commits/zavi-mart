import mongoose from "mongoose";
import { DEFAULT_AD, normalizeAdLines } from "../../../../lib/ad-types";
import { ApiError, handleApiError } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import Ad from "../../../../lib/models/Ad";
import Product from "../../../../models/Product";
import type { AdData, AdProductPreview } from "../../../../lib/ad-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0"
};

function publicAdResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const ad = await Ad.collection.find({
      isActive: { $in: [true, "true"] },
      placement: "homepage"
    }).sort({ updatedAt: -1 }).limit(1).next();
    if (!ad) {
      console.info("[ads/active] No active homepage ad found.");
      return publicAdResponse({ ad: null, activeAd: null, ads: [] });
    }

    const storedProducts = Array.isArray(ad.products) ? ad.products : [];
    const ids = storedProducts.filter((id): id is string => typeof id === "string" && mongoose.isValidObjectId(id));
    const products = ids.length
      ? await Product.find({ _id: { $in: ids }, isActive: { $ne: false } })
        .select("_id title price images")
        .lean()
      : [];
    const productDetails: AdProductPreview[] = products.map((product) => ({
      id: String(product._id),
      title: product.title,
      price: product.price,
      image: product.images?.[0] ?? ""
    }));
    const rawLines = (field: unknown, fallback: string[]) =>
      normalizeAdLines(field, fallback);
    const result: AdData = {
      id: String(ad._id),
      titleLines: rawLines(ad.titleLines, DEFAULT_AD.titleLines),
      secondLines: rawLines(ad.secondLines, DEFAULT_AD.secondLines),
      finalLines: rawLines(ad.finalLines, DEFAULT_AD.finalLines),
      products: storedProducts.filter((id): id is string => typeof id === "string"),
      productDetails,
      ctaText: typeof ad.ctaText === "string" ? ad.ctaText : DEFAULT_AD.ctaText,
      ctaLink: typeof ad.ctaLink === "string" ? ad.ctaLink : DEFAULT_AD.ctaLink,
      logoText: typeof ad.logoText === "string" ? ad.logoText : DEFAULT_AD.logoText,
      bgColor: typeof ad.bgColor === "string" ? ad.bgColor : DEFAULT_AD.bgColor,
      textColor: typeof ad.textColor === "string" ? ad.textColor : DEFAULT_AD.textColor,
      goldColor: typeof ad.goldColor === "string" ? ad.goldColor : DEFAULT_AD.goldColor,
      audioUrl: typeof ad.audioUrl === "string" ? ad.audioUrl : DEFAULT_AD.audioUrl,
      audioType: typeof ad.audioType === "string" &&
        ["punchy-beat", "luxury-tick", "deep-bass", "custom"].includes(ad.audioType)
        ? ad.audioType as AdData["audioType"]
        : DEFAULT_AD.audioType,
      beatSync: ad.beatSync !== false,
      volume: typeof ad.volume === "number" ? ad.volume : DEFAULT_AD.volume,
      isActive: true,
      placement: "homepage",
      createdAt: ad.createdAt instanceof Date ? ad.createdAt.toISOString() : undefined,
      updatedAt: ad.updatedAt instanceof Date ? ad.updatedAt.toISOString() : undefined
    };
    console.info("[ads/active] Serving active homepage ad.", { adId: result.id, products: productDetails.length });
    return publicAdResponse({ ad: result, activeAd: result, ads: [result] });
  } catch (error) {
    const response = handleApiError(error, "GET /api/ads/active failed");
    for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value);
    return response;
  }
}
