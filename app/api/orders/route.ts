import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, requireAdmin, readJsonBody } from "../../../lib/api-utils";
import { connectToDatabase } from "../../../lib/mongodb";
import Order from "../../../models/Order";
import Product from "../../../models/Product";

type RequestedProduct = { productId: string; qty: number };
type CustomerDetails = { name: string; phone: string; address: string; city: string };

function parseOrderBody(value: unknown): { products: RequestedProduct[]; customer: CustomerDetails } {
  if (!isRecord(value)) throw new ApiError("Order data must be a JSON object.", 400);
  if (value.paymentMethod !== undefined && value.paymentMethod !== "COD") {
    throw new ApiError("Only cash on delivery (COD) is supported.", 400);
  }
  if (!Array.isArray(value.products) || value.products.length === 0 || value.products.length > 50) {
    throw new ApiError("products must contain between 1 and 50 items.", 400);
  }

  const products = value.products.map((item): RequestedProduct => {
    if (!isRecord(item) || typeof item.productId !== "string" || !mongoose.isValidObjectId(item.productId)) {
      throw new ApiError("Each product requires a valid productId.", 400);
    }
    const qty = item.qty ?? item.quantity;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      throw new ApiError("Each product qty must be an integer from 1 to 100.", 400);
    }
    return { productId: item.productId, qty };
  });

  if (!isRecord(value.customer)) throw new ApiError("customer details are required.", 400);
  const customerFields = ["name", "phone", "address", "city"] as const;
  const customer = {} as CustomerDetails;
  for (const field of customerFields) {
    const entry = value.customer[field];
    if (typeof entry !== "string" || !entry.trim()) {
      throw new ApiError(`customer.${field} is required.`, 400);
    }
    customer[field] = entry.trim();
  }

  return { products, customer };
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const connection = await connectToDatabase();
    if (!connection) throw new ApiError("Order listing requires a configured MongoDB database.", 503);

    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    return Response.json({
      orders: orders.map((order) => ({ ...order, _id: order._id.toString() }))
    });
  } catch (error) {
    return handleApiError(error, "GET /api/orders failed");
  }
}

export async function POST(request: Request) {
  try {
    const { products: requestedProducts, customer } = parseOrderBody(await readJsonBody(request));
    const connection = await connectToDatabase();
    if (!connection) throw new ApiError("Order creation requires a configured MongoDB database.", 503);

    const quantities = new Map<string, number>();
    for (const item of requestedProducts) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
    }

    const productIds = [...quantities.keys()];
    const foundProducts = await Product.find({ _id: { $in: productIds } });
    const productsById = new Map(foundProducts.map((product) => [product._id.toString(), product]));
    const orderProducts = productIds.map((productId) => {
      const product = productsById.get(productId);
      const qty = quantities.get(productId)!;
      if (!product) throw new ApiError(`Product ${productId} was not found.`, 404);
      if (product.stock < qty) {
        throw new ApiError(`Insufficient stock for ${product.title}.`, 409);
      }
      return {
        productId: product._id,
        title: product.title,
        price: product.price,
        qty,
        image: product.images[0] ?? "",
        isMarkazProduct: product.isMarkazProduct,
        markazProductId: product.markazProductId ?? "",
        wholesalePrice: product.wholesalePrice,
        profit: product.isMarkazProduct ? product.price - (product.wholesalePrice ?? product.price) : 0,
        supplier: product.supplier
      };
    });

    const subtotal = orderProducts.reduce((sum, product) => sum + product.price * product.qty, 0);
    const profit = orderProducts.reduce((sum, product) => sum + product.profit * product.qty, 0);
    const deliveryFee = subtotal > 2999 ? 0 : 299;
    const order = await Order.create({
      orderId: `ZM-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`,
      products: orderProducts,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      profit,
      customer,
      paymentMethod: "COD"
    });

    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/orders failed");
  }
}
