import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, isRecord } from "./api-utils";
import { connectToDatabase } from "./mongodb";
import HotDeal from "../models/HotDeal";

export type HotDealItem = {
  id: string;
  dealType: "single" | "bundle";
  productId: string;
  productIds: string[];
  products: Array<{
    productId: string;
    title: string;
    image: string;
    category: string;
    originalPrice: number;
  }>;
  productName: string;
  productImage: string;
  category: string;
  bundleTitle: string;
  bundleImage: string;
  originalPrice: number;
  originalTotalPrice: number;
  dealPrice: number;
  discountPercent: number;
  discountType: "percent" | "fixed";
  discountValue: number;
  badgeText: string;
  customTitle: string;
  priority: number;
  showOnHomepage: boolean;
  isActive: boolean;
  validTill: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HotDealInput = Omit<HotDealItem, "id" | "createdAt" | "updatedAt">;

export type HotDealProduct = HotDealItem["products"][number];

const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const hotDealsFile = path.join(dataDirectory, "hotDeals.json");
let writeQueue: Promise<void> = Promise.resolve();

function isHotDeal(value: unknown): value is HotDealItem {
  return isRecord(value) &&
    typeof value.id === "string" &&
    (value.dealType === undefined || value.dealType === "single" || value.dealType === "bundle") &&
    typeof value.productId === "string" &&
    typeof value.productName === "string" &&
    typeof value.productImage === "string" &&
    typeof value.category === "string" &&
    typeof value.originalPrice === "number" &&
    typeof value.dealPrice === "number" &&
    (value.discountType === "percent" || value.discountType === "fixed") &&
    typeof value.discountValue === "number" &&
    typeof value.badgeText === "string" &&
    typeof value.customTitle === "string" &&
    typeof value.priority === "number" &&
    typeof value.showOnHomepage === "boolean" &&
    typeof value.isActive === "boolean" &&
    (typeof value.validTill === "string" || value.validTill === null) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function serializeHotDeal(deal: {
  _id: unknown;
  dealType?: "single" | "bundle";
  productId?: string;
  productIds?: string[];
  products?: HotDealProduct[];
  productName?: string;
  productImage?: string;
  category?: string;
  bundleTitle?: string;
  bundleImage?: string;
  originalPrice?: number;
  originalTotalPrice?: number | null;
  dealPrice: number;
  discountPercent?: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  badgeText?: string;
  customTitle?: string;
  priority?: number;
  showOnHomepage?: boolean;
  isActive?: boolean;
  validTill?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): HotDealItem {
  const products = deal.products?.length
    ? deal.products
    : [{
      productId: deal.productId ?? "",
      title: deal.productName ?? "",
      image: deal.productImage ?? "",
      category: deal.category ?? "General",
      originalPrice: deal.originalPrice ?? deal.originalTotalPrice ?? 0
    }];
  const productIds = deal.productIds?.length
    ? deal.productIds
    : products.map((product) => product.productId);
  const originalTotalPrice = deal.originalTotalPrice ?? deal.originalPrice ?? 0;
  const firstProduct = products[0];
  return {
    id: String(deal._id),
    dealType: deal.dealType ?? "single",
    productId: deal.productId || firstProduct?.productId || "",
    productIds,
    products,
    productName: deal.productName || products.map((product) => product.title).join(" + "),
    productImage: deal.productImage || firstProduct?.image || "",
    category: deal.category || firstProduct?.category || "General",
    bundleTitle: deal.bundleTitle ?? "",
    bundleImage: deal.bundleImage ?? "",
    originalPrice: deal.originalPrice ?? originalTotalPrice,
    originalTotalPrice,
    dealPrice: deal.dealPrice,
    discountPercent: deal.discountPercent ?? Math.round((1 - deal.dealPrice / Math.max(1, originalTotalPrice)) * 100),
    discountType: deal.discountType ?? "fixed",
    discountValue: deal.discountValue ?? Math.max(0, originalTotalPrice - deal.dealPrice),
    badgeText: deal.badgeText ?? "Hot Deal",
    customTitle: deal.customTitle ?? "",
    priority: deal.priority ?? 1,
    showOnHomepage: deal.showOnHomepage ?? true,
    isActive: deal.isActive ?? true,
    validTill: deal.validTill?.toISOString() ?? null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString()
  };
}

async function readLocalHotDeals(): Promise<HotDealItem[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(hotDealsFile, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(isHotDeal)) {
      throw new Error("The hot deal store contains invalid data.");
    }
    return parsed.map((deal) => {
      const products = deal.products?.length
        ? deal.products
        : [{
          productId: deal.productId,
          title: deal.productName,
          image: deal.productImage,
          category: deal.category,
          originalPrice: deal.originalPrice
        }];
      const originalTotalPrice = deal.originalTotalPrice ?? deal.originalPrice;
      return {
        ...deal,
        dealType: deal.dealType ?? "single",
        productIds: deal.productIds?.length ? deal.productIds : products.map((product) => product.productId),
        products,
        bundleTitle: deal.bundleTitle ?? "",
        bundleImage: deal.bundleImage ?? "",
        originalTotalPrice,
        discountPercent: deal.discountPercent ?? Math.round((1 - deal.dealPrice / Math.max(1, originalTotalPrice)) * 100)
      };
    });
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

async function updateLocalHotDeals(
  update: (deals: HotDealItem[]) => HotDealItem[]
): Promise<void> {
  const operation = writeQueue.then(async () => {
    const deals = update(await readLocalHotDeals());
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${hotDealsFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryFile, `${JSON.stringify(deals, null, 2)}\n`, "utf8");
      await rename(temporaryFile, hotDealsFile);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw error;
    }
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  await operation;
}

export async function getHotDeals(): Promise<HotDealItem[]> {
  const connection = await connectToDatabase();
  if (connection) {
    const deals = await HotDeal.find({}).sort({ priority: 1, createdAt: -1 }).lean();
    return deals.map(serializeHotDeal);
  }
  return (await readLocalHotDeals()).sort((left, right) =>
    left.priority - right.priority || right.createdAt.localeCompare(left.createdAt)
  );
}

export async function createHotDeal(input: HotDealInput): Promise<HotDealItem> {
  const connection = await connectToDatabase();
  if (connection) {
    return serializeHotDeal(await HotDeal.create(input));
  }
  const now = new Date().toISOString();
  const deal: HotDealItem = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  await updateLocalHotDeals((deals) => [...deals, deal]);
  return deal;
}

export async function updateHotDeal(id: string, input: Partial<HotDealInput>): Promise<HotDealItem | null> {
  const connection = await connectToDatabase();
  if (connection) {
    const deal = await HotDeal.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    return deal ? serializeHotDeal(deal) : null;
  }
  let updatedDeal: HotDealItem | null = null;
  await updateLocalHotDeals((deals) => deals.map((deal) => {
    if (deal.id !== id) return deal;
    updatedDeal = { ...deal, ...input, updatedAt: new Date().toISOString() };
    return updatedDeal;
  }));
  return updatedDeal;
}

export async function deleteHotDeal(id: string): Promise<boolean> {
  const connection = await connectToDatabase();
  if (connection) return !!(await HotDeal.findByIdAndDelete(id));
  let deleted = false;
  await updateLocalHotDeals((deals) => deals.filter((deal) => {
    if (deal.id === id) {
      deleted = true;
      return false;
    }
    return true;
  }));
  return deleted;
}

export function parseHotDealInput(value: unknown): HotDealInput {
  if (!isRecord(value)) throw new ApiError("Hot deal data must be a JSON object.", 400);
  if (value.dealType !== undefined && value.dealType !== "single" && value.dealType !== "bundle") {
    throw new ApiError("Deal type must be single or bundle.", 400);
  }
  const dealType = value.dealType === "bundle" ? "bundle" : "single";
  const rawProducts = Array.isArray(value.products) ? value.products : [];
  const products: HotDealProduct[] = rawProducts.map((entry): HotDealProduct => {
    if (!isRecord(entry)) throw new ApiError("Each selected product must be valid.", 400);
    const productId = typeof entry.productId === "string" ? entry.productId.trim() : "";
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const image = typeof entry.image === "string" ? entry.image.trim() : "";
    const category = typeof entry.category === "string" && entry.category.trim()
      ? entry.category.trim()
      : "General";
    const originalPrice = Number(entry.originalPrice);
    if (!productId || productId.length > 100 || !title || title.length > 200 ||
        image.length > 100000 || category.length > 100 ||
        !Number.isFinite(originalPrice) || originalPrice <= 0) {
      throw new ApiError("A selected product contains invalid name, image, category, or price data.", 400);
    }
    return { productId, title, image, category, originalPrice };
  });
  if (!products.length) {
    const productId = typeof value.productId === "string" ? value.productId.trim() : "";
    const productName = typeof value.productName === "string" ? value.productName.trim() : "";
    if (productId && productName) {
      products.push({
        productId,
        title: productName,
        image: typeof value.productImage === "string" ? value.productImage.trim() : "",
        category: typeof value.category === "string" && value.category.trim() ? value.category.trim() : "General",
        originalPrice: Number(value.originalPrice)
      });
    }
  }
  if (products.length < 1 || products.length > 4 ||
      (dealType === "single" && products.length !== 1) ||
      (dealType === "bundle" && products.length < 2)) {
    throw new ApiError("A single deal requires exactly one product; bundles require 2 to 4 products.", 400);
  }
  if (new Set(products.map((product) => product.productId)).size !== products.length) {
    throw new ApiError("A product can only appear once in a deal.", 400);
  }
  if (products.some((product) =>
    !product.productId || product.productId.length > 100 ||
    !product.title || product.title.length > 200 ||
    product.image.length > 100000 || product.category.length > 100 ||
    !Number.isFinite(product.originalPrice) || product.originalPrice <= 0
  )) {
    throw new ApiError("A selected product contains invalid name, image, category, or price data.", 400);
  }
  const originalTotalPrice = products.reduce((total, product) => total + product.originalPrice, 0);
  if (!Number.isFinite(originalTotalPrice)) {
    throw new ApiError("The combined original product price is invalid.", 400);
  }
  const firstProduct = products[0];
  const productIds = products.map((product) => product.productId);
  const productId = firstProduct.productId;
  const productName = products.map((product) => product.title).join(" + ");
  const productImage = firstProduct.image;
  const category = firstProduct.category;
  const bundleTitle = typeof value.bundleTitle === "string" ? value.bundleTitle.trim() : "";
  const bundleImage = typeof value.bundleImage === "string" ? value.bundleImage.trim() : "";
  const discountType = value.discountType;
  const inputDiscountValue = Number(value.discountValue);
  const hasDealPrice = value.dealPrice !== undefined && value.dealPrice !== "";
  const requestedDealPrice = hasDealPrice ? Number(value.dealPrice) : Number.NaN;
  const discountValue = hasDealPrice && dealType === "bundle"
    ? originalTotalPrice - requestedDealPrice
    : inputDiscountValue;
  const priority = Number(value.priority);
  const badgeText = typeof value.badgeText === "string" ? value.badgeText.trim() : "";
  const customTitle = typeof value.customTitle === "string" ? value.customTitle.trim() : "";
  const validTill = value.validTill === null || value.validTill === ""
    ? null
    : typeof value.validTill === "string" ? new Date(value.validTill) : new Date(NaN);

  if (!productId || productId.length > 100 || !productName || productName.length > 820) {
    throw new ApiError("Select a valid product for this hot deal.", 400);
  }
  if (productImage.length > 100000 || category.length > 100) {
    throw new ApiError("Product image or category is too long.", 400);
  }
  if ((discountType !== "percent" && discountType !== "fixed") ||
      !Number.isFinite(discountValue) || discountValue <= 0) {
    throw new ApiError("Choose a valid percentage or fixed-amount discount.", 400);
  }
  const dealPrice = hasDealPrice && dealType === "bundle"
    ? requestedDealPrice
    : discountType === "percent"
      ? Math.round(originalTotalPrice * (1 - discountValue / 100))
      : Math.round(originalTotalPrice - discountValue);
  if (!Number.isFinite(dealPrice) ||
      (discountType === "percent" && discountValue >= 100) ||
      dealPrice <= 0 || dealPrice >= originalTotalPrice) {
    throw new ApiError("The hot deal price must be greater than zero and lower than the original price.", 400);
  }
  if (!Number.isInteger(priority) || priority < 1 || priority > 100000) {
    throw new ApiError("Priority must be a whole number from 1 to 100,000.", 400);
  }
  if (bundleTitle.length > 120 || bundleImage.length > 1000000) {
    throw new ApiError("Bundle title or image is too long.", 400);
  }
  if (dealType === "bundle" && !bundleTitle) {
    throw new ApiError("Enter a title for this product bundle.", 400);
  }
  if (!badgeText || badgeText.length > 80 || customTitle.length > 120) {
    throw new ApiError("Enter a badge (up to 80 characters) and a custom title up to 120 characters.", 400);
  }
  if (validTill && !Number.isFinite(validTill.getTime())) {
    throw new ApiError("Valid Till must be a valid date.", 400);
  }

  return {
    dealType,
    productId,
    productIds,
    products,
    productName,
    productImage,
    category,
    bundleTitle,
    bundleImage,
    originalPrice: originalTotalPrice,
    originalTotalPrice,
    dealPrice,
    discountPercent: Math.round((1 - dealPrice / originalTotalPrice) * 100),
    discountType,
    discountValue,
    badgeText,
    customTitle,
    priority,
    showOnHomepage: value.showOnHomepage !== false,
    isActive: value.isActive !== false,
    validTill: validTill?.toISOString() ?? null
  };
}

export function getPublicHotDeals(deals: HotDealItem[], now = Date.now()): HotDealItem[] {
  return deals.filter((deal) =>
    deal.isActive &&
    deal.showOnHomepage &&
    (!deal.validTill || Date.parse(deal.validTill) > now)
  ).sort((left, right) => left.priority - right.priority || left.createdAt.localeCompare(right.createdAt));
}
