import mongoose from "mongoose";
import { ApiError, handleApiError, readJsonBody, requireAdmin } from "../../../../../lib/api-utils";
import {
  categoryHasRelations,
  deleteCategory,
  getCategories,
  parseCategoryInput,
  updateCategory
} from "../../../../../lib/category-store";

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
    if (!isValidId(id)) throw new ApiError("A valid category ID is required.", 400);
    const input = parseCategoryInput(await readJsonBody(request));
    if ((await getCategories()).some((category) => category.id !== id && category.slug === input.slug)) {
      throw new ApiError("A category with this slug already exists.", 409);
    }
    const category = await updateCategory(id, input);
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    return Response.json({ success: true, category });
  } catch (error) {
    return handleApiError(error, "PUT /api/admin/categories/[id] failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    if (!isValidId(id)) throw new ApiError("A valid category ID is required.", 400);
    const category = (await getCategories()).find((entry) => entry.id === id);
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    if (await categoryHasRelations(id)) {
      throw new ApiError("Move assigned products before deleting this category.", 409);
    }
    if (!await deleteCategory(id)) return Response.json({ error: "Category not found." }, { status: 404 });
    return Response.json({ success: true, id });
  } catch (error) {
    return handleApiError(error, "DELETE /api/admin/categories/[id] failed");
  }
}
