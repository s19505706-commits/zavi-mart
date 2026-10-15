import * as flashDeals from "../flash-deals/route";
import * as hotDeals from "../hot-deals/route";

type DealType = "flash" | "hot";
type Handler = (request: Request) => Promise<Response>;

function getDealType(request: Request): DealType | null {
  const type = new URL(request.url).searchParams.get("type");
  return type === "flash" || type === "hot" ? type : null;
}

function dispatch(request: Request, method: "GET" | "POST" | "PUT" | "DELETE"): Promise<Response> {
  const type = getDealType(request);
  if (!type) {
    return Promise.resolve(Response.json(
      { error: "type must be either 'flash' or 'hot'." },
      { status: 400 }
    ));
  }

  const handlers = type === "flash" ? flashDeals : hotDeals;
  switch (method) {
    case "GET":
      return handlers.GET(request);
    case "POST":
      return handlers.POST(request);
    case "PUT":
      return handlers.PUT(request);
    case "DELETE":
      return handlers.DELETE(request);
  }
}

export const GET = (request: Request) => dispatch(request, "GET");
export const POST = (request: Request) => dispatch(request, "POST");
export const PUT = (request: Request) => dispatch(request, "PUT");
export const DELETE = (request: Request) => dispatch(request, "DELETE");
