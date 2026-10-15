import { handleApiError, requireAdmin } from "../../../lib/api-utils";
import { getLocalOrders } from "../../../lib/local-orders";
import { migrateLocalCommentIdentities, type LocalComment } from "../../../lib/local-notifications";

type RawRecord = Record<string, unknown>;
type CustomerOrder = {
  id: string;
  date: string;
  total: number;
  status: string;
  products: Array<{ id: string; name: string; price: number; qty: number; image: string }>;
};

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function dateValue(record: RawRecord): string {
  return stringValue(record.date || record.createdAt);
}

function contactValues(record: RawRecord) {
  const customer = isRecord(record.customer) ? record.customer : {};
  return {
    name: stringValue(record.customerName || customer.name),
    phone: stringValue(record.customerPhone || customer.phone),
    email: stringValue(record.customerEmail || customer.email)
  };
}

function identityKeys(record: RawRecord): string[] {
  const contact = contactValues(record);
  const keys: string[] = [];
  const phone = normalizePhone(contact.phone);
  const email = normalizeEmail(contact.email);
  if (phone) keys.push(`phone:${phone}`);
  if (email) keys.push(`email:${email}`);
  return keys;
}

function parseProducts(value: unknown): CustomerOrder["products"] {
  const products = Array.isArray(value) ? value : [];
  return products.flatMap((item): CustomerOrder["products"] => {
    if (!isRecord(item)) return [];
    const qty = Number(item.qty ?? item.quantity ?? 1);
    const price = Number(item.price ?? item.unitPrice ?? 0);
    if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(price) || price < 0) return [];
    return [{
      id: stringValue(item.productId || item.id),
      name: stringValue(item.name || item.title) || "Product",
      price,
      qty,
      image: stringValue(item.image)
    }];
  });
}

function serializeComment(comment: LocalComment) {
  return {
    id: comment.id,
    productId: comment.productId,
    productName: comment.productName,
    customerName: comment.customerName,
    customerPhone: comment.customerPhone || "",
    customerEmail: comment.customerEmail || "",
    comment: comment.comment,
    rating: comment.rating,
    isVerifiedPurchase: comment.isVerifiedPurchase === true,
    createdAt: comment.createdAt,
    adminReply: comment.adminReply || "",
    adminReplyDate: comment.adminReplyDate || ""
  };
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const rawOrders = (await getLocalOrders()).filter(isRecord);
    const comments = await migrateLocalCommentIdentities(rawOrders);
    const activity: Array<{ kind: "order"; value: RawRecord } | { kind: "comment"; value: LocalComment }> = [
      ...rawOrders.map((value) => ({ kind: "order" as const, value })),
      ...comments.map((value) => ({ kind: "comment" as const, value }))
    ];
    const parents = activity.map((_, index) => index);
    const find = (index: number): number => {
      if (parents[index] !== index) parents[index] = find(parents[index]);
      return parents[index];
    };
    const union = (left: number, right: number) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
    };
    const identityOwners = new Map<string, number>();

    activity.forEach(({ value }, index) => {
      for (const key of identityKeys(value)) {
        const owner = identityOwners.get(key);
        if (owner === undefined) identityOwners.set(key, index);
        else union(index, owner);
      }
    });

    const groupedActivity = new Map<number, typeof activity>();
    activity.forEach((entry, index) => {
      if (!identityKeys(entry.value).length) return;
      const root = find(index);
      const group = groupedActivity.get(root) ?? [];
      group.push(entry);
      groupedActivity.set(root, group);
    });

    const now = Date.now();
    const newCustomerCutoff = now - 7 * 24 * 60 * 60 * 1000;
    const customers = [...groupedActivity.values()].map((group) => {
      const orderRecords = group
        .filter((entry): entry is { kind: "order"; value: RawRecord } => entry.kind === "order")
        .map(({ value }) => value);
      const customerOrders = orderRecords.map((order): CustomerOrder => {
        const amount = Number(order.total ?? order.amount ?? order.subtotal ?? 0);
        return {
          id: stringValue(order.orderId || order.id || order._id),
          date: dateValue(order),
          total: Number.isFinite(amount) && amount >= 0 ? amount : 0,
          status: stringValue(order.status || order.orderStatus) || "pending",
          products: parseProducts(order.products || order.items)
        };
      }).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
      const customerComments = group
        .filter((entry): entry is { kind: "comment"; value: LocalComment } => entry.kind === "comment")
        .map(({ value }) => serializeComment(value))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      const dates = customerOrders
        .map((order) => new Date(order.date).getTime())
        .filter(Number.isFinite);
      const firstOrderTime = dates.length ? Math.min(...dates) : null;
      const lastOrderTime = dates.length ? Math.max(...dates) : null;
      const latestActivity = group
        .slice()
        .sort((left, right) => new Date(dateValue(right.value)).getTime() - new Date(dateValue(left.value)).getTime());
      const latestContact = latestActivity.map(({ value }) => contactValues(value));
      const phone = latestContact.find((value) => value.phone)?.phone || "";
      const email = latestContact.find((value) => value.email)?.email || "";
      const name = latestContact.find((value) => value.name)?.name || "Customer";
      const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);

      return {
        id: phone || email,
        name,
        email,
        phone,
        totalOrders: customerOrders.length,
        totalSpent,
        firstOrderDate: firstOrderTime === null ? "" : new Date(firstOrderTime).toISOString(),
        lastOrderDate: lastOrderTime === null ? "" : new Date(lastOrderTime).toISOString(),
        isNew: firstOrderTime !== null && firstOrderTime >= newCustomerCutoff && firstOrderTime <= now,
        orders: customerOrders,
        comments: customerComments
      };
    }).sort((left, right) => right.totalSpent - left.totalSpent);

    return Response.json(
      { customers },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return handleApiError(error, "GET /api/customers failed");
  }
}
