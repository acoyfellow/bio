const scriptContent = `
const setStatus = (cls, txt) => {
  const el = document.getElementById('status');
  el.className = cls;
  el.textContent = txt;
};

const b64decode = b => {
  const s = b.replace(/-/g, '+').replace(/_/g, '/');
  const p = s.length % 4;
  const pad = p ? s + '='.repeat(4 - p) : s;
  const bin = atob(pad);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0))).buffer;
};

const b64encode = buf => {
  const b = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
};

async function auth() {
  const status = document.getElementById('status');
  status.className = 'info';
  status.textContent = 'Authenticating...';
  try {
    const {_sessionId, ...opts} = await fetch('/webauthn/register/start', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {'Content-Type': 'application/json'}
    }).then(r => r.json());
    
    const pk = {...opts, challenge: b64decode(opts.challenge), user: {...opts.user, id: b64decode(opts.user.id)}};
    const cred = await navigator.credentials.create({publicKey: pk});
    const resp = {
      id: cred.id,
      rawId: b64encode(cred.rawId),
      response: {
        clientDataJSON: b64encode(cred.response.clientDataJSON),
        attestationObject: b64encode(cred.response.attestationObject),
      },
      type: cred.type,
      _sessionId
    };
    
    await fetch('/webauthn/register/finish', {
      method: 'POST',
      body: JSON.stringify(resp),
      headers: {'Content-Type': 'application/json'}
    });
    
    status.className = 'success';
    status.textContent = 'Authenticated! Reloading...';
    setTimeout(() => window.location.reload(), 500);
  } catch (e) {
    status.className = 'error';
    status.textContent = 'Auth failed: ' + e.message;
  }
}

async function logout() {
  const status = document.getElementById('status');
  status.className = 'info';
  status.textContent = 'Logging out...';
  try {
    await fetch('/logout', { method: 'POST' });
    status.className = 'success';
    status.textContent = 'Logged out! Reloading...';
    setTimeout(() => window.location.reload(), 500);
  } catch (e) {
    status.className = 'error';
    status.textContent = 'Logout failed: ' + e.message;
  }
}
`;

import { raw } from "hono/html";
import * as security from "./security";

export function App(authState?: { authenticated: boolean; username: string | null; userId: string | null }, agentData?: string | null) {
  const sanitizedAgentData = agentData ? security.sanitizeText(agentData) : null;
  const auth = authState || { authenticated: false, username: null, userId: null };
  return (
    <html>
      <head>
        <title>Bio-Authed Edge Agent</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; font-size: 16px; }
          @media (max-width: 640px) { body { margin: 30px auto; padding: 16px; font-size: 14px; } }
          
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; gap: 12px; }
          .header-links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
          .header-links a { font-size: 13px; color: #0d6efd; text-decoration: none; }
          .header-links a:hover { text-decoration: underline; }
          
          h1 { margin: 30px 0 20px 0; }
          
          button { padding: 12px 24px; font-size: 16px; cursor: pointer; border: none; border-radius: 4px; }
          @media (max-width: 640px) { button { padding: 10px 16px; font-size: 14px; } }
          
          #status { margin-top: 20px; padding: 10px; border-radius: 4px; }
          .success { background: #d4edda; color: #155724; }
          .error { background: #f8d7da; color: #721c24; }
          .info { background: #d1ecf1; color: #0c5460; }
          .authenticated { background: #d1ecf1; color: #0c5460; margin-bottom: 20px; padding: 12px; border-radius: 4px; font-weight: 500; }
          .not-authenticated { background: #fff3cd; color: #856404; margin-bottom: 20px; padding: 12px; border-radius: 4px; font-weight: 500; }
          #agent-data { background: #e7f3ff; border: 1px solid #b3d9ff; color: #004085; margin-top: 20px; padding: 12px; border-radius: 4px; overflow-x: auto; }
        `}</style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">Bio</h1>
          <div class="header-links">
            <a href="https://x.com/acoyfellow">X</a>
            <a href="https://github.com/acoyfellow/bio">GitHub</a>
          </div>
        </div>
        <div class={auth.authenticated ? "authenticated" : "not-authenticated"}>
          {auth.authenticated ? `Logged in as: ${auth.username || auth.userId}` : "Not authenticated"}
        </div>
        {auth.authenticated ? (
          <div>
            <button onclick="logout()" style="background: #6c757d; color: white;">Logout</button>
          </div>
        ) : (
          <div>
            <button onclick="auth()" style="background: #198754; color: white;">Auth</button>
          </div>
        )}
        {sanitizedAgentData && <div id="agent-data">{sanitizedAgentData}</div>}
        <div id="status"></div>
        <script>{raw(scriptContent)}</script>
      </body>
    </html>
  );
}
