export function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("session="));
  if (!sessionCookie) return null;

  return sessionCookie.split("=")[1] || null;
}

export function setSessionCookie(sessionId: string, maxAge: number = 86400 * 7): string {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

