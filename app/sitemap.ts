import type { MetadataRoute } from "next";
import { getCatalogProducts } from "../lib/product-catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zavimart.com";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["/", "/about", "/contact", "/terms"];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: new URL(path, siteUrl).toString(),
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.5
  }));
  try {
    const { products, deletedIds } = await getCatalogProducts();
    const productEntries: MetadataRoute.Sitemap = products
      .filter((product) => product.isActive !== false && product.isMock !== true && !deletedIds.includes(product._id))
      .flatMap((product) => {
        const id = product._id || product.id;
        if (!id) return [];
        const rawDate = product.updatedAt ?? product.createdAt;
        const parsedDate = typeof rawDate === "string" || rawDate instanceof Date
          ? new Date(rawDate)
          : null;
        return [{
          url: new URL(`/product/${encodeURIComponent(id)}`, siteUrl).toString(),
          ...(parsedDate && Number.isFinite(parsedDate.getTime()) ? { lastModified: parsedDate } : {}),
          changeFrequency: "weekly" as const,
          priority: 0.7
        }];
      });
    return [...staticEntries, ...productEntries];
  } catch (error) {
    console.error("Could not generate the product sitemap entries.", error);
    return staticEntries;
  }
}
