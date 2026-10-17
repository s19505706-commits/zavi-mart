import mongoose from "mongoose";
import { ApiError, isRecord } from "./api-utils";
import type { BundleRecord } from "../models/Bundle";

export type BundleInput = Pick<
  BundleRecord,
  "name" | "tag" | "images" | "items" | "setPrice" | "valuePrice" | "timerHours" | "stockTotal" | "isActive"
>;

export type SerializedBundle = Omit<BundleRecord, "items" | "createdAt" | "updatedAt" | "timerExpiry"> & {
  _id: string;
  items: Array<{ title: string; image: string; price: number }>;
  timerExpiry: string;
  createdAt: string;
  updatedAt: string;
};

export function parseBundleInput(value: unknown): BundleInput {
  if (!isRecord(value)) throw new ApiError("Bundle details are required.", 400);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const allowedTags = ["VALUE SET", "LIMITED EDITION", "CURATED SET"];
  if (value.tag !== undefined && (typeof value.tag !== "string" || !allowedTags.includes(value.tag))) {
    throw new ApiError("Choose VALUE SET, LIMITED EDITION, or CURATED SET.", 400);
  }
  const tag = typeof value.tag === "string" ? value.tag : "VALUE SET";
  const setPrice = Number(value.setPrice);
  const valuePrice = Number(value.valuePrice);
  const timerHours = Number(value.timerHours ?? 4);
  const stockTotal = Number(value.stockTotal ?? 50);
  if (!name || name.length > 160) throw new ApiError("Bundle name is required and must be 160 characters or fewer.", 400);
  if (!Number.isFinite(setPrice) || setPrice < 0 || !Number.isFinite(valuePrice) || valuePrice < setPrice) {
    throw new ApiError("Value price must be at least the set price, and prices cannot be negative.", 400);
  }
  if (!Number.isInteger(timerHours) || timerHours < 1 || timerHours > 72) {
    throw new ApiError("Timer hours must be a whole number from 1 to 72.", 400);
  }
  if (!Number.isInteger(stockTotal) || stockTotal < 0 || stockTotal > 1000000) {
    throw new ApiError("Stock total must be a whole number from 0 to 1,000,000.", 400);
  }
  const rawImages = Array.isArray(value.images) ? value.images : [];
  if (rawImages.length > 3 || rawImages.some((image) => typeof image !== "string" || image.length > 2048)) {
    throw new ApiError("Provide up to three image URLs, each no longer than 2,048 characters.", 400);
  }
  const images = rawImages.map((image) => (image as string).trim()).filter(Boolean);
  const rawItems = Array.isArray(value.items) ? value.items : [];
  if (rawItems.length > 30) throw new ApiError("A bundle can contain at most 30 items.", 400);
  const items = rawItems.map((item) => {
    if (!isRecord(item)) throw new ApiError("Bundle items must include a title and price.", 400);
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const image = typeof item.image === "string" ? item.image.trim() : "";
    const price = Number(item.price);
    if (!title || title.length > 200 || image.length > 2048 || !Number.isFinite(price) || price < 0) {
      throw new ApiError("Each bundle item needs a title of up to 200 characters and a non-negative price.", 400);
    }
    return { title, image, price };
  });
  return {
    name,
    tag,
    images,
    items,
    setPrice,
    valuePrice,
    timerHours,
    stockTotal,
    isActive: typeof value.isActive === "boolean" ? value.isActive : true
  } as BundleInput;
}

export function serializeBundle(bundle: {
  _id: mongoose.Types.ObjectId;
  name: string;
  tag: string;
  images: string[];
  items: Array<{ title: string; image: string; price: number }>;
  setPrice: number;
  valuePrice: number;
  savings?: number;
  timerHours: number;
  timerExpiry: Date;
  stockTotal: number;
  stockClaimed: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SerializedBundle {
  return {
    _id: bundle._id.toString(),
    name: bundle.name,
    tag: bundle.tag,
    images: bundle.images,
    items: bundle.items,
    setPrice: bundle.setPrice,
    valuePrice: bundle.valuePrice,
    savings: bundle.savings ?? bundle.valuePrice - bundle.setPrice,
    timerHours: bundle.timerHours,
    timerExpiry: bundle.timerExpiry.toISOString(),
    stockTotal: bundle.stockTotal,
    stockClaimed: bundle.stockClaimed,
    isActive: bundle.isActive,
    createdAt: bundle.createdAt.toISOString(),
    updatedAt: bundle.updatedAt.toISOString()
  } as SerializedBundle;
}

export function validBundleId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}
