import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { MOCK_PRODUCTS, type MockProduct } from "./mock-products";
import { getCategoryId } from "./product-categories";
import { getProductImportSource, logProductHistory, type ProductImportSource } from "./product-history";
import { cleanMarkazTitle, cleanProductDescription, extractProductCode } from "./product-codes";

const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const localProductsFile = path.join(dataDirectory, "products.json");
const staticProducts = MOCK_PRODUCTS.slice();
let writeQueue = Promise.resolve();
let productMetadataMigration: Promise<ProductStore> | null = null;

export type StoredProduct = Omit<MockProduct, "createdAt" | "updatedAt" | "categoryId"> & {
  createdAt: string;
  updatedAt: string;
  importSource: ProductImportSource;
  isHotDeal: boolean;
  flashDealDiscount?: number;
  flashDealExpiry?: string | null;
  hotDealLabel?: string;
  isNewArrival: boolean;
  dealEndDate: string | null;
  discountPercent: number;
  brand: string;
  sku: string;
  productCode?: string | null;
  markazCode?: string | null;
  markazProductUrl?: string | null;
  supplierCode?: string | null;
  originalDescription?: string | null;
  originalMarkazTitle?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
};

type ProductStore = {
  products: StoredProduct[];
  deletedIds: string[];
};

function toStoredProduct(product: MockProduct, importSource?: ProductImportSource): StoredProduct {
  const extendedProduct = product as MockProduct & Partial<StoredProduct>;
  const originalMarkazTitle = extendedProduct.originalMarkazTitle ??
    (/Markaz|\bPKR\s*[\d,]+/i.test(product.title) ? product.title : null);
  const productCode = extendedProduct.productCode ?? extendedProduct.markazCode ??
    extendedProduct.supplierCode ?? extractProductCode(
      extendedProduct.originalDescription?.trim() ? extendedProduct.originalDescription : product.description
    );
  return {
    ...product,
    title: cleanMarkazTitle(product.title),
    name: cleanMarkazTitle(product.name),
    description: cleanProductDescription(product.description),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    importSource: importSource ?? getProductImportSource(extendedProduct),
    isHotDeal: extendedProduct.isHotDeal === true,
    flashDealDiscount: extendedProduct.flashDealDiscount ?? 0,
    flashDealExpiry: extendedProduct.flashDealExpiry ?? null,
    hotDealLabel: extendedProduct.hotDealLabel ?? "",
    isNewArrival: extendedProduct.isNewArrival === true,
    dealEndDate: extendedProduct.dealEndDate ?? null,
    discountPercent: extendedProduct.discountPercent ?? 0,
    brand: extendedProduct.brand ?? "",
    sku: extendedProduct.sku ?? "",
    productCode,
    markazCode: extendedProduct.markazCode ?? productCode,
    supplierCode: extendedProduct.supplierCode ?? productCode,
    originalDescription: extendedProduct.originalDescription ??
      (productCode ? product.description : null),
    originalMarkazTitle,
    markazProductUrl: extendedProduct.markazProductUrl ?? null
  };
}

