/**
 * Orquestra o envio da lista de clientes ao COR (regras em lib/gmudCorLista.js).
 * Tudo que toca fora é injetado (fontes de GMUDs/eventos/clientes/destinatários e o envio): testável sem rede nem banco.
 * Em simulação (dryRun) só calcula e registra o que FARIA — não envia nada nem grava eventos.
 */
import { brazilNowNaive } from './gmudClientSync.js';
import { formatEscopoRotas, normalizeEscopoRotas } from './gmudEscopoRede.js';
import { normalizeClientesSemSplitter } from './gmudClientesSemSplitter.js';
import {
  COR_EVENT_LEMBRETE,
  COR_EVENT_LISTA,
  buildCorClientes,
  buildCorPayload,
  planCorLista,
  readCorListaConfig,
} from './gmudCorLista.js';

const LOG = '[gmud-cor-lista]';
const MAX_ERRORS_KEPT = 20;

export function createGmudCorListaService({ gmudSource, eventsSource, clientsSource, recipientsSource, sender, env = process.env, logger, nowFn = () => new Date() }) {
  const state = { running: false, lastRunAt: null, lastRunMs: null, lastResult: null, lastError: null, errors: [], totals: { enviadas: 0, simuladas: 0 } };
  const simulatedLogged = new Set();

  const pushError = (protocol, message) => {
    state.errors.unshift({ at: new Date().toISOString(), protocol, message });
    state.errors.length = Math.min(state.errors.length, MAX_ERRORS_KEPT);
    logger?.warn?.(`${LOG} GMUD ${protocol}: ${message}`);
  };

  async function runOnce() {
    const cfg = readCorListaConfig(env);
    if (state.running) return { skipped: 'ja_em_execucao' };
    state.running = true;
    const started = Date.now();
    const result = { simulacao: cfg.dryRun, enviar: [], erros: 0 };
    try {
      const nowNaive = brazilNowNaive(nowFn());
      const candidates = await gmudSource.listCandidates(nowNaive);
      const protocols = candidates.map((g) => g.voalleProtocol).filter(Boolean);
      const lastByProtocol = protocols.length > 0 ? await eventsSource.latestByTypes(protocols, [COR_EVENT_LISTA, COR_EVENT_LEMBRETE]) : new Map();
      const plan = planCorLista({ candidates, nowNaive, lastByProtocol, lembreteHoras: cfg.lembreteHoras });
      if (plan.length === 0) { state.lastError = null; return { ...result, nada: true }; }

      const destinatarios = await recipientsSource.list();
      if (destinatarios.length === 0) {
        state.lastError = 'A lista do COR em Configurações da GMUD não tem destinatários.';
        pushError('-', state.lastError);
        return { ...result, skipped: 'sem_destinatarios' };
      }

      for (const { gmud, kind, signature } of plan) {
        const protocol = gmud.voalleProtocol;
        const listed = await clientsSource.listClients(gmud);
        if (!listed.ok) { result.erros += 1; pushError(protocol, listed.reason); continue; }
        const clientes = buildCorClientes({
          corporativos: listed.clients.filter((c) => c.corporate),
          semSplitter: normalizeClientesSemSplitter(gmud.categoriaData),
        });
        const payload = buildCorPayload({
          gmud, kind, signature, clientes, destinatarios,
          abrangencia: formatEscopoRotas(normalizeEscopoRotas(gmud.categoriaData)),
          appBaseUrl: cfg.appBaseUrl,
        });
        result.enviar.push({ protocol, kind, total: clientes.length });

        if (cfg.dryRun) {
          const key = `${protocol}:${kind}:${signature}`;
          if (!simulatedLogged.has(key)) {
            simulatedLogged.add(key);
            state.totals.simuladas += 1;
            logger?.info?.(`${LOG} SIMULAÇÃO GMUD ${protocol}: enviaria "${kind}" ao COR (${clientes.length} clientes, ${destinatarios.length} destinatários).`);
          }
          continue;
        }
        if (cfg.webhookUrl === '') { result.erros += 1; pushError(protocol, 'N8N_GMUD_COR_LISTA_WEBHOOK_URL não configurada.'); continue; }
        const sent = await sender.send(cfg.webhookUrl, payload);
        if (!sent.ok) { result.erros += 1; pushError(protocol, sent.reason); continue; }
        await eventsSource.log({
          voalleProtocol: protocol,
          type: kind === 'lembrete' ? COR_EVENT_LEMBRETE : COR_EVENT_LISTA,
          actor: 'sistema',
          payload: { kind, signature, total: clientes.length, destinatarios: destinatarios.length },
        });
        state.totals.enviadas += 1;
        logger?.info?.(`${LOG} GMUD ${protocol}: "${kind}" enviada ao COR (${clientes.length} clientes).`);
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
      state.lastResult = result;
    }
  }

  async function getStatus() {
    const cfg = readCorListaConfig(env);
    return {
      enabled: cfg.enabled,
      dryRun: cfg.dryRun,
      intervalMinutes: cfg.intervalMinutes,
      lembreteHoras: cfg.lembreteHoras,
      webhookConfigurado: cfg.webhookUrl !== '',
      running: state.running,
      lastRunAt: state.lastRunAt,
      lastRunMs: state.lastRunMs,
      lastResult: state.lastResult,
      lastError: state.lastError,
      errors: state.errors,
      totals: state.totals,
    };
  }

  return { runOnce, getStatus };
}

/** Agenda o ciclo. Desligado por padrão (GMUD_COR_LISTA_ENABLED=true liga; começa em simulação). */
export function startGmudCorListaScheduler({
  service, env = process.env, logger,
  setIntervalFn = setInterval, setTimeoutFn = setTimeout, primeiraExecucaoMs = 60_000,
} = {}) {
  const cfg = readCorListaConfig(env);
  if (!cfg.enabled) {
    logger?.info?.(`${LOG} desativado (GMUD_COR_LISTA_ENABLED != true).`);
    return { started: false, motivo: 'desativado' };
  }
  const tick = () => { service.runOnce().catch((e) => logger?.error?.(`${LOG} erro no agendamento: ${e?.message ?? e}`)); };
  const first = setTimeoutFn(tick, primeiraExecucaoMs);
  const loop = setIntervalFn(tick, cfg.intervalMinutes * 60_000);
  first?.unref?.();
  loop?.unref?.();
  logger?.info?.(`${LOG} ativo: a cada ${cfg.intervalMinutes} min${cfg.dryRun ? ' (SIMULAÇÃO: não envia nada)' : ''}.`);
  return { started: true, dryRun: cfg.dryRun };
}

/** Envio ao webhook do N8N (o payload tem dados de clientes: nunca logar o corpo). */
export function createCorListaSender({ fetchFn = fetch, timeoutMs = 15_000 } = {}) {
  return {
    async send(url, payload) {
      try {
        const response = await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return response.ok ? { ok: true } : { ok: false, reason: `Webhook respondeu ${response.status}.` };
      } catch (error) {
        return { ok: false, reason: `Falha ao chamar o webhook: ${error?.message ?? 'erro desconhecido'}` };
      }
    },
  };
}
