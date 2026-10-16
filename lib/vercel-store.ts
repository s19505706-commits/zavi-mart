import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./api-utils";
import { connectToDatabase } from "./mongodb";
import StoreData from "../models/StoreData";

let ephemeralWarningShown = false;

export function getStoreDirectory(): string {
  return path.join(process.env.VERCEL === "1" ? "/tmp" : process.cwd(), ".data");
}

export function getStoreFilePath(fileName: string): string {
  return path.join(getStoreDirectory(), fileName);
}

export function isProductionLocalWritesBlocked(): boolean {
  return process.env.VERCEL === "1" &&
    (process.env.VERCEL_ENV
      ? process.env.VERCEL_ENV === "production"
      : process.env.NODE_ENV === "production") &&
    !process.env.MONGODB_URI?.trim();
}

function getStoreKey(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function warnAboutEphemeralStorage(): void {
  if (process.env.VERCEL === "1" && !process.env.MONGODB_URI?.trim() && !ephemeralWarningShown) {
    const environment = process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === "production" ? "production" : "development");
    console.warn(
      `MongoDB persistence is not configured on Vercel ${environment}; /tmp storage is ephemeral and will not survive a redeploy.`
    );
    ephemeralWarningShown = true;
  }
}

export function assertLocalStoreWritesAllowed(_storeName: string): void {
  warnAboutEphemeralStorage();
  if (isProductionLocalWritesBlocked()) {
    throw new ApiError("Configure MONGODB_URI for production persistence", 503);
  }
}

export async function readStoreJson(
  filePath: string
): Promise<{ exists: boolean; value?: unknown }> {
  const connection = await connectToDatabase();
  const key = getStoreKey(filePath);

  if (connection) {
    const stored = await StoreData.findOne({ key }).lean();
    if (stored) return { exists: true, value: stored.value };
  } else {
    warnAboutEphemeralStorage();
  }

  let value: unknown;
  try {
    value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { exists: false };
    }
    throw error;
  }

  if (connection) {
    await StoreData.findOneAndUpdate(
      { key },
      { $setOnInsert: { value } },
      { upsert: true, runValidators: true }
    );
  }
  return { exists: true, value };
}

export async function writeStoreJson(filePath: string, value: unknown): Promise<void> {
  const connection = await connectToDatabase();
  const key = getStoreKey(filePath);

  if (connection) {
    await StoreData.findOneAndUpdate(
      { key },
      { $set: { value } },
      { upsert: true, new: true, runValidators: true }
    );
    return;
  }

  assertLocalStoreWritesAllowed(path.basename(filePath, ".json"));
  warnAboutEphemeralStorage();
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryFile = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, ".json")}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryFile, filePath);
  } catch (error) {
    await unlink(temporaryFile).catch((cleanupError: unknown) => {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error(`Could not remove temporary ${path.basename(filePath)} file.`, cleanupError);
      }
    });
    throw error;
  }
}
