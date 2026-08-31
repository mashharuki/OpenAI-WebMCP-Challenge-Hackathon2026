import { loadEnv } from "vite";

const environment = {
  ...loadEnv("production", process.cwd(), ""),
  ...process.env,
};
const apiBaseUrl = environment.VITE_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  console.error("VITE_API_BASE_URL is required for a production deployment.");
  process.exitCode = 1;
} else {
  let parsedApiBaseUrl;
  try {
    parsedApiBaseUrl = new URL(apiBaseUrl);
  } catch {
    parsedApiBaseUrl = undefined;
  }

  if (
    parsedApiBaseUrl?.protocol !== "https:" ||
    apiBaseUrl !== parsedApiBaseUrl?.origin
  ) {
    console.error(
      "VITE_API_BASE_URL must be an HTTPS origin without a path or trailing slash.",
    );
    process.exitCode = 1;
  }
}
