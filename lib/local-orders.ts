import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { MOCK_PRODUCTS } from "./mock-products";

const dataDirectory = path.join(process.cwd(), ".data");
const ordersFile = path.join(dataDirectory, "orders.json");
let writeQueue = Promise.resolve();
const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
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
  try {
    return {
      orders: parseOrderStore(JSON.parse(await readFile(ordersFile, "utf8"))),
      created: false
    };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    return { orders: createMockOrders(), created: true };
  }
}

async function writeOrdersFile(orders: LocalOrderStore): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = path.join(dataDirectory, `orders.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
    await rename(temporaryFile, ordersFile);
  } catch (error) {
    try {
      await unlink(temporaryFile);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error("Could not remove temporary orders file.", cleanupError);
      }
    }
    throw error;
  }
}

export async function getLocalOrders(): Promise<LocalOrder[]> {
  const { orders, created } = await readOrdersFile();
  if (created) await writeOrdersFile(orders);
  return Object.values(orders);
}

export async function updateLocalOrderStatus(orderId: string, status: string): Promise<LocalOrder | null> {
  const update = async () => {
    const { orders, created } = await readOrdersFile();
    if (created) await writeOrdersFile(orders);
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
    const { orders, created } = await readOrdersFile();
    if (created) await writeOrdersFile(orders);
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
    const { orders, created } = await readOrdersFile();
    if (created) await writeOrdersFile(orders);
    await writeOrdersFile({ ...orders, [key]: order });
  };
  const pendingSave = writeQueue.then(save);
  writeQueue = pendingSave.then(() => undefined, () => undefined);
  await pendingSave;
}
