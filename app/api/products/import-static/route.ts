import { handleApiError, requireAdmin } from "../../../../lib/api-utils";
import { importStaticProducts } from "../../../../lib/local-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const importedCount = await importStaticProducts();
    return Response.json({ importedCount });
  } catch (error) {
    return handleApiError(error, "POST /api/products/import-static failed");
  }
}
