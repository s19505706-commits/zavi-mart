const DEVELOPMENT_API_URL = "http://192.168.100.117:4242/api";

export function getBackendApiUrl(endpoint: "checkout" | "geocode"): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
    || (process.env.NODE_ENV === "development" ? DEVELOPMENT_API_URL : "");

  if (!configuredUrl) {
    throw new Error("NEXT_PUBLIC_API_URL must be configured for the backend service.");
  }

  const backendUrl = new URL(configuredUrl);
  const basePath = backendUrl.pathname.replace(/\/+$/, "");
  const apiPath = basePath.endsWith("/api") ? basePath : `${basePath}/api`;
  backendUrl.pathname = `${apiPath}/${endpoint}`;
  backendUrl.search = "";
  backendUrl.hash = "";

  return backendUrl;
}
