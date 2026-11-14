import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GMUD_OPEN_SQL, buildGmudListWhere, parseGmudListFilters } from './gmudListFilters.js';
import {
  agruparSituacoes,
  buildGmudPainelCountsSql,
  buildGmudPainelWhere,
  buildGmudSolicitantesSql,
  classificarSituacaoPlataforma,
  gmudPainelCountsFromRow,
  gmudPainelNeeds,
  parseGmudPainelFilters,
  semanaAtual,
} from './gmudPainelFiltros.js';

const VAZIO = { filter: 'todas', minhas: false, aba: null, tipos: [], origem: null, situacoes: [], aberturaDias: null, solicitantes: [], ocultarCanceladas: false };
const SIT = { cancelada: [1], concluida: [2], negada: [3], encerrada: [4], liberada: [5], aguardando: [6] };
const SO_LEITURA = (sql) => assert.ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql));

test('parseGmudPainelFilters: sem parametros e com valores validos', () => {
  assert.deepEqual(parseGmudPainelFilters({}), VAZIO);
  assert.deepEqual(parseGmudPainelFilters(undefined), VAZIO);
  assert.deepEqual(
    parseGmudPainelFilters({
      filter: 'abertas',
      aba: 'Vencidas',
      tipo: 'emergencial,pre_aprovada',
      origem: 'plataforma',
      situacao: 'liberada, cancelada',
      aberturaDias: '30',
      solicitante: ['ANA SOUZA', 'BRUNO, DA SILVA'],
      ocultarCanceladas: '1',
    }),
    {
      filter: 'abertas',
      minhas: false,
      aba: 'vencidas',
      tipos: ['Emergencial', 'Pré-aprovada'],
      origem: 'plataforma',
      situacoes: ['liberada', 'cancelada'],
      aberturaDias: 30,
      // O nome do solicitante nao e quebrado em virgulas.
      solicitantes: ['ANA SOUZA', 'BRUNO, DA SILVA'],
      ocultarCanceladas: true,
    },
  );
});

test('parseGmudPainelFilters: valores desconhecidos ou fora da faixa sao ignorados', () => {
  const f = parseGmudPainelFilters({
    aba: 'equipe',
    tipo: "x' OR 1=1,programada,constructor",
    origem: 'plataforma,legado',
    situacao: 'liberada,drop table,liberada',
    aberturaDias: '0',
    solicitante: ['', '   ', 'x'.repeat(500), 42],
    ocultarCanceladas: 'talvez',
  });
  assert.deepEqual(f, { ...VAZIO, tipos: ['Programada'], situacoes: ['liberada'] });
  assert.equal(parseGmudPainelFilters({ aberturaDias: '366' }).aberturaDias, null);
  assert.equal(parseGmudPainelFilters({ aberturaDias: '365' }).aberturaDias, 365);
  assert.equal(parseGmudPainelFilters({ aberturaDias: '7 days' }).aberturaDias, null);
  assert.equal(parseGmudPainelFilters({ aberturaDias: ['7'] }).aberturaDias, null);
  assert.equal(parseGmudPainelFilters({ origem: 'legado' }).origem, 'legado');
  assert.equal(parseGmudPainelFilters({ ocultarCanceladas: 'true' }).ocultarCanceladas, true);
  // Jeito antigo continua valendo.
  assert.equal(parseGmudPainelFilters({ filter: 'minhas' }).minhas, true);
  assert.deepEqual(parseGmudPainelFilters({ tipo: 'emergencial' }).tipos, ['Emergencial']);
  // No maximo 50 itens por lista.
  assert.equal(parseGmudPainelFilters({ solicitante: Array.from({ length: 80 }, (_, i) => `P${i}`) }).solicitantes.length, 50);
});

