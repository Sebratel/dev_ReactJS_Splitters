/**
 * Cliente do gateway para os clientes da GMUD em assignment_clients (POST/PATCH/DELETE /api/v1/afetados).
 * Mesma autenticação da conferência (GATEWAY_ORIGIN + GATEWAY_BASIC_AUTH_*). Sem estado, sem banco.
 */
import { gatewayConfig } from './massivaConferenciaElleven.js';
import { toLocalDateTimeIso } from './gmudClientSync.js';

const TIMEOUT_MS = 60_000;
/** Clientes por POST (o gateway confere conflito por pedido). */
export const POST_CHUNK = 1000;

const AFETADOS = '/api/v1/afetados';

export function createGmudGatewayClient({ env = process.env, fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const cfg = gatewayConfig(env);

  const call = async (method, path, body) => {
    const response = await fetchImpl(`${cfg.origin}${path}`, {
      method,
      headers: {
        Authorization: cfg.authorization,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await response.json().catch(() => null);
    return { response, json };
  };

  const describe = (response, json) =>
    `HTTP ${response.status}${json?.message ? ` — ${String(json.message).slice(0, 200)}` : ''}`;

  const client = {
    configured: cfg !== null,

    /** Remove todas as linhas do protocolo (a GMUD tem protocolo próprio, sem colisão com massiva). */
    async removeByProtocol(protocol) {
      try {
        const { response, json } = await call('DELETE', `${AFETADOS}/protocol/${encodeURIComponent(protocol)}`);
        return response.ok ? { ok: true } : { ok: false, reason: `Gateway recusou a remoção (${describe(response, json)}).` };
      } catch (error) {
        return { ok: false, reason: `Falha ao remover no gateway: ${error?.message ?? 'erro desconhecido'}` };
      }
    },

    /** Atualiza a previsão de fim de todas as linhas do protocolo. `finishDateNaive`: 'YYYY-MM-DD HH:mm:ss'. */
    async updateFinishDate(protocol, finishDateNaive) {
      try {
        const q = encodeURIComponent(toLocalDateTimeIso(finishDateNaive));
        const { response, json } = await call('PATCH', `${AFETADOS}/protocol/${encodeURIComponent(protocol)}?finishDate=${q}`);
        return response.ok ? { ok: true } : { ok: false, reason: `Gateway recusou a nova previsão (${describe(response, json)}).` };
      } catch (error) {
        return { ok: false, reason: `Falha ao atualizar a previsão: ${error?.message ?? 'erro desconhecido'}` };
      }
    },

    /**
     * Inclui os clientes (origin GMUD). O gateway deixa de fora quem já está em outro evento aberto e
     * devolve esses contratos em `skippedContractIds`. Se algum lote falhar, remove o que já entrou
     * (sem unique no banco, tentar de novo duplicaria) e devolve { ok:false }.
     */
    async addClients({ protocol, assignmentId, reason, finishDateNaive, createdNaive, clients, origin = 'GMUD', createdBy = 'gmud' }) {
      const finishDate = toLocalDateTimeIso(finishDateNaive);
      const created = toLocalDateTimeIso(createdNaive);
      const skipped = new Set();
      try {
        for (let i = 0; i < clients.length; i += POST_CHUNK) {
          const slice = clients.slice(i, i + POST_CHUNK);
          const { response, json } = await call('POST', AFETADOS, {
            assignmentId,
            usuarioAfetadoEntities: slice.map((c) => ({
              pppoe: c.pppoe ? c.pppoe : null,
              protocol,
              reason,
              contractId: c.contractId,
              finishDate,
              created,
              createdBy,
              origin,
            })),
          });
          if (!response.ok || json?.success === false) {
            await client.removeByProtocol(protocol); // limpa o que já entrou nos lotes anteriores
            return { ok: false, reason: `Gateway recusou a inclusão (${describe(response, json)}).` };
          }
          for (const id of json?.data?.skippedContractIds ?? []) skipped.add(Number(id));
        }
        return { ok: true, skippedContractIds: [...skipped] };
      } catch (error) {
        await client.removeByProtocol(protocol);
        return { ok: false, reason: `Falha ao incluir no gateway: ${error?.message ?? 'erro desconhecido'}` };
      }
    },
  };
  return client;
}
