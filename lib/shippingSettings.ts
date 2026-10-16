import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type ShippingSettings = {
  freeDeliveryEnabled: boolean;
  minAmountForFree: number;
  shippingFee: number;
  bannerText: string;
  updatedAt: string;
};

export const defaultShipping: ShippingSettings = {
  freeDeliveryEnabled: true,
  minAmountForFree: 2999,
  shippingFee: 149,
  bannerText: "Free delivery above Rs 2,999",
  updatedAt: new Date().toISOString()
};

const dataDirectory = path.join(process.env.VERCEL ? "/tmp" : process.cwd(), ".data");
const shippingFile = path.join(dataDirectory, "shipping.json");
let writeQueue: Promise<void> = Promise.resolve();

function parseShippingSettings(value: unknown): ShippingSettings {
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    !("freeDeliveryEnabled" in value) || typeof value.freeDeliveryEnabled !== "boolean" ||
    !("minAmountForFree" in value) || typeof value.minAmountForFree !== "number" ||
    !Number.isFinite(value.minAmountForFree) || value.minAmountForFree < 0 ||
    !("shippingFee" in value) || typeof value.shippingFee !== "number" ||
    !Number.isFinite(value.shippingFee) || value.shippingFee < 0 ||
    !("bannerText" in value) || typeof value.bannerText !== "string" ||
    !("updatedAt" in value) || typeof value.updatedAt !== "string"
  ) {
    throw new Error(".data/shipping.json contains invalid shipping settings.");
  }

  return {
    freeDeliveryEnabled: value.freeDeliveryEnabled,
    minAmountForFree: value.minAmountForFree,
    shippingFee: value.shippingFee,
    bannerText: value.bannerText,
    updatedAt: value.updatedAt
  };
}

async function writeShippingSettings(settings: ShippingSettings): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = path.join(dataDirectory, `shipping.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    await rename(temporaryFile, shippingFile);
  } catch (error) {
    try {
      await unlink(temporaryFile);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error("Could not remove temporary shipping settings file.", cleanupError);
      }
    }
    throw error;
  }
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  try {
    return parseShippingSettings(JSON.parse(await readFile(shippingFile, "utf8")));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    await writeShippingSettings(defaultShipping);
    return defaultShipping;
  }
}

export async function saveShippingSettings(value: unknown): Promise<ShippingSettings> {
  const validated = parseShippingSettings({
    ...(typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}),
    updatedAt: new Date().toISOString()
  });
  const save = async () => {
    await writeShippingSettings(validated);
    return validated;
  };

  const pendingSave = writeQueue.then(save);
  writeQueue = pendingSave.then(() => undefined, () => undefined);
  return pendingSave;
}
