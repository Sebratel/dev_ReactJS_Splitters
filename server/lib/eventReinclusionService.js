/**
 * Reinclui, a cada ciclo, os clientes que ficaram de fora de um evento por já estarem em outro (ver
 * lib/eventReinclusion.js). Tudo que toca fora é injetado: testável sem rede nem banco.
 * Em simulação (dryRun) só calcula e registra o que FARIA.
 */
import { brazilNowNaive } from './gmudClientSync.js';
import {
  EVENT_TYPES,
  fallbackReason,
  groupPendingByEvent,
  planGroup,
  readReinclusionConfig,
} from './eventReinclusion.js';

const LOG = '[reinclusao]';
const MAX_ERRORS_KEPT = 20;

/**
 * deps:
 *  - store: event_suppressed_clients (listPending/markReincluded/markResolved/isReady)
 *  - conflictsStore.findOpenEventConflicts(contractIds, { excludeProtocol })
 *  - gateway.addClients({ origin, createdBy, ... })
 *  - eventInfo.get(group) -> { open, assignmentId, finishDateNaive }
 *  - followUp.massiva({ protocol, assignmentId, clients }) / followUp.gmud({ protocol, contractIds })
 */
export function createEventReinclusionService({ store, conflictsStore, gateway, eventInfo, followUp = {}, env = process.env, logger, nowFn = () => new Date() }) {
  const state = {
    running: false, lastRunAt: null, lastRunMs: null, lastResult: null, lastError: null, errors: [],
    totals: { reincluidos: 0, resolvidos: 0, aguardando: 0 },
  };
  const pushError = (key, message) => {
    state.errors.unshift({ at: new Date().toISOString(), event: key, message });
    state.errors.length = Math.min(state.errors.length, MAX_ERRORS_KEPT);
    logger?.warn?.(`${LOG} ${key}: ${message}`);
  };

  async function runOnce() {
    const cfg = readReinclusionConfig(env);
    if (state.running) return { skipped: 'ja_em_execucao' };
    state.running = true;
    const started = Date.now();
    const result = { simulacao: cfg.dryRun, reincluir: [], resolver: [], esperar: 0, erros: 0 };
    try {
      if (!(await store.isReady())) {
        state.lastError = 'Tabela ausente: aplique server/sql/event_suppressed_clients.sql.';
        logger?.warn?.(`${LOG} ${state.lastError}`);
        return { skipped: 'tabela_ausente' };
      }
      const nowNaive = brazilNowNaive(nowFn());
      const groups = groupPendingByEvent(await store.listPending());

      for (const group of groups) {
        const info = await eventInfo.get(group);
        const ids = group.rows.map((r) => r.id);
        let blocked = new Set();
        if (info?.open === true) {
          try {
            const found = await conflictsStore.findOpenEventConflicts(
              group.rows.map((r) => r.contractId),
              { excludeProtocol: group.eventProtocol },
            );
            blocked = new Set(found.contractIds);
          } catch (error) {
            result.erros += 1; pushError(group.key, `Falha ao conferir conflitos: ${error?.message ?? error}`);
            continue;
          }
        }
        const plan = planGroup({ group, info, blockedContractIds: blocked });

        if (plan.action === 'resolver') {
          result.resolver.push({ event: group.key, clientes: ids.length, reason: plan.reason });
          if (cfg.dryRun) continue;
          await store.markResolved(ids, plan.reason, nowNaive);
          state.totals.resolvidos += ids.length;
          continue;
        }
        if (plan.action === 'esperar') { result.esperar += plan.waiting?.length ?? ids.length; continue; }

        // reincluir
        result.reincluir.push({ event: group.key, clientes: plan.free.length, aguardando: plan.waiting.length });
        if (cfg.dryRun) continue;
        const first = plan.free[0];
        const origin = group.eventType === EVENT_TYPES.GMUD ? 'GMUD' : 'MASSIVA';
        const finishDateNaive = info.finishDateNaive ?? first.finishDate;
        if (!finishDateNaive) { result.erros += 1; pushError(group.key, 'Sem previsão de fim para reincluir.'); continue; }
        const clients = plan.free.map((r) => ({ contractId: r.contractId, pppoe: r.pppoe, corporate: r.corporate }));
        const res = await gateway.addClients({
          origin, createdBy: 'reinclusao', protocol: group.eventProtocol, assignmentId: info.assignmentId,
          reason: first.reason || fallbackReason(group.eventType, group.eventProtocol),
          finishDateNaive, createdNaive: nowNaive, clients,
        });
        if (!res.ok) { result.erros += 1; pushError(group.key, res.reason); continue; }
        const skipped = new Set(res.skippedContractIds ?? []);
        const done = plan.free.filter((r) => !skipped.has(r.contractId));
        await store.markReincluded(done.map((r) => r.id), nowNaive);
        state.totals.reincluidos += done.length;
        state.totals.aguardando += skipped.size + plan.waiting.length;
        try {
          if (done.length > 0 && group.eventType === EVENT_TYPES.MASSIVA) {
            await followUp.massiva?.({ protocol: group.eventProtocol, assignmentId: info.assignmentId, clients: done.map((r) => ({ pppoe: r.pppoe, contractId: r.contractId })) });
          }
          if (done.length > 0 && group.eventType === EVENT_TYPES.GMUD) {
            await followUp.gmud?.({ protocol: group.eventProtocol, contractIds: done.map((r) => r.contractId) });
          }
        } catch (error) {
          pushError(group.key, `Reincluídos, mas o histórico local falhou: ${error?.message ?? error}`);
        }
        logger?.info?.(`${LOG} ${group.key}: ${done.length} cliente(s) reincluídos, ${plan.waiting.length + skipped.size} ainda aguardando.`);
      }
      state.lastError = null;
      return result;
    } catch (error) {
      state.lastError = error?.message ?? String(error);
      logger?.error?.(`${LOG} falha no ciclo: ${state.lastError}`);
      return { ...result, erro: state.lastError };
    } finally {
      state.running = false;
      state.lastRunAt = new Date().toISOString();
      state.lastRunMs = Date.now() - started;
      state.lastResult = { simulacao: result.simulacao, reincluir: result.reincluir.length, resolver: result.resolver.length, esperar: result.esperar, erros: result.erros, detalhe: { reincluir: result.reincluir.slice(0, 20), resolver: result.resolver.slice(0, 20) } };
    }
  }

  return {
    runOnce,
    async getStatus() {
      const cfg = readReinclusionConfig(env);
      let pendentes = 0; let ready = false;
      try { ready = await store.isReady(); if (ready) pendentes = (await store.listPending()).length; } catch { /* status nunca quebra */ }
      return { enabled: cfg.enabled, dryRun: cfg.dryRun, intervalMinutes: cfg.intervalMinutes, tabelaPronta: ready, pendentes,
        running: state.running, lastRunAt: state.lastRunAt, lastRunMs: state.lastRunMs, lastResult: state.lastResult, lastError: state.lastError, errors: state.errors, totals: state.totals };
    },
  };
}

