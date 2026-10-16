import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isRecord } from "./api-utils";

export type ProductHistoryAction =
  | "created"
  | "imported"
  | "updated"
  | "deleted"
  | "restored"
  | "flash-deal-added"
  | "hot-deal-added";
export type ProductImportSource = "manual" | "local" | "markaz" | "csv" | "json" | "aliexpress" | "bulk-import";
const productImportSources = new Set<ProductImportSource>(["manual", "local", "markaz", "csv", "json", "aliexpress", "bulk-import"]);
const productHistoryActions = new Set<ProductHistoryAction>([
  "created",
  "imported",
  "updated",
  "deleted",
  "restored",
  "flash-deal-added",
  "hot-deal-added"
]);

export type ProductHistoryEntry = {
  id: number;
  productId: string;
  productName: string;
  action: ProductHistoryAction;
  source: ProductImportSource;
  sourceFileName?: string;
  timestamp: string;
  productSnapshot: Record<string, unknown>;
};

export type DeletedProduct = Record<string, unknown> & {
  _id: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
};

const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const historyFile = path.join(dataDirectory, "productHistory.json");
const deletedProductsFile = path.join(dataDirectory, "deletedProducts.json");
let historyWriteQueue = Promise.resolve();
let deletedWriteQueue = Promise.resolve();

function getProductId(product: Record<string, unknown>): string {
  const id = product._id ?? product.id;
  if (typeof id === "string") return id;
  if (typeof id === "object" && id !== null && "toString" in id && typeof id.toString === "function") {
    return id.toString();
  }
  throw new Error("Product history requires a product ID.");
}

function getProductName(product: Record<string, unknown>): string {
  const name = product.title ?? product.name;
  if (typeof name !== "string" || !name.trim()) throw new Error("Product history requires a product name.");
  return name.trim();
}

export function isProductImportSource(value: unknown): value is ProductImportSource {
  return typeof value === "string" && productImportSources.has(value as ProductImportSource);
}

export function getProductImportSource(product: unknown): ProductImportSource {
  if (!isRecord(product) || typeof product.importSource !== "string") return "manual";
  return isProductImportSource(product.importSource)
    ? product.importSource
    : "manual";
}

async function readArray<T>(file: string, description: string, isEntry: (value: unknown) => value is T): Promise<T[]> {
  try {
    const contents = await readFile(file, "utf8");
    const value: unknown = JSON.parse(contents);
    if (!Array.isArray(value) || !value.every(isEntry)) {
      throw new Error(`${description} must contain a valid JSON array.`);
    }
    return value;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await mkdir(dataDirectory, { recursive: true });
      await writeFile(file, "[]\n", "utf8");
      return [];
    }
    throw error;
  }
}

function isHistoryEntry(value: unknown): value is ProductHistoryEntry {
  return isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.productId === "string" &&
    typeof value.productName === "string" &&
    typeof value.action === "string" && productHistoryActions.has(value.action as ProductHistoryAction) &&
    typeof value.source === "string" && productImportSources.has(value.source as ProductImportSource) &&
    typeof value.timestamp === "string" &&
    isRecord(value.productSnapshot);
}

function isDeletedProduct(value: unknown): value is DeletedProduct {
  return isRecord(value) &&
    typeof value._id === "string" &&
    typeof value.deletedAt === "string" &&
    typeof value.deletedBy === "string" &&
    typeof value.reason === "string";
}