test('classificarSituacaoPlataforma: mesma ordem de gmudSituacao', () => {
  const c = classificarSituacaoPlataforma;
  assert.equal(c({ ellevenEncerradoStatus: 'cancelada', statusExec: 'concluida' }), 'cancelada');
  assert.equal(c({ statusExec: 'concluida', statusComite: 'aprovada' }), 'concluida');
  assert.equal(c({ ellevenEncerradoStatus: 'concluida' }), 'concluida');
  assert.equal(c({ statusComite: 'negada' }), 'negada');
  assert.equal(c({ statusComite: 'pendente', ellevenEncerradoStatus: 'negada' }), 'negada');
  assert.equal(c({ statusComite: 'aprovada', ellevenEncerradoEm: '2026-11-01T10:00:00Z' }), 'encerrada');
  assert.equal(c({ statusComite: 'aprovada', statusAreas: 'nao_aplicavel' }), 'liberada');
  assert.equal(c({ statusComite: 'aprovada', statusAreas: 'aprovada' }), 'liberada');
  assert.equal(c({ statusComite: 'aprovada', statusAreas: null }), 'liberada');
  assert.equal(c({ statusComite: 'aprovada', statusAreas: 'pendente' }), 'aguardando');
  assert.equal(c({ statusComite: 'aprovada', statusAreas: 'negada' }), 'aguardando');
  assert.equal(c({ statusComite: 'pendente', statusAreas: 'aprovada' }), 'aguardando');
  assert.equal(c({ statusComite: null }), null);
  assert.equal(c(undefined), null);
});

test('agruparSituacoes: protocolos por situacao', () => {
  const grupos = agruparSituacoes([
    { voalleProtocol: 10, statusComite: 'pendente' },
    { voalleProtocol: 11, statusComite: 'aprovada', statusAreas: 'nao_aplicavel' },
    { voalleProtocol: 12, ellevenEncerradoStatus: 'cancelada' },
    { voalleProtocol: 13, statusComite: null },
    { voalleProtocol: 0, statusComite: 'pendente' },
    { voalleProtocol: '14', statusExec: 'concluida' },
  ]);
  assert.deepEqual(grupos, { aguardando: [10], liberada: [11], concluida: [14], encerrada: [], negada: [], cancelada: [12] });
  assert.deepEqual(agruparSituacoes(null).cancelada, []);
});

test('semanaAtual: segunda a domingo, virando mes e ano', () => {
  assert.deepEqual(semanaAtual('2026-11-11'), { de: '2026-11-09', ate: '2026-11-15' });
  assert.deepEqual(semanaAtual('2026-11-09'), { de: '2026-11-09', ate: '2026-11-15' });
  assert.deepEqual(semanaAtual('2026-11-15'), { de: '2026-11-09', ate: '2026-11-15' });
  assert.deepEqual(semanaAtual('2027-01-01 08:00:00'), { de: '2026-12-28', ate: '2027-01-03' });
  assert.equal(semanaAtual('ontem'), null);
});

test('gmudPainelNeeds: so pede as listas que a consulta usa', () => {
  assert.deepEqual(gmudPainelNeeds(VAZIO), { filter: undefined, registered: false, tipos: false, situacao: false, comitePendente: false, semana: false });
  assert.deepEqual(gmudPainelNeeds({ ...VAZIO, filter: 'comite_pendente', origem: 'legado', tipos: ['Programada'], situacoes: ['liberada'], aba: 'semana' }), {
    filter: ['pendente'],
    registered: true,
    tipos: true,
    situacao: true,
    comitePendente: false,
    semana: true,
  });
  assert.equal(gmudPainelNeeds({ ...VAZIO, ocultarCanceladas: true }).situacao, true);
  assert.equal(gmudPainelNeeds({ ...VAZIO, aba: 'aguardando' }).comitePendente, true);
  const todas = gmudPainelNeeds(VAZIO, { todasAsAbas: true });
  assert.equal(todas.situacao && todas.comitePendente && todas.semana, true);
});

test('buildGmudPainelWhere: sem os parametros novos e igual ao de antes', () => {
  for (const query of [{}, { filter: 'abertas' }, { filter: 'vencidas' }, { filter: 'minhas' }, { filter: 'comite_pendente' }, { origem: 'legado' }, { minhas: '1', filter: 'vencem_semana' }]) {
    const lists = { filter: [10, 11], registered: [5, 6] };
    const antes = buildGmudListWhere({ typeId: 1084, search: 'olt', ...parseGmudListFilters(query), email: 'ana@sebratel.com', lists });
    const agora = buildGmudPainelWhere({ typeId: 1084, search: 'olt', filters: parseGmudPainelFilters(query), email: 'ana@sebratel.com', lists });
    assert.deepEqual(agora, antes, JSON.stringify(query));
  }
  assert.deepEqual(buildGmudPainelWhere({ typeId: 1084 }), { clause: '', params: [1084] });
});

