/**
 * Conferência com o Elleven.
 *
 * Problema: às vezes o Elleven abre o protocolo de uma massiva e a plataforma não chega a gravar a
 * linha em `massiva_history` (aba fechada, rede, reinício do backend entre os dois passos). O protocolo
 * existe no Elleven e "não aparece" na plataforma. Este módulo compara a lista de massivas do Elleven
 * com o histórico local e CRIA as linhas que faltam, avisando por webhook (N8N -> e-mail).
 *
 * Fonte no Elleven: GET `${GATEWAY_ORIGIN}/api/v1/massivas/recuperar-pelo-banco` (Basic auth do gateway).
 * Cada item traz: id (== assignment_id local), protocolo, criacao, finalizado (vazio = aberto), status,
 * tituloIncidente, pontoDeAcesso, descricao, criadoPor, responsavel, catalogo, equipe, sla.
 *
 * O que ela FAZ
 *  - Cria em `massiva_history` o protocolo que está na lista do Elleven e NÃO está na plataforma
 *    (somente dentro da janela de dias e depois de uma carência, para não disputar com a gravação normal).
 *    A linha recuperada tem source = 'conferencia-elleven' (a tela usa isso para o selo "Recuperada do Elleven").
 *  - Só CONTA/REPORTA divergências de status (não altera nada): local 'aberta' x Elleven finalizado, e
 *    local 'encerrada'/'cancelada' x Elleven aberto (esta é tratada hoje pelo fluxo N8N de reconciliação).
 *
 * LIMITAÇÕES (importante)
 *  - A lista do Elleven NÃO é o histórico completo: o endpoint devolve uma janela de itens e já se viu protocolo
 *    recente que existe no Elleven e não veio na lista. O job só trata o que vier na lista. Se um protocolo
 *    nunca aparecer nela, esta conferência não o enxerga.
 *  - O último resultado fica só em memória (sem tabela nova, sem DDL): reinício do backend zera o painel e a
 *    antirrepetição de alertas.
 *  - Datas: o Elleven devolve horário de parede de Brasília sem fuso ("2026-11-11T16:21:24.091575"), o mesmo
 *    padrão do banco; qualquer sufixo de fuso é ignorado.
 *  - Campos que o Elleven não fornece ficam no default da tabela (affected_clients = 0, operator_email = '',
 *    access_point_code = ''): a linha recuperada é parcial por natureza.
 *
 * Envs (todas opcionais)
 *  - MASSIVA_CONFERENCIA_ENABLED=true            liga o agendamento (padrão: desligado)
 *  - MASSIVA_CONFERENCIA_DRY_RUN=true            só relata, não grava nada
 *  - MASSIVA_CONFERENCIA_INTERVAL_MINUTES=5      intervalo entre execuções (1..1440)
 *  - MASSIVA_CONFERENCIA_JANELA_DIAS=30          só considera protocolos criados nos últimos N dias
 *  - MASSIVA_CONFERENCIA_CARENCIA_MINUTOS=10     ignora protocolos criados há menos que isso
 *  - MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL=      webhook (N8N) que recebe o alerta em JSON; vazio = só log
 *  - MASSIVA_CONFERENCIA_LIST_PATH=              sobrescreve o caminho da lista no gateway
 *  - GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_USER / GATEWAY_BASIC_AUTH_PASSWORD   as mesmas do backend
 */

export const CONFERENCIA_SOURCE = 'conferencia-elleven';
export const CONFERENCIA_CLOSED_BY = 'conferencia-elleven';
const DEFAULT_LIST_PATH = '/api/v1/massivas/recuperar-pelo-banco';
const LOG = '[conferencia-elleven]';
const FALHAS_SEGUIDAS_PARA_AVISAR = 3;
const REPETIR_ALERTA_APOS_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;
const WEBHOOK_TIMEOUT_MS = 15_000;
const BRASILIA_OFFSET = '-03:00';

// ---------------------------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------------------------

