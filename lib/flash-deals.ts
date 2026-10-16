import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectToDatabase } from "./mongodb";
import FlashDeal from "../models/FlashDeal";
import { ApiError, isRecord } from "./api-utils";

export type FlashDealItem = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  flashPrice: number;
  originalPrice: number;
  discountPercent: number;
  stockLimit: number;
  soldCount: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  badgeText: string;
  createdAt: string;
  updatedAt: string;
};

export type FlashDealInput = Omit<FlashDealItem, "id" | "soldCount" | "createdAt" | "updatedAt">;

const dataDirectory = path.join(process.cwd(), ".data");
const dealsFile = path.join(dataDirectory, "flashDeals.json");
let writeQueue: Promise<void> = Promise.resolve();

function isFlashDeal(value: unknown): value is FlashDealItem {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.productName === "string" &&
    typeof value.productImage === "string" &&
    typeof value.flashPrice === "number" &&
    typeof value.originalPrice === "number" &&
    typeof value.discountPercent === "number" &&
    typeof value.stockLimit === "number" &&
    typeof value.soldCount === "number" &&
    typeof value.startTime === "string" &&
    typeof value.endTime === "string" &&
    typeof value.isActive === "boolean" &&
    typeof value.badgeText === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function serializeDatabaseDeal(deal: {
  _id: unknown;
  productId: string;
  productName: string;
  productImage: string;
  flashPrice: number;
  originalPrice: number;
  discountPercent: number;
  stockLimit: number;
  soldCount: number;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  badgeText: string;
  createdAt: Date;
  updatedAt: Date;
}): FlashDealItem {
  return {
    id: String(deal._id),
    productId: deal.productId,
    productName: deal.productName,
    productImage: deal.productImage,
    flashPrice: deal.flashPrice,
    originalPrice: deal.originalPrice,
    discountPercent: deal.discountPercent,
    stockLimit: deal.stockLimit,
    soldCount: deal.soldCount,
    startTime: deal.startTime.toISOString(),
    endTime: deal.endTime.toISOString(),
    isActive: deal.isActive,
    badgeText: deal.badgeText,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString()
  };
}

async function readLocalDeals(): Promise<FlashDealItem[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(dealsFile, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(isFlashDeal)) {
      throw new Error("The flash deal store contains invalid data.");
    }
    return parsed;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
}

async function updateLocalDeals(
  update: (deals: FlashDealItem[]) => FlashDealItem[]
): Promise<FlashDealItem[]> {
  const operation = writeQueue.then(async () => {
    const deals = update(await readLocalDeals());
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${dealsFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryFile, `${JSON.stringify(deals, null, 2)}\n`, "utf8");
      await rename(temporaryFile, dealsFile);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw error;
    }
    return deals;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function getFlashDeals(): Promise<FlashDealItem[]> {
  const connection = await connectToDatabase();
  if (connection) {
    const deals = await FlashDeal.find({}).sort({ createdAt: -1 }).lean();
    return deals.map((deal) => serializeDatabaseDeal(deal));
  }
  return (await readLocalDeals()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export async function createFlashDeal(input: FlashDealInput): Promise<FlashDealItem> {
  const connection = await connectToDatabase();
  const now = new Date();
  if (connection) {
    const deal = await FlashDeal.create(input);
    return serializeDatabaseDeal(deal);
  }
  const deal: FlashDealItem = {
    id: randomUUID(),
    ...input,
    soldCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  await updateLocalDeals((deals) => [deal, ...deals]);
  return deal;
}

export async function updateFlashDeal(
  id: string,
  input: Partial<FlashDealInput>
): Promise<FlashDealItem | null> {
  const connection = await connectToDatabase();
  if (connection) {
    const deal = await FlashDeal.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true
    });
    return deal ? serializeDatabaseDeal(deal) : null;
  }
  let updatedDeal: FlashDealItem | null = null;
  await updateLocalDeals((deals) => deals.map((deal) => {
    if (deal.id !== id) return deal;
    updatedDeal = { ...deal, ...input, updatedAt: new Date().toISOString() };
    return updatedDeal;
  }));
  return updatedDeal;
}

export async function deleteFlashDeal(id: string): Promise<boolean> {
  const connection = await connectToDatabase();
  if (connection) return !!(await FlashDeal.findByIdAndDelete(id));
  let deleted = false;
  await updateLocalDeals((deals) => deals.filter((deal) => {
    if (deal.id === id) {
      deleted = true;
      return false;
    }
    return true;
  }));
  return deleted;
}

export function parseFlashDealInput(value: unknown): FlashDealInput {
  if (!isRecord(value)) throw new ApiError("Flash deal data must be a JSON object.", 400);
  const productId = typeof value.productId === "string" ? value.productId.trim() : "";
  const productName = typeof value.productName === "string" ? value.productName.trim() : "";
  const productImage = typeof value.productImage === "string" ? value.productImage.trim() : "";
  const flashPrice = Number(value.flashPrice);
  const originalPrice = Number(value.originalPrice);
  const stockLimit = Number(value.stockLimit);
  const startTime = typeof value.startTime === "string" ? new Date(value.startTime) : new Date(NaN);
  const endTime = typeof value.endTime === "string" ? new Date(value.endTime) : new Date(NaN);
  const badgeText = typeof value.badgeText === "string" ? value.badgeText.trim() : "Flash Sale";

  if (!productId || productId.length > 100 || !productName || productName.length > 200) {
    throw new ApiError("Select a valid product for this flash deal.", 400);
  }
  if (productImage.length > 100000) throw new ApiError("Product image is too large.", 400);
  if (!Number.isFinite(flashPrice) || flashPrice <= 0 ||
      !Number.isFinite(originalPrice) || originalPrice <= 0 || flashPrice >= originalPrice) {
    throw new ApiError("Flash price must be lower than a valid original price.", 400);
  }
  if (!Number.isInteger(stockLimit) || stockLimit < 1 || stockLimit > 1_000_000) {
    throw new ApiError("Flash stock must be a whole number between 1 and 1,000,000.", 400);
  }
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) ||
      endTime.getTime() <= startTime.getTime()) {
    throw new ApiError("Enter a valid end time after the start time.", 400);
  }
  if (badgeText.length > 80) throw new ApiError("Badge text must be 80 characters or fewer.", 400);

  return {
    productId,
    productName,
    productImage,
    flashPrice,
    originalPrice,
    discountPercent: Math.round((1 - flashPrice / originalPrice) * 100),
    stockLimit,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    isActive: value.isActive !== false,
    badgeText: badgeText || "Flash Sale"
  };
}

export function applyActiveFlashDeals<T extends {
  _id: string;
  id?: string;
  title: string;
  price: number;
  [key: string]: unknown;
}>(products: T[], deals: FlashDealItem[]): T[] {
  const now = Date.now();
  const activeDeals = deals.filter((deal) =>
    deal.isActive &&
    Date.parse(deal.startTime) <= now &&
    Date.parse(deal.endTime) > now &&
    deal.soldCount < deal.stockLimit
  );
  return products.map((product) => {
    const deal = activeDeals.find((entry) =>
      entry.productId === product._id ||
      entry.productId === product.id ||
      entry.productName.trim().toLocaleLowerCase() === product.title.trim().toLocaleLowerCase()
    );
    return deal ? {
      ...product,
      price: deal.flashPrice,
      originalPrice: deal.originalPrice,
      image: typeof product.image === "string" && product.image ? product.image : deal.productImage,
      isFlashDeal: true,
      flashDealDiscount: deal.discountPercent,
      flashDealExpiry: deal.endTime,
      badge: deal.badgeText
    } as T : product;
  });
}
