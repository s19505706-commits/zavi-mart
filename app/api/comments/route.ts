import { ApiError, handleApiError, isRecord, readJsonBody } from "../../../lib/api-utils";
import {
  createLocalComment,
  createLocalNotification,
  getLocalComments,
  migrateLocalCommentIdentities
} from "../../../lib/local-notifications";
import { getLocalOrders } from "../../../lib/local-orders";

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function orderMatchesProduct(order: unknown, productId: string): boolean {
  if (!isRecord(order)) return false;
  const products = Array.isArray(order.products) ? order.products : Array.isArray(order.items) ? order.items : [];
  return products.some((item) => isRecord(item) &&
    String(item.productId ?? item.id ?? "") === productId);
}

function maskContact(phone: string, email: string): string {
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const local = digits.startsWith("92") ? `0${digits.slice(2)}` : phone;
    return `${local.slice(0, 4)}xxx`;
  }
  const [name, domain] = email.split("@");
  return name && domain ? `${name.slice(0, 1)}***@${domain}` : "";
}

export async function GET(request: Request) {
  try {
    const productId = new URL(request.url).searchParams.get("productId")?.trim();
    const orders = await getLocalOrders();
    await migrateLocalCommentIdentities(orders);
    const comments = await getLocalComments(productId || undefined);
    return Response.json(
      { comments },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.warn("GET /api/comments could not read reviews; returning an empty list.", error);
    return Response.json(
      { comments: [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.productId !== "string" || !body.productId.trim() ||
        typeof body.productName !== "string" || !body.productName.trim() ||
        typeof body.customerName !== "string" || !body.customerName.trim() ||
        (typeof body.customerPhone !== "string" && typeof body.customerEmail !== "string") ||
        typeof body.comment !== "string" || !body.comment.trim() ||
        typeof body.rating !== "number" || !Number.isInteger(body.rating) ||
        body.rating < 1 || body.rating > 5) {
      throw new ApiError("Product, name, phone or email, comment, and a rating from 1 to 5 are required.", 400);
    }
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim().slice(0, 40) : "";
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().slice(0, 254) : "";
    if (!customerPhone && !customerEmail) {
      throw new ApiError("Enter the phone number or email address used for your order.", 400);
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new ApiError("Enter a valid email address.", 400);
    }
    if (customerPhone && normalizePhone(customerPhone).length < 7) {
      throw new ApiError("Enter a valid phone number.", 400);
    }
    const productId = body.productId.trim().slice(0, 160);
    const orders = await getLocalOrders();
    const isVerifiedPurchase = orders.some((order) => {
      if (!isRecord(order)) return false;
      const customer = isRecord(order.customer) ? order.customer : {};
      const orderPhone = typeof order.customerPhone === "string"
        ? order.customerPhone
        : typeof customer.phone === "string" ? customer.phone : "";
      const orderEmail = typeof order.customerEmail === "string"
        ? order.customerEmail
        : typeof customer.email === "string" ? customer.email : "";
      const phoneMatches = !!customerPhone && !!orderPhone &&
        normalizePhone(customerPhone) === normalizePhone(orderPhone);
      const emailMatches = !!customerEmail && !!orderEmail &&
        normalizeEmail(customerEmail) === normalizeEmail(orderEmail);
      return (phoneMatches || emailMatches) && orderMatchesProduct(order, productId);
    });
    const comment = await createLocalComment({
      productId,
      productName: body.productName.trim().slice(0, 160),
      customerName: body.customerName.trim().slice(0, 120),
      customerPhone,
      customerEmail,
      comment: body.comment.trim().slice(0, 2000),
      rating: body.rating,
      isVerifiedPurchase,
      purchaseClaimed: body.purchaseClaimed === true
    });
    try {
      await createLocalNotification({
        type: "new_comment",
        title: "New Product Review",
        message: `${comment.customerName} (${maskContact(customerPhone, customerEmail)}) reviewed ${comment.productName}: ${comment.comment}`,
        productName: comment.productName,
        productId: comment.productId,
        customerName: comment.customerName,
        customerPhone,
        customerEmail,
        commentId: comment.id,
        orderId: ""
      });
    } catch (notificationError) {
      console.error("Review saved, but its notification could not be created.", notificationError);
    }
    return Response.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error, "POST /api/comments failed");
    console.error("POST /api/comments failed to save the review.", error);
    return Response.json(
      { error: "Could not save your review. Please try again." },
      { status: 500 }
    );
  }
}
