import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import {
  createDepartment,
  getDepartments,
  parseDepartmentInput
} from "../../../../lib/department-category-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    return Response.json({ departments: await getDepartments(true) }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/departments failed");
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
    return handleApiError(error, "POST /api/admin/departments failed");
  }
}
