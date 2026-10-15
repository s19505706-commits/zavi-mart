import mongoose from "mongoose";
import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../../../lib/api-utils";
import {
  deleteDepartmentRecord,
  departmentHasProducts,
  getCategories,
  getDepartments,
  parseDepartmentInput,
  updateDepartment
} from "../../../../../lib/department-category-store";
import { deleteCategory } from "../../../../../lib/category-store";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

function isValidId(id: string): boolean {
  return mongoose.isValidObjectId(id) || /^[\da-f-]{36}$/i.test(id);
}

export async function PUT(request: Request, context: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    if (!isValidId(id)) throw new ApiError("A valid department ID is required.", 400);
    const input = parseDepartmentInput(await readJsonBody(request));
    if ((await getDepartments()).some((department) => department.id !== id && department.slug === input.slug)) {
      throw new ApiError("A department with this slug already exists.", 409);
    }
    const department = await updateDepartment(id, input);
    if (!department) return Response.json({ error: "Department not found." }, { status: 404 });
    return Response.json({ success: true, department });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/departments/[id] failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    if (!isValidId(id)) throw new ApiError("A valid department ID is required.", 400);
    const department = (await getDepartments()).find((entry) => entry.id === id);
    if (!department) return Response.json({ error: "Department not found." }, { status: 404 });
    if (await departmentHasProducts(id)) {
      throw new ApiError("Move assigned products before deleting this department.", 409);
    }
    const childCategories = await getCategories(true, id);
    for (const category of childCategories) await deleteCategory(category.id);
    if (!await deleteDepartmentRecord(id)) {
      return Response.json({ error: "Department not found." }, { status: 404 });
    }
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/departments/[id] failed");
  }
}
