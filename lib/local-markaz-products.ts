import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { addMockProduct, type MockProduct } from "./mock-products";

const dataDirectory = path.join(process.cwd(), "data");
const productsFile = path.join(dataDirectory, "markaz-products.json");
let writeQueue = Promise.resolve();

export type LocalMarkazProduct = Omit<MockProduct, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function normalizeLocalMarkazProduct(product: LocalMarkazProduct): LocalMarkazProduct {
  const rating = product.ratings > 0 ? product.ratings : 4.5;
  return {
    ...product,
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
    "updatedAt" in value && typeof value.updatedAt === "string";
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
  const products = (await readProductsFile()).map(normalizeLocalMarkazProduct);
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
