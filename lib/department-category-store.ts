import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError, isRecord } from "./api-utils";
import { connectToDatabase } from "./mongodb";
import Department from "../models/Department";
import Category from "../models/Category";
import Product from "../models/Product";
import { MOCK_PRODUCTS } from "./mock-products";
import {
  getStoredLocalMarkazProducts,
  getTrackedMarkazProducts
} from "./local-markaz-products";
import { getLocalProductStore } from "./local-products";
import { PRODUCT_CATEGORIES } from "./product-categories";
import mongoose from "mongoose";
import {
  assertLocalStoreWritesAllowed,
  getStoreFilePath,
  isProductionLocalWritesBlocked,
  readStoreJson,
  writeStoreJson
} from "./vercel-store";
import { mergeCatalogProducts } from "./product-catalog";

type BaseEntity = {
  id: string;
  name: string;
  slug: string;
  image: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentInput = Omit<BaseEntity, "id" | "createdAt" | "updatedAt">;
export type DepartmentItem = BaseEntity & { totalCategories: number; totalProducts: number };
export type CategoryInput = DepartmentInput & { departmentId: string };
export type CategoryItem = BaseEntity & { departmentId: string; productsCount: number };

type StoredDepartment = BaseEntity;
type StoredCategory = BaseEntity & { departmentId: string };
type ProductForCounts = { title: string; category: string; departmentId?: string | null; categoryId?: string | null };
type ProductForMerge = ProductForCounts & {
  _id: string;
  id?: string;
};

const departmentsFile = getStoreFilePath("departments.json");
const categoriesFile = getStoreFilePath("categories.json");
let localInitialization: Promise<void> | null = null;
let databaseInitialization: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseBaseInput(value: unknown): DepartmentInput {
  if (!isRecord(value)) throw new ApiError("Department data must be a JSON object.", 400);
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 100) {
    throw new ApiError("Name is required and must be 100 characters or fewer.", 400);
  }
  const name = value.name.trim();
  const slug = typeof value.slug === "string" ? slugify(value.slug) : slugify(name);
  if (!slug || slug.length > 120) throw new ApiError("Enter a valid slug.", 400);
  const image = value.image === undefined ? "" : value.image;
  if (typeof image !== "string" || image.length > 1000000 ||
      (image !== "" && !/^https?:\/\//i.test(image) && !/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(image))) {
    throw new ApiError("Image must be an HTTP(S) URL or a supported image upload.", 400);
  }
  const description = value.description === undefined ? "" : value.description;
  if (typeof description !== "string" || description.length > 1000) {
    throw new ApiError("Description must be 1000 characters or fewer.", 400);
  }
  const isActive = value.isActive === undefined ? true : value.isActive;
  if (typeof isActive !== "boolean") throw new ApiError("isActive must be a boolean.", 400);
  const sortOrder = value.sortOrder === undefined ? 0 : value.sortOrder;
  if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
    throw new ApiError("Sort order must be a non-negative integer.", 400);
  }
  return { name, slug, image, description, isActive, sortOrder };
}

export function parseDepartmentInput(value: unknown): DepartmentInput {
  return parseBaseInput(value);
}

export function parseChildCategoryInput(value: unknown): CategoryInput {
  if (!isRecord(value) || typeof value.departmentId !== "string" || !value.departmentId.trim()) {
    throw new ApiError("Select a department for this category.", 400);
  }
  return { ...parseBaseInput(value), departmentId: value.departmentId.trim() };
}