function intEnv(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function readConferenciaConfig(env = process.env) {
  return {
    enabled: String(env.MASSIVA_CONFERENCIA_ENABLED ?? '').trim().toLowerCase() === 'true',
    dryRun: String(env.MASSIVA_CONFERENCIA_DRY_RUN ?? '').trim().toLowerCase() === 'true',
    intervalMinutes: intEnv(env.MASSIVA_CONFERENCIA_INTERVAL_MINUTES, 5, 1, 1440),
    janelaDias: intEnv(env.MASSIVA_CONFERENCIA_JANELA_DIAS, 30, 1, 365),
    carenciaMinutos: intEnv(env.MASSIVA_CONFERENCIA_CARENCIA_MINUTOS, 10, 0, 1440),
    alertUrl: String(env.MASSIVA_CONFERENCIA_ALERT_WEBHOOK_URL ?? '').trim(),
  };
}

function gatewayConfig(env) {
  const origin = String(env.GATEWAY_ORIGIN ?? '').trim().replace(/\/+$/, '');
  const user = String(env.GATEWAY_BASIC_AUTH_USER ?? '').trim();
  const password = String(env.GATEWAY_BASIC_AUTH_PASSWORD ?? '');
  if (origin === '' || user === '' || password === '') return null;
  return { origin, authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` };
}

export function isGatewayConfigured(env = process.env) {
  return gatewayConfig(env) !== null;
}

// ---------------------------------------------------------------------------------------------
// Datas (horário de parede de Brasília, igual ao banco)
// ---------------------------------------------------------------------------------------------

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/** "2026-11-11T16:21:24.091575" -> "2026-11-11 16:21:24" (ou null). */
export function toMysqlNaive(value) {
  if (value === null || value === undefined) return null;
  const m = String(value).trim().match(NAIVE_RE);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}`;
}

/** "2026-11-11 16:21:24" (Brasília) -> epoch ms (NaN se inválido). */
export function naiveToEpochMs(naive) {
  if (!naive) return Number.NaN;
  return Date.parse(`${String(naive).replace(' ', 'T')}${BRASILIA_OFFSET}`);
}

function formatBrasilia(date) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

// ---------------------------------------------------------------------------------------------
// Lista do Elleven
// ---------------------------------------------------------------------------------------------

/** Nunca lança. { ok:true, items } | { ok:false, reason } */
export async function fetchEllevenMassivas({ env = process.env, fetchImpl = fetch } = {}) {
  const cfg = gatewayConfig(env);
  if (!cfg) {
    return { ok: false, reason: 'Gateway não configurado no backend (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).' };
  }
  const path = String(env.MASSIVA_CONFERENCIA_LIST_PATH ?? '').trim() || DEFAULT_LIST_PATH;
  try {
    const response = await fetchImpl(`${cfg.origin}${path.startsWith('/') ? path : `/${path}`}`, {
      method: 'GET',
      headers: { Authorization: cfg.authorization, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: `Gateway recusou a consulta (HTTP ${response.status}).` };
    const json = await response.json();
    const items = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : null;
    if (!items) return { ok: false, reason: 'Resposta inesperada do gateway (não é uma lista de massivas).' };
    return { ok: true, items };
  } catch (error) {
    return { ok: false, reason: `Falha ao consultar o gateway: ${error?.message ?? 'erro desconhecido'}` };
  }
}

function positiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isFinalizado(item) {
  return String(item?.finalizado ?? '').trim() !== '';
}

function text(value) {
  return String(value ?? '').trim();
}

// ---------------------------------------------------------------------------------------------
// Mapeamento e plano (puro)
// ---------------------------------------------------------------------------------------------

/**
 * Item do Elleven -> linha de massiva_history. Padrão local: `title` guarda o PONTO DE ACESSO
 * (ex.: "OLT 03 - SLEFT"), e não o título do incidente.
 */
export function mapEllevenItemToRow(item) {
  const protocol = positiveInt(item?.protocolo);
  const assignmentId = positiveInt(item?.id);
  const finalizado = isFinalizado(item);
  const cancelada = finalizado && /cancel/i.test(text(item?.status));
  const status = finalizado ? (cancelada ? 'cancelada' : 'encerrada') : 'aberta';
  const title = text(item?.pontoDeAcesso) || text(item?.tituloIncidente);
  return {
    protocol,
    assignmentId,
    title,
    status,
    openedAt: toMysqlNaive(item?.criacao),
    closedAt: finalizado ? toMysqlNaive(item?.finalizado) : null,
    closedBy: finalizado ? CONFERENCIA_CLOSED_BY : null,
    closeDescription: finalizado
      ? 'Recuperada pela conferência com o Elleven (protocolo não estava na plataforma).'
      : null,
    source: CONFERENCIA_SOURCE,
  };
}

/**
 * Decide o que criar. `localProtocols` = Set de protocolos que já têm linha local (qualquer status).
 * Só cria o que está dentro da janela e já passou da carência.
 */
export function planConferencia({ ellevenItems, localProtocols, now = new Date(), janelaDias = 30, carenciaMinutos = 10 }) {
  const nowMs = now.getTime();
  const inicioJanelaMs = nowMs - janelaDias * 86_400_000;
  const limiteCarenciaMs = nowMs - carenciaMinutos * 60_000;
  const plano = { criar: [], semAssignment: [], jaExistem: 0, foraDaJanela: 0, naCarencia: 0, invalidas: 0 };
  const vistos = new Set();

  for (const item of Array.isArray(ellevenItems) ? ellevenItems : []) {
    const row = mapEllevenItemToRow(item);
    if (row.protocol === null || row.openedAt === null) {
      plano.invalidas += 1;
      continue;
    }
    if (vistos.has(row.protocol)) continue;
    vistos.add(row.protocol);
    if (localProtocols.has(row.protocol)) {
      plano.jaExistem += 1;
      continue;
    }
    const criadoMs = naiveToEpochMs(row.openedAt);
    if (!Number.isFinite(criadoMs) || criadoMs < inicioJanelaMs) {
      plano.foraDaJanela += 1;
      continue;
    }
    if (criadoMs > limiteCarenciaMs) {
      plano.naCarencia += 1;
      continue;
    }
    if (row.assignmentId === null) {
      plano.semAssignment.push({ protocolo: row.protocol });
      continue;
    }
    plano.criar.push(row);
  }
  return plano;
}

/** Divergências de status (somente leitura) entre o Elleven e o que há no banco. */
export function computeDivergencias({ ellevenItems, localStatus, now = new Date(), janelaDias = 30 }) {
  const inicioJanelaMs = now.getTime() - janelaDias * 86_400_000;
  const abertaLocalFinalizadaElleven = [];
  const fechadaLocalAbertaElleven = [];
  for (const item of Array.isArray(ellevenItems) ? ellevenItems : []) {
    const protocol = positiveInt(item?.protocolo);
    if (protocol === null) continue;
    const local = localStatus.get(protocol);
    if (!local) continue;
    const criadoMs = naiveToEpochMs(toMysqlNaive(item?.criacao));
    if (!Number.isFinite(criadoMs) || criadoMs < inicioJanelaMs) continue;
    const finalizado = isFinalizado(item);
    const entry = { protocolo: protocol, assignmentId: positiveInt(item?.id), statusLocal: local, statusElleven: text(item?.status) };
    if (local === 'aberta' && finalizado) abertaLocalFinalizadaElleven.push(entry);
    else if ((local === 'encerrada' || local === 'cancelada') && !finalizado) fechadaLocalAbertaElleven.push(entry);
  }
  return { abertaLocalFinalizadaElleven, fechadaLocalAbertaElleven };
}

// ---------------------------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------------------------

function listProtocolos(list) {
  return list.map((x) => x.protocolo ?? x.protocol).filter((x) => x !== undefined && x !== null);
}

function signatureOf(list) {
  return [...listProtocolos(list)].sort((a, b) => Number(a) - Number(b)).join(',');
}

/** Webhook JSON. Nunca lança. Sem URL: só log. */
export function createWebhookNotifier({ env = process.env, fetchImpl = fetch, logger } = {}) {
  return async function notify(payload) {
    const { alertUrl } = readConferenciaConfig(env);
    if (alertUrl === '') {
      logger?.info?.(`${LOG} alerta (sem webhook configurado): ${payload.assunto}`, { tipo: payload.tipo });
      return { sent: false, reason: 'webhook não configurado' };
    }
    try {
      const response = await fetchImpl(alertUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger?.warn?.(`${LOG} webhook de alerta recusou (HTTP ${response.status}).`, { tipo: payload.tipo });
        return { sent: false, reason: `HTTP ${response.status}` };
      }
      return { sent: true };
    } catch (error) {
      logger?.warn?.(`${LOG} falha ao enviar o alerta: ${error?.message ?? error}`, { tipo: payload.tipo });
      return { sent: false, reason: String(error?.message ?? error) };
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Serviço (execução, estado em memória, antirrepetição)
// ---------------------------------------------------------------------------------------------

/**
 * store: { configured, getLocalStatusByProtocols(protocols) -> Map<number,string>,
 *          insertRecovered(row) -> {inserted}|{duplicate}|{conflict}, countRecovered(days) -> number }
 */
export function createConferenciaService({
  store,
  env = process.env,
  fetchImpl = fetch,
  logger,
  nowFn = () => new Date(),
  notify = null,
} = {}) {
  const send = notify ?? createWebhookNotifier({ env, fetchImpl, logger });
  let running = false;
  let ultimo = null;
  let falhasSeguidas = 0;
  let avisoFalhaEnviado = false;
  const alertas = new Map(); // tipo -> { sig, at }

  async function alertarRepetivel(tipo, lista, montar, now) {
    if (lista.length === 0) {
      alertas.delete(tipo);
      return;
    }
    const sig = signatureOf(lista);
    const anterior = alertas.get(tipo);
    if (anterior && anterior.sig === sig && now.getTime() - anterior.at < REPETIR_ALERTA_APOS_MS) return;
    alertas.set(tipo, { sig, at: now.getTime() });
    await send(montar());
  }

  async function dispararAlertas(r, now) {
    const quando = { quando: now.toISOString(), quandoBrasilia: formatBrasilia(now) };
    if (r.criadas.length > 0 && !r.dryRun) {
      await send({
        tipo: 'massivas_recuperadas',
        assunto: `${r.criadas.length} massiva(s) estavam só no Elleven e foram criadas na plataforma`,
        resumo: 'A conferência encontrou protocolos do Elleven que não existiam na plataforma e criou as linhas faltantes (parciais).',
        criadas: r.criadas,
        divergencias: r.divergencias,
        falhas: r.falhas,
        ...quando,
      });
    }
    if (r.dryRun) {
      await alertarRepetivel('faltando_simulacao', r.criariam, () => ({
        tipo: 'massivas_faltando_simulacao',
        assunto: `[SIMULAÇÃO] ${r.criariam.length} massiva(s) no Elleven sem registro na plataforma`,
        resumo: 'Modo de simulação (dry-run): nada foi gravado. Estes protocolos seriam criados.',
        criadas: r.criariam,
        divergencias: r.divergencias,
        falhas: [],
        ...quando,
      }), now);
    }
    await alertarRepetivel('falha_gravacao', r.falhas, () => ({
      tipo: 'falha_gravacao',
      assunto: `Não foi possível criar ${r.falhas.length} massiva(s) do Elleven na plataforma`,
      resumo: 'A gravação no banco falhou para estes protocolos. A conferência tenta de novo na próxima execução.',
      criadas: r.criadas,
      divergencias: r.divergencias,
      falhas: r.falhas,
      ...quando,
    }), now);
    await alertarRepetivel('conflito_protocolo', r.conflitos, () => ({
      tipo: 'conflito_protocolo',
      assunto: `${r.conflitos.length} protocolo(s) do Elleven conflitam com um assignment já usado na plataforma`,
      resumo: 'O assignment desses protocolos já existe na plataforma ligado a outro protocolo. Precisa de revisão manual.',
      criadas: [],
      divergencias: r.divergencias,
      falhas: r.conflitos,
      ...quando,
    }), now);
    const divTodas = [
      ...r.divergencias.abertaLocalFinalizadaElleven.map((d) => ({ ...d, tipo: 'abertaLocalFinalizadaElleven' })),
      ...r.divergencias.fechadaLocalAbertaElleven.map((d) => ({ ...d, tipo: 'fechadaLocalAbertaElleven' })),
    ];
    await alertarRepetivel('divergencia', divTodas, () => ({
      tipo: 'divergencia_status',
      assunto: `${divTodas.length} massiva(s) com status diferente entre o Elleven e a plataforma`,
      resumo: 'Divergência de status entre os dois sistemas. A conferência só reporta; não altera nada.',
      criadas: [],
      divergencias: r.divergencias,
      falhas: [],
      ...quando,
    }), now);
  }

  async function executar(dryRunOverride) {
    const now = nowFn();
    const t0 = Date.now();
    const cfg = readConferenciaConfig(env);
    const dryRun = dryRunOverride ?? cfg.dryRun;
    const base = {
      ok: false,
      dryRun,
      iniciadoEm: now.toISOString(),
      duracaoMs: 0,
      elleven: { total: 0, abertos: 0 },
      plano: { criar: 0, semAssignment: 0, jaExistem: 0, foraDaJanela: 0, naCarencia: 0, invalidas: 0 },
      criadas: [],
      criariam: [],
      falhas: [],
      conflitos: [],
      jaExistiam: 0,
      divergencias: { abertaLocalFinalizadaElleven: [], fechadaLocalAbertaElleven: [] },
    };
    const fim = (extra) => {
      const r = { ...base, ...extra, duracaoMs: Date.now() - t0 };
      return r;
    };

    if (!store?.configured) return fim({ erro: 'MySQL de massivas não configurado no backend.' });
    if (!isGatewayConfigured(env)) {
      return fim({ erro: 'Gateway não configurado no backend (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).' });
    }

    const lista = await fetchEllevenMassivas({ env, fetchImpl });
    if (!lista.ok) return fim({ erro: lista.reason });
    const items = lista.items;

    let localStatus;
    try {
      const protocolos = items.map((i) => positiveInt(i?.protocolo)).filter((p) => p !== null);
      localStatus = await store.getLocalStatusByProtocols(protocolos);
    } catch (error) {
      return fim({ erro: `Falha ao ler o histórico local: ${error?.message ?? error}`, elleven: { total: items.length, abertos: items.filter((i) => !isFinalizado(i)).length } });
    }

    const plano = planConferencia({
      ellevenItems: items,
      localProtocols: new Set(localStatus.keys()),
      now,
      janelaDias: cfg.janelaDias,
      carenciaMinutos: cfg.carenciaMinutos,
    });
    const divergencias = computeDivergencias({ ellevenItems: items, localStatus, now, janelaDias: cfg.janelaDias });
    const resumoPlano = {
      criar: plano.criar.length,
      semAssignment: plano.semAssignment.length,
      jaExistem: plano.jaExistem,
      foraDaJanela: plano.foraDaJanela,
      naCarencia: plano.naCarencia,
      invalidas: plano.invalidas,
    };

    const criadas = [];
    const falhas = [];
    const conflitos = [];
    let jaExistiam = 0;
    const refOf = (row) => ({ protocolo: row.protocol, assignmentId: row.assignmentId, status: row.status, pontoDeAcesso: row.title });

    if (!dryRun) {
      for (const row of plano.criar) {
        try {
          const r = await store.insertRecovered(row);
          if (r?.inserted) criadas.push(refOf(row));
          else if (r?.conflict) conflitos.push({ ...refOf(row), erro: String(r.conflict) });
          else jaExistiam += 1;
        } catch (error) {
          falhas.push({ ...refOf(row), erro: String(error?.message ?? error).slice(0, 300) });
        }
      }
    }

    return fim({
      ok: true,
      elleven: { total: items.length, abertos: items.filter((i) => !isFinalizado(i)).length },
      plano: resumoPlano,
      criadas,
      criariam: dryRun ? plano.criar.map(refOf) : [],
      falhas,
      conflitos,
      jaExistiam,
      divergencias,
    });
  }

  /** Executa uma conferência. Nunca lança; sem sobreposição. */
  async function runOnce({ dryRun } = {}) {
    if (running) return { ok: false, skipped: true, erro: 'Execução anterior ainda em andamento.' };
    running = true;
    let resultado;
    try {
      resultado = await executar(dryRun);
    } catch (error) {
      resultado = {
        ok: false,
        dryRun: dryRun ?? false,
        iniciadoEm: nowFn().toISOString(),
        duracaoMs: 0,
        erro: `Erro inesperado: ${error?.message ?? error}`,
        elleven: { total: 0, abertos: 0 },
        plano: {},
        criadas: [],
        criariam: [],
        falhas: [],
        conflitos: [],
        jaExistiam: 0,
        divergencias: { abertaLocalFinalizadaElleven: [], fechadaLocalAbertaElleven: [] },
      };
    }
    ultimo = resultado;
    try {
      const now = nowFn();
      if (resultado.ok) {
        falhasSeguidas = 0;
        avisoFalhaEnviado = false;
        await dispararAlertas(resultado, now);
        logger?.info?.(
          `${LOG} ok: ${resultado.elleven.total} no Elleven (${resultado.elleven.abertos} abertas), ${resultado.criadas.length} criadas${resultado.dryRun ? ` (simulação: ${resultado.criariam.length} seriam criadas)` : ''}, ${resultado.falhas.length} falhas, divergências ${resultado.divergencias.abertaLocalFinalizadaElleven.length}/${resultado.divergencias.fechadaLocalAbertaElleven.length}.`,
        );
      } else {
        falhasSeguidas += 1;
        logger?.warn?.(`${LOG} execução falhou (${falhasSeguidas} seguida(s)): ${resultado.erro}`);
        if (falhasSeguidas >= FALHAS_SEGUIDAS_PARA_AVISAR && !avisoFalhaEnviado) {
          avisoFalhaEnviado = true;
          await send({
            tipo: 'execucao_falhou',
            assunto: `A conferência com o Elleven falhou ${falhasSeguidas} vezes seguidas`,
            resumo: `Último erro: ${resultado.erro}`,
            criadas: [],
            divergencias: { abertaLocalFinalizadaElleven: [], fechadaLocalAbertaElleven: [] },
            falhas: [],
            quando: now.toISOString(),
            quandoBrasilia: formatBrasilia(now),
          });
        }
      }
    } catch (error) {
      logger?.error?.(`${LOG} falha ao tratar alertas: ${error?.message ?? error}`);
    } finally {
      running = false;
    }
    return resultado;
  }

  return {
    runOnce,
    getUltimoResultado: () => ultimo,
    isRunning: () => running,
    getFalhasSeguidas: () => falhasSeguidas,
  };
}

// ---------------------------------------------------------------------------------------------
// Agendamento (sem sobreposição; primeira execução ~30 s depois de subir)
// ---------------------------------------------------------------------------------------------

export function startConferenciaScheduler({
  service,
  store,
  env = process.env,
  logger,
  setIntervalFn = setInterval,
  setTimeoutFn = setTimeout,
  primeiraExecucaoMs = 30_000,
} = {}) {
  const cfg = readConferenciaConfig(env);
  if (!cfg.enabled) {
    logger?.info?.(`${LOG} desativada (MASSIVA_CONFERENCIA_ENABLED != true).`);
    return { started: false, motivo: 'desativada' };
  }
  if (!store?.configured) {
    logger?.warn?.(`${LOG} não iniciada: MySQL de massivas não configurado.`);
    return { started: false, motivo: 'mysql_nao_configurado' };
  }
  if (!isGatewayConfigured(env)) {
    logger?.warn?.(`${LOG} não iniciada: gateway não configurado (GATEWAY_ORIGIN / GATEWAY_BASIC_AUTH_*).`);
    return { started: false, motivo: 'gateway_nao_configurado' };
  }
  const tick = () => {
    service.runOnce().catch((error) => logger?.error?.(`${LOG} erro no agendamento: ${error?.message ?? error}`));
  };
  const first = setTimeoutFn(tick, primeiraExecucaoMs);
  const loop = setIntervalFn(tick, cfg.intervalMinutes * 60_000);
  first?.unref?.();
  loop?.unref?.();
  logger?.info?.(
    `${LOG} ativa: a cada ${cfg.intervalMinutes} min, janela ${cfg.janelaDias} dias, carência ${cfg.carenciaMinutos} min${cfg.dryRun ? ' (SIMULAÇÃO: não grava)' : ''}.`,
  );
  return {
    started: true,
    intervalMinutes: cfg.intervalMinutes,
    stop() {
      clearTimeout(first);
      clearInterval(loop);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Contrato do endpoint de leitura (GET /api/massiva/conferencia/status)
// ---------------------------------------------------------------------------------------------

const MAX_ITENS_NO_STATUS = 10;

function resumirResultado(r) {
  if (!r) return null;
  const corta = (list) => (Array.isArray(list) ? list.slice(0, MAX_ITENS_NO_STATUS) : []);
  return {
    ok: r.ok === true,
    skipped: r.skipped === true ? true : undefined,
    erro: r.erro ?? null,
    dryRun: r.dryRun === true,
    iniciadoEm: r.iniciadoEm ?? null,
    duracaoMs: r.duracaoMs ?? 0,
    elleven: r.elleven ?? { total: 0, abertos: 0 },
    plano: r.plano ?? {},
    criadasTotal: r.criadas?.length ?? 0,
    criadas: corta(r.criadas),
    criariamTotal: r.criariam?.length ?? 0,
    criariam: corta(r.criariam),
    falhasTotal: r.falhas?.length ?? 0,
    falhas: corta(r.falhas),
    conflitosTotal: r.conflitos?.length ?? 0,
    divergencias: {
      abertaLocalFinalizadaElleven: {
        total: r.divergencias?.abertaLocalFinalizadaElleven?.length ?? 0,
        itens: corta(r.divergencias?.abertaLocalFinalizadaElleven),
      },
      fechadaLocalAbertaElleven: {
        total: r.divergencias?.fechadaLocalAbertaElleven?.length ?? 0,
        itens: corta(r.divergencias?.fechadaLocalAbertaElleven),
      },
    },
  };
}

export async function buildConferenciaStatus({ service, store, env = process.env }) {
  const cfg = readConferenciaConfig(env);
  let recuperadas = null;
  try {
    if (store?.configured) recuperadas = await store.countRecovered(30);
  } catch {
    recuperadas = null;
  }
  return {
    habilitada: cfg.enabled,
    dryRun: cfg.dryRun,
    intervaloMinutos: cfg.intervalMinutes,
    janelaDias: cfg.janelaDias,
    gatewayConfigurado: isGatewayConfigured(env),
    emExecucao: service?.isRunning?.() === true,
    ultimaExecucao: resumirResultado(service?.getUltimoResultado?.() ?? null),
    recuperadasUltimos30Dias: recuperadas,
  };
}
