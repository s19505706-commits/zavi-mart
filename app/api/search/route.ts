import { connectToDatabase } from "../../../lib/mongodb";
import { ApiError, escapeRegex, handleApiError, parseLimit } from "../../../lib/api-utils";
import { serializeProduct } from "../../../lib/product-response";
import Product from "../../../models/Product";
import { filterMockProducts } from "../../../lib/mock-products";
import { getLocalMarkazProducts } from "../../../lib/local-markaz-products";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    if (!query) throw new ApiError("q is required.", 400);
    if (query.length > 100) throw new ApiError("q must be 100 characters or fewer.", 400);

    const connection = await connectToDatabase();
    if (!connection) {
      await getLocalMarkazProducts();
      const products = filterMockProducts({ search: query })
        .slice(0, parseLimit(url.searchParams.get("limit")));
      return Response.json({ products });
    }

    const products = await Product.find({
      title: { $regex: escapeRegex(query), $options: "i" }
    }).sort({ createdAt: -1 }).limit(parseLimit(url.searchParams.get("limit")));

    return Response.json({ products: products.map(serializeProduct) });
  } catch (error) {
    return handleApiError(error, "GET /api/search failed");
  }
}
