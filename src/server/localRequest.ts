/** Bind a loopback request to the browser's exact origin, allowing Next's hostname normalization. */
export function isLocalRequest(request: Request, header: string, value: string): boolean {
  const url = new URL(request.url);
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? url.host;
  let browserOrigin: URL;
  try { browserOrigin = new URL(`${url.protocol}//${host}`); } catch { return false; }
  const loopback = (hostname: string) => ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
  return loopback(url.hostname) && loopback(browserOrigin.hostname) && browserOrigin.host === host &&
    browserOrigin.port === url.port && (origin === null || origin === browserOrigin.origin) &&
    (site === null || site === "same-origin" || site === "none") && request.headers.get(header) === value;
}
