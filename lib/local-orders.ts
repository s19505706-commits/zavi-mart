import { MOCK_PRODUCTS } from "./mock-products";
import {
  assertLocalStoreWritesAllowed,
  getStoreFilePath,
  readStoreJson,
  writeStoreJson
} from "./vercel-store";

const ordersFile = getStoreFilePath("orders.json");
let writeQueue = Promise.resolve();

export type LocalOrder = Record<string, unknown>;
export type LocalOrderStore = Record<string, LocalOrder>;

function createMockOrders(): LocalOrderStore {
  const now = Date.now();
  return Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
    const firstProduct = MOCK_PRODUCTS[index % MOCK_PRODUCTS.length];
    const secondProduct = MOCK_PRODUCTS[(index + 4) % MOCK_PRODUCTS.length];
    const firstQty = index % 2 + 1;
    const secondQty = index % 3 + 1;
    const products = [
      {
        productId: firstProduct.id,
        name: firstProduct.title,
        price: firstProduct.price,
        qty: firstQty,
        image: firstProduct.image
      },
      {
        productId: secondProduct.id,
        name: secondProduct.title,
        price: secondProduct.price,
        qty: secondQty,
        image: secondProduct.image
      }
    ];
    const date = new Date(now - index * 86_400_000).toISOString();
    const id = `ZM-DEMO-${index + 1}`;
    return [id, {
      id,
      orderId: id,
      customer: {
        name: ["Amina Khan", "Bilal Ahmed", "Sara Malik", "Hamza Raza", "Noor Ali", "Zainab Shah"][index],
        phone: `+9230000000${String(index + 1).padStart(2, "0")}`,
        email: `customer${index + 1}@example.com`
      },
      products,
      subtotal: products.reduce((total, product) => total + product.price * product.qty, 0),
      shipping: 0,
      amount: products.reduce((total, product) => total + product.price * product.qty, 0),
      status: index === 0 ? "delivered" : "pending",
      createdAt: date
    }];
  }));
}

function parseOrderStore(value: unknown): LocalOrderStore {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(".data/orders.json must contain an object keyed by order ID.");
  }
  const entries = Object.entries(value);
  if (!entries.every(([, order]) => typeof order === "object" && order !== null && !Array.isArray(order))) {
    throw new Error(".data/orders.json contains an invalid order record.");
  }
  return value as LocalOrderStore;
}

async function readOrdersFile(): Promise<{ orders: LocalOrderStore; created: boolean }> {
  const stored = await readStoreJson(ordersFile);
  if (stored.exists) return { orders: parseOrderStore(stored.value), created: false };
  const orders = process.env.NODE_ENV === "production" ? {} : createMockOrders();
  return { orders, created: true };
}

async function writeOrdersFile(orders: LocalOrderStore): Promise<void> {
  await writeStoreJson(ordersFile, orders);
}

export async function getLocalOrders(): Promise<LocalOrder[]> {
  const { orders, created } = await readOrdersFile();
  if (created && process.env.NODE_ENV !== "production") await writeOrdersFile(orders);
  return Object.values(orders);
}

export async function updateLocalOrderStatus(orderId: string, status: string): Promise<LocalOrder | null> {
  const update = async () => {
    assertLocalStoreWritesAllowed("Order");
    const { orders, created } = await readOrdersFile();
    if (created && process.env.NODE_ENV !== "production") await writeOrdersFile(orders);
    const entry = Object.entries(orders).find(([key, order]) =>
      key === orderId || order.id === orderId || order.orderId === orderId || order._id === orderId
    );
    if (!entry) return null;

    const [key, order] = entry;
    const updatedOrder = {
      ...order,
      status,
      orderStatus: status,
      ...(status === "delivered" ? { deliveredAt: new Date().toISOString() } : { deliveredAt: null }),
      updatedAt: new Date().toISOString()
    };
    await writeOrdersFile({ ...orders, [key]: updatedOrder });
    return updatedOrder;
  };

  const pendingUpdate = writeQueue.then(update);
  writeQueue = pendingUpdate.then(() => undefined, () => undefined);
  return pendingUpdate;
}

export async function markLocalOrderOrderedOnMarkaz(orderId: string): Promise<LocalOrder | null> {
  const update = async () => {
    assertLocalStoreWritesAllowed("Order");
    const { orders, created } = await readOrdersFile();
    if (created && process.env.NODE_ENV !== "production") await writeOrdersFile(orders);
    const entry = Object.entries(orders).find(([key, order]) =>
      key === orderId || order.id === orderId || order.orderId === orderId || order._id === orderId
    );
    if (!entry) return null;

    const [key, order] = entry;
    const updatedOrder = {
      ...order,
      supplierOrderedOnMarkaz: true,
      supplierOrderedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeOrdersFile({ ...orders, [key]: updatedOrder });
    return updatedOrder;
  };

  const pendingUpdate = writeQueue.then(update);
  writeQueue = pendingUpdate.then(() => undefined, () => undefined);
  return pendingUpdate;
}

export async function saveLocalOrder(order: LocalOrder): Promise<void> {
  const key = typeof order.orderId === "string"
    ? order.orderId
    : typeof order.id === "string"
      ? order.id
      : typeof order._id === "string"
        ? order._id
        : "";
  if (!key) throw new Error("An order ID is required to save an order.");

  const save = async () => {
    assertLocalStoreWritesAllowed("Order");
    const { orders, created } = await readOrdersFile();
    if (created && process.env.NODE_ENV !== "production") await writeOrdersFile(orders);
    await writeOrdersFile({ ...orders, [key]: order });
  };
  const pendingSave = writeQueue.then(save);
  writeQueue = pendingSave.then(() => undefined, () => undefined);
  await pendingSave;
}
