/**
 * Reinclusão de clientes que ficaram de fora de um evento por já estarem em outro (regras puras).
 *
 * Um cliente não entra em dois eventos. Quando ele ficou de fora do evento B porque estava no A, e o A
 * fecha enquanto o B continua aberto, o cliente continua afetado pelo B: precisa voltar a ser sinalizado.
 * Cada cliente excluído fica registrado (event_suppressed_clients) e é reavaliado a cada ciclo:
 *  - evento B encerrado           -> resolve sem reincluir;
 *  - ainda em outro evento aberto -> espera;
 *  - livre e B aberto             -> reinclui.
 */

const text = (v) => String(v ?? '').trim();

export const EVENT_TYPES = Object.freeze({ MASSIVA: 'massiva', GMUD: 'gmud' });

export function readReinclusionConfig(env = process.env) {
  const flag = (name, fallback) => {
    const raw = text(env[name]).toLowerCase();
    if (raw === '') return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
  };
  const n = Number.parseInt(text(env.EVENT_REINCLUSION_INTERVAL_MINUTES), 10);
  return {
    enabled: flag('EVENT_REINCLUSION_ENABLED', false),
    dryRun: flag('EVENT_REINCLUSION_DRY_RUN', true),
    intervalMinutes: Number.isFinite(n) ? Math.min(1440, Math.max(1, n)) : 5,
  };
}

/** Agrupa as linhas pendentes por evento: [{ key, eventType, eventProtocol, rows }]. */
export function groupPendingByEvent(rows) {
  const groups = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const eventType = text(r?.eventType);
    const eventProtocol = Number(r?.eventProtocol);
    const contractId = Number(r?.contractId);
    if (!Object.values(EVENT_TYPES).includes(eventType) || !(eventProtocol > 0) || !(contractId > 0)) continue;
    const key = `${eventType}:${eventProtocol}`;
    if (!groups.has(key)) groups.set(key, { key, eventType, eventProtocol, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()];
}

/**
 * Decide o que fazer com um evento.
 *  - info: { open: boolean, assignmentId: number|null } (open=false se o evento já encerrou ou sumiu);
 *  - blockedContractIds: contratos que AINDA estão em outro evento aberto.
 * Retorna { action: 'resolver' | 'reincluir' | 'esperar', reason?, free?, waiting? }.
 */
export function planGroup({ group, info, blockedContractIds = new Set() }) {
  if (!info || info.open !== true) return { action: 'resolver', reason: 'evento_encerrado' };
  const free = [];
  const waiting = [];
  for (const r of group.rows) (blockedContractIds.has(Number(r.contractId)) ? waiting : free).push(r);
  if (free.length === 0) return { action: 'esperar', waiting };
  if (!(Number(info.assignmentId) > 0)) return { action: 'esperar', waiting: group.rows, reason: 'sem_assignment' };
  return { action: 'reincluir', free, waiting };
}

/** Motivo (texto que o cliente verá) quando a linha original não guardou o dele. */
export function fallbackReason(eventType, protocol) {
  return eventType === EVENT_TYPES.GMUD
    ? `Manutenção programada (GMUD ${protocol})`
    : `Massiva (protocolo ${protocol}): clientes afetados`;
}
