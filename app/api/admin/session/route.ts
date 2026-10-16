import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  getAdminCredential,
  getAdminSessionSecret,
  matchesAdminCredential,
  readAdminSessionToken
} from "../../../../lib/admin-session";

export async function GET(request: NextRequest) {
  const session = readAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  return Response.json(
    { isAdmin: session?.role === "admin" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const reqOrigin = request.headers.get("origin") || request.headers.get("referer") || "";
  const host = request.headers.get("host") || new URL(request.url).host;
  let originUrl: URL | null = null;
  try {
    if (reqOrigin) originUrl = new URL(reqOrigin);
  } catch {
    originUrl = null;
  }

  const originHost = originUrl?.host.toLocaleLowerCase() ?? "";
  const originHostname = originUrl?.hostname.toLocaleLowerCase() ?? "";
  const requestHost = host.toLocaleLowerCase();
  const isLoopbackOrigin =
    (originHostname === "localhost" || originHostname === "127.0.0.1") &&
    originHost === requestHost &&
    originUrl?.port === "3001";
  const isPrivateNetworkOrigin =
    /^(?:192\.168|10)\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(originHost) &&
    originHost === requestHost;
  const isSameOrigin = originUrl?.origin === new URL(request.url).origin;
  const isAllowedOrigin =
    !!originUrl &&
    (originUrl.protocol === "http:" || originUrl.protocol === "https:") &&
    (isSameOrigin || isLoopbackOrigin || isPrivateNetworkOrigin);

  if (!isAllowedOrigin) {
    return Response.json({ error: "Admin sign-in requests must come from this site." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must contain valid JSON." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("key" in body) ||
    typeof body.key !== "string" ||
    !body.key.trim()
  ) {
    return Response.json({ error: "Enter the admin key." }, { status: 400 });
  }

  const expectedKey = getAdminCredential();
  if (!expectedKey || !getAdminSessionSecret()) {
    return Response.json({ error: "Admin sign-in is not configured on the server." }, { status: 500 });
  }

  if (!matchesAdminCredential(body.key, expectedKey)) {
    return Response.json({ error: "The admin key is incorrect." }, { status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const token = createAdminSessionToken(expiresAt);
  if (!token) {
    return Response.json({ error: "Admin sign-in is not configured on the server." }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });
  return response;
}
