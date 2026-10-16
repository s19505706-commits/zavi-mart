import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from "./lib/admin-session";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login") return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    // API handlers perform authorization, preserving their JSON responses and
    // support for legacy admin-key clients.
    return NextResponse.next();
  }

  const session = readAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (session.role !== "admin") {
    const homeUrl = new URL("/", request.url);
    homeUrl.searchParams.set("message", "Access Denied");
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
