import { timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import {
  ADMIN_SESSION_COOKIE,
  getAdminCredential,
  readAdminSessionToken
} from "./admin-session";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError("Request body must contain valid JSON.", 400);
  }
}

export function requireAdmin(
  request: Request,
  _fallbackAdminKey?: string,
  bodyAdminKey?: unknown
): Response | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const sessionCookie = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  const sessionToken = sessionCookie?.slice(ADMIN_SESSION_COOKIE.length + 1);
  if (readAdminSessionToken(sessionToken)?.role === "admin") return null;

  const adminKey = getAdminCredential();
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedKey = request.headers.get("x-admin-key")?.trim() ||
    (authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : authorization).trim() ||
    (typeof bodyAdminKey === "string" ? bodyAdminKey.trim() : "");
  const expected = Buffer.from(adminKey);
  const supplied = Buffer.from(suppliedKey);

  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return Response.json({ error: "Admin authentication is required." }, { status: 401 });
  }

  return null;
}

export function parseLimit(value: string | null, fallback = 50): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError("limit must be a positive integer.", 400);
  }
  return Math.min(parsed, 100);
}

export function handleApiError(error: unknown, context: string): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    return Response.json({ error: "A record with that unique value already exists." }, { status: 409 });
  }

  if (error instanceof Error && error.message === "MONGODB_URI is not configured.") {
    return Response.json({ error: "The database service is not configured." }, { status: 503 });
  }

  if (
    error instanceof Error &&
    ["MongooseServerSelectionError", "MongoNetworkError", "MongoTopologyClosedError"].includes(error.name)
  ) {
    console.error(`${context}: MongoDB is unavailable.`, error);
    return Response.json({ error: "The database service is temporarily unavailable." }, { status: 503 });
  }

  console.error(`${context}:`, error);
  return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
