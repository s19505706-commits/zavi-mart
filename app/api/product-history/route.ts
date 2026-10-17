import { handleApiError, requireAdmin } from "../../../lib/api-utils";
import { getDeletedProducts, getProductHistory } from "../../../lib/product-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const type = new URL(request.url).searchParams.get("type") ?? "all";
    if (type === "deleted") {
      const deletedProducts = await getDeletedProducts();
      deletedProducts.sort((left, right) =>
        new Date(right.deletedAt).getTime() - new Date(left.deletedAt).getTime()
      );
      return Response.json({ deletedProducts }, {
        headers: { "Cache-Control": "no-store, max-age=0" }
      });
    }
    if (![
      "all",
      "created",
      "imported",
      "updated",
      "deleted",
      "restored",
      "flash-deal-added",
      "hot-deal-added"
    ].includes(type)) {
      return Response.json({
        error: "type must be all, created, imported, updated, deleted, restored, flash-deal-added, or hot-deal-added."
      }, { status: 400 });
    }
    const history = await getProductHistory();
    const filteredHistory = type === "all" ? history : history.filter((entry) => entry.action === type);
    filteredHistory.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
    return Response.json({ history: filteredHistory }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/product-history failed");
  }
}
