import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
config({ path: resolve(repositoryRoot, "app", ".env.local") });

const baseUrl = process.env.NEXT_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const adminKey = process.env.ADMIN_KEY || process.env.ADMIN_ACCESS_KEY || "zavi123";

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

async function main() {
  const origin = new URL(baseUrl);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error("NEXT_APP_URL must be a valid HTTP or HTTPS URL without embedded credentials.");
  }

  const headers = { "x-admin-key": adminKey };
  const products = [];
  for (let offset = 0; ; offset += 100) {
    const result = await requestJson(new URL(`/api/products?includeAdminFields=true&limit=100&offset=${offset}`, origin), {
      headers,
      cache: "no-store"
    });
    if (!Array.isArray(result?.products)) throw new Error("The products API returned an invalid product list.");
    products.push(...result.products.filter((product) =>
      product && typeof product._id === "string" &&
      typeof product.markazProductUrl === "string" &&
      /^https:\/\/(?:www\.)?markaz\.app\//i.test(product.markazProductUrl)
    ));
    if (result.products.length < 100) break;
  }
  if (!products.length) {
    console.log("No Markaz products with a public product URL were found.");
    return;
  }

  let updatedCount = 0;
  let withoutVariants = 0;
  for (const product of products) {
    const scraped = await requestJson(new URL(`/api/scrape?url=${encodeURIComponent(product.markazProductUrl)}`, origin), {
      cache: "no-store"
    });
    if (!Array.isArray(scraped?.variants) || scraped.variants.length === 0) {
      withoutVariants += 1;
      console.log(`Skipped ${product.title}: the public page exposed no variant attributes.`);
      continue;
    }
    await requestJson(new URL(`/api/products/${encodeURIComponent(product._id)}`, origin), {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        variants: scraped.variants,
        variantOptions: Array.isArray(scraped.variantOptions) ? scraped.variantOptions : [],
        variantCombinations: Array.isArray(scraped.variantCombinations) ? scraped.variantCombinations : [],
        hasVariants: true
      })
    });
    updatedCount += 1;
    console.log(`Updated ${product.title} (${scraped.variants.length} variant attributes).`);
  }

  console.log(`Variant backfill complete: ${updatedCount} updated, ${withoutVariants} pages without readable variants.`);
}

main().catch((error) => {
  console.error("Variant backfill failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
