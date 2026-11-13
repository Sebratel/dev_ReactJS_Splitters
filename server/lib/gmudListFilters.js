/**
 * Filtros do painel de GMUDs (GET /api/gmud/list e /api/gmud/list-summary). Só monta SQL de leitura:
 * os valores do usuário entram sempre como parâmetros ($n), nunca concatenados.
 *
 * - `filter` (o dos cartões do topo) continua como sempre foi.
 * - `tipo`, `origem` e `minhas` são filtros novos, que se COMBINAM com o `filter` e entre si.
 * - "Plataforma" = protocolo registrado no nosso MySQL; "Legado" = só no Voalle.
 */

/** Protocolo aberto: sem data de conclusão e sem status de cancelamento no Voalle. */
export const GMUD_OPEN_SQL = `a.conclusion_date IS NULL AND COALESCE(ist.title, '') NOT ILIKE '%cancel%'`;

/** Aberta e ainda dentro do prazo, vencendo nos próximos 7 dias (mesma regra do filtro "vencem_semana"). */
export const GMUD_VENCE_EM_7_DIAS_SQL = `ai.responsible_final_date >= now() AND ai.responsible_final_date < now() + interval '7 days'`;

/** Valor de `tipo` na URL (sem acento) -> tipo gravado na plataforma. */
export const GMUD_TIPO_BY_SLUG = Object.freeze({
  emergencial: 'Emergencial',
  programada: 'Programada',
  pre_aprovada: 'Pré-aprovada',
});

const ORIGENS = new Set(['plataforma', 'legado']);

/** Lê e valida os filtros da query string; qualquer valor desconhecido é ignorado (vira "sem filtro"). */
export function parseGmudListFilters(query) {
  const q = query && typeof query === 'object' ? query : {};
  const filter = typeof q.filter === 'string' ? q.filter : 'todas';
  const tipoSlug = typeof q.tipo === 'string' ? q.tipo.trim().toLowerCase() : '';
  const origemRaw = typeof q.origem === 'string' ? q.origem.trim().toLowerCase() : '';
  const minhasRaw = typeof q.minhas === 'string' ? q.minhas.trim().toLowerCase() : '';
  return {
    filter,
    tipo: Object.hasOwn(GMUD_TIPO_BY_SLUG, tipoSlug) ? GMUD_TIPO_BY_SLUG[tipoSlug] : null,
    origem: ORIGENS.has(origemRaw) ? origemRaw : null,
    // `filter=minhas` é o jeito antigo e continua valendo.
    minhas: minhasRaw === '1' || minhasRaw === 'true' || filter === 'minhas',
  };
}

/**
 * Status do Comitê que o `filter` pede à plataforma: `undefined` quando o filtro não depende da plataforma,
 * `null` para "todas as registradas" (filter=plataforma) ou a lista de status.
 */
export function gmudFilterComiteStatuses(filter) {
  if (filter === 'comite_pendente') return ['pendente'];
  if (filter === 'aprovadas') return ['aprovada'];
  if (filter === 'plataforma') return null;
  return undefined;
}

/** `= ANY($n)` com lista vazia não casa nada; [0] mantém o tipo do parâmetro e nenhum protocolo é 0. */
function protocolList(list) {
  return Array.isArray(list) && list.length > 0 ? list : [0];
}

/**
 * Monta o trecho do WHERE (começando por " AND ...") e os parâmetros da lista de GMUDs.
 * `lists` traz os protocolos vindos do MySQL: `filter` (do filtro dos cartões), `tipo` e `registered`.
 */
