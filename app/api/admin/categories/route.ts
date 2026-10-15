import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import {
  createCategory,
  getCategories,
  parseCategoryInput
} from "../../../../lib/category-store";
import { getDepartments } from "../../../../lib/department-category-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const departmentId = new URL(request.url).searchParams.get("department_id")?.trim() || undefined;
    return Response.json(
      { categories: await getCategories(true, departmentId) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return handleApiError(error, "GET /api/admin/categories failed");
  }
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const input = parseCategoryInput(await readJsonBody(request));
    if (!(await getDepartments()).some((department) => department.id === input.departmentId)) {
      throw new ApiError("The selected department does not exist.", 400);
    }
    if ((await getCategories()).some((category) => category.slug === input.slug)) {
      throw new ApiError("A category with this slug already exists.", 409);
    }
    const category = await createCategory(input);
    return Response.json({ success: true, category }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/admin/categories failed");
  }
}
