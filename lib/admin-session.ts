import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "zavimart-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ADMIN_ACCESS_KEY || "zavi123";

console.log(
  "[ADMIN] ENV KEY exists:",
  !!process.env.ADMIN_KEY,
  "length:",
  process.env.ADMIN_KEY?.length
);

export type AdminSession = {
  role: string;
  expiresAt: number;
};

export function getAdminSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

export function getAdminCredential(): string {
  return ADMIN_KEY;
}

export function matchesAdminCredential(supplied: string, expected: string): boolean {
  const suppliedBytes = Buffer.from(supplied.trim());
  const expectedBytes = Buffer.from(expected.trim());
  return suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes);
}

export function createAdminSessionToken(expiresAt: number): string | null {
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const payload = Buffer.from(JSON.stringify({ role: "admin", expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readAdminSessionToken(token: string | undefined): AdminSession | null {
  const secret = getAdminSessionSecret();
  if (!secret || !token) return null;

  const [payload, signature, ...extraParts] = token.split(".");
  if (
    !payload ||
    !signature ||
    extraParts.length > 0 ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  const suppliedSignature = Buffer.from(signature, "base64url");
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("role" in parsed) ||
      typeof parsed.role !== "string" ||
      !("expiresAt" in parsed) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isInteger(parsed.expiresAt) ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { role: parsed.role, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}
