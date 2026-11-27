// ─────────────────────────────────────────────────────────────────────────
// Entrada pelo Hub Apps: o Splitters aberto DENTRO do Hub (iframe).
//
// Como funciona:
//   1. A pessoa clica no Splitters no Hub. O Hub confere se ela tem acesso ao
//      app e emite um token de 5 min (JWT HS256 assinado com SSO_JWT_SECRET,
//      com { sub, email, name, appId }).
//   2. O iframe abre https://splitters…/?sso_token=<token>. A tela tira o
//      token da URL antes do React montar e manda para POST /api/auth/hub.
//   3. Aqui o token é conferido (assinatura, validade, appId, domínio, uso
//      único) e trocado por um TOKEN PERSONALIZADO do Firebase
//      (firebaseAdminAuth.mintHubFirebaseCustomToken). A tela entra com
//      signInWithCustomToken: sem popup e sem redirecionar para o Google,
//      que se recusa a abrir dentro de um iframe.
//
// O Splitters já vive no Firebase (perfil e permissões em splitters_users),
// então a "sessão" do guia de integração é a própria sessão do Firebase: o
// ID token sai com a marca `hub: true`, e o BFF usa essa marca para o
// HUB_ONLY. As permissões continuam vindo do Firestore, nunca do token.
//
// HUB_ONLY liga o "só pelo Hub": login direto pelo Google passa a ser
// recusado para todo mundo, sem exceção (nem admin master).
// ─────────────────────────────────────────────────────────────────────────
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const ALLOWED_DOMAIN = 'sebratel.com.br';
const ABRA_DE_NOVO = 'Abra o Splitters de novo pelo Hub Apps.';

function envValue(name) {
  const raw = String(process.env[name] ?? '').trim();
  // Mesmo cuidado do firebaseAdminAuth: o painel do Portainer não tira aspas.
  if (raw.length >= 2 && ((raw[0] === '"' && raw.at(-1) === '"') || (raw[0] === "'" && raw.at(-1) === "'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function hubSecret() {
  return envValue('HUB_SSO_SECRET');
}

/** Id do Splitters na tabela `apps` do DB_Hub_Apps (o Hub grava no token). */
export function hubAppId() {
  return envValue('HUB_APP_ID');
}

/** Os dois valores obrigatórios estão na stack? */
export function hubSsoConfigured() {
  return hubSecret() !== '' && hubAppId() !== '';
}

/**
 * "Só pelo Hub" valendo. Sem a entrada pelo Hub configurada, ligar HUB_ONLY
 * trancaria todo mundo (ninguém entra pelo Hub nem direto) — então só vale
 * com as duas pontas prontas.
 */
export function hubOnlyActive() {
  return /^(1|true|yes|sim)$/i.test(envValue('HUB_ONLY')) && hubSsoConfigured();
}

/** Confere forma, algoritmo e assinatura de um JWT HS256. Devolve o payload ou null. */
export function verifyHs256(token, key) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSig] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  // Só HS256: aceitar o algoritmo que vem no cabeçalho abriria o "alg: none".
  if (header?.alg !== 'HS256') return null;
  const esperado = createHmac('sha256', key).update(`${rawHeader}.${rawPayload}`).digest();
  const recebido = Buffer.from(rawSig, 'base64url');
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

// Uso único: o token viaja na URL do iframe, então pode parar em histórico ou
// log de proxy. Quem o encontrar depois não consegue reaproveitar — mesmo
// dentro dos 5 minutos. Em memória basta: o BFF roda num contêiner só, e
// depois de um restart o token já está perto de vencer de qualquer forma.
const usados = new Map();

function marcarUso(token, expS) {
  const agoraMs = Date.now();
  for (const [k, exp] of usados) if (exp <= agoraMs) usados.delete(k);
  const id = createHash('sha256').update(token).digest('hex');
  if (usados.has(id)) return false;
  usados.set(id, expS * 1000);
  return true;
}

function recusa(error, status = 401) {
  return { ok: false, status, error };
}

/**
 * Confere o token de lançamento emitido pelo Hub Apps.
 * @returns {{ ok: true, email: string, name: string } | { ok: false, status: number, error: string }}
 */
export function verifyHubLaunchToken(token) {
  if (!hubSsoConfigured()) {
    return recusa(
      'O acesso pelo Hub Apps não está configurado neste servidor (HUB_SSO_SECRET e HUB_APP_ID).',
      503,
    );
  }
  const raw = String(token ?? '').trim();
  const p = verifyHs256(raw, hubSecret());
  if (!p) return recusa(`Token do Hub inválido. ${ABRA_DE_NOVO}`);

  const agora = Math.floor(Date.now() / 1000);
  const exp = Number(p.exp ?? 0);
  const iat = Number(p.iat ?? 0);
  if (!exp || exp <= agora) return recusa(`O link de acesso venceu. ${ABRA_DE_NOVO}`);
  if (iat && iat > agora + 300) return recusa(`Token do Hub inválido. ${ABRA_DE_NOVO}`);

  if (String(p.appId ?? '') !== hubAppId()) {
    return recusa('Este token do Hub foi emitido para outro aplicativo.', 403);
  }
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return recusa(`Somente contas @${ALLOWED_DOMAIN} acessam o Splitters.`, 403);
  }
  if (!marcarUso(raw, exp)) return recusa(`Este link de acesso já foi usado. ${ABRA_DE_NOVO}`);

  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : email;
  return { ok: true, email, name };
}

/** Só para teste: esquece os tokens já usados. */
export function __resetHubReplayForTest() {
  usados.clear();
}
