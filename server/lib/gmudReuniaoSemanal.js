/**
 * Reunião semanal de GMUDs (GET /api/gmud/reuniao-semanal): o que foi feito numa semana e o que vem na outra.
 * Só funções puras, sem banco: validação dos parâmetros, classificação do resultado e montagem da resposta.
 *
 * Só entram GMUDs registradas na plataforma: a janela (data/hora) fica no nosso banco; as legadas (só no
 * Voalle) não têm janela e ficam de fora.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Cada intervalo cobre no máximo 15 dias (a tela pede 7; a folga é para o uso manual da rota). */
export const REUNIAO_MAX_DIAS = 15;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/** Dias desde 1970 para uma data YYYY-MM-DD real (não aceita 2026-02-31), ou null. */
function dayNumber(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return Math.round(ms / 86_400_000);
}

function parseRange(query, deKey, ateKey, nome) {
  const de = typeof query?.[deKey] === 'string' ? query[deKey].trim() : '';
  const ate = typeof query?.[ateKey] === 'string' ? query[ateKey].trim() : '';
  const a = dayNumber(de);
  const b = dayNumber(ate);
  if (a === null || b === null) throw badRequest(`Informe ${deKey} e ${ateKey} no formato AAAA-MM-DD.`);
  if (b < a) throw badRequest(`O intervalo de "${nome}" termina antes de começar.`);
  if (b - a + 1 > REUNIAO_MAX_DIAS) throw badRequest(`O intervalo de "${nome}" pode ter no máximo ${REUNIAO_MAX_DIAS} dias.`);
  return [de, ate];
}

/** Lê e valida feitoDe/feitoAte/vemDe/vemAte. Lança erro 400 com mensagem clara se algo estiver errado. */
export function parseReuniaoSemanalQuery(query) {
  const [feitoDe, feitoAte] = parseRange(query, 'feitoDe', 'feitoAte', 'feito');
  const [vemDe, vemAte] = parseRange(query, 'vemDe', 'vemAte', 'vem');
  return { feitoDe, feitoAte, vemDe, vemAte };
}

/** A janela (dataInicio..dataFim) cruza o intervalo [de, ate]? Datas YYYY-MM-DD comparam como texto. */
export function janelaCruza(janela, de, ate) {
  const inicio = janela?.dataInicio;
  if (!inicio) return false;
  const fim = janela.dataFim || inicio;
  return inicio <= ate && fim >= de;
}

/** Cancelada: pela plataforma/Elleven ou já cancelada no Voalle (o status do protocolo traz "cancel"). */
export function reuniaoCancelada(item) {
  return item?.ellevenEncerradoStatus === 'cancelada' || /cancel/i.test(item?.statusVoalle ?? '');
}

export function reuniaoConcluida(item) {
  return item?.statusExec === 'concluida' || item?.ellevenEncerradoStatus === 'concluida';
}

export function reuniaoNegada(item) {
  return item?.statusComite === 'negada' || item?.ellevenEncerradoStatus === 'negada';
}

/** Liberada: aprovada pelo Comitê e pelas áreas (mesma regra de isGmudDisponivel do front). */
export function reuniaoLiberada(item) {
  if (item?.statusComite !== 'aprovada') return false;
  const areas = item.statusAreas;
  return areas == null || areas === 'aprovada' || areas === 'nao_aplicavel';
}

/** Fim da janela como "YYYY-MM-DD HH:mm" (sem hora de fim, vale o fim do dia). */
function fimDaJanela(janela) {
  const dia = janela?.dataFim || janela?.dataInicio;
  return dia ? `${dia} ${janela.horaFim || '23:59'}` : null;
}

/**
 * Resultado de uma GMUD cuja janela caiu na semana do "feito":
 * - 'cancelada': cancelada na plataforma/Elleven ou no Voalle;
 * - 'concluida': execução concluída;
 * - 'nao_concluida': estava liberada, a janela já terminou e ela não foi concluída, cancelada nem encerrada;
 * - 'janela_aberta': liberada, mas a janela ainda não terminou (acontece quando a semana do "feito" é a atual);
 * - null: não era para ter sido executada (negada, nunca aprovada ou encerrada sem conclusão) — fica de fora.
 * `agoraNaive` é a hora de Brasília em "YYYY-MM-DD HH:mm[:ss]".
 */
export function classificarResultadoFeito(item, agoraNaive) {
  if (reuniaoCancelada(item)) return 'cancelada';
  if (reuniaoConcluida(item)) return 'concluida';
  if (reuniaoNegada(item) || !reuniaoLiberada(item) || item.ellevenEncerradoEm) return null;
  const fim = fimDaJanela(item.janela);
  if (fim === null) return null;
  return fim < String(agoraNaive ?? '').slice(0, 16) ? 'nao_concluida' : 'janela_aberta';
}

/** Entra no "o que vem": tudo que ainda pode acontecer, inclusive o que ainda aguarda aprovação. */
export function entraNoVem(item) {
  return !reuniaoCancelada(item) && !reuniaoConcluida(item) && !reuniaoNegada(item) && !item.ellevenEncerradoEm;
}