test('buildGmudPainelWhere: tipo (um ou varios), abertura e solicitante viram parametros', () => {
  const r = buildGmudPainelWhere({
    typeId: 1084,
    filters: parseGmudPainelFilters({ tipo: 'emergencial,programada', aberturaDias: '30', solicitante: ["ANA D'AVILA"] }),
    lists: { tipos: [7, 8] },
  });
  assert.deepEqual(r.params, [1084, [7, 8], 30, ["ANA D'AVILA"]]);
  assert.equal(
    r.clause,
    ' AND ai.protocol = ANY($2::bigint[]) AND ai.date_to_start >= now() - make_interval(days => $3::int) AND pe.name = ANY($4::text[])',
  );
  // O texto do usuario so aparece nos parametros.
  assert.ok(!r.clause.includes('ANA') && !r.clause.includes('Emergencial'));
  // Tipo sem nenhuma GMUD registrada nao casa nada.
  assert.deepEqual(buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ tipo: 'programada' }), lists: {} }).params, [1084, [0]]);
});

test('buildGmudPainelWhere: situacao segue a precedencia e reaproveita os parametros', () => {
  const uma = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ situacao: 'liberada' }), lists: { situacao: SIT } });
  assert.deepEqual(uma.params, [1084, [5]]);
  assert.equal(uma.clause, " AND ((NOT COALESCE(ist.title, '') ILIKE '%cancel%' AND NOT a.conclusion_date IS NOT NULL AND ai.protocol = ANY($2::bigint[])))");

  const cancelada = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ situacao: 'cancelada' }), lists: { situacao: SIT } });
  assert.deepEqual(cancelada.params, [1084, [1]]);
  assert.equal(cancelada.clause, " AND ((COALESCE(ist.title, '') ILIKE '%cancel%' OR ai.protocol = ANY($2::bigint[])))");

  // Encerrada: fechada sem outro motivo, inclusive o legado (so a data de conclusao do Voalle).
  const encerrada = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ situacao: 'encerrada' }), lists: { situacao: SIT } });
  assert.deepEqual(encerrada.params, [1084, [1], [2], [3], [4]]);
  assert.match(encerrada.clause, /NOT ai\.protocol = ANY\(\$2::bigint\[\]\) AND NOT ai\.protocol = ANY\(\$3::bigint\[\]\) AND NOT ai\.protocol = ANY\(\$4::bigint\[\]\) AND \(ai\.protocol = ANY\(\$5::bigint\[\]\) OR a\.conclusion_date IS NOT NULL\)/);

  // Varias situacoes entram com OR; a lista de canceladas usa o mesmo $n nas duas vezes.
  const varias = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ situacao: 'cancelada,encerrada,aguardando' }), lists: { situacao: SIT } });
  assert.deepEqual(varias.params, [1084, [1], [2], [3], [4], [6]]);
  assert.equal(varias.clause.split(' OR (').length >= 3, true);
  assert.equal((varias.clause.match(/\$2::bigint/g) ?? []).length, 2);
});

test('buildGmudPainelWhere: ocultar canceladas e abas', () => {
  const ocultar = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ ocultarCanceladas: '1' }), lists: { situacao: SIT } });
  assert.deepEqual(ocultar.params, [1084, [1]]);
  assert.equal(ocultar.clause, " AND NOT (COALESCE(ist.title, '') ILIKE '%cancel%' OR ai.protocol = ANY($2::bigint[]))");

  const minhas = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ aba: 'minhas' }), email: ' Ana@Sebratel.com ' });
  assert.deepEqual(minhas, { clause: ' AND lower(pe.email) = $2', params: [1084, 'ana@sebratel.com'] });

  const aguardando = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ aba: 'aguardando' }), lists: { comitePendente: [9] } });
  assert.deepEqual(aguardando, { clause: ` AND (ai.protocol = ANY($2::bigint[]) AND ${GMUD_OPEN_SQL})`, params: [1084, [9]] });

  const vencidas = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ aba: 'vencidas' }) });
  assert.deepEqual(vencidas, { clause: ` AND (${GMUD_OPEN_SQL} AND ai.responsible_final_date < now())`, params: [1084] });

  const semana = buildGmudPainelWhere({ typeId: 1084, filters: parseGmudPainelFilters({ aba: 'semana' }), lists: { semana: [] } });
  assert.deepEqual(semana, { clause: ' AND ai.protocol = ANY($2::bigint[])', params: [1084, [0]] });
});

