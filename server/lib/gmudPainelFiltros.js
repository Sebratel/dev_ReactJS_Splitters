import { GMUD_OPEN_SQL, GMUD_TIPO_BY_SLUG, buildGmudListWhere, gmudFilterComiteStatuses, parseGmudListFilters } from './gmudListFilters.js';

/**
 * Filtros do painel de GMUDs com construtor de filtros (GET /api/gmud/list, /list-counts): abas rápidas,
 * situação, abertura, tipo (vários), origem, solicitante e canceladas ocultas. Só leitura.
 * Tudo aqui é função pura: monta o SQL com parâmetros ($n) — o texto do usuário nunca é concatenado.
 * Sem os parâmetros novos, o resultado é exatamente o de buildGmudListWhere (compatível com o que já existia).
 */

/** Cancelada no Voalle: o status do protocolo traz "cancel". */
export const GMUD_CANCELADA_VOALLE_SQL = `COALESCE(ist.title, '') ILIKE '%cancel%'`;
const ENCERRADA_VOALLE_SQL = 'a.conclusion_date IS NOT NULL';

export const GMUD_LIST_FROM_SQL = `FROM erp.assignment_incidents ai
        JOIN erp.assignments a ON a.id = ai.assignment_id
        LEFT JOIN erp.incident_status ist ON ist.id = ai.incident_status_id
        LEFT JOIN erp.people pe ON pe.id = ai.person_id`;

/** Situações que o filtro aceita (as mesmas da coluna Situação, para GMUD da plataforma). */
export const GMUD_SITUACOES = Object.freeze(['aguardando', 'liberada', 'concluida', 'encerrada', 'negada', 'cancelada']);
export const GMUD_ABAS = Object.freeze(['minhas', 'aguardando', 'vencidas', 'semana']);
const MAX_ITENS = 50;
const MAX_TEXTO = 120;

/** Valor de query (texto com vírgulas, ou repetido) -> lista de textos limpos, sem repetição. */
function lista(value, { separar = true } = {}) {
  const brutos = Array.isArray(value) ? value : value == null ? [] : [value];
  const itens = brutos
    .filter((v) => typeof v === 'string')
    .flatMap((v) => (separar ? v.split(',') : [v]))
    .map((v) => v.trim())
    .filter((v) => v !== '' && v.length <= MAX_TEXTO);
  return [...new Set(itens)].slice(0, MAX_ITENS);
}

const verdadeiro = (value) => typeof value === 'string' && ['1', 'true'].includes(value.trim().toLowerCase());

/**
 * Lê e valida os filtros do painel. Valor desconhecido é ignorado (vira "sem filtro").
 * - `aba`: minhas | aguardando | vencidas | semana;
 * - `situacao`: lista (vírgulas) de GMUD_SITUACOES;
 * - `aberturaDias`: inteiro de 1 a 365 (abertas nos últimos N dias);
 * - `tipo`: um ou vários (vírgulas) de emergencial | programada | pre_aprovada;
 * - `origem`: plataforma | legado (os dois juntos = sem filtro);
 * - `solicitante`: nome(s) do solicitante, um por parâmetro repetido;
 * - `ocultarCanceladas`: 1/true esconde as canceladas.
 */
export function parseGmudPainelFilters(query) {
  const q = query && typeof query === 'object' ? query : {};
  const base = parseGmudListFilters(q);
  const aba = typeof q.aba === 'string' && GMUD_ABAS.includes(q.aba.trim().toLowerCase()) ? q.aba.trim().toLowerCase() : null;
  const tipos = lista(q.tipo)
    .map((slug) => slug.toLowerCase())
    .filter((slug) => Object.hasOwn(GMUD_TIPO_BY_SLUG, slug))
    .map((slug) => GMUD_TIPO_BY_SLUG[slug]);
  const origens = lista(q.origem).map((o) => o.toLowerCase()).filter((o) => o === 'plataforma' || o === 'legado');
  const situacoes = lista(q.situacao).map((s) => s.toLowerCase()).filter((s) => GMUD_SITUACOES.includes(s));
  const dias = typeof q.aberturaDias === 'string' && /^\d{1,3}$/.test(q.aberturaDias.trim()) ? Number.parseInt(q.aberturaDias.trim(), 10) : NaN;
  return {
    filter: base.filter,
    minhas: base.minhas,
    aba,
    tipos: [...new Set(tipos)],
    origem: origens.length === 1 ? origens[0] : null,
    situacoes: [...new Set(situacoes)],
    aberturaDias: Number.isInteger(dias) && dias >= 1 && dias <= 365 ? dias : null,
    solicitantes: lista(q.solicitante, { separar: false }),
    ocultarCanceladas: verdadeiro(q.ocultarCanceladas),
  };
}