function isStoredProduct(value: unknown): value is StoredProduct {
  return typeof value === "object" && value !== null &&
    "_id" in value && typeof value._id === "string" &&
    "id" in value && typeof value.id === "string" &&
    "title" in value && typeof value.title === "string" &&
    "name" in value && typeof value.name === "string" &&
    "slug" in value && typeof value.slug === "string" &&
    "price" in value && typeof value.price === "number" &&
    "originalPrice" in value && (typeof value.originalPrice === "number" || value.originalPrice === null) &&
    "oldPrice" in value && typeof value.oldPrice === "number" &&
    "images" in value && Array.isArray(value.images) && value.images.every((image) => typeof image === "string") &&
    "image" in value && typeof value.image === "string" &&
    "category" in value && typeof value.category === "string" &&
    (!("departmentId" in value) || typeof value.departmentId === "string" || value.departmentId === null) &&
    (!("categoryId" in value) || typeof value.categoryId === "string" || value.categoryId === null) &&
    "stock" in value && typeof value.stock === "number" &&
    "description" in value && typeof value.description === "string" &&
    "isFlashDeal" in value && typeof value.isFlashDeal === "boolean" &&
    "isFeatured" in value && typeof value.isFeatured === "boolean" &&
    "isMarkazProduct" in value && typeof value.isMarkazProduct === "boolean" &&
    "ratings" in value && typeof value.ratings === "number" &&
    "rating" in value && typeof value.rating === "number" &&
    "badge" in value && typeof value.badge === "string" &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    (!("importSource" in value) || typeof value.importSource === "string") &&
    "isHotDeal" in value && typeof value.isHotDeal === "boolean" &&
    (!("flashDealDiscount" in value) || typeof value.flashDealDiscount === "number") &&
    (!("flashDealExpiry" in value) || typeof value.flashDealExpiry === "string" || value.flashDealExpiry === null) &&
    (!("hotDealLabel" in value) || typeof value.hotDealLabel === "string") &&
    (!("productCode" in value) || typeof value.productCode === "string" || value.productCode === null) &&
    (!("markazCode" in value) || typeof value.markazCode === "string" || value.markazCode === null) &&
    (!("supplierCode" in value) || typeof value.supplierCode === "string" || value.supplierCode === null) &&
    (!("originalDescription" in value) || typeof value.originalDescription === "string" || value.originalDescription === null) &&
    (!("originalMarkazTitle" in value) || typeof value.originalMarkazTitle === "string" || value.originalMarkazTitle === null) &&
    "isNewArrival" in value && typeof value.isNewArrival === "boolean" &&
    "dealEndDate" in value && (typeof value.dealEndDate === "string" || value.dealEndDate === null) &&
    "discountPercent" in value && typeof value.discountPercent === "number" &&
    "brand" in value && typeof value.brand === "string" &&
    "sku" in value && typeof value.sku === "string";
}

async function readStore(): Promise<ProductStore> {
  try {
    const contents = await readFile(localProductsFile, "utf8");
    const value: unknown = JSON.parse(contents);
    if (
      typeof value !== "object" || value === null ||
      !("products" in value) || !Array.isArray(value.products) ||
      !value.products.every(isStoredProduct) ||
      !("deletedIds" in value) || !Array.isArray(value.deletedIds) ||
      !value.deletedIds.every((id) => typeof id === "string")
    ) {
      throw new Error(".data/products.json must contain valid product and deletedIds arrays.");
    }
    const products = value.products.map((product) => ({
      ...product,
      title: cleanMarkazTitle(product.title),
      name: cleanMarkazTitle(product.name),
      importSource: product.importSource ?? "manual",
      departmentId: typeof product.departmentId === "string" ? product.departmentId : null,
      categoryId: typeof product.categoryId === "string" ? product.categoryId : null
    }));
    return { products, deletedIds: value.deletedIds };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { products: [], deletedIds: [] };
    }
    throw error;
  }
}

