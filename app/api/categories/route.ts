import { handleApiError } from "../../../lib/api-utils";
import { getCategories, getDepartments } from "../../../lib/department-category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const departmentId = url.searchParams.get("department_id")?.trim() ||
      url.searchParams.get("departmentId")?.trim() || undefined;
    if (departmentId && departmentId.length > 100) {
      return Response.json({ error: "department_id must be 100 characters or fewer." }, { status: 400 });
    }
    const [categories, departments] = await Promise.all([
      getCategories(false, departmentId),
      getDepartments(false)
    ]);
    const departmentsById = new Map(departments.map((department) => [
      department.id,
      { name: department.name, slug: department.slug }
    ]));
    return Response.json(
      {
        categories: categories.map((category) => ({
          ...category,
          departmentName: departmentsById.get(category.departmentId)?.name,
          departmentSlug: departmentsById.get(category.departmentId)?.slug,
          label: category.name,
          count: category.productsCount
        }))
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return handleApiError(error, "GET /api/categories failed");
  }
}
