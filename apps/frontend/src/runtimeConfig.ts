export const resolveApiBaseUrl = (
  configured: string | undefined,
  pageOrigin: string,
): string => {
  const url = new URL(configured?.trim() || pageOrigin);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTP or HTTPS.");
  }
  return url.toString();
};
