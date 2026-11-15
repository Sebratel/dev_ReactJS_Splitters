import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GMUD_OPEN_SQL,
  buildGmudListWhere,
  buildGmudSummarySql,
  gmudFilterComiteStatuses,
  gmudSummaryFromRow,
  parseGmudListFilters,
} from './gmudListFilters.js';

test('parseGmudListFilters: valores validos, desconhecidos e compatibilidade com filter=minhas', () => {
  assert.deepEqual(parseGmudListFilters({}), { filter: 'todas', tipo: null, origem: null, minhas: false });
  assert.deepEqual(parseGmudListFilters(undefined), { filter: 'todas', tipo: null, origem: null, minhas: false });
  assert.deepEqual(parseGmudListFilters({ filter: 'abertas', tipo: 'pre_aprovada', origem: 'Plataforma', minhas: '1' }), {
    filter: 'abertas',
    tipo: 'Pré-aprovada',
    origem: 'plataforma',
    minhas: true,
  });
  assert.equal(parseGmudListFilters({ tipo: 'emergencial' }).tipo, 'Emergencial');
  assert.equal(parseGmudListFilters({ tipo: 'programada' }).tipo, 'Programada');
  // Valor fora da lista nunca chega ao SQL: vira "sem filtro".
  assert.equal(parseGmudListFilters({ tipo: "x' OR 1=1" }).tipo, null);
  assert.equal(parseGmudListFilters({ tipo: 'constructor' }).tipo, null);
  assert.equal(parseGmudListFilters({ origem: 'outra' }).origem, null);
  assert.equal(parseGmudListFilters({ minhas: '0' }).minhas, false);
  assert.equal(parseGmudListFilters({ filter: 'minhas' }).minhas, true);
});

test('gmudFilterComiteStatuses: so os filtros da plataforma pedem lista de protocolos', () => {
  assert.deepEqual(gmudFilterComiteStatuses('comite_pendente'), ['pendente']);
  assert.deepEqual(gmudFilterComiteStatuses('aprovadas'), ['aprovada']);
  assert.equal(gmudFilterComiteStatuses('plataforma'), null);
  assert.equal(gmudFilterComiteStatuses('abertas'), undefined);
  assert.equal(gmudFilterComiteStatuses('todas'), undefined);
});

test('buildGmudListWhere: sem filtros so o tipo de incidente', () => {
  assert.deepEqual(buildGmudListWhere({ typeId: 1084 }), { clause: '', params: [1084] });
});

test('buildGmudListWhere: filtros antigos continuam iguais', () => {
  const busca = buildGmudListWhere({ typeId: 1084, search: 'olt' });
  assert.deepEqual(busca.params, [1084, '%olt%']);
  assert.match(busca.clause, /ai\.protocol::text ILIKE \$2 OR a\.title ILIKE \$2 OR pe\.name ILIKE \$2/);

  assert.equal(buildGmudListWhere({ typeId: 1084, filter: 'abertas' }).clause, ` AND ${GMUD_OPEN_SQL}`);
  assert.match(buildGmudListWhere({ typeId: 1084, filter: 'vencidas' }).clause, /responsible_final_date < now\(\)$/);
  assert.match(buildGmudListWhere({ typeId: 1084, filter: 'vencem_semana' }).clause, /interval '7 days'/);

  const minhas = buildGmudListWhere({ typeId: 1084, ...parseGmudListFilters({ filter: 'minhas' }), email: ' Ana@Sebratel.com ' });
  assert.deepEqual(minhas.params, [1084, 'ana@sebratel.com']);
  assert.equal(minhas.clause, ' AND lower(pe.email) = $2');

  const comite = buildGmudListWhere({ typeId: 1084, filter: 'comite_pendente', lists: { filter: [10, 11] } });
  assert.deepEqual(comite.params, [1084, [10, 11]]);
  assert.equal(comite.clause, ` AND ai.protocol = ANY($2::bigint[]) AND ${GMUD_OPEN_SQL}`);

  // Lista vazia da plataforma nao casa nada (e nao quebra o tipo do parametro).
  const vazio = buildGmudListWhere({ typeId: 1084, filter: 'plataforma', lists: { filter: [] } });
  assert.deepEqual(vazio.params, [1084, [0]]);
  assert.equal(vazio.clause, ' AND ai.protocol = ANY($2::bigint[])');
});