async function updateStore(update: (store: ProductStore) => ProductStore): Promise<ProductStore> {
  const save = async () => {
    const store = update(await readStore());
    await mkdir(dataDirectory, { recursive: true });
    const temporaryFile = path.join(dataDirectory, `products.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
      await rename(temporaryFile, localProductsFile);
    } catch (error) {
      try {
        await unlink(temporaryFile);
      } catch (cleanupError) {
        if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
          console.error("Could not remove temporary product data file.", cleanupError);
        }
      }
      throw error;
    }
    return store;
  };

  const pendingSave = writeQueue.then(save);
  writeQueue = pendingSave.then(() => undefined, () => undefined);
  return pendingSave;
}

export async function getLocalProductStore(): Promise<ProductStore> {
  if (!productMetadataMigration) {
    productMetadataMigration = updateStore((store) => ({
      ...store,
      products: store.products.map((product) => ({
        ...product,
        title: cleanMarkazTitle(product.title),
        name: cleanMarkazTitle(product.name),
        description: cleanProductDescription(product.description),
        importSource: getProductImportSource(product),
        flashDealDiscount: product.flashDealDiscount ?? 0,
        flashDealExpiry: product.flashDealExpiry ?? null,
        hotDealLabel: product.hotDealLabel ?? "",
        productCode: product.productCode ?? product.markazCode ?? product.supplierCode ??
          extractProductCode(product.originalDescription?.trim() ? product.originalDescription : product.description),
        markazCode: product.markazCode ?? product.productCode ??
          extractProductCode(product.originalDescription?.trim() ? product.originalDescription : product.description),
        supplierCode: product.supplierCode ?? product.productCode ??
          extractProductCode(product.originalDescription?.trim() ? product.originalDescription : product.description),
        originalDescription: product.originalDescription ??
          (extractProductCode(product.description) ? product.description : null),
        originalMarkazTitle: product.originalMarkazTitle ??
          (/Markaz|\bPKR\s*[\d,]+/i.test(product.title) ? product.title : null)
      }))
    })).catch((error: unknown) => {
      productMetadataMigration = null;
      throw error;
    });
  }
  return productMetadataMigration;
}

export async function importStaticProducts(): Promise<number> {
  let importedCount = 0;
  const importedProducts: StoredProduct[] = [];
  await updateStore((store) => {
    const names = new Set(store.products.map((product) => product.title.trim().toLocaleLowerCase()));
    for (const product of staticProducts) {
      const name = product.title.trim().toLocaleLowerCase();
      if (!names.has(name)) {
        const importedProduct = toStoredProduct(product, "bulk-import");
        store.products.push(importedProduct);
        importedProducts.push(importedProduct);
        names.add(name);
        importedCount += 1;
      }
    }
    return store;
  });
  for (const product of importedProducts) {
    await logProductHistory("imported", product, "bulk-import");
  }
  return importedCount;
}

export async function upsertLocalProduct(product: StoredProduct): Promise<StoredProduct> {
  let savedProduct = product;
  await updateStore((store) => {
    const matchingIndex = store.products.findIndex((entry) =>
      entry._id === product._id || entry.title.trim().toLocaleLowerCase() === product.title.trim().toLocaleLowerCase()
    );
    if (matchingIndex >= 0) {
      savedProduct = { ...store.products[matchingIndex], ...product };
      store.products[matchingIndex] = savedProduct;
    } else {
      store.products.push(savedProduct);
    }
    return {
      products: store.products,
      deletedIds: store.deletedIds.filter((id) => id !== product._id)
    };
  });
  return savedProduct;
}

export async function clearLocalProductDeletion(id: string): Promise<void> {
  await updateStore((store) => ({
    products: store.products,
    deletedIds: store.deletedIds.filter((deletedId) => deletedId !== id)
  }));
}

export async function restoreLocalProduct(product: StoredProduct): Promise<StoredProduct> {
  await updateStore((store) => {
    const index = store.products.findIndex((entry) => entry._id === product._id || entry.id === product.id);
    if (index >= 0) store.products[index] = product;
    else store.products.push(product);
    return {
      products: store.products,
      deletedIds: store.deletedIds.filter((deletedId) => deletedId !== product._id)
    };
  });
  return product;
}

export function toRestoredLocalProduct(snapshot: Record<string, unknown>): StoredProduct | null {
  const id = typeof snapshot._id === "string"
    ? snapshot._id
    : typeof snapshot.id === "string" ? snapshot.id : "";
  const title = typeof snapshot.title === "string" ? snapshot.title : "";
  const slug = typeof snapshot.slug === "string" ? snapshot.slug : "";
  const category = typeof snapshot.category === "string" && snapshot.category.trim()
    ? snapshot.category.trim()
    : null;
  if (!id || !title || !slug || !category || typeof snapshot.price !== "number" ||
      typeof snapshot.stock !== "number") return null;

  const images = Array.isArray(snapshot.images)
    ? snapshot.images.filter((image): image is string => typeof image === "string")
    : typeof snapshot.image === "string" ? [snapshot.image] : [];
  const now = new Date().toISOString();
  const createdAt = typeof snapshot.createdAt === "string" && Number.isFinite(Date.parse(snapshot.createdAt))
    ? snapshot.createdAt
    : now;
  const updatedAt = typeof snapshot.updatedAt === "string" && Number.isFinite(Date.parse(snapshot.updatedAt))
    ? snapshot.updatedAt
    : now;
  const source = snapshot.importSource;

  return {
    _id: id,
    id,
    title,
    name: title,
    slug,
    price: snapshot.price,
    originalPrice: typeof snapshot.originalPrice === "number" ? snapshot.originalPrice : null,
    oldPrice: typeof snapshot.oldPrice === "number" ? snapshot.oldPrice
      : typeof snapshot.originalPrice === "number" ? snapshot.originalPrice : snapshot.price,
    images,
    image: images[0] ?? "",
    category,
    categoryId: typeof snapshot.categoryId === "string" ? snapshot.categoryId : getCategoryId(category),
    stock: snapshot.stock,
    description: typeof snapshot.description === "string" ? snapshot.description : "",
    productCode: typeof snapshot.productCode === "string" ? snapshot.productCode
      : typeof snapshot.markazCode === "string" ? snapshot.markazCode
        : typeof snapshot.supplierCode === "string" ? snapshot.supplierCode
          : extractProductCode(typeof snapshot.description === "string" ? snapshot.description : ""),
    markazCode: typeof snapshot.markazCode === "string" ? snapshot.markazCode : null,
    markazProductUrl: typeof snapshot.markazProductUrl === "string" ? snapshot.markazProductUrl : null,
    supplierCode: typeof snapshot.supplierCode === "string" ? snapshot.supplierCode : null,
    originalDescription: typeof snapshot.originalDescription === "string" ? snapshot.originalDescription : null,
    isFlashDeal: snapshot.isFlashDeal === true,
    isFeatured: snapshot.isFeatured === true,
    isMarkazProduct: snapshot.isMarkazProduct === true,
    isActive: true,
    importSource: source && ["manual", "csv", "json", "aliexpress", "bulk-import"].includes(String(source))
      ? source as ProductImportSource
      : "bulk-import",
    markazProductId: typeof snapshot.markazProductId === "string" ? snapshot.markazProductId : null,
    wholesalePrice: typeof snapshot.wholesalePrice === "number" ? snapshot.wholesalePrice : null,
    sellingPrice: typeof snapshot.sellingPrice === "number" ? snapshot.sellingPrice : null,
    profit: typeof snapshot.profit === "number" ? snapshot.profit : null,
    supplier: typeof snapshot.supplier === "object" && snapshot.supplier !== null &&
      "name" in snapshot.supplier && typeof snapshot.supplier.name === "string" &&
      "productUrl" in snapshot.supplier && typeof snapshot.supplier.productUrl === "string" &&
      "info" in snapshot.supplier && typeof snapshot.supplier.info === "string"
      ? { name: snapshot.supplier.name, productUrl: snapshot.supplier.productUrl, info: snapshot.supplier.info }
      : null,
    ratings: typeof snapshot.ratings === "number" ? snapshot.ratings
      : typeof snapshot.rating === "number" ? snapshot.rating : 0,
    rating: typeof snapshot.rating === "number" ? snapshot.rating
      : typeof snapshot.ratings === "number" ? snapshot.ratings : 0,
    reviews: typeof snapshot.reviews === "number" ? snapshot.reviews : 0,
    badge: typeof snapshot.badge === "string" ? snapshot.badge : "",
    createdAt,
    updatedAt: now,
    isHotDeal: snapshot.isHotDeal === true,
    flashDealDiscount: typeof snapshot.flashDealDiscount === "number" ? snapshot.flashDealDiscount : 0,
    flashDealExpiry: typeof snapshot.flashDealExpiry === "string" ? snapshot.flashDealExpiry : null,
    hotDealLabel: typeof snapshot.hotDealLabel === "string" ? snapshot.hotDealLabel : "",
    isNewArrival: snapshot.isNewArrival === true,
    dealEndDate: typeof snapshot.dealEndDate === "string" ? snapshot.dealEndDate : null,
    discountPercent: typeof snapshot.discountPercent === "number" ? snapshot.discountPercent : 0,
    brand: typeof snapshot.brand === "string" ? snapshot.brand : "",
    sku: typeof snapshot.sku === "string" ? snapshot.sku : ""
  };
}

export async function deleteLocalProduct(id: string): Promise<void> {
  await updateStore((store) => ({
    products: store.products.filter((product) => product._id !== id && product.id !== id),
    deletedIds: store.deletedIds.includes(id) ? store.deletedIds : [...store.deletedIds, id]
  }));
}

export function getStaticProduct(id: string): StoredProduct | undefined {
  const product = MOCK_PRODUCTS.find((entry) => entry._id === id || entry.id === id || entry.slug === id);
  return product ? toStoredProduct(product) : undefined;
}
