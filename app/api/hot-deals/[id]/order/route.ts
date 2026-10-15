import { randomUUID } from "node:crypto";
import { ApiError, handleApiError, isRecord, readJsonBody } from "../../../../../lib/api-utils";
import { createLocalNotification } from "../../../../../lib/local-notifications";
import { saveLocalOrder } from "../../../../../lib/local-orders";
import { getHotDeals } from "../../../../../lib/hot-deals";
import { getShippingSettings } from "../../../../../lib/shippingSettings";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deal = (await getHotDeals()).find((item) => item.id === id);
    if (!deal || deal.dealType !== "bundle" || !deal.isActive ||
        (deal.validTill && Date.parse(deal.validTill) <= Date.now())) {
      throw new ApiError("This bundle deal is no longer available.", 404);
    }
    const body = await readJsonBody(request);
    if (!isRecord(body) || !isRecord(body.customer)) {
      throw new ApiError("Enter your delivery details to place this order.", 400);
    }
    const customer = body.customer;
    const customerName = typeof customer.name === "string" ? customer.name.trim().slice(0, 100) : "";
    const customerPhone = typeof customer.phone === "string" ? customer.phone.trim().slice(0, 24) : "";
    const address = typeof customer.address === "string" ? customer.address.trim().slice(0, 240) : "";
    const city = typeof customer.city === "string" ? customer.city.trim().slice(0, 100) : "";
    if (!customerName || !/^[+0-9()\s-]{7,24}$/.test(customerPhone) || !address || !city) {
      throw new ApiError("Enter a valid name, phone number, street address, and city.", 400);
    }

    const shippingSettings = await getShippingSettings();
    const shipping = shippingSettings.freeDeliveryEnabled &&
      deal.dealPrice >= shippingSettings.minAmountForFree
      ? 0
      : shippingSettings.shippingFee;
    const orderId = `ZM-BUNDLE-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    let allocatedTotal = 0;
    const products = deal.products.map((product, index) => {
      const price = index === deal.products.length - 1
        ? deal.dealPrice - allocatedTotal
        : Math.floor(deal.dealPrice * product.originalPrice / deal.originalTotalPrice);
      allocatedTotal += price;
      return {
        productId: product.productId,
        name: product.title,
        price,
        qty: 1,
        image: product.image
      };
    });
    const now = new Date().toISOString();
    const total = deal.dealPrice + shipping;
    await saveLocalOrder({
      id: orderId,
      orderId,
      customerName,
      customerPhone,
      customer: {
        name: customerName,
        phone: customerPhone,
        address,
        city
      },
      products,
      subtotal: deal.dealPrice,
      shipping,
      amount: total,
      total,
      paymentMethod: "cod",
      paymentStatus: "pay_on_delivery",
      status: "pending",
      orderStatus: "confirmed",
      hotDealId: deal.id,
      bundleTitle: deal.bundleTitle,
      createdAt: now,
      date: now
    });
    try {
      await createLocalNotification({
        type: "new_order",
        title: "New Bundle Order Received",
        message: `Bundle order ${orderId} by ${customerName} - Rs ${total.toLocaleString("en-PK")}`,
        productName: deal.bundleTitle,
        productId: deal.id,
        customerName,
        customerPhone,
        orderId
      });
    } catch (error) {
      console.error(`Bundle order ${orderId} was saved, but its notification could not be created.`, error);
    }
    return Response.json({ success: true, orderId, amount: total }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/hot-deals/[id]/order failed");
  }
}
