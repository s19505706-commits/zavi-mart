import { ApiError, handleApiError, isRecord, readJsonBody } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { serializeBundle, validBundleId } from "../../../../lib/bundles";
import Bundle from "../../../../models/Bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !validBundleId(body.id)) {
      throw new ApiError("A valid bundle id is required.", 400);
    }
    const bundle = await Bundle.findOneAndUpdate({
      _id: body.id,
      isActive: true,
      timerExpiry: { $gt: new Date() },
      $expr: { $lt: ["$stockClaimed", "$stockTotal"] }
    }, {
      $inc: { stockClaimed: 1 }
    }, { returnDocument: "after", runValidators: true }).lean();
    if (!bundle) throw new ApiError("This value set has ended or is sold out.", 409);
    return Response.json({ bundle: serializeBundle(bundle) });
  } catch (error) {
    return handleApiError(error, "POST /api/bundles/purchase failed");
  }
}
