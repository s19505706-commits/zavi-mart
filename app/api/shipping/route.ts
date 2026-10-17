import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../lib/api-utils";
import { getShippingSettings, saveShippingSettings } from "../../../lib/shippingSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getShippingSettings();
    return Response.json(settings, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/shipping failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (
      !isRecord(body) ||
      typeof body.freeDeliveryEnabled !== "boolean" ||
      typeof body.minAmountForFree !== "number" ||
      typeof body.shippingFee !== "number" ||
      typeof body.bannerText !== "string" ||
      body.bannerText.trim().length === 0 ||
      body.bannerText.length > 160
    ) {
      throw new ApiError("Provide valid free delivery settings and banner text (160 characters maximum).", 400);
    }

    const previousSettings = await getShippingSettings();
    const submittedBannerText = body.bannerText.trim();
    const isDefaultBannerText = submittedBannerText ===
      `Free Delivery on orders above Rs ${previousSettings.minAmountForFree}` ||
      submittedBannerText === `Free delivery above Rs ${previousSettings.minAmountForFree.toLocaleString("en-US")}`;
    const bannerText = isDefaultBannerText &&
      body.minAmountForFree !== previousSettings.minAmountForFree
      ? `Free Delivery on orders above Rs ${body.minAmountForFree}`
      : submittedBannerText;
    const settings = await saveShippingSettings({
      ...body,
      bannerText
    });
    return Response.json(settings, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "POST /api/shipping failed");
  }
}