export function buildGmudListWhere({ typeId, search = '', filter = 'todas', tipo = null, origem = null, minhas = false, email = '', lists = {} }) {
  const params = [typeId];
  let clause = '';
  if (search !== '') {
    params.push(`%${search}%`);
    clause = ` AND (ai.protocol::text ILIKE $${params.length} OR a.title ILIKE $${params.length} OR pe.name ILIKE $${params.length})`;
  }
  const open = ` AND ${GMUD_OPEN_SQL}`;
  if (filter === 'abertas') clause += open;
  else if (filter === 'vencidas') clause += `${open} AND ai.responsible_final_date < now()`;
  else if (filter === 'vencem_semana') clause += `${open} AND ${GMUD_VENCE_EM_7_DIAS_SQL}`;
  else if (gmudFilterComiteStatuses(filter) !== undefined) {
    params.push(protocolList(lists.filter));
    clause += ` AND ai.protocol = ANY($${params.length}::bigint[])`;
    // Cancelada/concluída no Voalle não está mais aguardando ninguém.
    if (filter === 'comite_pendente') clause += open;
  }
  if (minhas) {
    params.push(String(email ?? '').trim().toLowerCase());
    clause += ` AND lower(pe.email) = $${params.length}`;
  }
  if (tipo) {
    params.push(protocolList(lists.tipo));
    clause += ` AND ai.protocol = ANY($${params.length}::bigint[])`;
  }
  if (origem === 'plataforma') {
    params.push(protocolList(lists.registered));
    clause += ` AND ai.protocol = ANY($${params.length}::bigint[])`;
  } else if (origem === 'legado') {
    params.push(protocolList(lists.registered));
    clause += ` AND NOT (ai.protocol = ANY($${params.length}::bigint[]))`;
  }
  return { clause, params };
}

/**
 * SQL dos números do topo. Com `withOrigem`, conta também quantas das abertas/vencidas são da plataforma
 * ($2 = protocolos registrados); o legado é o total menos a plataforma.
 */
export function buildGmudSummarySql({ withOrigem = false } = {}) {
  const origem = withOrigem
    ? `,
              COUNT(*) FILTER (WHERE ${GMUD_OPEN_SQL} AND ai.protocol = ANY($2::bigint[]))::int AS abertas_plataforma,
              COUNT(*) FILTER (WHERE ${GMUD_OPEN_SQL} AND ai.responsible_final_date < now() AND ai.protocol = ANY($2::bigint[]))::int AS vencidas_plataforma`
    : '';
  return `SELECT COUNT(*) FILTER (WHERE ${GMUD_OPEN_SQL})::int AS abertas,
              COUNT(*) FILTER (WHERE ${GMUD_OPEN_SQL} AND ai.responsible_final_date < now())::int AS vencidas,
              COUNT(*) FILTER (WHERE ${GMUD_OPEN_SQL} AND ${GMUD_VENCE_EM_7_DIAS_SQL})::int AS vencem_semana${origem}
         FROM erp.assignment_incidents ai
         JOIN erp.assignments a ON a.id = ai.assignment_id
         LEFT JOIN erp.incident_status ist ON ist.id = ai.incident_status_id
        WHERE ai.incident_type_id = $1`;
}

/**
 * Resposta do resumo. Os quatro campos de sempre continuam; a divisão por origem vem em campos novos e fica
 * `null` quando a plataforma (MySQL) não respondeu — o painel então mostra só o total.
 */
export function gmudSummaryFromRow(row, { comitePendente = 0, withOrigem = false } = {}) {
  const r = row ?? {};
  const abertas = r.abertas ?? 0;
  const vencidas = r.vencidas ?? 0;
  const abertasPlataforma = withOrigem ? (r.abertas_plataforma ?? 0) : null;
  const vencidasPlataforma = withOrigem ? (r.vencidas_plataforma ?? 0) : null;
  return {
    abertas,
    vencidas,
    vencemSemana: r.vencem_semana ?? 0,
    comitePendente,
    abertasPlataforma,
    abertasLegado: withOrigem ? Math.max(0, abertas - abertasPlataforma) : null,
    vencidasPlataforma,
    vencidasLegado: withOrigem ? Math.max(0, vencidas - vencidasPlataforma) : null,
  };
}
