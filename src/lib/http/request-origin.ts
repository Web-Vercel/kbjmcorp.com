/** Next's internal request URL can use the listener host instead of the browser host. */
export function hasSameOrigin(request: Request, required = true) {
  const origin = request.headers.get("origin");
  if (!origin) return !required;
  try {
    const url = new URL(request.url);
    const host = request.headers.get("host") || url.host;
    // Trust Vercel's protocol header only in Vercel's managed runtime.
    const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-proto") : null;
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : url.protocol;
    return origin === new URL(`${protocol}//${host}`).origin;
  } catch { return false; }
}
