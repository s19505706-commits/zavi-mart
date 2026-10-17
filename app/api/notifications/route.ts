import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../lib/api-utils";
import {
  createLocalNotification,
  deleteLocalNotification,
  getLocalNotifications,
  markLocalNotificationsRead
} from "../../../lib/local-notifications";

const notificationTypes = ["new_order", "new_comment", "low_stock"] as const;

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    const notifications = await getLocalNotifications(unreadOnly);
    return Response.json(
      { notifications },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return handleApiError(error, "GET /api/notifications failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.type !== "string" ||
        !notificationTypes.includes(body.type as (typeof notificationTypes)[number]) ||
        typeof body.title !== "string" || !body.title.trim() ||
        typeof body.message !== "string" || !body.message.trim()) {
      throw new ApiError("type, title, and message are required.", 400);
    }
    const notification = await createLocalNotification({
      type: body.type as (typeof notificationTypes)[number],
      title: body.title.trim().slice(0, 120),
      message: body.message.trim().slice(0, 500),
      productName: typeof body.productName === "string" ? body.productName.trim().slice(0, 160) : "",
      ...(typeof body.productId === "string" && body.productId.trim()
        ? { productId: body.productId.trim().slice(0, 160) }
        : {}),
      customerName: typeof body.customerName === "string" ? body.customerName.trim().slice(0, 120) : "",
      orderId: typeof body.orderId === "string" ? body.orderId.trim().slice(0, 120) : ""
    });
    return Response.json({ notification }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/notifications failed");
  }
}

export async function PUT(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || (body.id !== undefined && typeof body.id !== "string") ||
        (body.markAllRead !== undefined && body.markAllRead !== true) ||
        (!body.id && body.markAllRead !== true)) {
      throw new ApiError("Provide id or markAllRead: true.", 400);
    }
    const updated = await markLocalNotificationsRead(typeof body.id === "string" ? body.id : undefined);
    return Response.json({ updated });
  } catch (error) {
    return handleApiError(error, "PUT /api/notifications failed");
  }
}

export async function DELETE(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.id !== "string" || !body.id.trim()) {
      throw new ApiError("Notification id is required.", 400);
    }
    const deleted = await deleteLocalNotification(body.id);
    if (!deleted) throw new ApiError("Notification not found.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/notifications failed");
  }
}
