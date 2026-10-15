import mongoose from "mongoose";
import { ApiError, handleApiError, isRecord, requireAdmin, readJsonBody } from "../../../../lib/api-utils";
import { connectToDatabase } from "../../../../lib/mongodb";
import { markLocalOrderOrderedOnMarkaz, updateLocalOrderStatus } from "../../../../lib/local-orders";
import Order from "../../../../models/Order";

type RouteContext = { params: Promise<{ id: string }> };
const orderStatuses = ["pending", "processing", "confirmed", "shipped", "delivered"] as const;

export async function PUT(request: Request, { params }: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id.trim()) throw new ApiError("Order id is required.", 400);
    const body = await readJsonBody(request);
    const connection = await connectToDatabase();
    if (isRecord(body) && body.supplierOrderedOnMarkaz === true) {
      const supplierOrderedAt = new Date();
      const databaseOrder = connection
        ? await Order.findOneAndUpdate(
            mongoose.isValidObjectId(id) ? { _id: id } : { orderId: id },
            { supplierOrderedOnMarkaz: true, supplierOrderedAt },
            { new: true, runValidators: true }
          )
        : null;
      const localOrder = await markLocalOrderOrderedOnMarkaz(id);
      if (!databaseOrder && !localOrder) {
        return Response.json({ error: "Order not found." }, { status: 404 });
      }
      return Response.json({
        order: databaseOrder
          ? { ...databaseOrder.toObject(), _id: databaseOrder._id.toString() }
          : localOrder
      });
    }

    if (!isRecord(body) || typeof body.status !== "string" ||
        !orderStatuses.includes(body.status as (typeof orderStatuses)[number])) {
      throw new ApiError("Provide a valid order status or supplierOrderedOnMarkaz: true.", 400);
    }

    const update: Record<string, unknown> = { status: body.status };
    if (body.status === "delivered") {
      update.deliveredAt = new Date();
    } else {
      update.$unset = { deliveredAt: 1 };
    }
    const databaseOrder = connection
      ? await Order.findOneAndUpdate(
          mongoose.isValidObjectId(id) ? { _id: id } : { orderId: id },
          update,
          { new: true, runValidators: true }
        )
      : null;
    const localOrder = await updateLocalOrderStatus(id, body.status);
    if (!databaseOrder && !localOrder) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    return Response.json({
      order: databaseOrder
        ? { ...databaseOrder.toObject(), _id: databaseOrder._id.toString() }
        : localOrder
    });
  } catch (error) {
    return handleApiError(error, "PUT /api/orders/[id] failed");
  }
}
