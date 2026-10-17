import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { AD_AUDIO_TYPES, type AdData, type AdProductPreview } from "../../../../lib/ad-types";
import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import Ad from "../../../../lib/models/Ad";
import Product from "../../../../models/Product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLines(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8 ||
      value.some((line) => typeof line !== "string" || !line.trim() || line.trim().length > 60)) {
    throw new ApiError(`${label} must contain 1 to 8 lines, each no longer than 60 characters.`, 400);
  }
  return value.map((line) => (line as string).trim());
}

function parseAdInput(value: unknown): Omit<AdData, "id" | "productDetails" | "createdAt" | "updatedAt"> {
  if (!isRecord(value)) throw new ApiError("Ad data must be a JSON object.", 400);
  const titleLines = parseLines(value.titleLines, "Title");
  const secondLines = parseLines(value.secondLines, "Second section");
  const finalLines = parseLines(value.finalLines, "Final section");
  const products = value.products;
  if (!Array.isArray(products) || products.length > 20 ||
      products.some((id) => typeof id !== "string" || !id.trim() || id.length > 100)) {
    throw new ApiError("Products must contain up to 20 valid product ids.", 400);
  }
  const audioType = value.audioType;
  if (typeof audioType !== "string" || !AD_AUDIO_TYPES.includes(audioType as (typeof AD_AUDIO_TYPES)[number])) {
    throw new ApiError("Choose a supported audio type.", 400);
  }
  const audioUrl = typeof value.audioUrl === "string" ? value.audioUrl : "";
  const validAudioUrl = audioUrl === "" ||
    /^\/sounds\/[a-z\d._-]+\.(?:wav|mp3|ogg|m4a)$/i.test(audioUrl) ||
    /^https:\/\/[^\s]{1,2040}$/i.test(audioUrl) ||
    /^data:audio\/(?:mpeg|mp3|wav|ogg|mp4|aac);base64,[a-z\d+/]+=*$/i.test(audioUrl);
  if (!validAudioUrl || audioUrl.length > 5_700_000) {
    throw new ApiError("Audio must be a supported sound URL or an audio upload under 4 MB.", 400);
  }
  const volume = Number(value.volume);
  if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
    throw new ApiError("Volume must be between 0 and 100.", 400);
  }
  const color = (input: unknown, fallback: string, name: string) => {
    const result = typeof input === "string" ? input : fallback;
    if (!/^#[\da-f]{6}$/i.test(result)) throw new ApiError(`${name} must be a six-digit hex color.`, 400);
    return result;
  };
  const requiredText = (input: unknown, fallback: string, name: string, max: number) => {
    const result = typeof input === "string" ? input.trim() : fallback;
    if (!result || result.length > max) throw new ApiError(`${name} is required and must be at most ${max} characters.`, 400);
    return result;
  };
  const ctaLink = requiredText(value.ctaLink, "/products", "CTA link", 2048);
  if (!ctaLink.startsWith("/") && !/^https:\/\/[^\s]+$/i.test(ctaLink)) {
    throw new ApiError("CTA link must be a local path or an HTTPS URL.", 400);
  }
  return {
    titleLines,
    secondLines,
    finalLines,
    products: [...new Set(products.map((id) => (id as string).trim()))],
    ctaText: requiredText(value.ctaText, "Start Selling", "CTA text", 60),
    ctaLink,
    logoText: requiredText(value.logoText, "ZAVI MART", "Logo text", 60),
    bgColor: color(value.bgColor, "#0A0A0A", "Background color"),
    textColor: color(value.textColor, "#FFFFFF", "Text color"),
    goldColor: color(value.goldColor, "#D4AF37", "Gold color"),
    audioUrl,
    audioType: audioType as AdData["audioType"],
    beatSync: value.beatSync === true,
    volume,
    isActive: value.isActive === true,
    placement: "homepage"
  };
}

function serializeAd(ad: Record<string, unknown>, productsById = new Map<string, AdProductPreview>()): AdData {
  const productIds = Array.isArray(ad.products)
    ? ad.products.filter((id): id is string => typeof id === "string")
    : [];
  return {
    id: String(ad._id),
    titleLines: ad.titleLines as string[],
    secondLines: ad.secondLines as string[],
    finalLines: ad.finalLines as string[],
    products: productIds,
    productDetails: productIds.flatMap((id) => {
      const product = productsById.get(id);
      return product ? [product] : [];
    }),
    ctaText: ad.ctaText as string,
    ctaLink: ad.ctaLink as string,
    logoText: ad.logoText as string,
    bgColor: ad.bgColor as string,
    textColor: ad.textColor as string,
    goldColor: ad.goldColor as string,
    audioUrl: ad.audioUrl as string,
    audioType: ad.audioType as AdData["audioType"],
    beatSync: ad.beatSync as boolean,
    volume: ad.volume as number,
    isActive: ad.isActive as boolean,
    placement: "homepage",
    createdAt: ad.createdAt instanceof Date ? ad.createdAt.toISOString() : undefined,
    updatedAt: ad.updatedAt instanceof Date ? ad.updatedAt.toISOString() : undefined
  };
}

async function ensureDatabase() {
  if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    await ensureDatabase();
    const ads = await Ad.find({}).sort({ createdAt: -1 }).lean();
    const productIds = [...new Set(ads.flatMap((ad) => ad.products))]
      .filter((id) => mongoose.isValidObjectId(id));
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select("_id title price images").lean()
      : [];
    const productsById = new Map(products.map((product) => [String(product._id), {
      id: String(product._id),
      title: product.title,
      price: product.price,
      image: product.images[0] ?? ""
    }]));
    return Response.json({ ads: ads.map((ad) => serializeAd(ad, productsById)) }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/ads failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    await ensureDatabase();
    const input = parseAdInput(await readJsonBody(request));
    const ad = await Ad.create(input);
    revalidatePath("/");
    return Response.json({ success: true, ad: serializeAd(ad.toObject() as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/ads failed");
  }
}

export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    await ensureDatabase();
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !mongoose.isValidObjectId(body.id)) {
      throw new ApiError("A valid ad id is required.", 400);
    }
    const input = parseAdInput(body);
    const ad = await Ad.findByIdAndUpdate(body.id, { $set: input }, { new: true, runValidators: true }).lean();
    if (!ad) return Response.json({ error: "Ad not found." }, { status: 404 });
    revalidatePath("/");
    return Response.json({ success: true, ad: serializeAd(ad as unknown as Record<string, unknown>) });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/ads failed");
  }
}

export async function DELETE(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    await ensureDatabase();
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !mongoose.isValidObjectId(body.id)) {
      throw new ApiError("A valid ad id is required.", 400);
    }
    const deleted = await Ad.findByIdAndDelete(body.id).lean();
    if (!deleted) return Response.json({ error: "Ad not found." }, { status: 404 });
    revalidatePath("/");
    return Response.json({ success: true, id: body.id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/ads failed");
  }
}