async function writeArray<T>(file: string, entries: T[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = path.join(dataDirectory, `${path.basename(file, ".json")}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
    await rename(temporaryFile, file);
  } catch (error) {
    try {
      await unlink(temporaryFile);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error("Could not remove temporary product history file.", cleanupError);
      }
    }
    throw error;
  }
}

function enqueueWrite<T>(
  queue: Promise<void>,
  setQueue: (queue: Promise<void>) => void,
  operation: () => Promise<T>
): Promise<T> {
  const result = queue.then(operation);
  setQueue(result.then(() => undefined, () => undefined));
  return result;
}

export async function getProductHistory(): Promise<ProductHistoryEntry[]> {
  return readArray(historyFile, ".data/productHistory.json", isHistoryEntry);
}

export async function logProductHistory(
  action: ProductHistoryAction,
  productValue: unknown,
  source: ProductImportSource,
  sourceFileName?: string
): Promise<ProductHistoryEntry> {
  if (!isRecord(productValue)) throw new Error("Product history requires a product object.");
  if (!isProductImportSource(source)) throw new Error("Product history source is invalid.");
  const productSnapshot = JSON.parse(JSON.stringify(productValue)) as Record<string, unknown>;
  const result = await enqueueWrite(historyWriteQueue, (queue) => { historyWriteQueue = queue; }, async () => {
    const history = await readArray(historyFile, ".data/productHistory.json", isHistoryEntry);
    const timestamp = new Date().toISOString();
    const id = Math.max(Date.now(), (history.at(-1)?.id ?? 0) + 1);
    const entry: ProductHistoryEntry = {
      id,
      productId: getProductId(productSnapshot),
      productName: getProductName(productSnapshot),
      action,
      source,
      ...(sourceFileName ? { sourceFileName } : {}),
      timestamp,
      productSnapshot
    };
    history.push(entry);
    await writeArray(historyFile, history);
    return entry;
  });
  return result;
}

export async function logProductDealAdditions(
  productValue: unknown,
  previousProduct: unknown,
  source: ProductImportSource
): Promise<void> {
  if (!isRecord(productValue)) throw new Error("Product history requires a product object.");
  const previousIsRecord = isRecord(previousProduct);
  if (
    productValue.isFlashDeal === true &&
    (!previousIsRecord || previousProduct.isFlashDeal !== true)
  ) {
    await logProductHistory("flash-deal-added", productValue, source);
  }
  if (
    productValue.isHotDeal === true &&
    (!previousIsRecord || previousProduct.isHotDeal !== true)
  ) {
    await logProductHistory("hot-deal-added", productValue, source);
  }
}

export async function getDeletedProducts(): Promise<DeletedProduct[]> {
  return readArray(deletedProductsFile, ".data/deletedProducts.json", isDeletedProduct);
}

export async function archiveDeletedProduct(productValue: unknown): Promise<DeletedProduct> {
  if (!isRecord(productValue)) throw new Error("A product object is required for the deleted archive.");
  const productSnapshot = JSON.parse(JSON.stringify(productValue)) as Record<string, unknown>;
  const result = await enqueueWrite(deletedWriteQueue, (queue) => { deletedWriteQueue = queue; }, async () => {
    const deletedProducts = await readArray(deletedProductsFile, ".data/deletedProducts.json", isDeletedProduct);
    const productId = getProductId(productSnapshot);
    if (deletedProducts.some((product) => getProductId(product) === productId)) {
      throw new Error("This product is already in the deleted products archive.");
    }
    const archivedProduct: DeletedProduct = {
      ...productSnapshot,
      _id: productId,
      deletedAt: new Date().toISOString(),
      deletedBy: "admin",
      reason: "Removed from the active catalog by an administrator."
    };
    deletedProducts.push(archivedProduct);
    await writeArray(deletedProductsFile, deletedProducts);
    return archivedProduct;
  });
  return result;
}

export async function removeDeletedProduct(productId: string): Promise<DeletedProduct | null> {
  return enqueueWrite(deletedWriteQueue, (queue) => { deletedWriteQueue = queue; }, async () => {
    const deletedProducts = await readArray(deletedProductsFile, ".data/deletedProducts.json", isDeletedProduct);
    const archivedProduct = deletedProducts.find((product) => getProductId(product) === productId) ?? null;
    if (!archivedProduct) return null;
    await writeArray(deletedProductsFile, deletedProducts.filter((product) => getProductId(product) !== productId));
    return archivedProduct;
  });
}

export async function restoreDeletedProduct(productId: string): Promise<DeletedProduct | null> {
  return removeDeletedProduct(productId);
}
