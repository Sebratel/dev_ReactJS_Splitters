/**
 * Regras puras de "cliente já faz parte de outro evento aberto" (sem banco, sem rede).
 *
 * Um cliente não pode estar em dois eventos ao mesmo tempo: ele já está sinalizado (linha em
 * assignment_clients) e não "sobe" de novo na base. Ao abrir um novo evento, esses clientes não
 * vão junto — mas a abertura não é bloqueada, e o operador é avisado de quais são e de qual evento.
 */

export const MAX_CONTRACT_IDS = 5000;

/** Contratos únicos e válidos (inteiros positivos), limitados a MAX_CONTRACT_IDS. */
export function normalizeContractIds(input) {
  const out = new Set();
  for (const raw of Array.isArray(input) ? input : []) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) out.add(n);
    if (out.size >= MAX_CONTRACT_IDS) break;
  }
  return [...out];
}

const toIso = (value) => {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Agrupa as linhas (uma por cliente × evento) por evento.
 * Cada linha: { contract_id, user_pppoe, protocol, title, opened_at, finish_date }.
 * Retorna { events, contractIds }: `events` ordenado por protocolo, com os clientes de cada um;
 * `contractIds` é a união (sem repetição) de todos os clientes que já estão em algum evento.
 * `origin` fica 'massiva' nesta fase (a GMUD entra na fase seguinte).
 */
export function groupConflictsByEvent(rows) {
  const byProtocol = new Map();
  const contractIds = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    const protocol = Number(r?.protocol);
    const contractId = Number(r?.contract_id);
    if (!Number.isInteger(protocol) || protocol <= 0 || !Number.isInteger(contractId) || contractId <= 0) continue;
    let ev = byProtocol.get(protocol);
    if (!ev) {
      ev = {
        origin: String(r?.origin ?? '').toUpperCase() === 'GMUD' ? 'gmud' : 'massiva',
        protocol,
        title: String(r?.title ?? '').trim(),
        openedAt: toIso(r?.opened_at),
        finishDate: toIso(r?.finish_date),
        clients: [],
        seen: new Set(),
      };
      byProtocol.set(protocol, ev);
    }
    if (!ev.seen.has(contractId)) {
      ev.seen.add(contractId);
      ev.clients.push({ contractId, pppoe: String(r?.user_pppoe ?? '').trim() });
    }
    contractIds.add(contractId);
  }
  const events = [...byProtocol.values()]
    .sort((a, b) => a.protocol - b.protocol)
    .map(({ seen: _seen, ...ev }) => ev);
  return { events, contractIds: [...contractIds] };
}
