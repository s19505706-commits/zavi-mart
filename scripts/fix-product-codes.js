import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";

const productCodePattern = /Product Code:\s*([A-Z0-9-]+)/i;
const productDescriptionPattern = /Product Code:|Note:\s*There might be an error/i;
const filePaths = [
  path.join(process.cwd(), ".data", "products.json"),
  path.join(process.cwd(), "data", "markaz-products.json")
];

function cleanDescription(description) {
  return description
    .replace(/Product Code:\s*[A-Z0-9-]+/gi, "")
    .replace(/Note:\s*There might be an error[\s\S]*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function migrateProduct(product) {
  if (typeof product.description !== "string") return false;
  const rawDescription = typeof product.originalDescription === "string" && product.originalDescription.trim()
    ? product.originalDescription
    : product.description;
  const productCode = rawDescription.match(productCodePattern)?.[1]?.trim();
  const cleanedDescription = cleanDescription(product.description);
  let changed = product.description !== cleanedDescription;
  if (productCode) {
    for (const field of ["productCode", "markazCode", "supplierCode"]) {
      if (product[field] !== productCode) {
        product[field] = productCode;
        changed = true;
      }
    }
    if (typeof product.originalDescription !== "string" || !product.originalDescription.trim()) {
      product.originalDescription = rawDescription;
      changed = true;
    }
  }
  product.description = cleanedDescription;
  return changed;
}

for (const filePath of filePaths) {
  try {
    const contents = await readFile(filePath, "utf8");
    const value = JSON.parse(contents);
    const products = Array.isArray(value) ? value : value?.products;
    if (!Array.isArray(products)) {
      throw new Error(`${filePath} must contain a product array.`);
    }

    let migratedCount = 0;
    for (const product of products) {
      if (product && typeof product === "object" && migrateProduct(product)) migratedCount += 1;
    }

    if (migratedCount > 0) {
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
    console.log(`${path.relative(process.cwd(), filePath)}: migrated ${migratedCount} product(s).`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.log(`${path.relative(process.cwd(), filePath)}: not found; skipped.`);
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
    const products = await mongoose.connection.collection("products")
      .find({
        $or: [
          { description: { $regex: productDescriptionPattern } },
          { originalDescription: { $regex: productDescriptionPattern } }
        ]
      })
      .toArray();
    let migratedCount = 0;

    for (const product of products) {
      if (!product || typeof product.description !== "string") continue;
      const rawDescription = typeof product.originalDescription === "string" && product.originalDescription.trim()
        ? product.originalDescription
        : product.description;
      const productCode = rawDescription.match(productCodePattern)?.[1]?.trim();
      const cleanedDescription = cleanDescription(product.description);
      const update = {};
      let changed = product.description !== cleanedDescription;
      if (changed) update.description = cleanedDescription;
      if (productCode) {
        for (const field of ["productCode", "markazCode", "supplierCode"]) {
          if (product[field] !== productCode) {
            update[field] = productCode;
            changed = true;
          }
        }
        if (typeof product.originalDescription !== "string" || !product.originalDescription.trim()) {
          update.originalDescription = rawDescription;
          changed = true;
        }
      }
      if (changed) {
        await mongoose.connection.collection("products").updateOne(
          { _id: product._id },
          { $set: update }
        );
        migratedCount += 1;
      }
    }
    console.log(`MongoDB: migrated ${migratedCount} product(s).`);
  } finally {
    await mongoose.disconnect();
  }
} else {
  console.log("MongoDB: MONGODB_URI is not configured; skipped.");
}
