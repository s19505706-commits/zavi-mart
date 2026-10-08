import { getBackendApiUrl } from "../../../lib/backend-api";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return Response.json({ error: "Enter a delivery address to locate it." }, { status: 400 });
  }

  let response: Response;

  try {
    const target = getBackendApiUrl("geocode");
    target.searchParams.set("q", query);
    response = await fetch(target, { cache: "no-store" });
  } catch (error) {
    console.error("Address lookup proxy failed:", error);
    return Response.json(
      { error: "The address lookup service is unavailable. You can still place the pin manually." },
      { status: 502 }
    );
  }

  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json"
    }
  });
}
