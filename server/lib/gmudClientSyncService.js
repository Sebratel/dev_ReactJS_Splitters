/**
 * Orquestra a sincronização dos clientes da GMUD com assignment_clients (ver lib/gmudClientSync.js).
 * Tudo que toca fora é injetado (store, fonte de GMUDs, fonte de clientes, gateway): testável sem rede nem banco.
 * Em simulação (dryRun) só calcula e registra o que FARIA — não chama o gateway nem grava nada.
 */
import {
  SYNC_STATUS,
  brazilNowNaive,
  buildClientReason,
  gmudWindow,
  planClientSync,
  readClientSyncConfig,
} from './gmudClientSync.js';

const LOG = '[gmud-clientes]';
const MAX_ERRORS_KEPT = 20;

export function createGmudClientSyncService({ store, gmudSource, clientsSource, gateway, suppressed, env = process.env, logger, nowFn = () => new Date() }) {
  const state = {
    running: false,
    lastRunAt: null,
    lastRunMs: null,
    lastResult: null,
    lastError: null,
    errors: [],
    totals: { incluidas: 0, removidas: 0, previsoes: 0, clientesIncluidos: 0, clientesDeFora: 0 },
  };

  const pushError = (protocol, message) => {
    state.errors.unshift({ at: new Date().toISOString(), protocol, message });
    state.errors.length = Math.min(state.errors.length, MAX_ERRORS_KEPT);
    logger?.warn?.(`${LOG} GMUD ${protocol}: ${message}`);
  };

  async function runOnce() {
    const cfg = readClientSyncConfig(env);
    if (state.running) return { skipped: 'ja_em_execucao' };
    state.running = true;
    const started = Date.now();
    const result = { simulacao: cfg.dryRun, incluir: [], remover: [], previsao: [], erros: 0 };
    try {
      if (!(await store.isReady())) {
        state.lastError = 'Tabelas ausentes: aplique server/sql/gmud_clientes_afetados.sql.';
        logger?.warn?.(`${LOG} ${state.lastError}`);
        return { skipped: 'tabelas_ausentes' };
      }
      const now = nowFn();
      const nowNaive = brazilNowNaive(now);
      const states = await store.listStates();
      const candidates = await gmudSource.listCandidates(nowNaive);
      const includedProtocols = [...states.entries()].filter(([, s]) => s.status === SYNC_STATUS.INCLUIDA).map(([p]) => p);
      const gmudByProtocol = new Map();
      for (const protocol of includedProtocols) {
        if (!candidates.some((g) => g.voalleProtocol === protocol)) {
          const g = await gmudSource.getByProtocol(protocol);
          if (g) gmudByProtocol.set(protocol, g);
        }
      }
      const plan = planClientSync({ candidates, gmudByProtocol, states, nowNaive });

      // --- remover ---------------------------------------------------------------------------
      for (const { protocol, reason } of plan.remove) {
        result.remover.push({ protocol, reason });
        if (cfg.dryRun) continue;
        const res = await gateway.removeByProtocol(protocol);
        if (!res.ok) { result.erros += 1; pushError(protocol, res.reason); await store.recordError({ protocol, message: res.reason }); continue; }
        await store.markRemoved({ protocol, reason, nowNaive });
        state.totals.removidas += 1;
        logger?.info?.(`${LOG} GMUD ${protocol}: clientes removidos (${reason}).`);
      }

      // --- atualizar a previsão de fim -----------------------------------------------------------
      for (const { gmud, windowEnd } of plan.updateFinish) {
        result.previsao.push({ protocol: gmud.voalleProtocol, windowEnd });
        if (cfg.dryRun) continue;
        const res = await gateway.updateFinishDate(gmud.voalleProtocol, windowEnd);
        if (!res.ok) { result.erros += 1; pushError(gmud.voalleProtocol, res.reason); continue; }
        await store.markWindowEnd({ protocol: gmud.voalleProtocol, windowEnd });
        state.totals.previsoes += 1;
      }

      // --- incluir -------------------------------------------------------------------------------
      for (const gmud of plan.include) {
        const protocol = gmud.voalleProtocol;
        const found = await clientsSource.listClients(gmud);
        if (!found.ok) { result.erros += 1; pushError(protocol, found.reason); await store.recordError({ protocol, message: found.reason }); continue; }
        const clients = found.clients;
        if (clients.length > cfg.maxClientsPerGmud) {
          const msg = `Escopo com ${clients.length} clientes (limite ${cfg.maxClientsPerGmud}). Afunile a GMUD por ponto de acesso/slot/PON ou aumente GMUD_CLIENTES_SYNC_MAX_CLIENTES.`;
          result.erros += 1; pushError(protocol, msg); await store.recordError({ protocol, message: msg });
          continue;
        }
        const windowEnd = gmudWindow(gmud).end;
        result.incluir.push({ protocol, clientes: clients.length });
        if (cfg.dryRun) continue;

        let skippedContractIds = [];
        if (clients.length > 0) {
          const res = await gateway.addClients({
            protocol, assignmentId: gmud.assignmentId, reason: buildClientReason(gmud),
            finishDateNaive: windowEnd, createdNaive: nowNaive, clients,
          });
          if (!res.ok) { result.erros += 1; pushError(protocol, res.reason); await store.recordError({ protocol, message: res.reason }); continue; }
          skippedContractIds = res.skippedContractIds ?? [];
        }
        await store.markIncluded({ protocol, windowEnd, clients, skippedContractIds, nowNaive });
        if (skippedContractIds.length > 0 && suppressed) {
          // Ficaram de fora por ja estarem em outro evento: entram na fila de reinclusao (quando o outro fechar).
          try {
            const skippedSet = new Set(skippedContractIds);
            await suppressed.add({
              eventType: 'gmud', eventProtocol: protocol, assignmentId: gmud.assignmentId, reason: buildClientReason(gmud),
              finishDateNaive: windowEnd, nowNaive, clients: clients.filter((c) => skippedSet.has(c.contractId)),
            });
          } catch (error) {
            pushError(protocol, `Incluida, mas nao foi possivel registrar quem ficou de fora: ${error?.message ?? error}`);
          }
        }
        state.totals.incluidas += 1;
        state.totals.clientesIncluidos += clients.length - skippedContractIds.length;
        state.totals.clientesDeFora += skippedContractIds.length;
        logger?.info?.(`${LOG} GMUD ${protocol}: ${clients.length - skippedContractIds.length} cliente(s) incluídos, ${skippedContractIds.length} já em outro evento.`);
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
      state.lastResult = {
        simulacao: result.simulacao,
        incluir: result.incluir.length,
        remover: result.remover.length,
        previsao: result.previsao.length,
        erros: result.erros,
        detalhe: { incluir: result.incluir.slice(0, 20), remover: result.remover.slice(0, 20) },
      };
    }
  }

  return {
    runOnce,
    async getStatus() {
      const cfg = readClientSyncConfig(env);
      let counts = { incluidas: 0, clientesAtivos: 0 };
      let ready = false;
      try { ready = await store.isReady(); if (ready) counts = await store.counts(); } catch { /* status nunca quebra */ }
      return {
        enabled: cfg.enabled, dryRun: cfg.dryRun, intervalMinutes: cfg.intervalMinutes, maxClientsPerGmud: cfg.maxClientsPerGmud,
        gatewayConfigured: gateway.configured === true, tabelasProntas: ready,
        running: state.running, lastRunAt: state.lastRunAt, lastRunMs: state.lastRunMs, lastResult: state.lastResult,
        lastError: state.lastError, errors: state.errors, totals: state.totals, ativos: counts,
      };
    },
  };
}

export function startGmudClientSyncScheduler({
  service, store, gateway, env = process.env, logger,
  setIntervalFn = setInterval, setTimeoutFn = setTimeout, primeiraExecucaoMs = 45_000,
} = {}) {
  const cfg = readClientSyncConfig(env);
  if (!cfg.enabled) {
    logger?.info?.(`${LOG} desativado (GMUD_CLIENTES_SYNC_ENABLED != true).`);
    return { started: false, motivo: 'desativado' };
  }
  if (!store?.configured) {
    logger?.warn?.(`${LOG} não iniciado: MySQL de massivas não configurado.`);
    return { started: false, motivo: 'mysql_nao_configurado' };
  }
  if (!gateway?.configured) {
    logger?.warn?.(`${LOG} não iniciado: gateway não configurado (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).`);
    return { started: false, motivo: 'gateway_nao_configurado' };
  }
  const tick = () => { service.runOnce().catch((e) => logger?.error?.(`${LOG} erro no agendamento: ${e?.message ?? e}`)); };
  const first = setTimeoutFn(tick, primeiraExecucaoMs);
  const loop = setIntervalFn(tick, cfg.intervalMinutes * 60_000);
  first?.unref?.();
  loop?.unref?.();
  logger?.info?.(`${LOG} ativo: a cada ${cfg.intervalMinutes} min${cfg.dryRun ? ' (SIMULAÇÃO: não grava nada)' : ''}.`);
  return { started: true, dryRun: cfg.dryRun };
}
