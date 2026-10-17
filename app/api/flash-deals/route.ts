import { handleApiError } from "../../../lib/api-utils";
import { getDealProducts } from "../../../lib/product-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getDealProducts();
    return Response.json({ products }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/flash-deals failed");
  }
}
