import { getBackendApiUrl } from "../../../lib/backend-api";

export async function POST(request: Request) {
  let response: Response;

  try {
    response = await fetch(getBackendApiUrl("checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store"
    });
  } catch (error) {
    console.error("Checkout API proxy failed:", error);
    return Response.json(
      { error: "The order service is unavailable. Please try again shortly." },
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
