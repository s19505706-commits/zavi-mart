import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { addMockProduct, type MockProduct } from "./mock-products";
import type { ProductImportSource } from "./product-history";
import { cleanMarkazTitle, cleanProductDescription, extractProductCode } from "./product-codes";

const dataDirectory = path.join(process.cwd(), "data");
const productsFile = path.join(dataDirectory, "markaz-products.json");
let writeQueue = Promise.resolve();

export type LocalMarkazProduct = Omit<MockProduct, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  importSource: ProductImportSource;
  isHotDeal?: boolean;
  isNewArrival?: boolean;
  dealEndDate?: string | null;
  discountPercent?: number;
  brand?: string;
  sku?: string;
  productCode?: string | null;
  markazCode?: string | null;
  supplierCode?: string | null;
  originalDescription?: string | null;
  originalMarkazTitle?: string | null;
  hasVariants?: boolean;
  variantOptions?: unknown[];
  variants?: import("./markaz-variants").ProductVariantDefinition[];
  variantCombinations?: import("./markaz-variants").ProductVariantCombination[];
};

function normalizeLocalMarkazProduct(product: LocalMarkazProduct): LocalMarkazProduct {
  const rating = product.ratings > 0 ? product.ratings : 4.5;
  const productCode = product.productCode ?? product.markazCode ?? product.supplierCode ??
    extractProductCode(product.originalDescription?.trim() ? product.originalDescription : product.description);
  return {
    ...product,
    title: cleanMarkazTitle(product.title),
    name: cleanMarkazTitle(product.name),
    originalMarkazTitle: product.originalMarkazTitle ??
      (/Markaz|\bPKR\s*[\d,]+/i.test(product.title) ? product.title : null),
    description: cleanProductDescription(product.description),
    productCode,
    markazCode: product.markazCode ?? productCode,
    supplierCode: product.supplierCode ?? productCode,
    originalDescription: product.originalDescription ??
      (productCode ? product.description : null),
    importSource: product.importSource ?? "bulk-import",
    ratings: rating,
    rating,
    reviews: product.reviews || 100,
    badge: product.isFlashDeal ? "Flash deal" : product.isFeatured ? "Featured" : ""
  };
}

function isLocalMarkazProduct(value: unknown): value is LocalMarkazProduct {
  return typeof value === "object" && value !== null &&
    "_id" in value && typeof value._id === "string" &&
    "id" in value && typeof value.id === "string" &&
    "title" in value && typeof value.title === "string" &&
    "name" in value && typeof value.name === "string" &&
    "slug" in value && typeof value.slug === "string" &&
    "price" in value && typeof value.price === "number" &&
    "originalPrice" in value && (typeof value.originalPrice === "number" || value.originalPrice === null) &&
    "oldPrice" in value && typeof value.oldPrice === "number" &&
    "images" in value && Array.isArray(value.images) &&
    "image" in value && typeof value.image === "string" &&
    "category" in value && typeof value.category === "string" &&
    "categoryId" in value && typeof value.categoryId === "string" &&
    "stock" in value && typeof value.stock === "number" &&
    "description" in value && typeof value.description === "string" &&
    "isFlashDeal" in value && typeof value.isFlashDeal === "boolean" &&
    "isFeatured" in value && typeof value.isFeatured === "boolean" &&
    "isMarkazProduct" in value && value.isMarkazProduct === true &&
    "ratings" in value && typeof value.ratings === "number" &&
    "rating" in value && typeof value.rating === "number" &&
    "badge" in value && typeof value.badge === "string" &&
    "markazProductId" in value && typeof value.markazProductId === "string" &&
    "wholesalePrice" in value && typeof value.wholesalePrice === "number" &&
    "sellingPrice" in value && typeof value.sellingPrice === "number" &&
    "profit" in value && typeof value.profit === "number" &&
    "supplier" in value && typeof value.supplier === "object" && value.supplier !== null &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    (!("importSource" in value) || typeof value.importSource === "string") &&
    (!("productCode" in value) || typeof value.productCode === "string" || value.productCode === null) &&
    (!("markazCode" in value) || typeof value.markazCode === "string" || value.markazCode === null) &&
    (!("supplierCode" in value) || typeof value.supplierCode === "string" || value.supplierCode === null) &&
    (!("originalDescription" in value) || typeof value.originalDescription === "string" || value.originalDescription === null) &&
    (!("originalMarkazTitle" in value) || typeof value.originalMarkazTitle === "string" || value.originalMarkazTitle === null);
}

async function readProductsFile(): Promise<LocalMarkazProduct[]> {
  try {
    const contents = await readFile(productsFile, "utf8");
    const products: unknown = JSON.parse(contents);
    if (!Array.isArray(products) || !products.every(isLocalMarkazProduct)) {
      throw new Error("data/markaz-products.json must contain valid Markaz product records.");
    }
    return products;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function getLocalMarkazProducts(): Promise<LocalMarkazProduct[]> {
  const products = (await readProductsFile()).map((product) => normalizeLocalMarkazProduct({
    ...product,
    importSource: product.importSource ?? "bulk-import"
  }));
  for (const product of products) {
    addMockProduct({
      ...product,
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt)
    });
  }
  return products;
}

export async function saveLocalMarkazProduct(product: LocalMarkazProduct): Promise<void> {
  const save = async () => {
    await mkdir(dataDirectory, { recursive: true });
    const products = await readProductsFile();
    products.push(product);
    const temporaryFile = path.join(dataDirectory, `markaz-products.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");
      await rename(temporaryFile, productsFile);
    } catch (error) {
      try {
        await unlink(temporaryFile);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
          console.error("Could not remove temporary Markaz product data file.", cleanupError);
        }
      }
      throw error;
    }
    addMockProduct({
      ...product,
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt)
    });
  };

  const pendingSave = writeQueue.then(save);
  writeQueue = pendingSave.catch(() => undefined);
  await pendingSave;
}
