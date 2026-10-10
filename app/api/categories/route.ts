import { connectToDatabase } from "../../../lib/mongodb";
import { handleApiError } from "../../../lib/api-utils";
import { CATEGORY_DEFINITIONS } from "../../../lib/product-categories";
import Product from "../../../models/Product";
import { MOCK_PRODUCTS } from "../../../lib/mock-products";
import { getLocalMarkazProducts } from "../../../lib/local-markaz-products";

export const runtime = "nodejs";

export async function GET() {
  try {
    const connection = await connectToDatabase();
    if (!connection) {
      await getLocalMarkazProducts();
      const countByCategory = new Map<string, number>();
      for (const product of MOCK_PRODUCTS) {
        countByCategory.set(product.category, (countByCategory.get(product.category) ?? 0) + 1);
      }
      const categories = CATEGORY_DEFINITIONS.map(({ id, name }) => ({
        id,
        name,
        label: name,
        count: countByCategory.get(name) ?? 0
      }));
      return Response.json({ categories });
    }

    const counts = await Product.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const countByCategory = new Map(counts.map(({ _id, count }) => [_id, count]));
    const categories = CATEGORY_DEFINITIONS.map(({ id, name }) => ({
      id,
      name,
      label: name,
      count: countByCategory.get(name) ?? 0
    }));
    return Response.json({ categories });
  } catch (error) {
    return handleApiError(error, "GET /api/categories failed");
  }
}
