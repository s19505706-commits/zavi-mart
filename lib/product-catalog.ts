import { connectToDatabase } from "./mongodb";
import { getLocalMarkazProducts } from "./local-markaz-products";
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

function mergeProducts(groups: CatalogProduct[][]): CatalogProduct[] {
  const merged: CatalogProduct[] = [];
  for (const group of groups) {
    for (const product of group) {
      const name = product.title.trim().toLocaleLowerCase();
      const existingIndex = merged.findIndex((entry) =>
        entry._id === product._id ||
        (!!product.id && (entry._id === product.id || entry.id === product.id)) ||
        entry.title.trim().toLocaleLowerCase() === name
      );
      if (existingIndex >= 0) merged.splice(existingIndex, 1);
      merged.push(product);
    }
  }
  return merged;
}

export async function getDealProducts(): Promise<CatalogProduct[]> {
  const connection = await connectToDatabase();
  const [store, localMarkazProducts, databaseProducts] = await Promise.all([
    getLocalProductStore(),
    getLocalMarkazProducts(),
    connection
      ? Product.find({ isActive: { $ne: false } }).sort({ createdAt: -1 })
      : Promise.resolve([])
  ]);
  const databaseList = databaseProducts.map((product) => serializeProduct(product));
  const catalogProducts = mergeProducts([
    MOCK_PRODUCTS,
    localMarkazProducts,
    store.products,
    databaseList
  ]);
  const now = Date.now();
  const activeDeals = (await getFlashDeals()).filter((deal) =>
    deal.isActive &&
    Date.parse(deal.startTime) <= now &&
    Date.parse(deal.endTime) > now &&
    deal.soldCount < deal.stockLimit
  );
  const matchedProducts = catalogProducts.filter((product) =>
    product.isActive !== false &&
    !store.deletedIds.includes(product._id) &&
    activeDeals.some((deal) =>
      deal.productId === product._id ||
      deal.productId === product.id ||
      deal.productName.trim().toLocaleLowerCase() === product.title.trim().toLocaleLowerCase()
    )
  );

  return applyActiveFlashDeals(matchedProducts, activeDeals).map(cleanCustomerProduct);
}
