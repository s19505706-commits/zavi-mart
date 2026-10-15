import { ApiError, handleApiError, requireAdmin } from "../../../lib/api-utils";
import { createChildCategory, createDepartment, getCategories, getDepartments, parseDepartmentInput } from "../../../lib/department-category-store";
import { parseCategoryInput } from "../../../lib/category-store";
import { connectToDatabase } from "../../../lib/mongodb";
import Category from "../../../models/Category";
import Department from "../../../models/Department";
import Product from "../../../models/Product";

export const runtime = "nodejs";

const CATEGORY_SEEDS: Record<string, string[]> = {
  beauty: ["Face Wash", "Cream", "Serum", "Perfume"],
  watches: ["Mens Watches", "Womens Watches"],
  electronics: ["Audio", "Cameras", "Computer Accessories"],
  mobiles: ["Smartphones", "Feature Phones", "Tablets"],
  "mobile-accessories": ["Phone Cases", "Chargers", "Earphones"],
  fashion: ["Mens Wear", "Womens Wear", "Fashion Accessories"],
  "home-living": ["Kitchen", "Home Decor", "Bedding"],
  appliances: ["Kitchen Appliances", "Home Appliances", "Personal Care Appliances"],
  health: ["Personal Care", "Supplements", "Medical Devices"],
  groceries: ["Food and Beverages", "Household Essentials", "Snacks"],
  general: ["General Essentials", "New Arrivals", "Best Sellers"]
};

function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function categoryNames(department: { name: string; slug: string }): string[] {
  return CATEGORY_SEEDS[department.slug] ?? [
    `${department.name} Essentials`,
    `${department.name} Accessories`,
    `${department.name} More`
  ];
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const connection = await connectToDatabase();
    if (!connection) throw new ApiError("MONGODB_URI is required to migrate department data.", 500);

    let departments = await getDepartments(true);
    if (!departments.some((department) => department.slug === "watches")) {
      await createDepartment(parseDepartmentInput({
        name: "Watches",
        slug: "watches",
        image: "",
        description: "",
        isActive: true,
        sortOrder: departments.length * 10
      }));
      departments = await getDepartments(true);
    }

    let categories = await getCategories(true);
    const categoryDepartments = new Set(categories.map((category) => category.departmentId));
    for (const department of departments) {
      if (categoryDepartments.has(department.id)) continue;
      const names = categoryNames(department);
      for (const [index, name] of names.entries()) {
        await createChildCategory(parseCategoryInput({
          name,
          slug: slugify(name),
          image: "",
          description: "",
          departmentId: department.id,
          isActive: true,
          sortOrder: index * 10
        }));
      }
    }
    categories = await getCategories(true);

    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const departmentByName = new Map<string, (typeof departments)[number]>();
    for (const department of departments) {
      departmentByName.set(department.name.trim().toLocaleLowerCase(), department);
      departmentByName.set(department.slug.trim().toLocaleLowerCase(), department);
    }
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const categoriesByDepartment = new Map<string, typeof categories>();
    for (const category of categories) {
      const siblings = categoriesByDepartment.get(category.departmentId) ?? [];
      siblings.push(category);
      categoriesByDepartment.set(category.departmentId, siblings);
    }
    for (const siblings of categoriesByDepartment.values()) {
      siblings.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    }

    const products = await Product.collection.find({})
      .project<{ _id: unknown; category?: unknown; departmentId?: unknown; categoryId?: unknown }>({
        _id: 1,
        category: 1,
        departmentId: 1,
        categoryId: 1
      })
      .toArray();
    const updates: Array<{ updateOne: { filter: { _id: unknown }; update: { $set: Record<string, string> } } }> = [];
    const unmappedProducts: Array<{ id: string; category: string }> = [];

    for (const product of products) {
      if (typeof product.departmentId === "string" && typeof product.categoryId === "string") continue;
      const legacyCategory = typeof product.category === "string" ? product.category.trim() : "";
      const currentCategory = typeof product.categoryId === "string"
        ? categoryById.get(product.categoryId)
        : undefined;
      const department = (currentCategory && departmentById.get(currentCategory.departmentId)) ||
        (typeof product.departmentId === "string" ? departmentById.get(product.departmentId) : undefined) ||
        departmentByName.get(legacyCategory.toLocaleLowerCase()) ||
        departmentByName.get(slugify(legacyCategory));
      const category = currentCategory?.departmentId === department?.id
        ? currentCategory
        : categoriesByDepartment.get(department?.id ?? "")?.[0];

      if (!department || !category) {
        unmappedProducts.push({ id: String(product._id), category: legacyCategory });
        continue;
      }
      updates.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              departmentId: department.id,
              categoryId: category.id,
              category: category.name
            }
          }
        }
      });
    }

    if (updates.length) await Product.bulkWrite(updates, { ordered: true });

    return Response.json({
      success: true,
      departments: await Department.countDocuments(),
      categories: await Category.countDocuments(),
      productsScanned: products.length,
      productsUpdated: updates.length,
      productsUnmapped: unmappedProducts
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return handleApiError(error, "GET /api/migrate-departments failed");
  }
}