function validBase(value: unknown): value is StoredDepartment {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.image === "string" &&
    typeof value.description === "string" &&
    typeof value.isActive === "boolean" &&
    typeof value.sortOrder === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function defaultDepartments(): StoredDepartment[] {
  const now = new Date().toISOString();
  return PRODUCT_CATEGORIES.map((name, index) => ({
    id: randomUUID(),
    name,
    slug: slugify(name),
    image: "",
    description: "",
    isActive: true,
    sortOrder: index * 10,
    createdAt: now,
    updatedAt: now
  }));
}

async function readOptionalJson(file: string): Promise<{ exists: boolean; value?: unknown }> {
  return readStoreJson(file);
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeStoreJson(file, value);
}

function isLegacyCategory(entry: unknown): entry is Record<string, unknown> & {
  id: string; name: string; slug: string; parentId: string | null;
} {
  return isRecord(entry) &&
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    typeof entry.slug === "string" &&
    (typeof entry.parentId === "string" || entry.parentId === null);
}

function baseFromLegacy(entry: Record<string, unknown>, id = String(entry.id ?? randomUUID())): StoredDepartment {
  const now = new Date().toISOString();
  return {
    id,
    name: typeof entry.name === "string" ? entry.name : "Department",
    slug: typeof entry.slug === "string" ? entry.slug : slugify(String(entry.name ?? "department")),
    image: typeof entry.image === "string" ? entry.image : "",
    description: typeof entry.description === "string" ? entry.description : "",
    isActive: entry.isActive !== false,
    sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : now
  };
}

async function initializeLocalStores(): Promise<void> {
  const [departmentStore, categoryStore] = await Promise.all([
    readOptionalJson(departmentsFile),
    readOptionalJson(categoriesFile)
  ]);
  let departments: StoredDepartment[];
  let categories: StoredCategory[];

  if (departmentStore.exists) {
    if (!Array.isArray(departmentStore.value) || !departmentStore.value.every(validBase)) {
      throw new Error(".data/departments.json must contain valid department records.");
    }
    departments = departmentStore.value;
  } else {
    departments = [];
  }

  if (categoryStore.exists && !Array.isArray(categoryStore.value)) {
    throw new Error(".data/categories.json must contain a category array.");
  }
  const rawCategories = Array.isArray(categoryStore.value) ? categoryStore.value : [];
  const modernCategories = rawCategories.filter((entry): entry is StoredCategory =>
    validBase(entry) && "departmentId" in entry && typeof entry.departmentId === "string"
  );
  const legacyCategories = rawCategories.filter(isLegacyCategory);

  if (!departments.length) {
    const roots = legacyCategories.filter((entry) => !entry.parentId);
    departments = roots.length
      ? roots.map((entry) => baseFromLegacy(entry))
      : defaultDepartments();
  }

  const departmentByLegacyId = new Map<string, StoredDepartment>();
  for (const legacy of legacyCategories) {
    if (legacy.parentId) continue;
    let department = departments.find((entry) => entry.id === legacy.id || entry.slug === legacy.slug);
    if (!department) {
      department = baseFromLegacy(legacy);
      departments.push(department);
    }
    departmentByLegacyId.set(legacy.id, department);
  }
  if (!departments.length) departments = defaultDepartments();

  const legacyChildren: StoredCategory[] = [];
  for (const entry of legacyCategories) {
    if (!entry.parentId) continue;
    let parent = legacyCategories.find((candidate) => candidate.id === entry.parentId);
    const visited = new Set<string>();
    while (parent?.parentId && !visited.has(parent.id)) {
      visited.add(parent.id);
      parent = legacyCategories.find((candidate) => candidate.id === parent?.parentId);
    }
    const department = departmentByLegacyId.get(parent?.id ?? entry.parentId) ??
      departments.find((candidate) => candidate.id === entry.parentId);
    if (department) legacyChildren.push({ ...baseFromLegacy(entry), departmentId: department.id });
  }

  const needsWrite = !departmentStore.exists ||
    legacyCategories.length > 0 ||
    (categoryStore.exists && modernCategories.length !== rawCategories.length);
  departments = departments.filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.slug === entry.slug) === index
  );
  categories = [...modernCategories, ...legacyChildren].filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.id === entry.id) === index
  );
  if (!categoryStore.exists) categories = [];
  if (needsWrite || !categoryStore.exists) {
    if (!isProductionLocalWritesBlocked()) {
      await writeJson(departmentsFile, departments);
      await writeJson(categoriesFile, categories);
    }
  }
}

function rawRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function legacyObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "string" && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  throw new Error("Legacy Mongo category has an invalid _id; migration was stopped to preserve the record.");
}

