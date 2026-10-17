import { ApiError, handleApiError, requireAdmin } from "../../../lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE = 350_000;

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiError("Upload must use multipart form data.", 400);
    }

    const entries = formData.getAll("images");
    const files = entries.filter((entry): entry is File => entry instanceof File);
    if (files.length !== entries.length || files.length < 1 || files.length > 4) {
      throw new ApiError("Upload between 1 and 4 image files.", 400);
    }

    const images = await Promise.all(files.map(async (file) => {
      if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE) {
        throw new ApiError("Choose PNG, JPG, WebP, or GIF files no larger than 350 KB each.", 400);
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      return `data:${file.type};base64,${bytes.toString("base64")}`;
    }));

    return Response.json({ images });
  } catch (error) {
    return handleApiError(error, "POST /api/upload failed");
  }
}
