import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const notificationsFile = path.join(dataDirectory, "notifications.json");
const commentsFile = path.join(dataDirectory, "comments.json");
let writeQueue = Promise.resolve();

export type NotificationType = "new_order" | "new_comment" | "low_stock";

export type LocalNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  productName: string;
  productId?: string;
  customerName: string;
  orderId: string;
  customerPhone?: string;
  customerEmail?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: string;
};

export type LocalComment = {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  comment: string;
  rating: number;
  isVerifiedPurchase?: boolean;
  purchaseClaimed?: boolean;
  createdAt: string;
  adminReply?: string;
  adminReplyDate?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function commentContactMatchesOrder(comment: LocalComment, order: unknown): boolean {
  if (!isRecord(order)) return false;
  const customer = isRecord(order.customer) ? order.customer : {};
  const phone = typeof order.customerPhone === "string"
    ? order.customerPhone
    : typeof customer.phone === "string" ? customer.phone : "";
  const email = typeof order.customerEmail === "string"
    ? order.customerEmail
    : typeof customer.email === "string" ? customer.email : "";
  const phoneMatches = !!comment.customerPhone && !!phone &&
    normalizePhone(comment.customerPhone) === normalizePhone(phone);
  const emailMatches = !!comment.customerEmail && !!email &&
    normalizeEmail(comment.customerEmail) === normalizeEmail(email);
  return phoneMatches || emailMatches;
}

function orderContainsProduct(order: unknown, productId: string): boolean {
  if (!isRecord(order)) return false;
  const products = Array.isArray(order.products) ? order.products : Array.isArray(order.items) ? order.items : [];
  return products.some((product) => isRecord(product) &&
    String(product.productId ?? product.id ?? "") === productId);
}

async function readArray<T>(file: string, label: string): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    await writeArray(file, []);
    return [];
  }

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.warn(`${label} contains invalid JSON; resetting it to an empty array.`, error);
    await writeArray(file, []);
    return [];
  }

  if (!Array.isArray(value)) {
    console.warn(`${label} does not contain a JSON array; resetting it to an empty array.`);
    await writeArray(file, []);
    return [];
  }
  return value as T[];
}