function dateString(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

async function initializeDatabaseStores(): Promise<void> {
  const connection = await connectToDatabase();
  if (!connection) return;
  const collection = connection.connection.collection("categories");
  const legacyDocuments = (await collection.find({}).toArray())
    .map(rawRecord)
    .filter((entry): entry is Record<string, unknown> => !!entry);
  const roots = legacyDocuments.filter((entry) =>
    "parentId" in entry && (entry.parentId === null || entry.parentId === undefined || entry.parentId === "")
  );
  const departmentByLegacyId = new Map<string, string>();
  if (roots.length === 0 && await Department.countDocuments() === 0) {
    await Promise.all(PRODUCT_CATEGORIES.map((name, index) => {
      const slug = slugify(name);
      return Department.updateOne(
        { slug },
        { $setOnInsert: { name, slug, image: "", description: "", isActive: true, sortOrder: index * 10 } },
        { upsert: true }
      );
    }));
  }

  for (const entry of roots) {
    const id = String(entry._id);
    const name = typeof entry.name === "string" ? entry.name : "Department";
    const slug = typeof entry.slug === "string" ? entry.slug : slugify(name);
    const departmentRecord = await Department.findOneAndUpdate(
      { slug },
      { $setOnInsert: {
        ...(entry._id ? { _id: entry._id } : {}),
        name,
        slug,
        image: typeof entry.image === "string" ? entry.image : "",
        description: typeof entry.description === "string" ? entry.description : "",
        isActive: entry.isActive !== false,
        sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0
      } },
      { upsert: true, new: true }
    ).select({ _id: 1 }).lean();
    const departmentId = departmentRecord ? String(departmentRecord._id) : id;
    departmentByLegacyId.set(id, departmentId);
  }

  const orphanRoots: Record<string, unknown>[] = [];
  const childUpdates: Array<{ _id: unknown; departmentId: string }> = [];
  const legacyById = new Map(legacyDocuments.map((entry) => [String(entry._id), entry]));
  for (const entry of legacyDocuments) {
    if (!("parentId" in entry) || entry.parentId === null || entry.parentId === undefined || entry.parentId === "") {
      continue;
    }
    let parentId = String(entry.parentId);
    const visited = new Set<string>();
    while (!departmentByLegacyId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = legacyById.get(parentId);
      if (!parent || parent.parentId === null || parent.parentId === undefined || parent.parentId === "") break;
      parentId = String(parent.parentId);
    }
    let departmentId = departmentByLegacyId.get(parentId);
    if (!departmentId) {
      const matchingDepartment = await Department.findById(parentId, { _id: 1 }).lean();
      departmentId = matchingDepartment ? String(matchingDepartment._id) : undefined;
    }
    if (!departmentId) {
      orphanRoots.push(entry);
      continue;
    }
    childUpdates.push({ _id: entry._id, departmentId });
  }

  for (const entry of orphanRoots) {
    const id = String(entry._id);
    const name = typeof entry.name === "string" ? entry.name : "Department";
    const slug = typeof entry.slug === "string" ? entry.slug : slugify(name);
    await Department.updateOne(
      { slug },
      { $setOnInsert: {
        ...(entry._id ? { _id: entry._id } : {}),
        name,
        slug,
        image: typeof entry.image === "string" ? entry.image : "",
        description: typeof entry.description === "string" ? entry.description : "",
        isActive: entry.isActive !== false,
        sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : 0
      } },
      { upsert: true }
    );
    departmentByLegacyId.set(id, id);
  }

  for (const update of childUpdates) {
    await collection.updateOne(
      { _id: legacyObjectId(update._id) },
      {
        $set: { departmentId: update.departmentId },
        $unset: { parentId: "" }
      }
    );
  }
  if (roots.length) {
    await collection.deleteMany({ _id: { $in: roots.map((entry) => legacyObjectId(entry._id)) } });
  }
  await Promise.all([
    Department.syncIndexes(),
    Category.syncIndexes()
  ]);
}

async function ensureStores(): Promise<void> {
  if (!localInitialization) {
    localInitialization = initializeLocalStores().catch((error: unknown) => {
      localInitialization = null;
      throw error;
    });
  }
  await localInitialization;
  if (!databaseInitialization) {
    databaseInitialization = initializeDatabaseStores().catch((error: unknown) => {
      databaseInitialization = null;
      throw error;
    });
  }
  await databaseInitialization;
}

function toDepartment(record: {
  _id: unknown; name: string; slug: string; image: string; description: string;
  isActive: boolean; sortOrder: number; createdAt: Date; updatedAt: Date;
}): StoredDepartment {
  return {
    id: String(record._id),
    name: record.name,
    slug: record.slug,
    image: record.image ?? "",
    description: record.description ?? "",
    isActive: record.isActive !== false,
    sortOrder: record.sortOrder ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toCategory(record: {
  _id: unknown; name: string; slug: string; departmentId: string; image: string; description: string;
  isActive: boolean; sortOrder: number; createdAt: Date; updatedAt: Date;
}): StoredCategory {
  return {
    ...toDepartment(record),
    departmentId: record.departmentId
  };
}

async function readLocalDepartments(): Promise<StoredDepartment[]> {
  await ensureStores();
  const stored = await readStoreJson(departmentsFile);
  if (!stored.exists) return defaultDepartments();
  const value = stored.value;
  if (!Array.isArray(value) || !value.every(validBase)) throw new Error(".data/departments.json contains invalid data.");
  return value;
}

async function readLocalCategories(): Promise<StoredCategory[]> {
  await ensureStores();
  const stored = await readStoreJson(categoriesFile);
  if (!stored.exists) return [];
  const value = stored.value;
  if (!Array.isArray(value) || !value.every((entry) =>
    validBase(entry) && "departmentId" in entry && typeof entry.departmentId === "string"
  )) throw new Error(".data/categories.json contains invalid category data.");
  return value as StoredCategory[];
}

async function updateLocalFile<T>(file: string, updater: (items: T[]) => T[]): Promise<T[]> {
  const operation = writeQueue.then(async () => {
    assertLocalStoreWritesAllowed(path.basename(file, ".json"));
    const stored = await readStoreJson(file);
    const current = stored.value;
    if (!Array.isArray(current)) throw new Error(`${path.basename(file)} must contain an array.`);
    const updated = updater(current as T[]);
    await writeJson(file, updated);
    return updated;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function getProductRecords(connection: Awaited<ReturnType<typeof connectToDatabase>>): Promise<ProductForCounts[]> {
  const [local, markaz, database] = await Promise.all([
    getLocalProductStore(),
    getStoredLocalMarkazProducts(),
    connection ? Product.find({}, {
      title: 1, category: 1, departmentId: 1, categoryId: 1
    }).lean() : Promise.resolve([])
  ]);
  const toMergeProduct = (product: {
    _id: string;
    id?: string;
    title: string;
    category: string;
    departmentId?: string | null;
    categoryId?: string | null;
  }): ProductForMerge => product;
  const products = mergeCatalogProducts<ProductForMerge>([
    database.map((product) => ({
      _id: product._id.toString(),
      title: product.title,
      category: product.category,
      departmentId: product.departmentId,
      categoryId: product.categoryId
    })).map(toMergeProduct),
    local.products.map((product) => ({
      _id: product._id,
      id: product.id,
      title: product.title,
      category: product.category,
      departmentId: product.departmentId,
      categoryId: product.categoryId
    })).map(toMergeProduct),
    markaz.map((product) => ({
      _id: product._id,
      id: product.id,
      title: product.title,
      category: product.category,
      departmentId: "departmentId" in product && typeof product.departmentId === "string"
        ? product.departmentId
        : null,
      categoryId: product.categoryId
    })).map(toMergeProduct),
    getTrackedMarkazProducts().map(toMergeProduct)
  ], MOCK_PRODUCTS.map((product) => ({
    _id: product._id,
    id: product.id,
    title: product.title,
    category: product.category,
    departmentId: null,
    categoryId: product.categoryId
  })).map(toMergeProduct));
  const records: ProductForCounts[] = products.map((product) => ({
    title: product.title,
    category: product.category,
    departmentId: "departmentId" in product && typeof product.departmentId === "string" ? product.departmentId : undefined,
    categoryId: "categoryId" in product && typeof product.categoryId === "string" ? product.categoryId : undefined
  }));
  const unique = new Map<string, ProductForCounts>();
  for (const product of records) unique.set(product.title.trim().toLocaleLowerCase(), product);
  return [...unique.values()];
}

export async function getDepartments(includeInactive = true): Promise<DepartmentItem[]> {
  await ensureStores();
  const connection = await connectToDatabase();
  const [departments, categories, products] = await Promise.all([
    connection
      ? Department.find(includeInactive ? {} : { isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().then((records) => records.map(toDepartment))
      : readLocalDepartments().then((items) => includeInactive ? items : items.filter((entry) => entry.isActive)),
    connection
      ? Category.find(includeInactive ? {} : { isActive: true }).lean().then((records) => records.map(toCategory))
      : readLocalCategories().then((items) => includeInactive ? items : items.filter((entry) => entry.isActive)),
    getProductRecords(connection)
  ]);
  departments.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  return departments.map((department) => {
    const relatedCategories = categories.filter((category) => category.departmentId === department.id);
    const legacyValues = new Set([department.id, department.slug, department.name].map((value) => value.toLocaleLowerCase()));
    return {
      ...department,
      totalCategories: relatedCategories.length,
      totalProducts: products.filter((product) =>
        product.departmentId === department.id ||
        relatedCategories.some((category) =>
          product.categoryId === category.id ||
          (!product.categoryId && new Set([category.id, category.slug, category.name]
            .map((value) => value.toLocaleLowerCase())).has(product.category.trim().toLocaleLowerCase()))
        ) ||
        (!product.departmentId && legacyValues.has(product.category.trim().toLocaleLowerCase()))
      ).length
    };
  });
}

export async function getCategories(
  includeInactive = true,
  departmentId?: string | null
): Promise<CategoryItem[]> {
  await ensureStores();
  const connection = await connectToDatabase();
  const filter: Record<string, unknown> = {};
  if (!includeInactive) filter.isActive = true;
  if (departmentId) filter.departmentId = departmentId;
  const [categories, products] = await Promise.all([
    connection
      ? Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean().then((records) => records.map(toCategory))
      : readLocalCategories().then((items) =>
        items.filter((category) =>
          (includeInactive || category.isActive) && (!departmentId || category.departmentId === departmentId)
        )
      ),
    getProductRecords(connection)
  ]);
  return categories.map((category) => {
    const values = new Set([category.id, category.slug, category.name].map((value) => value.toLocaleLowerCase()));
    return {
      ...category,
      productsCount: products.filter((product) =>
        product.categoryId === category.id ||
        (!product.categoryId && values.has(product.category.trim().toLocaleLowerCase()))
      ).length
    };
  });
}

export async function createDepartment(input: DepartmentInput): Promise<DepartmentItem> {
  await ensureStores();
  const connection = await connectToDatabase();
  const now = new Date().toISOString();
  if (connection) {
    const record = await Department.create(input);
    return { ...toDepartment(record), totalCategories: 0, totalProducts: 0 };
  }
  const item: StoredDepartment = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  await updateLocalFile<StoredDepartment>(departmentsFile, (items) => [...items, item]);
  return { ...item, totalCategories: 0, totalProducts: 0 };
}

export async function updateDepartment(id: string, input: DepartmentInput): Promise<DepartmentItem | null> {
  await ensureStores();
  const connection = await connectToDatabase();
  if (connection) {
    const record = await Department.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    if (!record) return null;
    const department = toDepartment(record);
    const [totalCategories, totalProducts] = await Promise.all([
      Category.countDocuments({ departmentId: id }),
      Product.countDocuments({ departmentId: id })
    ]);
    return { ...department, totalCategories, totalProducts };
  }
  let result: StoredDepartment | undefined;
  const items = await updateLocalFile<StoredDepartment>(departmentsFile, (current) => current.map((item) => {
    if (item.id !== id) return item;
    result = { ...item, ...input, updatedAt: new Date().toISOString() };
    return result;
  }));
  const department = result ?? items.find((item) => item.id === id);
  return department ? { ...department, totalCategories: 0, totalProducts: 0 } : null;
}

export async function deleteDepartmentRecord(id: string): Promise<boolean> {
  await ensureStores();
  if (await departmentHasProducts(id)) return false;
  const connection = await connectToDatabase();
  if (connection) {
    const department = await Department.findById(id);
    if (!department) return false;
    await Category.deleteMany({ departmentId: id });
    await Department.findByIdAndDelete(id);
    return true;
  }
  const childCategories = await getCategories(true, id);
  for (const category of childCategories) {
    if (await categoryHasProducts(category.id)) return false;
  }
  await updateLocalFile<StoredCategory>(categoriesFile, (items) => items.filter((item) => item.departmentId !== id));
  let deleted = false;
  await updateLocalFile<StoredDepartment>(departmentsFile, (items) => items.filter((item) => {
    if (item.id === id) {
      deleted = true;
      return false;
    }
    return true;
  }));
  return deleted;
}

export async function createChildCategory(input: CategoryInput): Promise<CategoryItem> {
  await ensureStores();
  if (!(await getDepartments()).some((department) => department.id === input.departmentId)) {
    throw new ApiError("The selected department does not exist.", 400);
  }
  const connection = await connectToDatabase();
  const now = new Date().toISOString();
  if (connection) {
    const record = await Category.create(input);
    return { ...toCategory(record), productsCount: 0 };
  }
  const item: StoredCategory = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  await updateLocalFile<StoredCategory>(categoriesFile, (items) => [...items, item]);
  return { ...item, productsCount: 0 };
}

export async function updateChildCategory(id: string, input: CategoryInput): Promise<CategoryItem | null> {
  await ensureStores();
  if (!(await getDepartments()).some((department) => department.id === input.departmentId)) {
    throw new ApiError("The selected department does not exist.", 400);
  }
  const connection = await connectToDatabase();
  if (connection) {
    const record = await Category.findByIdAndUpdate(id, input, { new: true, runValidators: true });
    return record ? { ...toCategory(record), productsCount: 0 } : null;
  }
  let result: StoredCategory | undefined;
  const items = await updateLocalFile<StoredCategory>(categoriesFile, (current) => current.map((item) => {
    if (item.id !== id) return item;
    result = { ...item, ...input, updatedAt: new Date().toISOString() };
    return result;
  }));
  const category = result ?? items.find((item) => item.id === id);
  return category ? { ...category, productsCount: 0 } : null;
}

export async function deleteChildCategory(id: string): Promise<boolean> {
  await ensureStores();
  const connection = await connectToDatabase();
  if (connection) return !!(await Category.findByIdAndDelete(id));
  let deleted = false;
  await updateLocalFile<StoredCategory>(categoriesFile, (items) => items.filter((item) => {
    if (item.id === id) {
      deleted = true;
      return false;
    }
    return true;
  }));
  return deleted;
}

export async function departmentHasProducts(id: string): Promise<boolean> {
  const departments = await getDepartments();
  const department = departments.find((item) => item.id === id);
  return !!department && department.totalProducts > 0;
}

export async function categoryHasProducts(id: string): Promise<boolean> {
  const category = (await getCategories()).find((item) => item.id === id);
  return !!category && category.productsCount > 0;
}

export async function validateProductClassification(input: {
  category?: string;
  departmentId?: string | null;
  categoryId?: string | null;
}): Promise<void> {
  if (input.departmentId === undefined && input.categoryId === undefined) return;
  if (input.departmentId === null && input.categoryId === null) return;
  if (typeof input.departmentId !== "string" || typeof input.categoryId !== "string") {
    throw new ApiError("Select both a department and a category.", 400);
  }
  const category = (await getCategories(true, input.departmentId))
    .find((entry) => entry.id === input.categoryId);
  if (!category) throw new ApiError("The selected category does not belong to this department.", 400);
  if (input.category && category.name !== input.category) {
    throw new ApiError("The product category name must match its selected category.", 400);
  }
}

export function departmentSlug(value: string): string {
  return slugify(value);
}
