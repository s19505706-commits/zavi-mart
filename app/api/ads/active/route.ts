import mongoose from "mongoose";
import { ApiError, handleApiError } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import Ad from "../../../../lib/models/Ad";
import Product from "../../../../models/Product";
import type { AdData, AdProductPreview } from "../../../../lib/ad-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const ad = await Ad.findOne({ isActive: true, placement: "homepage" }).sort({ updatedAt: -1 }).lean();
    if (!ad) return Response.json({ ad: null }, { headers: { "Cache-Control": "no-store, max-age=0" } });

    const ids = ad.products.filter((id) => mongoose.isValidObjectId(id));
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
    const result: AdData = {
      id: String(ad._id),
      titleLines: ad.titleLines,
      secondLines: ad.secondLines,
      finalLines: ad.finalLines,
      products: ad.products,
      productDetails,
      ctaText: ad.ctaText,
      ctaLink: ad.ctaLink,
      logoText: ad.logoText,
      bgColor: ad.bgColor,
      textColor: ad.textColor,
      goldColor: ad.goldColor,
      audioUrl: ad.audioUrl,
      audioType: ad.audioType as AdData["audioType"],
      beatSync: ad.beatSync,
      volume: ad.volume,
      isActive: ad.isActive,
      placement: "homepage",
      createdAt: ad.createdAt.toISOString(),
      updatedAt: ad.updatedAt.toISOString()
    };
    return Response.json({ ad: result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/ads/active failed");
  }
}
