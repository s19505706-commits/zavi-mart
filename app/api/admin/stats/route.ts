import { handleApiError, requireAdmin } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import {
  getStoredLocalMarkazProducts,
  getTrackedMarkazProducts
} from "../../../../lib/local-markaz-products";
import { getLocalOrders } from "../../../../lib/local-orders";
import { getLocalProductStore } from "../../../../lib/local-products";
import { MOCK_PRODUCTS } from "../../../../lib/mock-products";
import Order from "../../../../models/Order";
import Product from "../../../../models/Product";
import { mergeCatalogProducts } from "../../../../lib/product-catalog";

type RecordValue = Record<string, unknown>;
type ProductForMerge = {
  _id: string;
  id?: string;
  title: string;
  name?: string;
  category?: string;
  departmentId?: string | null;
  categoryId?: string | null;
  price?: number;
  costPrice?: number | null;
  wholesalePrice?: number | null;
  stock?: number;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function recordId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return isRecord(value) && typeof value.toString === "function" ? String(value) : "";
}

function orderItems(order: RecordValue): RecordValue[] {
  const items = Array.isArray(order.products) ? order.products : Array.isArray(order.items) ? order.items : [];
  return items.filter(isRecord);
}

function orderDate(order: RecordValue): Date | null {
  const value = order.createdAt ?? order.date ?? order.created ?? order.updatedAt;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function orderTotal(order: RecordValue): number {
  return Math.max(0, number(order.total ?? order.amount ?? order.grandTotal ?? order.subtotal));
}

function orderCustomer(order: RecordValue): RecordValue {
  return isRecord(order.customer) ? order.customer : {};
}

function isCancelled(status: string): boolean {
  return /cancel/.test(status);
}

function isReturned(order: RecordValue, status: string): boolean {
  return order.isReturned === true || order.returnRequested === true ||
    /return|refund/.test(status);
}

function makeProductKey(product: Partial<ProductForMerge>): string {
  return recordId(product._id ?? product.id) || text(product.title ?? product.name).toLocaleLowerCase();
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const fromValue = url.searchParams.get("from");
    const toValue = url.searchParams.get("to");
    const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
    const to = toValue ? new Date(`${toValue}T23:59:59.999`) : null;
    if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime()))) {
      return Response.json({ error: "Date filters must be valid calendar dates." }, { status: 400 });
    }

    const connection = await connectToDatabase();
    const [localOrders, databaseOrders, localProductStore, localMarkazProducts, databaseProducts] = await Promise.all([
      getLocalOrders(),
      connection ? Order.find().sort({ createdAt: -1 }).lean() : Promise.resolve([]),
      getLocalProductStore(),
      getStoredLocalMarkazProducts(),
      connection ? Product.find().lean() : Promise.resolve([])
    ]);

    const ordersById = new Map<string, RecordValue>();
    for (const order of localOrders) {
      const key = text(order.orderId ?? order.id ?? order._id);
      if (key) ordersById.set(key, order);
    }
    for (const order of databaseOrders) {
      ordersById.set(order.orderId, { ...order, _id: order._id.toString() });
    }
    const allOrders = [...ordersById.values()];
    const orders = allOrders.filter((order) => {
      const created = orderDate(order);
      return (!from || (created && created >= from)) && (!to || (created && created <= to));
    });

    const allProducts = mergeCatalogProducts<ProductForMerge>([
      databaseProducts.map((product) => ({ ...product, _id: product._id.toString() })),
      localProductStore.products,
      localMarkazProducts,
      getTrackedMarkazProducts()
    ], MOCK_PRODUCTS);
    const productsById = new Map<string, ProductForMerge>();
    const productsByName = new Map<string, ProductForMerge>();
    for (const product of allProducts) {
      const key = makeProductKey(product);
      if (key) productsById.set(key, product);
      const name = text(product.title ?? product.name).trim().toLocaleLowerCase();
      if (name) productsByName.set(name, product);
    }

    const orderFinancials = orders.map((order) => {
      const items = orderItems(order);
      const customer = orderCustomer(order);
      const status = text(order.status ?? order.orderStatus, "pending").toLocaleLowerCase();
      const total = orderTotal(order);
      const shippingCost = Math.max(0, number(
        order.shippingCost ?? order.deliveryFee ?? order.shippingFee ?? order.shipping
      ));
      const platformFee = Math.max(0, number(order.platformFee));
      const products = items.map((item) => {
        const productId = recordId(item.productId ?? item.id);
        const productName = text(item.title ?? item.name, "Product");
        const product = productsById.get(productId) ??
          productsByName.get(productName.trim().toLocaleLowerCase());
        const price = Math.max(0, number(item.price ?? item.unitPrice ?? product?.price));
        const qty = Math.max(0, number(item.qty ?? item.quantity, 1));
        const costPrice = Math.max(0, number(
          item.costPrice ?? item.wholesalePrice ?? product?.costPrice ?? product?.wholesalePrice,
          price * 0.7
        ));
        return {
          id: productId || makeProductKey(product ?? {}),
          name: productName,
          category: text(item.category ?? product?.category, "General"),
          price,
          costPrice,
          qty
        };
      });
      const productCost = products.reduce((sum, product) => sum + product.costPrice * product.qty, 0);
      const income = total || products.reduce((sum, product) => sum + product.price * product.qty, 0);
      return {
        order,
        products,
        status,
        total: income,
        productCost,
        shippingCost,
        platformFee,
        profit: income - productCost - shippingCost - platformFee,
        paymentMethod: text(order.paymentMethod ?? order.payment, "COD").toLocaleLowerCase(),
        customerName: text(order.customerName ?? customer.name, "Customer"),
        customerPhone: text(order.customerPhone ?? order.phone ?? customer.phone),
        customerEmail: text(order.customerEmail ?? customer.email),
        orderId: text(order.orderId ?? order.id ?? order._id, "Order"),
        createdAt: orderDate(order)?.toISOString() ?? ""
      };
    });

    const totalIncome = orderFinancials.reduce((sum, order) => sum + order.total, 0);
    const netIncome = orderFinancials.reduce((sum, order) => sum + order.profit, 0);
    const codOrders = orderFinancials.filter((order) =>
      order.paymentMethod === "cod" || order.paymentMethod === "cash on delivery"
    );
    const delivered = orderFinancials.filter((order) => order.status === "delivered");
    const returned = orderFinancials.filter((entry) => isReturned(entry.order, entry.status));
    const cancelled = orderFinancials.filter((order) => isCancelled(order.status));
    const pending = orderFinancials.filter((order) => order.status === "pending");
    const monthlyStart = new Date();
    monthlyStart.setDate(1);
    monthlyStart.setHours(0, 0, 0, 0);
    monthlyStart.setMonth(monthlyStart.getMonth() - 5);
    const monthlyData = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(monthlyStart.getFullYear(), monthlyStart.getMonth() + index, 1);
      const monthOrders = orderFinancials.filter((order) => {
        const date = order.createdAt ? new Date(order.createdAt) : null;
        return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
      });
      return {
        month: month.toLocaleString("en", { month: "short" }),
        revenue: monthOrders.reduce((sum, order) => sum + order.total, 0),
        income: monthOrders.reduce((sum, order) => sum + order.total - order.shippingCost, 0),
        profit: monthOrders.reduce((sum, order) => sum + order.profit, 0)
      };
    });

    const categorySales = new Map<string, number>();
    const productSales = new Map<string, {
      id: string;
      name: string;
      category: string;
      quantity: number;
      revenue: number;
      profit: number;
    }>();
    for (const order of orderFinancials) {
      for (const product of order.products) {
        categorySales.set(product.category, (categorySales.get(product.category) ?? 0) + product.price * product.qty);
        const key = product.id || product.name.toLocaleLowerCase();
        const current = productSales.get(key) ?? {
          id: product.id,
          name: product.name,
          category: product.category,
          quantity: 0,
          revenue: 0,
          profit: 0
        };
        current.quantity += product.qty;
        current.revenue += product.price * product.qty;
        current.profit += (product.price - product.costPrice) * product.qty;
        productSales.set(key, current);
      }
    }

    const uniqueProducts = new Map<string, ProductForMerge>();
    for (const product of allProducts) {
      const key = makeProductKey(product);
      if (key) uniqueProducts.set(key, product);
    }
    const lowStock = [...uniqueProducts.values()]
      .filter((product) => number(product.stock) < 10)
      .map((product) => ({
        id: makeProductKey(product),
        name: text(product.title ?? product.name, "Product"),
        category: text(product.category, "General"),
        stock: number(product.stock),
        price: number(product.price)
      }))
      .sort((left, right) => left.stock - right.stock)
      .slice(0, 8);

    const customerOrders = new Map<string, number>();
    const customerFirstOrder = new Map<string, number>();
    for (const order of orderFinancials) {
      const customer = order.customerEmail.toLocaleLowerCase() || order.customerPhone || order.customerName;
      if (!customer) continue;
      customerOrders.set(customer, (customerOrders.get(customer) ?? 0) + 1);
      const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
      customerFirstOrder.set(customer, Math.min(customerFirstOrder.get(customer) ?? Infinity, orderTime));
    }
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const codTotal = codOrders.reduce((sum, order) => sum + order.total, 0);
    const codCollected = delivered
      .filter((order) => order.paymentMethod === "cod" || order.paymentMethod === "cash on delivery")
      .reduce((sum, order) => sum + order.total, 0);

    return Response.json({
      summary: {
        totalIncome,
        netIncome,
        totalRevenue: totalIncome,
        profitMargin: totalIncome ? netIncome / totalIncome * 100 : 0,
        totalOrders: orderFinancials.length,
        returns: returned.length,
        pendingOrders: pending.length,
        codOrders: codOrders.length,
        delivered: delivered.length,
        cancelled: cancelled.length,
        avgOrderValue: orderFinancials.length ? totalIncome / orderFinancials.length : 0
      },
      monthlyData,
      salesByCategory: [...categorySales].map(([name, value]) => ({ name, value })),
      topSellingProducts: [...productSales.values()]
        .sort((left, right) => right.quantity - left.quantity)
        .slice(0, 6),
      recentOrders: orderFinancials.slice(0, 8).map((order) => ({
        orderId: order.orderId,
        customerName: order.customerName,
        total: order.total,
        profit: order.profit,
        status: order.status,
        createdAt: order.createdAt
      })),
      lowStock,
      codStats: {
        orders: codOrders.length,
        total: codTotal,
        collected: codCollected,
        pending: Math.max(0, codTotal - codCollected),
        collectionRate: codTotal ? codCollected / codTotal * 100 : 0
      },
      customerStats: {
        total: customerOrders.size,
        repeat: [...customerOrders.values()].filter((count) => count > 1).length,
        newThisMonth: [...customerFirstOrder.values()].filter((time) => time >= thirtyDaysAgo).length
      },
      generatedAt: new Date().toISOString()
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/stats failed");
  }
}
