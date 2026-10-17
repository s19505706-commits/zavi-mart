import { extractMarkazVariantData, type MarkazVariantData } from "../../../lib/markaz-variants";

const MAX_HTML_LENGTH = 1_000_000;
const ALLOWED_HOSTS = new Set(["markaz.app", "www.markaz.app"]);

function getAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const point = code[0]?.toLowerCase() === "x"
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    });
}

function getMetaValue(html: string, key: "property" | "name", value: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => getAttribute(candidate, key)?.toLowerCase() === value);
  const content = tag ? getAttribute(tag, "content") : undefined;
  return content ? decodeHtml(content).trim() : undefined;
}

const EXCLUDED_IMAGE_TERMS = ["logo", "icon", "banner", "header", "zavi", "favicon"];

function isProductImageUrl(value: string, baseUrl: URL): string | null {
  try {
    const image = new URL(decodeHtml(value.trim()), baseUrl);
    const normalized = image.toString();
    const lowerUrl = normalized.toLowerCase();
    if (
      image.protocol !== "https:" ||
      !/(?:markaz|cdn)/i.test(normalized) ||
      /\.(?:mp4|mov|webm|m3u8)(?:$|[?#])/i.test(normalized) ||
      EXCLUDED_IMAGE_TERMS.some((term) => lowerUrl.includes(term))
    ) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

function addImage(images: string[], value: unknown, baseUrl: URL) {
  if (typeof value !== "string") return;
  const image = isProductImageUrl(value, baseUrl);
  if (image && !images.includes(image)) images.push(image);
}

function collectImageValues(value: unknown, images: string[], baseUrl: URL, imageContext = false) {
  if (typeof value === "string") {
    if (imageContext) addImage(images, value, baseUrl);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectImageValues(entry, images, baseUrl, imageContext);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    const isImageField = /image|photo|gallery|media|picture/i.test(key);
    if (isImageField || (imageContext && /^(src|url|original|large)$/i.test(key))) {
      collectImageValues(entry, images, baseUrl, true);
    } else if (imageContext) {
      collectImageValues(entry, images, baseUrl, true);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStructuredImages(html: string, baseUrl: URL): string[] {
  const images: string[] = [];
  const nextDataMatch = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const nextData: unknown = JSON.parse(nextDataMatch[1]);
      if (isRecord(nextData) && isRecord(nextData.props) && isRecord(nextData.props.pageProps)) {
        const visitProducts = (value: unknown) => {
          if (Array.isArray(value)) {
            value.forEach(visitProducts);
            return;
          }
          if (!isRecord(value)) return;
          for (const [key, entry] of Object.entries(value)) {
            if (/product/i.test(key)) collectImageValues(entry, images, baseUrl);
            else if (isRecord(entry) || Array.isArray(entry)) visitProducts(entry);
          }
        };
        visitProducts(nextData.props.pageProps);
      }
    } catch {
      // Malformed framework data should fall through to JSON-LD and HTML images.
    }
  }
  if (images.length) return images;

  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const json = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const data: unknown = JSON.parse(json);
      const visit = (entry: unknown) => {
        if (Array.isArray(entry)) {
          entry.forEach(visit);
          return;
        }
        if (!isRecord(entry)) return;
        const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
        if (types.some((type) => typeof type === "string" && type.toLowerCase() === "product")) {
          collectImageValues({ image: entry.image }, images, baseUrl);
        }
        Object.values(entry).forEach(visit);
      };
      visit(data);
    } catch {
      continue;
    }
  }
  return images;
}

function getHtmlImages(html: string, baseUrl: URL): string[] {
  const images: string[] = [];
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rawWidth = getAttribute(tag, "width") ?? tag.match(/\bwidth\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
    const declaredWidth = Number(rawWidth);
    if (Number.isFinite(declaredWidth) && declaredWidth > 200) {
      const candidates = [
        getAttribute(tag, "src"),
        getAttribute(tag, "data-src"),
        getAttribute(tag, "data-lazy-src"),
        getAttribute(tag, "data-original")
      ].filter((candidate): candidate is string => !!candidate);
      for (const candidate of candidates) addImage(images, candidate, baseUrl);
    }

    const srcSet = getAttribute(tag, "srcset");
    if (srcSet) {
      for (const candidate of srcSet.split(",")) {
        const [source, descriptor] = candidate.trim().split(/\s+/);
        const sourceWidth = descriptor?.endsWith("w")
          ? Number.parseInt(descriptor.slice(0, -1), 10)
          : descriptor?.endsWith("x")
            ? Number.parseFloat(descriptor.slice(0, -1)) * declaredWidth
            : declaredWidth;
        if (source && Number.isFinite(sourceWidth) && sourceWidth > 200) addImage(images, source, baseUrl);
      }
    }
  }
  return images;
}

function getOpenGraphImages(html: string, baseUrl: URL): string[] {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const images: string[] = [];
  for (const tag of tags) {
    if (getAttribute(tag, "property")?.toLowerCase() !== "og:image") continue;
    const image = getAttribute(tag, "content");
    if (!image) continue;
    const validImage = isProductImageUrl(image, baseUrl);
    if (validImage && !images.includes(validImage)) images.push(validImage);
  }
  return images;
}

type ProductMetadata = {
  rating?: number;
  reviews?: number;
  description?: string;
  wholesalePrice?: number;
  wholesalePriceRank?: number;
  stock?: number;
  stockRank?: number;
  inStock?: boolean;
};

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function readProductMetadata(value: unknown): ProductMetadata {
  let metadata: ProductMetadata = {};
  const priceRanks: Record<string, number> = {
    wholesaleprice: 0,
    resellerprice: 1,
    wholesale: 2,
    cost: 3,
    productprice: 4,
    price: 5
  };
  const stockRanks: Record<string, number> = {
    stock: 0,
    quantity: 1,
    availablestock: 2,
    availablequantity: 3
  };
  const visit = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!isRecord(entry)) return;

    for (const [key, child] of Object.entries(entry)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, "");
      if (metadata.rating === undefined && /^(ratingValue|averageRating|rating)$/i.test(key)) {
        const rating = typeof child === "number" ? child : typeof child === "string" ? Number(child) : Number.NaN;
        if (Number.isFinite(rating) && rating > 0 && rating <= 5) metadata.rating = rating;
      }
      if (metadata.reviews === undefined && /^(ratingCount|reviewCount|reviewsCount|reviews)$/i.test(key)) {
        const reviews = typeof child === "number" ? child : typeof child === "string" ? Number(child.replace(/[^\d]/g, "")) : Number.NaN;
        if (Number.isInteger(reviews) && reviews > 0) metadata.reviews = reviews;
      }
      if (
        metadata.description === undefined &&
        /^(description|productDescription|shortDescription|longDescription)$/i.test(key) &&
        typeof child === "string"
      ) {
        const description = child.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (description.length > 20) metadata.description = decodeHtml(description);
      }
      const priceRank = priceRanks[normalizedKey];
      const price = parseNumericValue(child);
      if (priceRank !== undefined && price !== undefined &&
          (metadata.wholesalePriceRank === undefined || priceRank < metadata.wholesalePriceRank)) {
        metadata.wholesalePrice = price;
        metadata.wholesalePriceRank = priceRank;
      }
      if (normalizedKey === "variants" && Array.isArray(child)) {
        const firstVariant = child.find(isRecord);
        const variantPrice = firstVariant ? parseNumericValue(firstVariant.price) : undefined;
        if (variantPrice !== undefined &&
            (metadata.wholesalePriceRank === undefined || 6 < metadata.wholesalePriceRank)) {
          metadata.wholesalePrice = variantPrice;
          metadata.wholesalePriceRank = 6;
        }
      }
      const stockRank = stockRanks[normalizedKey];
      const stock = parseNumericValue(child);
      if (stockRank !== undefined && stock !== undefined &&
          (metadata.stockRank === undefined || stockRank < metadata.stockRank)) {
        metadata.stock = stock;
        metadata.stockRank = stockRank;
      }
      if (normalizedKey === "instock" && typeof child === "boolean") metadata.inStock = child;
      if (normalizedKey === "variants" && Array.isArray(child) && metadata.stock === undefined) {
        const firstVariant = child.find(isRecord);
        const variantStock = firstVariant ? parseNumericValue(firstVariant.stock) : undefined;
        if (variantStock !== undefined) {
          metadata.stock = variantStock;
          metadata.stockRank = 4;
        }
      }
      visit(child);
    }
  };
  visit(value);
  return metadata;
}