async function writeArray<T>(file: string, value: T[]): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = path.join(dataDirectory, `${path.basename(file, ".json")}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryFile, file);
  } catch (error) {
    try {
      await unlink(temporaryFile);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error(`Could not remove temporary ${path.basename(file)} file.`, cleanupError);
      }
    }
    throw error;
  }
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const pending = writeQueue.then(operation);
  writeQueue = pending.then(() => undefined, () => undefined);
  return pending;
}

export async function getLocalNotifications(unreadOnly = false): Promise<LocalNotification[]> {
  const notifications = await readArray<LocalNotification>(notificationsFile, ".data/notifications.json");
  return notifications
    .filter((notification) => !unreadOnly || !notification.isRead)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function createLocalNotification(
  input: Omit<LocalNotification, "id" | "isRead" | "createdAt"> & Partial<Pick<LocalNotification, "id" | "isRead" | "createdAt">>
): Promise<LocalNotification> {
  return serialize(async () => {
    const notifications = await readArray<LocalNotification>(notificationsFile, ".data/notifications.json");
    const notification: LocalNotification = {
      id: input.id || randomUUID(),
      type: input.type,
      title: input.title,
      message: input.message,
      productName: input.productName,
      ...(input.productId ? { productId: input.productId } : {}),
      customerName: input.customerName,
      orderId: input.orderId,
      ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
      ...(input.commentId ? { commentId: input.commentId } : {}),
      isRead: input.isRead ?? false,
      createdAt: input.createdAt || new Date().toISOString()
    };
    await writeArray(notificationsFile, [notification, ...notifications]);
    return notification;
  });
}

export async function markLocalNotificationsRead(id?: string): Promise<number> {
  return serialize(async () => {
    const notifications = await readArray<LocalNotification>(notificationsFile, ".data/notifications.json");
    let updated = 0;
    const next = notifications.map((notification) => {
      if ((!id || notification.id === id) && !notification.isRead) {
        updated += 1;
        return { ...notification, isRead: true };
      }
      return notification;
    });
    if (updated) await writeArray(notificationsFile, next);
    return updated;
  });
}

export async function deleteLocalNotification(id: string): Promise<boolean> {
  return serialize(async () => {
    const notifications = await readArray<LocalNotification>(notificationsFile, ".data/notifications.json");
    const next = notifications.filter((notification) => notification.id !== id);
    if (next.length === notifications.length) return false;
    await writeArray(notificationsFile, next);
    return true;
  });
}

export async function getLocalComments(productId?: string): Promise<LocalComment[]> {
  const comments = await readArray<LocalComment>(commentsFile, ".data/comments.json");
  return comments
    .filter((comment) => !productId || comment.productId === productId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function createLocalComment(
  input: Omit<LocalComment, "id" | "createdAt"> & Partial<Pick<LocalComment, "id" | "createdAt">>
): Promise<LocalComment> {
  return serialize(async () => {
    const comments = await readArray<LocalComment>(commentsFile, ".data/comments.json");
    const comment: LocalComment = {
      ...input,
      id: input.id || randomUUID(),
      createdAt: input.createdAt || new Date().toISOString()
    };
    await writeArray(commentsFile, [comment, ...comments]);
    return comment;
  });
}

export async function migrateLocalCommentIdentities(orders: unknown[]): Promise<LocalComment[]> {
  return serialize(async () => {
    const comments = await readArray<LocalComment>(commentsFile, ".data/comments.json");
    let changed = false;
    const migrated = comments.map((comment) => {
      const hasPhone = typeof comment.customerPhone === "string" && !!comment.customerPhone.trim();
      const hasEmail = typeof comment.customerEmail === "string" && !!comment.customerEmail.trim();
      let candidateOrders = orders.filter((order) => {
        if (!isRecord(order)) return false;
        const customer = isRecord(order.customer) ? order.customer : {};
        const orderName = typeof order.customerName === "string"
          ? order.customerName
          : typeof customer.name === "string" ? customer.name : "";
        return !!orderName && orderName.trim().toLocaleLowerCase() === comment.customerName.trim().toLocaleLowerCase();
      });

      if (hasPhone || hasEmail) {
        candidateOrders = orders.filter((order) => commentContactMatchesOrder(comment, order));
      } else {
        const identities = new Set(candidateOrders.map((order) => {
          if (!isRecord(order)) return "";
          const customer = isRecord(order.customer) ? order.customer : {};
          const phone = typeof order.customerPhone === "string"
            ? order.customerPhone
            : typeof customer.phone === "string" ? customer.phone : "";
          const email = typeof order.customerEmail === "string"
            ? order.customerEmail
            : typeof customer.email === "string" ? customer.email : "";
          return normalizePhone(phone)
            ? `phone:${normalizePhone(phone)}`
            : normalizeEmail(email) ? `email:${normalizeEmail(email)}` : "";
        }).filter(Boolean));
        if (identities.size !== 1) candidateOrders = [];
      }

      let customerPhone = comment.customerPhone ?? "";
      let customerEmail = comment.customerEmail ?? "";
      if ((!hasPhone || !hasEmail) && candidateOrders.length) {
        const matchingOrder = candidateOrders
          .slice()
          .sort((left, right) => {
            const leftDate = isRecord(left) ? Date.parse(String(left.date ?? left.createdAt ?? "")) : 0;
            const rightDate = isRecord(right) ? Date.parse(String(right.date ?? right.createdAt ?? "")) : 0;
            return rightDate - leftDate;
          })
          .find(isRecord);
        if (matchingOrder) {
          const customer = isRecord(matchingOrder.customer) ? matchingOrder.customer : {};
          if (!hasPhone) {
            customerPhone = typeof matchingOrder.customerPhone === "string"
              ? matchingOrder.customerPhone
              : typeof customer.phone === "string" ? customer.phone : "";
          }
          if (!hasEmail) {
            customerEmail = typeof matchingOrder.customerEmail === "string"
              ? matchingOrder.customerEmail
              : typeof customer.email === "string" ? customer.email : "";
          }
        }
      }

      const updated: LocalComment = {
        ...comment,
        customerPhone,
        customerEmail,
        isVerifiedPurchase: candidateOrders.some((order) => orderContainsProduct(order, comment.productId))
      };
      if (updated.customerPhone !== comment.customerPhone ||
          updated.customerEmail !== comment.customerEmail ||
          updated.isVerifiedPurchase !== comment.isVerifiedPurchase) changed = true;
      return updated;
    });
    if (changed) await writeArray(commentsFile, migrated);
    return migrated;
  });
}

export async function updateLocalCommentReply(
  commentId: string,
  adminReply: string,
  adminReplyDate: string
): Promise<LocalComment | null> {
  return serialize(async () => {
    const comments = await readArray<LocalComment>(commentsFile, ".data/comments.json");
    const index = comments.findIndex((comment) => comment.id === commentId);
    if (index < 0) return null;
    const updated = { ...comments[index], adminReply, adminReplyDate };
    const next = [...comments];
    next[index] = updated;
    await writeArray(commentsFile, next);
    return updated;
  });
}
