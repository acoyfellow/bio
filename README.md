# Bio-Authed Edge Agent

A minimal, pragmatic biometric authentication system on Cloudflare Workers with SSR and WebAuthn.

## What This Is

Single "Auth" button flow:
- **New users**: Registers a biometric credential (fingerprint, face, PIN)
- **Existing users**: Logs in with their registered credential
- **Session**: One-tap authentication, persistent session cookie
- **Agent**: Server-side agent runs on auth, results displayed SSR (no client fetch)

No separate login/register screens. No double biometric prompts. One flow, one credential per user.

## Tech Stack

- **Cloudflare Workers**: Serverless runtime
- **D1 Database**: SQLite edge database
- **WebAuthn**: Client-side biometric auth via `@simplewebauthn/server`
- **Hono + JSX**: Lightweight web framework + SSR
- **Drizzle ORM**: Type-safe database queries

## Features

- ✅ Biometric registration & login (single flow)
- ✅ Server-side session management with cookies
- ✅ SSR: Auth state & agent data on page load
- ✅ Works on localhost & production domains
- ✅ Cross-platform authenticators supported (platform + external)
- ✅ User verification via PIN/fingerprint

## Setup

```bash
# Install deps
bun install

# Generate migrations (after schema changes)
bun run db:generate

# Run dev
bun run dev

# Deploy
DOMAINS=yourdomain.com SESSION_SECRET=$(openssl rand -hex 32) bun run deploy
```

**Environment Variables (Production)**:
- `DOMAINS`: Comma-separated list of domains (e.g., `yourdomain.com`)
- `SESSION_SECRET`: 32-character hex string for session signing (generated on deploy if not set)

## Live Demo

[https://bio.coey.dev](https://bio.coey.dev)

**Source**: [github.com/acoyfellow/bio](https://github.com/acoyfellow/bio)

## Project Structure

```
src/
  app.tsx          # SSR UI component with client-side auth flow
  worker.tsx       # Hono routes: registration, login, agent
  webauthn.ts      # WebAuthn setup (start/finish registration & auth)
  d1.ts            # Database helpers (users, credentials, sessions)
  agent.ts         # Agent logic (runs on auth, server-side)
  cookies.ts       # Session cookie helpers
  challenges.ts    # Challenge storage (in-memory, for dev)
  schema.ts        # Drizzle schema
  utils.ts         # Base64 encoding/decoding
```

## Auth Flow

1. User clicks "Auth"
2. Client calls `/webauthn/register/start` → server creates challenge
3. Browser prompts for biometric (fingerprint/face/PIN)
4. Client calls `/webauthn/register/finish` → server verifies, stores credential
5. Server creates session cookie & returns `{ success: true }`
6. Client reloads page
7. Server checks session cookie, runs agent, renders SSR with auth state + agent data
8. User sees "Logged in as: [username]" + agent output + Logout button

Subsequent logins re-use the same credential (same biometric, no re-registration).

## Security

- ✅ Session signing with HMAC
- ✅ Rate limiting on auth endpoints (10 reqs/min per IP)
- ✅ CSRF protection (Origin/Referer validation)
- ✅ Generic error messages (no user enumeration)
- ✅ Counter rollback detection (cloned key protection)
- ✅ Challenges stored in D1 with TTL (no in-memory leaks)
- ✅ HttpOnly, Secure, SameSite=Strict cookies
- ✅ Username validation (alphanumeric + underscore)
- ✅ Input sanitization on agent output

## Notes

- **RP ID**: Auto-detected from hostname (localhost on dev, prod domain in production)
- **User Verification**: Set to `"preferred"` (PIN, fingerprint, or face unlock)
- **Resident Keys**: Not required (single device, single credential per user)
- **Production**: All security features enabled by default

## Why This Approach

- **Minimal**: 400 lines of meaningful code (no bloat)
- **Pragmatic**: Single auth flow eliminates UX confusion
- **SSR**: No flashing or hydration mismatch
- **Fast**: One biometric prompt per auth
- **Secure**: WebAuthn + server-validated sessions

No magic, no overthinking. Auth that just works.