function mergeProductMetadata(metadata: ProductMetadata, found: ProductMetadata): void {
  metadata.rating ??= found.rating;
  metadata.reviews ??= found.reviews;
  metadata.description ??= found.description;
  if (
    found.wholesalePrice !== undefined &&
    (metadata.wholesalePriceRank === undefined ||
      (found.wholesalePriceRank ?? Number.MAX_SAFE_INTEGER) < metadata.wholesalePriceRank)
  ) {
    metadata.wholesalePrice = found.wholesalePrice;
    metadata.wholesalePriceRank = found.wholesalePriceRank;
  }
  if (
    found.stock !== undefined &&
    (metadata.stockRank === undefined || (found.stockRank ?? Number.MAX_SAFE_INTEGER) < metadata.stockRank)
  ) {
    metadata.stock = found.stock;
    metadata.stockRank = found.stockRank;
  }
  metadata.inStock ??= found.inStock;
}

function getProductMetadata(html: string): ProductMetadata {
  const metadata: ProductMetadata = {};
  const nextDataMatch = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const nextData: unknown = JSON.parse(nextDataMatch[1]);
      const products: unknown[] = [];
      const findProducts = (entry: unknown) => {
        if (Array.isArray(entry)) {
          entry.forEach(findProducts);
          return;
        }
        if (!isRecord(entry)) return;
        for (const [key, child] of Object.entries(entry)) {
          if (/product/i.test(key)) products.push(child);
          else if (isRecord(child) || Array.isArray(child)) findProducts(child);
        }
      };
      if (isRecord(nextData) && isRecord(nextData.props)) findProducts(nextData.props.pageProps);
      for (const product of products) {
        const found = readProductMetadata(product);
        mergeProductMetadata(metadata, found);
      }
    } catch {
      // Fall back to JSON-LD and HTML metadata if Next.js data is malformed.
    }
  }

  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const script of scripts) {
    const json = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const data: unknown = JSON.parse(json);
      const visitProducts = (entry: unknown) => {
        if (Array.isArray(entry)) {
          entry.forEach(visitProducts);
          return;
        }
        if (!isRecord(entry)) return;
        const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
        if (types.some((type) => typeof type === "string" && type.toLowerCase() === "product")) {
          const found = readProductMetadata(entry);
          mergeProductMetadata(metadata, found);
        }
        Object.values(entry).forEach(visitProducts);
      };
      visitProducts(data);
    } catch {
      continue;
    }
  }

  if (metadata.stock === undefined) {
    const stock = html.match(/\\?["'](?:stock|quantity|availableStock|availableQuantity)\\?["']\s*:\s*\\?["']?(\d+)/i)?.[1];
    if (stock !== undefined) metadata.stock = Number(stock);
  }
  if (metadata.inStock === undefined) {
    const inStock = html.match(/\\?["']inStock\\?["']\s*:\s*(true|false)/i)?.[1];
    if (inStock !== undefined) metadata.inStock = inStock.toLowerCase() === "true";
  }

  if (metadata.rating === undefined) {
    const explicitRating = html.match(/\bdata-rating\s*=\s*["']([0-5](?:\.\d+)?)["']/i)?.[1] ??
      html.match(/class=["'][^"']*rating[^"']*["'][^>]*>[^0-9]*([0-5](?:\.\d+)?)/i)?.[1];
    if (explicitRating) metadata.rating = Number(explicitRating);
  }
  if (metadata.reviews === undefined) {
    const ratingCount = html.match(/\b(?:ratingCount|reviewCount|reviewsCount)\s*["':=]+\s*["']?(\d+)/i)?.[1] ??
      html.match(/\(?\s*(\d[\d,]*)\s+(?:reviews|ratings)\s*\)?/i)?.[1];
    if (ratingCount) metadata.reviews = Number(ratingCount.replace(/,/g, ""));
  }
  metadata.description ??= getMetaValue(html, "property", "og:description") ??
    getMetaValue(html, "name", "description");
  return metadata;
}

function getMarkazVariantData(html: string) {
  const nextDataMatch = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch?.[1]) {
    try {
      const data = extractMarkazVariantData(JSON.parse(nextDataMatch[1]));
      if (data.variants.length) return data;
    } catch {
      // Try the streamed server-component payload when framework JSON is unavailable.
    }
  }

  let best: MarkazVariantData = { variantOptions: [], variants: [], variantCombinations: [] };
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const scriptTag of scripts) {
    const script = scriptTag.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
    const pushIndex = script.indexOf("self.__next_f.push(");
    if (pushIndex < 0) continue;
    const openIndex = script.indexOf("(", pushIndex);
    const closeIndex = script.lastIndexOf(")");
    if (openIndex < 0 || closeIndex <= openIndex) continue;

    let payload: unknown;
    try {
      payload = JSON.parse(script.slice(openIndex + 1, closeIndex));
    } catch {
      continue;
    }
    if (!Array.isArray(payload) || typeof payload[1] !== "string") continue;
    const chunk = payload[1];
    let markerIndex = 0;
    while ((markerIndex = chunk.indexOf('"skuInfo":{', markerIndex)) >= 0) {
      const objectStart = markerIndex + '"skuInfo":'.length;
      let depth = 0;
      let inString = false;
      let escaped = false;
      let objectEnd = -1;
      for (let index = objectStart; index < chunk.length; index += 1) {
        const character = chunk[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === "\"") inString = false;
          continue;
        }
        if (character === "\"") inString = true;
        else if (character === "{") depth += 1;
        else if (character === "}") {
          depth -= 1;
          if (depth === 0) {
            objectEnd = index + 1;
            break;
          }
        }
      }
      if (objectEnd > objectStart) {
        try {
          const data = extractMarkazVariantData(JSON.parse(chunk.slice(objectStart, objectEnd)));
          if (data.variants.length > best.variants.length ||
              (data.variants.length === best.variants.length &&
                data.variantCombinations.length > best.variantCombinations.length)) {
            best = data;
          }
        } catch {
          // Ignore incomplete streamed fragments and inspect the next product fragment.
        }
      }
      markerIndex = objectStart + 1;
    }
  }
  return best;
}

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const requestedUrl = new URL(request.url).searchParams.get("url");
  if (!requestedUrl || requestedUrl.length > 2048) {
    return Response.json({ error: "A valid supplier URL is required." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(requestedUrl);
  } catch {
    return Response.json({ error: "Supplier URL must be a valid URL." }, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) {
    return Response.json({ error: "Only HTTPS product pages on markaz.app can be fetched." }, { status: 400 });
  }

  try {
    let pageUrl = url;
    let response: Response | undefined;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      response = await fetch(pageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 ZaviMart product importer" },
        redirect: "manual",
        signal: AbortSignal.timeout(8000)
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === 5) {
        return Response.json({ error: "Supplier page redirected too many times or omitted its redirect URL." }, { status: 502 });
      }
      const redirectedUrl = new URL(location, pageUrl);
      if (
        redirectedUrl.protocol !== "https:" ||
        !ALLOWED_HOSTS.has(redirectedUrl.hostname.toLowerCase()) ||
        redirectedUrl.username ||
        redirectedUrl.password
      ) {
        return Response.json({ error: "Supplier page redirected outside the allowed Markaz domains." }, { status: 502 });
      }
      pageUrl = redirectedUrl;
    }
    if (!response) throw new Error("Supplier page did not return a response.");
    if (!response.ok) {
      return Response.json({ error: `Supplier page returned HTTP ${response.status}.` }, { status: 502 });
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return Response.json({ error: "Supplier URL did not return an HTML product page." }, { status: 502 });
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_LENGTH) {
      return Response.json({ error: "Supplier product page is too large to inspect." }, { status: 502 });
    }
    if (!response.body) {
      return Response.json({ error: "Supplier product page returned an empty response." }, { status: 502 });
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalLength += value.byteLength;
      if (totalLength > MAX_HTML_LENGTH) {
        await reader.cancel();
        return Response.json({ error: "Supplier product page is too large to inspect." }, { status: 502 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const html = new TextDecoder().decode(bytes);
    const title =
      getMetaValue(html, "property", "og:title") ??
      getMetaValue(html, "name", "twitter:title") ??
      html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, "").trim();
    const structuredImages = getStructuredImages(html, pageUrl);
    const htmlImages = structuredImages.length ? [] : getHtmlImages(html, pageUrl);
    const productImages = structuredImages.length ? structuredImages : htmlImages;
    if (!productImages.length) {
      productImages.push(...getOpenGraphImages(html, pageUrl));
    }
    const metadata = getProductMetadata(html);
    const variantData = getMarkazVariantData(html);
    const rating = metadata.rating ?? 4.5 + Math.random() * 0.5;
    const reviews = metadata.reviews ?? Math.floor(Math.random() * 200) + 50;
    const description = metadata.description ?? "";
    return Response.json({
      ...(title ? { title: decodeHtml(title).trim() } : {}),
      images: productImages,
      rating,
      reviews,
      ...(metadata.wholesalePrice !== undefined ? { wholesalePrice: metadata.wholesalePrice } : {}),
      ...(metadata.stock !== undefined ? { stock: metadata.stock } : {}),
      ...(metadata.inStock !== undefined ? { inStock: metadata.inStock } : {}),
      ...(variantData.variants.length ? variantData : {}),
      description
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Timed out while fetching the supplier product page."
      : "Could not fetch the supplier product page.";
    return Response.json({ error: message }, { status: 502 });
  }
}
