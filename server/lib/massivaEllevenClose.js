/**
 * Encerra/cancela uma massiva no Elleven pelo gateway, a partir do backend (sem depender do navegador).
 *
 * Antes, o navegador fazia os 3 passos (Elleven -> limpar afetados -> gravar MySQL) e, se a aba fechasse
 * no meio, o Elleven ficava encerrado e o histórico local "aberta". Agora o backend faz os 3 passos em
 * uma única requisição que continua rodando mesmo se o navegador desconectar.
 *
 * Config (env do backend): GATEWAY_ORIGIN, GATEWAY_BASIC_AUTH_USER, GATEWAY_BASIC_AUTH_PASSWORD (as mesmas
 * do cancelamento de GMUD). Opcionais: MASSIVA_CLOSE_PATH, MASSIVA_CLOSE_INCIDENT_STATUS_ID (4),
 * MASSIVA_CANCEL_INCIDENT_STATUS_ID (8), MASSIVA_AFFECTED_USERS_PATH.
 */

const DEFAULT_CLOSE_PATH = '/api/v1/massivas/finalizar-chamado-via-api';
const DEFAULT_AFFECTED_PATH = '/api/v1/afetados';

export const MASSIVA_FINALIZE_MODES = Object.freeze({ ENCERRAR: 'encerrar', CANCELAR: 'cancelar' });

function gatewayConfig(env) {
  const origin = String(env.GATEWAY_ORIGIN ?? '').trim().replace(/\/+$/, '');
  const user = String(env.GATEWAY_BASIC_AUTH_USER ?? '').trim();
  const password = String(env.GATEWAY_BASIC_AUTH_PASSWORD ?? '');
  if (origin === '' || user === '' || password === '') return null;
  return { origin, authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` };
}

function normalizePath(path, fallback) {
  const trimmed = String(path ?? '').trim() || fallback;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function isMassivaGatewayConfigured(env = process.env) {
  return gatewayConfig(env) !== null;
}

/** Data/hora de Brasília no formato `yyyy-MM-ddTHH:mm:ss` (igual ao que o frontend enviava em closedAt). */
export function nowBrazilIsoLike(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const m = new Map(parts.map((p) => [p.type, p.value]));
  const hour = m.get('hour') === '24' ? '00' : m.get('hour');
  return `${m.get('year')}-${m.get('month')}-${m.get('day')}T${hour}:${m.get('minute')}:${m.get('second')}`;
}

/**
 * Encerra (incidentStatusId 4) ou cancela (8) o protocolo no Elleven.
 * Retorna { ok:true } | { ok:false, notConfigured?:true, reason }.
 */
export async function finalizeMassivaInElleven(
  { assignmentId, description, mode },
  { env = process.env, fetchImpl = fetch } = {},
) {
  const cfg = gatewayConfig(env);
  if (!cfg) {
    return { ok: false, notConfigured: true, reason: 'Gateway não configurado no backend (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).' };
  }
  const id = Number(assignmentId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, reason: 'assignmentId inválido.' };
  }
  const cancelar = mode === MASSIVA_FINALIZE_MODES.CANCELAR;
  const body = {
    assignmentId: String(id),
    incidentStatusId: String(
      cancelar ? env.MASSIVA_CANCEL_INCIDENT_STATUS_ID || '8' : env.MASSIVA_CLOSE_INCIDENT_STATUS_ID || '4',
    ),
    description,
    progress: '0',
    priority: '35',
    notificationTarget: '0',
    privateReport: 'true',
  };
  try {
    const response = await fetchImpl(`${cfg.origin}${normalizePath(env.MASSIVA_CLOSE_PATH, DEFAULT_CLOSE_PATH)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: cfg.authorization },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return { ok: false, reason: `Elleven/gateway recusou (HTTP ${response.status}).` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `Falha ao chamar o gateway: ${error?.message ?? 'erro desconhecido'}` };
  }
}

/** Limpa os afetados do protocolo no gateway. Auxiliar: nunca lança; devolve { ok }. */
export async function cleanupMassivaAffected({ protocol }, { env = process.env, fetchImpl = fetch } = {}) {
  const cfg = gatewayConfig(env);
  const proto = Number(protocol);
  if (!cfg || !Number.isFinite(proto) || proto <= 0) return { ok: false, skipped: true };
  try {
    const base = normalizePath(env.MASSIVA_AFFECTED_USERS_PATH, DEFAULT_AFFECTED_PATH).replace(/\/+$/, '');
    const response = await fetchImpl(`${cfg.origin}${base}/protocol/${encodeURIComponent(String(proto))}`, {
      method: 'DELETE',
      headers: { Authorization: cfg.authorization },
      signal: AbortSignal.timeout(15000),
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
