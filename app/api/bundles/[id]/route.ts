import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { parseBundleInput, serializeBundle, validBundleId } from "../../../../lib/bundles";
import Bundle from "../../../../models/Bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    if (!validBundleId(id)) throw new ApiError("A valid bundle id is required.", 400);
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const body = await readJsonBody(request);
    if (!isRecord(body)) throw new ApiError("Bundle details are required.", 400);
    if (Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
      const bundle = await Bundle.findByIdAndUpdate(id, { isActive: body.isActive }, {
        returnDocument: "after",
        runValidators: true
      }).lean();
      if (!bundle) return Response.json({ error: "Bundle not found." }, { status: 404 });
      return Response.json({ bundle: serializeBundle(bundle) });
    }
    const input = parseBundleInput(body);
    const current = await Bundle.findById(id).select("stockClaimed timerHours").lean();
    if (!current) return Response.json({ error: "Bundle not found." }, { status: 404 });
    if (input.stockTotal < current.stockClaimed) {
      throw new ApiError("Stock total cannot be lower than the number of sets already claimed.", 409);
    }
    const update = {
      ...input,
      savings: input.valuePrice - input.setPrice,
      ...(input.timerHours !== current.timerHours
        ? { timerExpiry: new Date(Date.now() + input.timerHours * 60 * 60 * 1000) }
        : {})
    };
    const bundle = await Bundle.findOneAndUpdate({
      _id: id,
      stockClaimed: { $lte: input.stockTotal }
    }, update, {
      returnDocument: "after",
      runValidators: true
    }).lean();
    if (!bundle) return Response.json({ error: "Bundle not found or its stock changed. Refresh and try again." }, { status: 409 });
    return Response.json({ bundle: serializeBundle(bundle) });
  } catch (error) {
    return handleApiError(error, "PUT /api/bundles/[id] failed");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    if (!validBundleId(id)) throw new ApiError("A valid bundle id is required.", 400);
    if (!await connectToDatabase()) throw new ApiError("MONGODB_URI is not configured.", 503);
    const bundle = await Bundle.findByIdAndDelete(id).select("_id").lean();
    if (!bundle) return Response.json({ error: "Bundle not found." }, { status: 404 });
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/bundles/[id] failed");
  }
}
