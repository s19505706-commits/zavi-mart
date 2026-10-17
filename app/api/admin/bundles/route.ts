import { ApiError, handleApiError, requireAdmin } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { serializeBundle } from "../../../../lib/bundles";
import Bundle from "../../../../models/Bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const bundles = await Bundle.find({}).sort({ createdAt: -1 }).lean();
    return Response.json(bundles.map((bundle) => serializeBundle(bundle)), {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/bundles failed");
  }
}