export function startEventReinclusionScheduler({ service, store, gateway, env = process.env, logger, setIntervalFn = setInterval, setTimeoutFn = setTimeout, primeiraExecucaoMs = 60_000 } = {}) {
  const cfg = readReinclusionConfig(env);
  if (!cfg.enabled) { logger?.info?.(`${LOG} desativada (EVENT_REINCLUSION_ENABLED != true).`); return { started: false, motivo: 'desativada' }; }
  if (!store?.configured) { logger?.warn?.(`${LOG} não iniciada: MySQL não configurado.`); return { started: false, motivo: 'mysql_nao_configurado' }; }
  if (!gateway?.configured) { logger?.warn?.(`${LOG} não iniciada: gateway não configurado.`); return { started: false, motivo: 'gateway_nao_configurado' }; }
  const tick = () => { service.runOnce().catch((e) => logger?.error?.(`${LOG} erro no agendamento: ${e?.message ?? e}`)); };
  const first = setTimeoutFn(tick, primeiraExecucaoMs);
  const loop = setIntervalFn(tick, cfg.intervalMinutes * 60_000);
  first?.unref?.(); loop?.unref?.();
  logger?.info?.(`${LOG} ativa: a cada ${cfg.intervalMinutes} min${cfg.dryRun ? ' (SIMULAÇÃO: não grava nada)' : ''}.`);
  return { started: true, dryRun: cfg.dryRun };
}