test('buildGmudListWhere: tipo, origem e minhas combinam com o filtro do cartao', () => {
  const r = buildGmudListWhere({
    typeId: 1084,
    search: 'olt',
    filter: 'abertas',
    tipo: 'Emergencial',
    origem: 'plataforma',
    minhas: true,
    email: 'ana@sebratel.com',
    lists: { tipo: [5, 6], registered: [5, 6, 7] },
  });
  assert.deepEqual(r.params, [1084, '%olt%', 'ana@sebratel.com', [5, 6], [5, 6, 7]]);
  assert.match(r.clause, /ILIKE \$2/);
  assert.ok(r.clause.includes(` AND ${GMUD_OPEN_SQL}`));
  assert.ok(r.clause.includes(' AND lower(pe.email) = $3'));
  assert.ok(r.clause.includes(' AND ai.protocol = ANY($4::bigint[])'));
  assert.ok(r.clause.endsWith(' AND ai.protocol = ANY($5::bigint[])'));
  // O texto do usuario so aparece nos parametros.
  assert.ok(!r.clause.includes('olt') && !r.clause.includes('ana@') && !r.clause.includes('Emergencial'));
});

test('buildGmudListWhere: legado e o que NAO esta registrado na plataforma', () => {
  const r = buildGmudListWhere({ typeId: 1084, filter: 'vencidas', origem: 'legado', lists: { registered: [5, 6] } });
  assert.deepEqual(r.params, [1084, [5, 6]]);
  assert.ok(r.clause.endsWith(' AND NOT (ai.protocol = ANY($2::bigint[]))'));
  // Sem nada registrado, tudo e legado: NOT ANY([0]) casa todos os protocolos.
  const semRegistro = buildGmudListWhere({ typeId: 1084, origem: 'legado', lists: { registered: [] } });
  assert.deepEqual(semRegistro.params, [1084, [0]]);
});

test('buildGmudListWhere: tipo sem nenhuma GMUD registrada nao casa nada', () => {
  const r = buildGmudListWhere({ typeId: 1084, tipo: 'Programada', lists: {} });
  assert.deepEqual(r.params, [1084, [0]]);
  assert.equal(r.clause, ' AND ai.protocol = ANY($2::bigint[])');
});

test('buildGmudSummarySql: so leitura; a divisao por origem usa $2', () => {
  const simples = buildGmudSummarySql();
  assert.match(simples, /^SELECT /);
  assert.ok(!simples.includes('$2'));
  assert.ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(simples));
  const comOrigem = buildGmudSummarySql({ withOrigem: true });
  assert.match(comOrigem, /AS abertas_plataforma/);
  assert.match(comOrigem, /AS vencidas_plataforma/);
  assert.match(comOrigem, /ai\.protocol = ANY\(\$2::bigint\[\]\)/);
  assert.ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i.test(comOrigem));
});

test('gmudSummaryFromRow: mantem os campos antigos e divide plataforma/legado', () => {
  const row = { abertas: 12, vencidas: 5, vencem_semana: 3, abertas_plataforma: 4, vencidas_plataforma: 1 };
  assert.deepEqual(gmudSummaryFromRow(row, { comitePendente: 2, withOrigem: true }), {
    abertas: 12,
    vencidas: 5,
    vencemSemana: 3,
    comitePendente: 2,
    abertasPlataforma: 4,
    abertasLegado: 8,
    vencidasPlataforma: 1,
    vencidasLegado: 4,
  });
});

test('gmudSummaryFromRow: sem a plataforma a divisao vem nula e os totais continuam', () => {
  assert.deepEqual(gmudSummaryFromRow({ abertas: 12, vencidas: 5, vencem_semana: 3 }, { comitePendente: 0 }), {
    abertas: 12,
    vencidas: 5,
    vencemSemana: 3,
    comitePendente: 0,
    abertasPlataforma: null,
    abertasLegado: null,
    vencidasPlataforma: null,
    vencidasLegado: null,
  });
  assert.equal(gmudSummaryFromRow(undefined).abertas, 0);
});
