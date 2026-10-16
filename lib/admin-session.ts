import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "zavimart-admin-session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
let developmentFallbackWarningShown = false;
let missingAdminCredentialErrorShown = false;
let missingAdminSessionSecretErrorShown = false;

export type AdminSession = {
  role: string;
  expiresAt: number;
};

export function getAdminSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret && Buffer.byteLength(secret) >= 32) return secret;
  if (process.env.VERCEL === "1" && !missingAdminSessionSecretErrorShown) {
    console.error("ADMIN_SESSION_SECRET is missing or must be at least 32 bytes on Vercel.");
    missingAdminSessionSecretErrorShown = true;
  }
  return null;
}

export function getAdminCredential(): string | null {
  const configuredKey = process.env.ADMIN_KEY?.trim() || process.env.ADMIN_ACCESS_KEY?.trim();
  if (configuredKey) return configuredKey;
  if (process.env.VERCEL === "1") {
    if (!missingAdminCredentialErrorShown) {
      console.error("ADMIN_KEY or ADMIN_ACCESS_KEY is not configured on Vercel.");
      missingAdminCredentialErrorShown = true;
    }
    return null;
  }
  if (!developmentFallbackWarningShown) {
    console.warn("ADMIN_KEY is not configured; using the development-only admin credential.");
    developmentFallbackWarningShown = true;
  }
  return "zavi123";
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
