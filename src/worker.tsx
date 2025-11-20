import { getSessionCookie, setSessionCookie, clearSessionCookie } from "./cookies";
import * as d1 from "./d1";
import * as webauthn from "./webauthn";
import { runAgent } from "./agent";
import * as challenges from "./challenges";
import * as security from "./security";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { App } from "./app";
import { html } from "hono/html";

export interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

async function requireAuth(request: Request, env: Env): Promise<string> {
  const sessionId = getSessionCookie(request);
  if (!sessionId) {
    throw new Error("Unauthorized");
  }

  const db = d1.getDb(env.DB);
  const session = await d1.getSession(db, sessionId);
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.userId;
}

const finishAuth = async (userId: string, env: Env) => {
  const authSessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const db = d1.getDb(env.DB);
  await d1.createSession(db, userId, authSessionId, expiresAt);
  return new Response(
    JSON.stringify({ success: true }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setSessionCookie(authSessionId, SESSION_DURATION),
      },
    }
  );
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const db = d1.getDb(env.DB);

    try {
      // Root endpoint
      if (url.pathname === "/" && request.method === "GET") {
        let authState: { authenticated: boolean; username: string | null; userId: string | null } = { authenticated: false, username: null, userId: null };
        let agentData = null;
        try {
          const userId = await requireAuth(request, env);
          const user = await d1.getUserById(db, userId);
          authState = { authenticated: true, username: user?.username || null, userId: userId || null };
          agentData = await runAgent(userId);
        } catch {
          // Not authenticated, use default
        }

        const app = App(authState, agentData);
        return new Response(String(app), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // WebAuthn Registration
      if (url.pathname === "/webauthn/register/start" && request.method === "POST") {
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        if (!security.checkRateLimit(ip, 10, 60000)) {
          return security.genericAuthError();
        }

        const body = await request.json() as { username?: string };
        const username = body.username || `user_${Math.random().toString(36).substr(2, 9)}`;

        if (!security.validateUsername(username)) {
          return security.genericAuthError();
        }

        let user = await d1.getUserByUsername(db, username);
        if (!user) {
          const userId = await d1.createUser(db, username);
          user = await d1.getUserById(db, userId);
        }
        if (!user) throw new Error("Failed to create user");

        const rpId = url.hostname === "localhost" ? "localhost" : url.hostname;
        const options = await webauthn.startRegistration(user.username, user.id, rpId);
        const sessionId = crypto.randomUUID();
        await challenges.storeChallenge(db, sessionId, options.challenge, user.id);

        return Response.json({ ...options, _sessionId: sessionId });
      }

      if (url.pathname === "/webauthn/register/finish" && request.method === "POST") {
        if (!security.validateOrigin(request, url.origin)) {
          return security.genericAuthError();
        }

        const body = await request.json() as { _sessionId: string; [key: string]: any };
        const sessionId = body._sessionId;
        const stored = await challenges.getChallenge(db, sessionId);

        if (!stored) {
          return security.genericAuthError();
        }

        const origin = url.origin;
        const rpId = url.hostname === "localhost" ? "localhost" : url.hostname;
        const result = await webauthn.finishRegistration(body, stored.challenge, stored.userId!, origin, rpId);
        await d1.saveCredential(db, stored.userId!, result.credentialID, result.publicKey);
        await challenges.deleteChallenge(db, sessionId);

        return finishAuth(stored.userId!, env);
      }

      // WebAuthn Login
      if (url.pathname === "/webauthn/login/start" && request.method === "POST") {
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        if (!security.checkRateLimit(ip, 10, 60000)) {
          return security.genericAuthError();
        }

        const body = await request.json() as { username?: string };
        const username = body.username || "user";

        if (!security.validateUsername(username)) {
          return security.genericAuthError();
        }

        const user = await d1.getUserByUsername(db, username);
        if (!user) {
          return security.genericAuthError();
        }

        const credentials = await db.select({ id: schema.credentials.id })
          .from(schema.credentials)
          .where(eq(schema.credentials.userId, user.id));

        const rpId = url.hostname === "localhost" ? "localhost" : url.hostname;
        const options = await webauthn.startAuthentication(
          credentials.map((c) => ({ id: c.id })),
          rpId
        );
        const sessionId = crypto.randomUUID();
        await challenges.storeChallenge(db, sessionId, options.challenge);

        return Response.json({ ...options, _sessionId: sessionId });
      }

      if (url.pathname === "/webauthn/login/finish" && request.method === "POST") {
        if (!security.validateOrigin(request, url.origin)) {
          return security.genericAuthError();
        }

        const body = await request.json() as { _sessionId: string; response: { id: string }; [key: string]: any };
        const sessionId = body._sessionId;
        const stored = await challenges.getChallenge(db, sessionId);

        if (!stored) {
          return security.genericAuthError();
        }

        const credentialId = body.id;

        const credential = await d1.getCredential(db, credentialId);
        if (!credential) {
          return security.genericAuthError();
        }

        const origin = url.origin;
        const rpId = url.hostname === "localhost" ? "localhost" : url.hostname;
        const result = await webauthn.finishAuthentication(body, stored.challenge, {
          id: credential.id,
          publicKey: credential.publicKey,
          counter: credential.counter,
        }, origin, rpId);

        const counterValid = await d1.updateCredentialCounter(db, credential.id, result.newCounter);
        if (!counterValid) {
          return security.genericAuthError();
        }

        await challenges.deleteChallenge(db, sessionId);

        return finishAuth(credential.userId, env);
      }

      // Me endpoint (check auth status)
      if (url.pathname === "/me" && request.method === "GET") {
        try {
          const userId = await requireAuth(request, env);
          const user = await d1.getUserById(db, userId);
          return Response.json({
            authenticated: true,
            userId,
            username: user?.username,
          });
        } catch {
          return Response.json({ authenticated: false });
        }
      }

      // Agent endpoint (requires auth)
      if (url.pathname === "/me/agent" && request.method === "GET") {
        const userId = await requireAuth(request, env);
        const agentResponse = await runAgent(userId);

        return Response.json({
          userId,
          agentResponse,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      // Logout endpoint
      if (url.pathname === "/logout" && request.method === "POST") {
        if (!security.validateOrigin(request, url.origin)) {
          return security.genericAuthError();
        }

        const sessionId = getSessionCookie(request);
        if (sessionId) {
          await d1.deleteSession(db, sessionId);
        }
        return new Response(
          JSON.stringify({ success: true }),
          {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": clearSessionCookie(),
            },
          }
        );
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        return new Response("Unauthorized", { status: 401 });
      }
      console.error(error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
