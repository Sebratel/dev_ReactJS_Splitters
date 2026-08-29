import { OAuth2Client } from 'google-auth-library';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getFirebaseAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_USERS_COLLECTION = 'splitters_users';

let oauthClient = null;

export function toCleanString(value) {
  return String(value ?? '').trim();
}

export function normalizeEmail(value) {
  return toCleanString(value).toLowerCase();
}

/**
 * Remove aspas envolventes de um valor de variavel de ambiente (ex.: `"algo"` -> `algo`).
 * Paineis como o do Portainer nao interpretam aspas como o `dotenv` faz ao ler um .env
 * local — se alguem colar `FOO="valor"` la, o processo recebe a aspa como parte literal
 * do valor. Isso corrompe segredos como a private key do Firebase Admin (torna o PEM
 * invalido) silenciosamente, sem erro obvio. Aplicar isso nos valores sensiveis evita
 * depender de como cada ambiente (local/staging/producao) foi configurado.
 */
export function stripWrappingQuotes(value) {
  const trimmed = toCleanString(value);
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function cleanEnvValue(value) {
  return stripWrappingQuotes(toCleanString(value));
}

const hubBaseUrl = (
  cleanEnvValue(process.env.HUB_BASE_URL) ||
  cleanEnvValue(process.env.VITE_HUB_ORIGIN) ||
  'https://hub-apps.sebratel.net.br'
).replace(/\/+$/, '');

function buildError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getGoogleClientId() {
  return (
    cleanEnvValue(process.env.GOOGLE_CLIENT_ID) ||
    cleanEnvValue(process.env.VITE_GOOGLE_CLIENT_ID)
  );
}

function getFirebaseAdminCredentialConfig() {
  const projectId =
    cleanEnvValue(process.env.FIREBASE_ADMIN_PROJECT_ID) ||
    cleanEnvValue(process.env.VITE_FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnvValue(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const rawPrivateKey =
    cleanEnvValue(process.env.FIREBASE_ADMIN_PRIVATE_KEY) ||
    cleanEnvValue(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64);
  const privateKey = rawPrivateKey.includes('-----BEGIN')
    ? rawPrivateKey.replace(/\\n/g, '\n')
    : rawPrivateKey
      ? Buffer.from(rawPrivateKey, 'base64').toString('utf8').replace(/\\n/g, '\n').trim()
      : '';

  return { projectId, clientEmail, privateKey };
}

export function isFirebaseAdminAccessConfigured() {
  const { projectId, clientEmail, privateKey } = getFirebaseAdminCredentialConfig();
  return (
    projectId !== '' &&
    clientEmail !== '' &&
    privateKey !== '' &&
    (getGoogleClientId() !== '' || hubBaseUrl !== '')
  );
}

function getOAuthClient() {
  if (oauthClient) return oauthClient;
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw buildError(
      'Protecao admin da ISA nao configurada no servidor (GOOGLE_CLIENT_ID ausente).',
      503,
    );
  }
  oauthClient = new OAuth2Client(clientId);
  return oauthClient;
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const { projectId, clientEmail, privateKey } = getFirebaseAdminCredentialConfig();
  if (!projectId || !clientEmail || !privateKey) {
    throw buildError(
      'Protecao admin da ISA nao configurada no servidor (credenciais Firebase Admin ausentes).',
      503,
    );
  }

  if (!privateKey.startsWith('-----BEGIN') || !privateKey.trimEnd().endsWith('-----')) {
    console.error(
      '[auth] FIREBASE_ADMIN_PRIVATE_KEY parece malformada (nao comeca com -----BEGIN ou nao termina com -----). ' +
        'Verifique se a env var no Portainer nao tem aspas ou caracteres extras colados por engano.',
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

function getFirebaseAdminAuthClient() {
  return getFirebaseAdminAuth(getFirebaseAdminApp());
}

export function extractBearerToken(req) {
  const authorization = toCleanString(req?.headers?.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw buildError('Sessao expirada ou nao autorizada.', 401);
  }
  return match[1].trim();
}

async function verifyGoogleIdentityToken(idToken) {
  const client = getOAuthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: getGoogleClientId(),
  });

  const payload = ticket.getPayload() ?? {};
  const email = normalizeEmail(payload.email);

  if (!email || payload.email_verified !== true) {
    throw buildError('Nao foi possivel validar o e-mail do usuario administrador.', 403);
  }

  return {
    googleSubject: toCleanString(payload.sub),
    email,
    name: toCleanString(payload.name),
  };
}

async function verifyFirebaseIdToken(idToken) {
  const auth = getFirebaseAdminAuthClient();
  const decoded = await auth.verifyIdToken(idToken);
  const email = normalizeEmail(decoded.email);

  if (!email) {
    throw buildError('Nao foi possivel validar o e-mail do usuario administrador.', 403);
  }

  return {
    googleSubject: toCleanString(decoded.uid),
    email,
    name: toCleanString(decoded.name),
  };
}

async function resolveIdentityFromHubSession(authorizationHeader) {
  if (!hubBaseUrl) return null;

  const response = await fetch(`${hubBaseUrl}/auth/session`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authorizationHeader,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(
      `[auth] resolveIdentityFromHubSession: ${hubBaseUrl}/auth/session respondeu ${response.status}`,
      body.slice(0, 300),
    );
    return null;
  }

  const payload = await response.json().catch(() => null);
  const email = normalizeEmail(payload?.email);
  if (!email) {
    console.error('[auth] resolveIdentityFromHubSession: resposta sem email', JSON.stringify(payload)?.slice(0, 300));
    return null;
  }

  return {
    googleSubject: '',
    email,
    name: toCleanString(payload?.name),
  };
}

async function fetchSplittersProfileByEmail(email) {
  const firestore = getFirebaseAdminFirestore();
  const snapshot = await firestore
    .collection(FIRESTORE_USERS_COLLECTION)
    .where('email', '==', normalizeEmail(email))
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data() ?? {};
  const permissions =
    data.permissions && typeof data.permissions === 'object' ? data.permissions : {};

  return {
    uid: doc.id,
    email: normalizeEmail(data.email),
    displayName: toCleanString(data.displayName),
    photoURL: toCleanString(data.photoURL) || null,
    isActive: data.isActive !== false,
    permissions,
  };
}

export async function requireAuthenticatedSplittersUser(req) {
  if (!isFirebaseAdminAccessConfigured()) {
    throw buildError(
      'Autenticacao do backend indisponivel: credenciais Firebase Admin ou fonte de identidade ausentes.',
      503,
    );
  }

  const token = extractBearerToken(req);
  const authorizationHeader = `Bearer ${token}`;
  let identity = null;

  try {
    identity = await verifyFirebaseIdToken(token);
  } catch (error) {
    console.error('[auth] verifyFirebaseIdToken falhou:', error?.message);
    identity = null;
  }

  try {
    if (getGoogleClientId() !== '') {
      identity = identity ?? (await verifyGoogleIdentityToken(token));
    }
  } catch (error) {
    console.error('[auth] verifyGoogleIdentityToken falhou:', error?.message);
    identity = identity ?? null;
  }

  if (!identity) {
    try {
      identity = await resolveIdentityFromHubSession(authorizationHeader);
    } catch (error) {
      console.error('[auth] resolveIdentityFromHubSession falhou:', error?.message);
      identity = null;
    }
  }

  if (!identity?.email) {
    throw buildError('Sessao expirada ou nao autorizada.', 401);
  }

  const profile = await fetchSplittersProfileByEmail(identity.email);

  if (!profile) {
    throw buildError('Usuario nao encontrado no controle de acesso do Splitters.', 403);
  }
  if (!profile.isActive) {
    throw buildError('Seu usuario esta inativo. Contate um administrador.', 403);
  }

  return { identity, profile };
}

export async function requireSplittersAdminAccess(
  req,
  message = 'Somente administradores podem executar esta acao.',
) {
  const actor = await requireAuthenticatedSplittersUser(req);
  if (actor.profile?.permissions?.isAdmin !== true) {
    throw buildError(message, 403);
  }
  return actor;
}

/**
 * Exige que o usuario autenticado tenha uma permissao especifica (ex.: 'canViewMassiva').
 * Admin passa por qualquer permissao (isAdmin implica acesso total).
 * @param {import('express').Request} req
 * @param {string} permission — chave em profile.permissions
 * @param {string} [message]
 */
export async function requireSplittersPermission(
  req,
  permission,
  message = 'Voce nao tem permissao para executar esta acao.',
) {
  const actor = await requireAuthenticatedSplittersUser(req);
  const perms = actor.profile?.permissions ?? {};
  if (perms.isAdmin === true || perms[permission] === true) {
    return actor;
  }
  throw buildError(message, 403);
}

export async function requireIsaAdminAccess(req) {
  return requireSplittersAdminAccess(
    req,
    'Somente administradores podem alterar a configuracao da ISA.',
  );
}
