import { OAuth2Client } from 'google-auth-library';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getFirebaseAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_USERS_COLLECTION = 'splitters_users';
const hubBaseUrl = (
  process.env.HUB_BASE_URL ||
  process.env.VITE_HUB_ORIGIN ||
  'https://sebratel-hub.web.app'
).replace(/\/+$/, '');

let oauthClient = null;

export function toCleanString(value) {
  return String(value ?? '').trim();
}

export function normalizeEmail(value) {
  return toCleanString(value).toLowerCase();
}

function buildError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getGoogleClientId() {
  return (
    toCleanString(process.env.GOOGLE_CLIENT_ID) ||
    toCleanString(process.env.VITE_GOOGLE_CLIENT_ID)
  );
}

function getFirebaseAdminCredentialConfig() {
  const projectId =
    toCleanString(process.env.FIREBASE_ADMIN_PROJECT_ID) ||
    toCleanString(process.env.VITE_FIREBASE_PROJECT_ID);
  const clientEmail = toCleanString(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const rawPrivateKey =
    toCleanString(process.env.FIREBASE_ADMIN_PRIVATE_KEY) ||
    toCleanString(process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64);
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

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const email = normalizeEmail(payload?.email);
  if (!email) return null;

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
  } catch {
    identity = null;
  }

  try {
    if (getGoogleClientId() !== '') {
      identity = identity ?? (await verifyGoogleIdentityToken(token));
    }
  } catch {
    identity = identity ?? null;
  }

  if (!identity) {
    identity = await resolveIdentityFromHubSession(authorizationHeader);
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

export async function requireIsaAdminAccess(req) {
  return requireSplittersAdminAccess(
    req,
    'Somente administradores podem alterar a configuracao da ISA.',
  );
}
