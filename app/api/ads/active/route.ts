import mongoose from "mongoose";
import {
  AD_ANIMATION_SPEEDS,
  AD_ANIMATION_STYLES,
  AD_FILTER_PRESETS,
  AD_TEXT_EFFECTS,
  DEFAULT_AD,
  normalizeAdLines,
  type AdCustomImage
} from "../../../../lib/ad-types";
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

function enumValue<T extends readonly string[]>(value: unknown, choices: T, fallback: T[number]): T[number] {
  return typeof value === "string" && choices.some((choice) => choice === value)
    ? value as T[number]
    : fallback;
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
      customImages: Array.isArray(ad.customImages) ? ad.customImages as AdCustomImage[] : DEFAULT_AD.customImages,
      animationStyle: enumValue(ad.animationStyle, AD_ANIMATION_STYLES, DEFAULT_AD.animationStyle),
      animationSpeed: enumValue(ad.animationSpeed, AD_ANIMATION_SPEEDS, DEFAULT_AD.animationSpeed),
      textEffect: enumValue(ad.textEffect, AD_TEXT_EFFECTS, DEFAULT_AD.textEffect),
      filterPreset: enumValue(ad.filterPreset, AD_FILTER_PRESETS, DEFAULT_AD.filterPreset),
      customBg: typeof ad.customBg === "string" ? ad.customBg : DEFAULT_AD.customBg,
      overlayOpacity: typeof ad.overlayOpacity === "number" ? ad.overlayOpacity : DEFAULT_AD.overlayOpacity,
      brightness: typeof ad.brightness === "number" ? ad.brightness : DEFAULT_AD.brightness,
      contrast: typeof ad.contrast === "number" ? ad.contrast : DEFAULT_AD.contrast,
      blurAmount: typeof ad.blurAmount === "number" ? ad.blurAmount : DEFAULT_AD.blurAmount,
      goldTintOpacity: typeof ad.goldTintOpacity === "number" ? ad.goldTintOpacity : DEFAULT_AD.goldTintOpacity,
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
