// Rate limiting: simple in-memory cache per IP
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitCache.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// CSRF validation
export function validateOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin && origin !== expectedOrigin) return false;
  if (referer && !referer.startsWith(expectedOrigin)) return false;

  return true;
}

// Session signing with HMAC
export async function signSession(sessionId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${sessionId}.${signatureHex}`;
}

export async function verifySession(signedSession: string, secret: string): Promise<string | null> {
  const [sessionId, sig] = signedSession.split(".");
  if (!sessionId || !sig) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId));
  const expectedSig = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return sig === expectedSig ? sessionId : null;
}

// Generic error response (no user enumeration)
export function genericAuthError(): Response {
  return Response.json({ error: "Authentication failed" }, { status: 401 });
}

// Input validation
export function validateUsername(username: string): boolean {
  if (!username || username.length < 1 || username.length > 64) return false;
  return /^[a-zA-Z0-9_]+$/.test(username);
}

// Sanitize HTML from agent output
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

