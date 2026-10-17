import { handleApiError, requireAdmin } from "../../../../lib/api-utils";
import { getStoreFilePath, readStoreJson, writeStoreJson } from "../../../../lib/vercel-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsFile = getStoreFilePath("auto-import-settings.json");

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const stored = await readStoreJson(settingsFile);
    const disabledAt = typeof stored.value === "object" && stored.value !== null &&
      "disabledAt" in stored.value && typeof stored.value.disabledAt === "string"
      ? stored.value.disabledAt
      : null;
    return Response.json({ enabled: false, disabledAt }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/auto-import failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const disabledAt = new Date().toISOString();
    await writeStoreJson(settingsFile, { enabled: false, disabledAt });
    console.info("[admin/settings] Automatic product imports disabled.");
    return Response.json({ success: true, enabled: false, disabledAt });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/auto-import failed");
  }
}
