import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../lib/api-utils";
import { connectToDatabase } from "../../../lib/mongodb";
import { parseBundleInput, serializeBundle } from "../../../lib/bundles";
import Bundle from "../../../models/Bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!await connectToDatabase()) {
      return Response.json([], { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const bundles = await Bundle.find({
      isActive: true,
      timerExpiry: { $gt: new Date() },
      $expr: { $lt: ["$stockClaimed", "$stockTotal"] }
    }).sort({ createdAt: -1 }).lean();
    return Response.json(bundles.map((bundle) => serializeBundle(bundle)), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/bundles failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const input = parseBundleInput(await readJsonBody(request));
    if (input.valuePrice < input.setPrice) {
      throw new ApiError("Value price must be greater than or equal to set price.", 400);
    }
    const bundle = await Bundle.create(input);
    return Response.json({ bundle: serializeBundle(bundle) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/bundles failed");
  }
}
