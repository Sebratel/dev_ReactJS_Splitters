/**
 * Clientes da GMUD em assignment_clients (regras puras, sem banco nem rede).
 *
 * Fluxo: no INÍCIO PREVISTO de uma GMUD de rede externa já liberada (Comitê E áreas aprovaram), os clientes
 * do escopo (ponto de acesso / slot / PON / splitter, ou o site inteiro) entram em assignment_clients com
 * origin = GMUD — a presença da linha é o gatilho do aviso ao cliente. No ENCERRAMENTO (fim da janela,
 * encerrada/cancelada/negada no Elleven ou deixou de estar liberada) eles saem. O histórico permanente fica
 * em gmud_affected_clients (nunca é apagado), separado de massiva_affected_clients.
 */
import { isGmudAprovadaFinal } from './gmudCommittee.js';

export const SYNC_STATUS = Object.freeze({ INCLUIDA: 'incluida', REMOVIDA: 'removida' });

const text = (v) => String(v ?? '').trim();

/** Config do job. Desligado por padrão; ligado, começa em SIMULAÇÃO (dryRun) até alguém desligar de propósito. */
export function readClientSyncConfig(env = process.env) {
  const flag = (name, fallback) => {
    const raw = text(env[name]).toLowerCase();
    if (raw === '') return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
  };
  const int = (name, fallback, min, max) => {
    const n = Number.parseInt(text(env[name]), 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  return {
    enabled: flag('GMUD_CLIENTES_SYNC_ENABLED', false),
    dryRun: flag('GMUD_CLIENTES_SYNC_DRY_RUN', true),
    intervalMinutes: int('GMUD_CLIENTES_SYNC_INTERVAL_MINUTES', 5, 1, 1440),
    maxClientsPerGmud: int('GMUD_CLIENTES_SYNC_MAX_CLIENTES', 5000, 1, 50000),
  };
}

/** "Agora" no horário de parede de Brasília, como 'YYYY-MM-DD HH:mm:ss' (mesmo formato das janelas da GMUD). */
export function brazilNowNaive(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Janela da GMUD em 'YYYY-MM-DD HH:mm:ss' (início inclusivo, fim exclusivo) ou null se faltar data. */
export function gmudWindow(g) {
  const di = text(g?.dataInicio);
  const df = text(g?.dataFim) || di;
  if (!DATE_RE.test(di) || !DATE_RE.test(df)) return null;
  const hi = TIME_RE.test(text(g?.horaInicio)) ? text(g.horaInicio) : '00:00';
  const hf = TIME_RE.test(text(g?.horaFim)) ? text(g.horaFim) : '23:59';
  const full = (t) => (t.length === 5 ? `${t}:00` : t);
  return { start: `${di} ${full(hi)}`, end: `${df} ${full(hf)}` };
}

/** Só rede externa tem clientes (sistemas internos/externos não). Categoria nula = legado de rede. */
export function isNetworkGmud(g) {
  const c = text(g?.categoria);
  return c === '' || c === 'rede_externa';
}

/** GMUD encerrada de qualquer forma (Elleven, concluída). */
function isClosed(g) {
  return Boolean(g?.ellevenEncerradoEm) || text(g?.statusExec) === 'concluida' || text(g?.statusComite) === 'negada';
}

/** Por que a GMUD NÃO está ativa agora (ou null se está). */
export function inactiveReason(g, nowNaive) {
  if (!g) return 'gmud_nao_encontrada';
  if (!isNetworkGmud(g)) return 'categoria_sem_clientes';
  if (text(g.statusAreas) === 'negada' || text(g.statusComite) === 'negada') return 'negada';
  if (isClosed(g)) return 'encerrada';
  if (!isGmudAprovadaFinal(g.statusComite, g.statusAreas)) return 'nao_liberada';
  const w = gmudWindow(g);
  if (!w) return 'sem_janela';
  if (nowNaive < w.start) return 'antes_da_janela';
  if (nowNaive >= w.end) return 'fora_da_janela';
  if (!(Number(g.assignmentId) > 0)) return 'sem_assignment';
  return null;
}

/**
 * Decide o que fazer neste ciclo.
 *  - candidates: GMUDs (mapGmudRow) que podem estar ativas agora;
 *  - includedProtocols: protocolos hoje com status 'incluida' (precisam ser reavaliados mesmo que saiam do filtro);
 *  - gmudByProtocol: Map protocolo -> GMUD (para os já incluídos);
 *  - states: Map protocolo -> { status, windowEnd }.
 * Retorna { include, remove, updateFinish }.
 */
export function planClientSync({ candidates = [], gmudByProtocol = new Map(), states = new Map(), nowNaive }) {
  const include = [];
  const remove = [];
  const updateFinish = [];

  const pool = new Map();
  for (const g of candidates) if (g?.voalleProtocol) pool.set(g.voalleProtocol, g);
  for (const [protocol, g] of gmudByProtocol) if (!pool.has(protocol)) pool.set(protocol, g);

  const protocols = new Set([...pool.keys(), ...[...states.entries()].filter(([, s]) => s?.status === SYNC_STATUS.INCLUIDA).map(([p]) => p)]);
  for (const protocol of protocols) {
    const g = pool.get(protocol) ?? null;
    const state = states.get(protocol) ?? null;
    const reason = inactiveReason(g, nowNaive);
    const included = state?.status === SYNC_STATUS.INCLUIDA;

    if (reason === null) {
      if (!included) {
        include.push(g);
      } else {
        const end = gmudWindow(g)?.end ?? null;
        if (end && state.windowEnd && end !== state.windowEnd) updateFinish.push({ gmud: g, windowEnd: end });
      }
    } else if (included) {
      remove.push({ protocol, reason });
    }
  }
  return { include, remove, updateFinish };
}

/** Motivo (texto que o cliente verá) da inclusão. */
export function buildClientReason(g) {
  const titulo = text(g?.titulo) || text(g?.assunto);
  const base = `Manutenção programada (GMUD ${g?.voalleProtocol})`;
  const out = titulo !== '' ? `${base}: ${titulo}` : base;
  return out.length <= 2000 ? out : `${out.slice(0, 1999)}…`;
}

/** 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DDTHH:mm:ss' (LocalDateTime do gateway). */
export const toLocalDateTimeIso = (naive) => text(naive).replace(' ', 'T');
