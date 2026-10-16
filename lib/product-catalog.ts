import { connectToDatabase } from "./mongodb";
import {
  getStoredLocalMarkazProducts,
  getTrackedMarkazProducts
} from "./local-markaz-products";
import { getLocalProductStore } from "./local-products";
import { MOCK_PRODUCTS } from "./mock-products";
import { serializeProduct } from "./product-response";
import Product from "../models/Product";
import { cleanCustomerProduct } from "./product-codes";
import { applyActiveFlashDeals, getFlashDeals } from "./flash-deals";

type CatalogProduct = {
  _id: string;
  id?: string;
  title: string;
  isActive?: boolean;
  flashDealExpiry?: string | null;
  price: number;
  originalPrice?: number | null;
  image?: string;
  [key: string]: unknown;
  createdAt?: Date | string;
};

type MergeableProduct = {
  _id: string;
  id?: string;
  title: string;
  isMock?: boolean;
};

type CatalogSnapshot = {
  products: CatalogProduct[];
  deletedIds: string[];
};

const CATALOG_CACHE_DURATION_MS = 60_000;
let catalogCache: { snapshot: CatalogSnapshot; expiresAt: number } | null = null;
let catalogLoad: Promise<CatalogSnapshot> | null = null;

export function mergeCatalogProducts<T extends MergeableProduct>(
  realGroups: readonly (readonly T[])[],
  mockProducts: readonly T[]
): T[] {
  const realProducts = mergeProducts(realGroups);
  const groups = process.env.NODE_ENV !== "production" && realProducts.length < 5
    ? [...realGroups, mockProducts]
    : realGroups;
  return mergeProducts(groups);
}

function mergeProducts<T extends MergeableProduct>(
  groups: readonly (readonly T[])[]
): T[] {
  const merged: T[] = [];
  for (const group of groups) {
    for (const product of group) {
      const name = product.title.trim().toLocaleLowerCase();
      const existingIndex = merged.findIndex((entry) =>
        entry._id === product._id ||
        (!!product.id && (entry._id === product.id || entry.id === product.id)) ||
        entry.title.trim().toLocaleLowerCase() === name
      );
      if (existingIndex < 0) merged.push(product);
    }
  }
  return merged;
}

async function loadCatalogSnapshot(): Promise<CatalogSnapshot> {
  const connection = await connectToDatabase();
  const [store, localMarkazProducts, databaseProducts] = await Promise.all([
    getLocalProductStore(),
    getStoredLocalMarkazProducts(),
    connection
      ? Product.find({ isActive: { $ne: false } }).sort({ createdAt: -1 })
      : Promise.resolve([])
  ]);
  const databaseList = databaseProducts.map((product) => serializeProduct(product) as CatalogProduct);
  return {
    products: mergeCatalogProducts([
      databaseList,
      store.products.map((product) => ({ ...product }) as CatalogProduct),
      localMarkazProducts.map((product) => ({ ...product }) as CatalogProduct),
      getTrackedMarkazProducts().map((product) => ({ ...product }) as CatalogProduct)
    ], MOCK_PRODUCTS.map((product) => ({ ...product }) as CatalogProduct)),
    deletedIds: [...store.deletedIds]
  };
}

export async function getCatalogProducts(): Promise<CatalogSnapshot> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return {
      products: catalogCache.snapshot.products.map((product) => ({ ...product })),
      deletedIds: [...catalogCache.snapshot.deletedIds]
    };
  }
  if (!catalogLoad) {
    catalogLoad = loadCatalogSnapshot().then((snapshot) => {
      catalogCache = { snapshot, expiresAt: Date.now() + CATALOG_CACHE_DURATION_MS };
      return snapshot;
    }).finally(() => {
      catalogLoad = null;
    });
  }
  const snapshot = await catalogLoad;
  return {
    products: snapshot.products.map((product) => ({ ...product })),
    deletedIds: [...snapshot.deletedIds]
  };
}

export async function getDealProducts(): Promise<CatalogProduct[]> {
  const { products: catalogProducts, deletedIds } = await getCatalogProducts();
  const now = Date.now();
  const activeDeals = (await getFlashDeals()).filter((deal) =>
    deal.isActive &&
    Date.parse(deal.startTime) <= now &&
    Date.parse(deal.endTime) > now &&
    deal.soldCount < deal.stockLimit
  );
  const matchedProducts = catalogProducts.filter((product) =>
    product.isActive !== false &&
    !deletedIds.includes(product._id) &&
    activeDeals.some((deal) =>
      deal.productId === product._id ||
      deal.productId === product.id ||
      deal.productName.trim().toLocaleLowerCase() === product.title.trim().toLocaleLowerCase()
    )
  );

  return applyActiveFlashDeals(matchedProducts, activeDeals).map(cleanCustomerProduct);
}
