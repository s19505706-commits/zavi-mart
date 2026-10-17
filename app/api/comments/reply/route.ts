import { ApiError, handleApiError, isRecord, readJsonBody, requireAdmin } from "../../../../lib/api-utils";
import { updateLocalCommentReply } from "../../../../lib/local-notifications";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.commentId !== "string" || !body.commentId.trim() ||
        typeof body.adminReply !== "string" || !body.adminReply.trim()) {
      throw new ApiError("commentId and adminReply are required.", 400);
    }
    const adminReplyDate = typeof body.adminReplyDate === "string" &&
      Number.isFinite(new Date(body.adminReplyDate).getTime())
      ? new Date(body.adminReplyDate).toISOString()
      : new Date().toISOString();
    const comment = await updateLocalCommentReply(
      body.commentId.trim(),
      body.adminReply.trim().slice(0, 2000),
      adminReplyDate
    );
    if (!comment) throw new ApiError("Review not found.", 404);
    return Response.json({ success: true, comment });
  } catch (error) {
    return handleApiError(error, "POST /api/comments/reply failed");
  }
}
