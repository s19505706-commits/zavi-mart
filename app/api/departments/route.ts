import { handleApiError } from "../../../lib/api-utils";
import { getCategories, getDepartments } from "../../../lib/department-category-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [departments, categories] = await Promise.all([
      getDepartments(false),
      getCategories(false)
    ]);
    const categoriesByDepartment = new Map<string, typeof categories>();
    for (const category of categories) {
      const children = categoriesByDepartment.get(category.departmentId) ?? [];
      children.push(category);
      categoriesByDepartment.set(category.departmentId, children);
    }
    const departmentsWithCategories = departments.map((department) => ({
      ...department,
      categories: (categoriesByDepartment.get(department.id) ?? []).map(({ id, name, slug }) => ({
        id,
        name,
        slug
      }))
    }));
    return Response.json({ departments: departmentsWithCategories }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/departments failed");
  }
}
