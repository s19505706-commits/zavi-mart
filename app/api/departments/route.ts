import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../lib/api-utils";
import {
  createDepartment,
  getCategories,
  getDepartments,
  parseDepartmentInput
} from "../../../lib/department-category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const input = parseDepartmentInput(await readJsonBody(request));
    if ((await getDepartments()).some((department) => department.slug === input.slug)) {
      throw new ApiError("A department with this slug already exists.", 409);
    }
    const department = await createDepartment(input);
    return Response.json({ success: true, department }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/departments failed");
  }
}
