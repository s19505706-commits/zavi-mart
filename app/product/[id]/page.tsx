import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";
import { getCatalogProducts } from "../../../lib/product-catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zavimart.com";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { products, deletedIds } = await getCatalogProducts();
    const product = products.find((candidate) =>
      (candidate._id === id || candidate.id === id || candidate.slug === id) &&
      candidate.isActive !== false && !deletedIds.includes(candidate._id)
    );
    if (!product) return { title: "Product not found" };
    const title = product.title.trim();
    const description = typeof product.description === "string" && product.description.trim()
      ? product.description.trim().slice(0, 300)
      : `Shop ${title} at Zavi Collection. View details, price, and availability.`;
    const image = typeof product.image === "string" && product.image
      ? new URL(product.image, siteUrl).toString()
      : undefined;
    return {
      title,
      description,
      alternates: { canonical: `/product/${encodeURIComponent(id)}` },
      openGraph: {
        type: "website",
        url: new URL(`/product/${encodeURIComponent(id)}`, siteUrl),
        title,
        description,
        ...(image ? { images: [image] } : {})
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {})
      }
    };
  } catch (error) {
    console.error("Could not generate product metadata.", error);
    return { title: "Product | Zavi Collection" };
  }
}

export default function ProductPage() {
  return <ProductDetailClient />;
}