/**
 * Situação de uma GMUD registrada na plataforma, sem olhar o Voalle. Espelha gmudSituacao do front
 * (src/features/gmud/lib/gmudSituacao.ts): cancelada → concluída → negada → encerrada → liberada → aguardando.
 * `null` quando não há decisão do Comitê gravada (vale o status do Voalle).
 */
export function classificarSituacaoPlataforma(row) {
  const r = row ?? {};
  if (r.ellevenEncerradoStatus === 'cancelada') return 'cancelada';
  if (r.statusExec === 'concluida' || r.ellevenEncerradoStatus === 'concluida') return 'concluida';
  if (r.statusComite === 'negada' || r.ellevenEncerradoStatus === 'negada') return 'negada';
  if (r.ellevenEncerradoEm) return 'encerrada';
  const areas = r.statusAreas;
  if (r.statusComite === 'aprovada' && (areas == null || areas === 'aprovada' || areas === 'nao_aplicavel')) return 'liberada';
  if (r.statusComite === 'pendente' || r.statusComite === 'aprovada') return 'aguardando';
  return null;
}

/** Linhas da plataforma -> protocolos por situação: { aguardando: [...], liberada: [...], ... }. */
export function agruparSituacoes(rows) {
  const grupos = Object.fromEntries(GMUD_SITUACOES.map((s) => [s, []]));
  for (const row of Array.isArray(rows) ? rows : []) {
    const protocolo = Number(row?.voalleProtocol);
    const situacao = classificarSituacaoPlataforma(row);
    if (situacao && Number.isFinite(protocolo) && protocolo > 0) grupos[situacao].push(protocolo);
  }
  return grupos;
}

/** Segunda a domingo da semana que contém o dia (AAAA-MM-DD). */
export function semanaAtual(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(base.getTime())) return null;
  const segunda = new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 86_400_000);
  const dia = (date) => date.toISOString().slice(0, 10);
  return { de: dia(segunda), ate: dia(new Date(segunda.getTime() + 6 * 86_400_000)) };
}

/**
 * Quais listas de protocolos (do nosso MySQL) a consulta precisa. `todasAsAbas` pede também as das abas,
 * para a contagem de cada aba.
 */
export function gmudPainelNeeds(filters, { todasAsAbas = false } = {}) {
  const f = filters ?? {};
  return {
    filter: gmudFilterComiteStatuses(f.filter),
    registered: f.origem != null,
    tipos: (f.tipos ?? []).length > 0,
    // Todas as abas (contagem) sempre precisam: é o que separa as canceladas.
    situacao: (f.situacoes ?? []).length > 0 || Boolean(f.ocultarCanceladas) || todasAsAbas,
    comitePendente: todasAsAbas || f.aba === 'aguardando',
    semana: todasAsAbas || f.aba === 'semana',
  };
}

/** Contexto de montagem: guarda os parâmetros e reaproveita o mesmo $n para a mesma lista de protocolos. */
function criarCtx(params) {
  const usados = new Map();
  return {
    params,
    valor(v) {
      params.push(v);
      return `$${params.length}`;
    },
    protocolos(chave, list) {
      if (!usados.has(chave)) {
        // `= ANY($n)` com lista vazia não casa nada; [0] mantém o tipo e nenhum protocolo é 0.
        params.push(Array.isArray(list) && list.length > 0 ? list : [0]);
        usados.set(chave, `ai.protocol = ANY($${params.length}::bigint[])`);
      }
      return usados.get(chave);
    },
  };
}

/** Cancelada: no Voalle ou pela plataforma/Elleven. */
function canceladaSql(ctx, situacao) {
  return `(${GMUD_CANCELADA_VOALLE_SQL} OR ${ctx.protocolos('sit:cancelada', situacao?.cancelada)})`;
}

/**
 * Condição de uma situação, na mesma ordem de precedência de gmudSituacao: cancelada (Voalle ou plataforma)
 * vence tudo; concluída e negada vêm da plataforma; encerrada é o protocolo fechado sem outro motivo
 * (inclusive legado); liberada e aguardando só valem com o protocolo aberto.
 */
function situacaoSql(nome, ctx, situacao) {
  const p = (s) => ctx.protocolos(`sit:${s}`, situacao?.[s]);
  const naoCancelada = `NOT ${GMUD_CANCELADA_VOALLE_SQL}`;
  if (nome === 'cancelada') return canceladaSql(ctx, situacao);
  if (nome === 'concluida' || nome === 'negada') return `(${naoCancelada} AND ${p(nome)})`;
  if (nome === 'encerrada') {
    return `(${naoCancelada} AND NOT ${p('cancelada')} AND NOT ${p('concluida')} AND NOT ${p('negada')} AND (${p('encerrada')} OR ${ENCERRADA_VOALLE_SQL}))`;
  }
  // liberada | aguardando
  return `(${naoCancelada} AND NOT ${ENCERRADA_VOALLE_SQL} AND ${p(nome)})`;
}

