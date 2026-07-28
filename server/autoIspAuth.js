/**
 * Autenticação AutoISP no backend — as credenciais (AUTOISP_USERNAME/PASSWORD)
 * ficam SÓ no servidor. O browser pede um token curto via GET /api/autoisp/token,
 * então usuário/senha nunca vão para o bundle do frontend.
 */

const DEFAULT_EXPIRES_IN_SEC = 3600;

function authEndpoint() {
  return String(process.env.AUTOISP_AUTH_ENDPOINT || '').trim();
}
function autoIspUsername() {
  return String(process.env.AUTOISP_USERNAME || '').trim();
}
function autoIspPassword() {
  return String(process.env.AUTOISP_PASSWORD || '');
}

export function isAutoIspAuthConfigured() {
  return authEndpoint() !== '' && autoIspUsername() !== '' && autoIspPassword() !== '';
}

/** Extrai o token do corpo de resposta (mesma heurística do antigo cliente do front). */
function extractTokenFromAuthBody(data) {
  if (typeof data === 'string') {
    const s = data.trim();
    return s.length > 20 ? s : null;
  }
  if (data === null || typeof data !== 'object') return null;

  const queue = [data];
  const seen = new Set();
  while (queue.length > 0) {
    const cur = queue.pop();
    if (cur === null || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      for (const x of cur) queue.push(x);
      continue;
    }
    for (const key of ['token', 'access_token', 'accessToken', 'jwt', 'id_token', 'idToken', 'bearer']) {
      const v = cur[key];
      if (typeof v === 'string' && v.trim().length > 12) return v.trim();
    }
    for (const v of Object.values(cur)) {
      if (v !== null && typeof v === 'object') queue.push(v);
    }
  }
  return null;
}

function pickExpiresInSeconds(data) {
  const raw =
    (data && data.expires_in) ??
    (data && data.response && data.response.expires_in) ??
    (data && data.expiresIn);
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_EXPIRES_IN_SEC;
}

let cachedToken = null;
let tokenExpiresAtMs = 0;

async function authenticate() {
  const res = await fetch(authEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' },
    body: JSON.stringify({ username: autoIspUsername(), password: autoIspPassword() }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AutoISP auth HTTP ${res.status}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  const token = extractTokenFromAuthBody(data);
  if (!token) {
    throw new Error('AutoISP não retornou um token válido.');
  }

  const expiresInSec = pickExpiresInSeconds(data);
  // Renova com folga (mesma margem do antigo cliente): 15% do TTL, entre 60s e 300s.
  const slackSec = Math.min(300, Math.max(60, Math.floor(expiresInSec * 0.15)));
  const usableSec = Math.max(30, expiresInSec - slackSec);
  cachedToken = token;
  tokenExpiresAtMs = Date.now() + usableSec * 1000;
  return { token, expiresInSec: usableSec };
}

/** Token válido em cache (compartilhado entre requisições) ou renova. */
export async function getAutoIspToken() {
  if (cachedToken && Date.now() < tokenExpiresAtMs) {
    return { token: cachedToken, expiresInSec: Math.max(30, Math.floor((tokenExpiresAtMs - Date.now()) / 1000)) };
  }
  return authenticate();
}