test('buildGmudPainelWhere: tudo combinado, com os parametros na ordem', () => {
  const r = buildGmudPainelWhere({
    typeId: 1084,
    search: 'olt',
    filters: parseGmudPainelFilters({ filter: 'abertas', origem: 'plataforma', tipo: 'programada', situacao: 'liberada', aberturaDias: '7', solicitante: 'ANA', ocultarCanceladas: '1', aba: 'minhas' }),
    email: 'ana@sebratel.com',
    lists: { registered: [5, 6, 7], tipos: [5], situacao: SIT },
  });
  assert.deepEqual(r.params, [1084, '%olt%', [5, 6, 7], [5], [5], 7, ['ANA'], [1], 'ana@sebratel.com']);
  assert.ok(r.clause.endsWith(' AND lower(pe.email) = $9'));
  SO_LEITURA(r.clause);
});

test('buildGmudPainelCountsSql: uma consulta com a contagem de cada aba e das canceladas', () => {
  const { sql, params } = buildGmudPainelCountsSql({
    typeId: 1084,
    search: 'olt',
    filters: parseGmudPainelFilters({ aba: 'vencidas', ocultarCanceladas: '1', tipo: 'programada' }),
    email: 'ana@sebratel.com',
    lists: { tipos: [5], situacao: SIT, comitePendente: [9], semana: [5, 9] },
  });
  SO_LEITURA(sql);
  assert.match(sql, /^SELECT COUNT\(\*\) FILTER/);
  for (const coluna of ['todas', 'minhas', 'aguardando', 'vencidas', 'semana', 'canceladas']) assert.match(sql, new RegExp(`::int AS ${coluna}\\b`));
  // Os filtros valem para todas as abas; a aba escolhida NAO entra no WHERE (senao as outras contariam zero).
  assert.ok(sql.includes("WHERE ai.incident_type_id = $1 AND (ai.protocol::text ILIKE $2 OR a.title ILIKE $2 OR pe.name ILIKE $2) AND ai.protocol = ANY($3::bigint[])"));
  assert.ok(sql.trim().endsWith('AND ai.protocol = ANY($3::bigint[])'));
  assert.deepEqual(params, [1084, '%olt%', [5], [1], 'ana@sebratel.com', [9], [5, 9]]);
  // Com "ocultar", cada aba conta so as nao canceladas; as canceladas sao contadas na aba atual.
  assert.match(sql, /FILTER \(WHERE NOT \(COALESCE\(ist\.title, ''\) ILIKE '%cancel%' OR ai\.protocol = ANY\(\$4::bigint\[\]\)\)\)::int AS todas/);
  assert.match(sql, /FILTER \(WHERE \(COALESCE\(ist\.title, ''\) ILIKE '%cancel%' OR ai\.protocol = ANY\(\$4::bigint\[\]\)\) AND \(.*responsible_final_date < now\(\)\)\)::int AS canceladas/);

  const semOcultar = buildGmudPainelCountsSql({ typeId: 1084, filters: parseGmudPainelFilters({}), lists: {} });
  assert.match(semOcultar.sql, /FILTER \(WHERE TRUE\)::int AS todas/);
  assert.match(semOcultar.sql, /AND TRUE\)::int AS canceladas/);
});

test('gmudPainelCountsFromRow e solicitantes', () => {
  assert.deepEqual(gmudPainelCountsFromRow({ todas: 12, minhas: 3, aguardando: 2, vencidas: 4, semana: 1, canceladas: 5 }), {
    todas: 12, minhas: 3, aguardando: 2, vencidas: 4, semana: 1, canceladas: 5,
  });
  assert.deepEqual(gmudPainelCountsFromRow(undefined), { todas: 0, minhas: 0, aguardando: 0, vencidas: 0, semana: 0, canceladas: 0 });
  const sql = buildGmudSolicitantesSql();
  SO_LEITURA(sql);
  assert.match(sql, /^SELECT DISTINCT pe\.name AS name/);
  assert.match(sql, /LIMIT 500$/);
});
