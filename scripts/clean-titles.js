import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";

function cleanMarkazTitle(rawTitle) {
  return rawTitle
    .replace(/\s*[—-]\s*PKR\s*[\d,]+(?:\.\d+)?\s*[–—-]\s*Markaz/gi, "")
    .replace(/\s*PKR\s*[\d,]+(?:\.\d+)?\s*/gi, " ")
    .replace(/\s*[–—-]\s*Markaz\s*$/gi, "")
    .replace(/\s*-\s*Markaz\s*$/gi, "")
    .replace(/\bMarkaz\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(" ")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ")
    .trim();
}

function cleanProduct(product) {
  if (!product || typeof product !== "object" || typeof product.title !== "string") return false;
  const originalTitle = product.title;
  const cleanedTitle = cleanMarkazTitle(originalTitle);
  const contaminated = /Markaz|\bPKR\s*[\d,]+/i.test(originalTitle);
  let changed = false;

  if (contaminated && !product.originalMarkazTitle) {
    product.originalMarkazTitle = originalTitle;
    changed = true;
  }
  if (product.title !== cleanedTitle) {
    product.title = cleanedTitle;
    changed = true;
  }
  if (typeof product.name === "string") {
    const cleanedName = cleanMarkazTitle(product.name);
    if (product.name !== cleanedName) {
      product.name = cleanedName;
      changed = true;
    }
  }
  return changed;
}

const files = [
  { path: path.join(process.cwd(), ".data", "products.json"), collection: (value) => value?.products },
  { path: path.join(process.cwd(), "data", "markaz-products.json"), collection: (value) => value }
];

for (const file of files) {
  try {
    const contents = await readFile(file.path, "utf8");
    const value = JSON.parse(contents);
    const products = file.collection(value);
    if (!Array.isArray(products)) {
      throw new Error(`${file.path} does not contain a product array.`);
    }
    let changedCount = 0;
    for (const product of products) {
      if (cleanProduct(product)) changedCount += 1;
    }
    if (changedCount > 0) {
      await writeFile(file.path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
    console.log(`${path.relative(process.cwd(), file.path)}: cleaned ${changedCount} product(s).`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log(`${path.relative(process.cwd(), file.path)}: not found; skipped.`);
      continue;
    }
    throw error;
  }
}

const envResult = dotenv.config({ path: path.join(process.cwd(), ".env.local") });
if (envResult.error && envResult.error.code !== "ENOENT") throw envResult.error;
const mongoUri = process.env.MONGODB_URI?.trim();
if (mongoUri) {
  try {
    await mongoose.connect(mongoUri);
    const titleFilter = { $regex: /Markaz|\bPKR\s*[\d,]+/i };
    const products = await mongoose.connection.collection("products")
      .find({ $or: [{ title: titleFilter }, { name: titleFilter }] })
      .toArray();
    let changedCount = 0;
    for (const product of products) {
      if (!product || typeof product.title !== "string") continue;
      const update = {};
      const cleanedTitle = cleanMarkazTitle(product.title);
      if (/Markaz|\bPKR\s*[\d,]+/i.test(product.title) && !product.originalMarkazTitle) {
        update.originalMarkazTitle = product.title;
      }
      if (cleanedTitle !== product.title) update.title = cleanedTitle;
      if (typeof product.name === "string" && cleanMarkazTitle(product.name) !== product.name) {
        update.name = cleanMarkazTitle(product.name);
      }
      if (Object.keys(update).length > 0) {
        await mongoose.connection.collection("products").updateOne(
          { _id: product._id },
          { $set: update }
        );
        changedCount += 1;
      }
    }
    console.log(`MongoDB: cleaned ${changedCount} product(s).`);
  } finally {
    await mongoose.disconnect();
  }
} else {
  console.log("MongoDB: MONGODB_URI is not configured; skipped.");
}