/** Condição de uma aba rápida. */
function abaSql(aba, ctx, { email, lists }) {
  if (aba === 'minhas') return `lower(pe.email) = ${ctx.valor(String(email ?? '').trim().toLowerCase())}`;
  // Mesma regra do cartão "Aguardando Comitê": Comitê pendente e protocolo aberto.
  if (aba === 'aguardando') return `(${ctx.protocolos('aba:aguardando', lists.comitePendente)} AND ${GMUD_OPEN_SQL})`;
  if (aba === 'vencidas') return `(${GMUD_OPEN_SQL} AND ai.responsible_final_date < now())`;
  // Janela de execução cruzando a semana atual (segunda a domingo); só GMUD da plataforma tem janela.
  if (aba === 'semana') return ctx.protocolos('aba:semana', lists.semana);
  return 'TRUE';
}

/** Parte comum: filtros que valem para a lista e para a contagem das abas (sem a aba e sem "ocultar canceladas"). */
function montarBase({ typeId, search = '', filters = {}, email = '', lists = {} }) {
  const base = buildGmudListWhere({
    typeId,
    search,
    filter: filters.filter ?? 'todas',
    tipo: null,
    origem: filters.origem ?? null,
    minhas: Boolean(filters.minhas),
    email,
    lists,
  });
  const ctx = criarCtx(base.params);
  let clause = base.clause;
  if ((filters.tipos ?? []).length > 0) clause += ` AND ${ctx.protocolos('tipos', lists.tipos)}`;
  if ((filters.situacoes ?? []).length > 0) {
    clause += ` AND (${filters.situacoes.map((s) => situacaoSql(s, ctx, lists.situacao)).join(' OR ')})`;
  }
  if (filters.aberturaDias != null) clause += ` AND ai.date_to_start >= now() - make_interval(days => ${ctx.valor(filters.aberturaDias)}::int)`;
  if ((filters.solicitantes ?? []).length > 0) clause += ` AND pe.name = ANY(${ctx.valor(filters.solicitantes)}::text[])`;
  return { clause, ctx };
}

/**
 * WHERE da lista (começando por " AND ...") e os parâmetros. `lists` traz os protocolos do MySQL:
 * `filter`, `registered`, `tipos`, `situacao` ({ cancelada: [...], ... }), `comitePendente` e `semana`.
 */
export function buildGmudPainelWhere(input) {
  const { filters = {}, email = '', lists = {} } = input;
  const { clause: base, ctx } = montarBase(input);
  let clause = base;
  if (filters.ocultarCanceladas) clause += ` AND NOT ${canceladaSql(ctx, lists.situacao)}`;
  if (filters.aba) clause += ` AND ${abaSql(filters.aba, ctx, { email, lists })}`;
  return { clause, params: ctx.params };
}

/**
 * Contagem de cada aba com os MESMOS filtros da lista (menos a própria aba), em uma consulta só, e quantas
 * canceladas existem na aba atual (para o "N canceladas ocultas").
 */
export function buildGmudPainelCountsSql(input) {
  const { typeId, filters = {}, email = '', lists = {} } = input;
  const { clause, ctx } = montarBase({ ...input, typeId });
  const cancelada = canceladaSql(ctx, lists.situacao);
  const visivel = filters.ocultarCanceladas ? `NOT ${cancelada}` : 'TRUE';
  const aba = (nome) => abaSql(nome, ctx, { email, lists });
  const colunas = [
    `COUNT(*) FILTER (WHERE ${visivel})::int AS todas`,
    ...GMUD_ABAS.map((nome) => `COUNT(*) FILTER (WHERE ${visivel} AND ${aba(nome)})::int AS ${nome}`),
    `COUNT(*) FILTER (WHERE ${cancelada} AND ${filters.aba ? aba(filters.aba) : 'TRUE'})::int AS canceladas`,
  ];
  const sql = `SELECT ${colunas.join(',\n             ')}
        ${GMUD_LIST_FROM_SQL}
       WHERE ai.incident_type_id = $1${clause}`;
  return { sql, params: ctx.params };
}

/** Linha da contagem -> resposta da rota. */
export function gmudPainelCountsFromRow(row) {
  const r = row ?? {};
  return {
    todas: r.todas ?? 0,
    minhas: r.minhas ?? 0,
    aguardando: r.aguardando ?? 0,
    vencidas: r.vencidas ?? 0,
    semana: r.semana ?? 0,
    canceladas: r.canceladas ?? 0,
  };
}

/** Nomes dos solicitantes das GMUDs (para as opções do filtro). Só leitura. */
export function buildGmudSolicitantesSql() {
  return `SELECT DISTINCT pe.name AS name
        ${GMUD_LIST_FROM_SQL}
       WHERE ai.incident_type_id = $1 AND COALESCE(pe.name, '') <> ''
       ORDER BY pe.name
       LIMIT 500`;
}