function janelaDe(source) {
  return {
    dataInicio: source?.dataInicio || null,
    horaInicio: source?.horaInicio || null,
    dataFim: source?.dataFim || null,
    horaFim: source?.horaFim || null,
  };
}

/** Sistema afetado, conforme a categoria (sistemas internos ou externos); rede externa não tem. */
export function sistemaDaGmud(categoriaData) {
  const data = categoriaData && typeof categoriaData === 'object' ? categoriaData : {};
  const externo = String(data.sistemaExterno ?? '').trim();
  const nome = externo === 'Outro (especificar)' ? String(data.sistemaExternoOutro ?? '').trim() : externo;
  return String(data.sistemaAfetado ?? '').trim() || nome || null;
}

/** Linha do nosso banco (formato de mapGmudRow) -> item da reunião. */
export function toReuniaoItem(row, { elleven = null, areas = null, reagendada = false } = {}) {
  return {
    protocolo: row.voalleProtocol,
    titulo: row.titulo ?? null,
    tipo: row.tipo ?? null,
    categoria: row.categoria ?? null,
    popSite: row.popSite ?? null,
    sistema: sistemaDaGmud(row.categoriaData),
    janela: janelaDe(row),
    impactoParada: row.impactoParada ?? null,
    statusComite: row.statusComite ?? null,
    statusAreas: row.statusAreas ?? null,
    areasTotal: areas?.areasTotal ?? 0,
    areasAprovadas: areas?.areasAprovadas ?? 0,
    statusExec: row.statusExec ?? null,
    ellevenEncerradoEm: row.ellevenEncerradoEm ?? null,
    ellevenEncerradoStatus: row.ellevenEncerradoStatus ?? null,
    statusVoalle: elleven?.status ?? '',
    reagendada,
  };
}

/**
 * GMUDs que ESTAVAM marcadas para a semana [de, ate] e foram reagendadas para fora dela.
 * Regra: existe um evento `reagendada` cuja janela ANTERIOR (payload.previous) cruzava a semana, e a janela
 * atual da GMUD não cruza mais. `events` vem do mais recente para o mais antigo; vale o mais recente que casar.
 * `naSemana` = protocolos cuja janela atual cruza a semana (esses seguem a classificação normal).
 * Devolve Map protocolo -> { previous, next, at }.
 */
export function reagendadasParaFora(events, naSemana, de, ate) {
  const dentro = naSemana instanceof Set ? naSemana : new Set(naSemana ?? []);
  const out = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    const protocolo = Number(e?.voalleProtocol);
    if (!Number.isFinite(protocolo) || protocolo <= 0 || dentro.has(protocolo) || out.has(protocolo)) continue;
    if (!janelaCruza(e.previous, de, ate)) continue;
    out.set(protocolo, { previous: janelaDe(e.previous), next: janelaDe(e.next), at: e.at ?? null });
  }
  return out;
}

const inicioDaJanela = (item) => `${item.janela.dataInicio ?? ''} ${item.janela.horaInicio ?? ''}`;
const porJanela = (a, b) => inicioDaJanela(a).localeCompare(inicioDaJanela(b)) || a.protocolo - b.protocolo;

/**
 * Monta a resposta { feito, vem }, cada lista em ordem de janela.
 * - `feitoRows` / `vemRows`: GMUDs cuja janela atual cruza cada intervalo;
 * - `moved` (de reagendadasParaFora) e `movedRows`: as reagendadas para fora da semana do "feito";
 * - `ellevenByProtocol`: status do protocolo no Voalle; `extrasByProtocol`: contagem de áreas;
 * - `reagendadas`: protocolos com algum evento de reagendamento.
 */
export function buildReuniaoSemanal({
  feitoRows = [], vemRows = [], moved = new Map(), movedRows = [],
  ellevenByProtocol = new Map(), extrasByProtocol = new Map(), reagendadas = new Set(), agoraNaive,
}) {
  const item = (row) =>
    toReuniaoItem(row, {
      elleven: ellevenByProtocol.get(row.voalleProtocol) ?? null,
      areas: extrasByProtocol.get(row.voalleProtocol) ?? null,
      reagendada: reagendadas.has(row.voalleProtocol),
    });

  const feito = [];
  for (const row of feitoRows) {
    const base = item(row);
    const resultado = classificarResultadoFeito(base, agoraNaive);
    if (resultado !== null) feito.push({ ...base, resultado, novaJanela: null });
  }
  for (const row of movedRows) {
    const info = moved.get(row.voalleProtocol);
    if (!info) continue;
    // Mostra a janela em que ela ESTAVA (a da semana) e para onde foi.
    feito.push({ ...item(row), reagendada: true, janela: info.previous, resultado: 'reagendada', novaJanela: janelaDe(row) });
  }
  const vem = vemRows.map(item).filter(entraNoVem);
  return { feito: feito.sort(porJanela), vem: vem.sort(porJanela) };
}
