/**
 * Lista de clientes ao COR (regras puras, sem banco nem rede).
 *
 * Para o COR não ser pego de surpresa na execução, a plataforma envia por e-mail (via N8N) a lista dos clientes
 * CORPORATIVOS impactados mais os ponto a ponto e fibra apagada escolhidos na GMUD:
 *  - ao LIBERAR a GMUD (Comitê e áreas aprovaram);
 *  - de novo, como ATUALIZAÇÃO, se a abrangência, os clientes escolhidos ou a janela mudarem;
 *  - um LEMBRETE antes do início da janela.
 * O que já foi enviado fica registrado nos eventos da GMUD (sem tabela nova); a "assinatura" das entradas evita reenviar o que não mudou.
 */
import crypto from 'node:crypto';
import { isGmudAprovadaFinal } from './gmudCommittee.js';
import { gmudWindow, isNetworkGmud } from './gmudClientSync.js';
import { normalizeEscopoRotas } from './gmudEscopoRede.js';
import { CLIENTE_SEM_SPLITTER_LABEL, normalizeClientesSemSplitter } from './gmudClientesSemSplitter.js';

export const COR_EVENT_LISTA = 'cor_lista_enviada';
export const COR_EVENT_LEMBRETE = 'cor_lembrete_enviado';

const text = (v) => String(v ?? '').trim();

/** Config do job. Desligado por padrão; ligado, começa em SIMULAÇÃO (dryRun). */
export function readCorListaConfig(env = process.env) {
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
    enabled: flag('GMUD_COR_LISTA_ENABLED', false),
    dryRun: flag('GMUD_COR_LISTA_DRY_RUN', true),
    intervalMinutes: int('GMUD_COR_LISTA_INTERVAL_MINUTES', 10, 1, 1440),
    lembreteHoras: int('GMUD_COR_LISTA_LEMBRETE_HORAS', 24, 1, 168),
    webhookUrl: text(env.N8N_GMUD_COR_LISTA_WEBHOOK_URL),
    appBaseUrl: text(env.APP_BASE_URL).replace(/\/+$/, ''),
  };
}

function isClosed(g) {
  return Boolean(g?.ellevenEncerradoEm) || text(g?.statusExec) === 'concluida' || text(g?.statusComite) === 'negada';
}

/** Subtrai horas de 'YYYY-MM-DD HH:mm:ss' (horário de parede; a aritmética é feita como se fosse UTC). */
export function minusHoursNaive(naive, hours) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(naive);
  if (!m) return naive;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - hours * 3_600_000;
  return new Date(t).toISOString().slice(0, 19).replace('T', ' ');
}

/** Assinatura das ENTRADAS que definem a lista (janela, site, rotas e clientes escolhidos). */
export function corInputsSignature(g) {
  const w = gmudWindow(g);
  const base = JSON.stringify({
    w: w ? [w.start, w.end] : null,
    site: text(g?.popSite).toLowerCase(),
    rotas: normalizeEscopoRotas(g?.categoriaData),
    manuais: normalizeClientesSemSplitter(g?.categoriaData).map((c) => [c.contractId, c.tipo]),
  });
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
}

/** A GMUD precisa da lista ao COR neste momento? Só as liberadas, de rede, ainda não encerradas e com janela futura. */
function isEligible(g, nowNaive) {
  if (!g?.voalleProtocol || !isNetworkGmud(g) || isClosed(g)) return false;
  if (!isGmudAprovadaFinal(g.statusComite, g.statusAreas)) return false;
  const w = gmudWindow(g);
  return Boolean(w) && nowNaive < w.end;
}

/**
 * Decide o que enviar neste ciclo. `lastByProtocol`: Map protocolo -> { [tipoDeEvento]: { payload } } com o
 * último evento de cada tipo. Retorna [{ gmud, kind: 'liberacao'|'atualizacao'|'lembrete', signature }].
 */
export function planCorLista({ candidates = [], nowNaive, lastByProtocol = new Map(), lembreteHoras = 24 }) {
  const out = [];
  for (const g of candidates) {
    if (!isEligible(g, nowNaive)) continue;
    const signature = corInputsSignature(g);
    const last = lastByProtocol.get(g.voalleProtocol) ?? {};
    const lista = last[COR_EVENT_LISTA];
    if (!lista) {
      out.push({ gmud: g, kind: 'liberacao', signature });
      continue;
    }
    if (lista.payload?.signature !== signature) {
      out.push({ gmud: g, kind: 'atualizacao', signature });
      continue;
    }
    const w = gmudWindow(g);
    if (w && nowNaive >= minusHoursNaive(w.start, lembreteHoras) && nowNaive < w.start) {
      const lembrete = last[COR_EVENT_LEMBRETE];
      if (lembrete?.payload?.signature !== signature) out.push({ gmud: g, kind: 'lembrete', signature });
    }
  }
  return out;
}

const csvCell = (v) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Junta os clientes corporativos (da abrangência) e os escolhidos à mão, sem repetir contrato.
 * `corporativos`: [{ contractId, nome, pppoe, pontoAcesso }]. Os escolhidos à mão trazem o tipo escolhido.
 */
export function buildCorClientes({ corporativos = [], semSplitter = [] }) {
  const byContract = new Map();
  for (const c of semSplitter) {
    byContract.set(c.contractId, {
      contrato: c.contractId,
      nome: text(c.nome),
      pppoe: text(c.pppoe),
      pontoAcesso: '',
      tipo: c.tipo,
      tipoLabel: CLIENTE_SEM_SPLITTER_LABEL[c.tipo] ?? c.tipo,
    });
  }
  for (const c of corporativos) {
    if (byContract.has(c.contractId)) continue;
    byContract.set(c.contractId, {
      contrato: c.contractId,
      nome: text(c.nome),
      pppoe: text(c.pppoe),
      pontoAcesso: text(c.pontoAcesso),
      tipo: 'corporativo',
      tipoLabel: 'corporativo',
    });
  }
  return [...byContract.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.contrato - b.contrato);
}

export function buildCorCsv(clientes) {
  const head = ['contrato', 'cliente', 'usuario_conexao', 'ponto_de_acesso', 'tipo'].join(';');
  const rows = clientes.map((c) => [c.contrato, c.nome, c.pppoe, c.pontoAcesso, c.tipoLabel].map(csvCell).join(';'));
  return [head, ...rows].join('\r\n');
}

/** Corpo enviado ao N8N, que monta e envia o e-mail ao COR. */
export function buildCorPayload({ gmud, kind, signature, clientes, destinatarios, abrangencia, appBaseUrl }) {
  const w = gmudWindow(gmud);
  const contagem = (tipo) => clientes.filter((c) => c.tipo === tipo).length;
  return {
    evento: 'gmud_lista_cor',
    tipo: kind,
    protocol: gmud.voalleProtocol,
    titulo: text(gmud.titulo),
    tipoGmud: text(gmud.tipo),
    popSite: text(gmud.popSite),
    abrangenciaRede: abrangencia,
    janela: w ? { inicio: w.start, fim: w.end } : null,
    solicitanteNome: text(gmud.solicitanteNome),
    solicitanteEmail: text(gmud.solicitanteEmail),
    link: appBaseUrl ? `${appBaseUrl}/gmud/${gmud.voalleProtocol}` : '',
    destinatarios,
    resumo: {
      total: clientes.length,
      corporativos: contagem('corporativo'),
      pontoAPonto: contagem('ponto_a_ponto'),
      fibraApagada: contagem('fibra_apagada'),
    },
    clientes,
    csv: buildCorCsv(clientes),
    assinatura: signature,
  };
}
