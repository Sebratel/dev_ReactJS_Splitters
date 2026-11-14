import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReuniaoSemanal,
  classificarResultadoFeito,
  entraNoVem,
  janelaCruza,
  parseReuniaoSemanalQuery,
  reagendadasParaFora,
  sistemaDaGmud,
  toReuniaoItem,
} from './gmudReuniaoSemanal.js';

const QUERY = { feitoDe: '2026-11-09', feitoAte: '2026-11-15', vemDe: '2026-11-16', vemAte: '2026-11-22' };
const AGORA = '2026-11-17 10:00:00';

const row = (over = {}) => ({
  voalleProtocol: 100,
  titulo: 'Troca de OLT',
  tipo: 'Programada',
  categoria: 'rede_externa',
  categoriaData: null,
  popSite: 'POP Centro',
  dataInicio: '2026-11-10',
  horaInicio: '01:00',
  dataFim: '2026-11-10',
  horaFim: '05:00',
  impactoParada: 'Sim',
  statusComite: 'aprovada',
  statusAreas: 'nao_aplicavel',
  statusExec: null,
  ellevenEncerradoEm: null,
  ellevenEncerradoStatus: null,
  ...over,
});
const item = (over = {}, extra = {}) => toReuniaoItem(row(over), extra);

test('parseReuniaoSemanalQuery: aceita os quatro parametros validos', () => {
  assert.deepEqual(parseReuniaoSemanalQuery(QUERY), QUERY);
  assert.deepEqual(parseReuniaoSemanalQuery({ ...QUERY, feitoDe: ' 2026-11-09 ' }).feitoDe, '2026-11-09');
});

test('parseReuniaoSemanalQuery: recusa data ausente, mal formatada, impossivel, invertida ou intervalo grande', () => {
  const erro400 = (query, pattern) =>
    assert.throws(() => parseReuniaoSemanalQuery(query), (e) => e.statusCode === 400 && pattern.test(e.message));
  erro400({}, /AAAA-MM-DD/);
  erro400(undefined, /AAAA-MM-DD/);
  erro400({ ...QUERY, vemAte: undefined }, /vemDe e vemAte/);
  erro400({ ...QUERY, feitoDe: '09/11/2026' }, /AAAA-MM-DD/);
  erro400({ ...QUERY, feitoDe: "2026-11-09' OR 1=1" }, /AAAA-MM-DD/);
  erro400({ ...QUERY, feitoDe: ['2026-11-09'] }, /AAAA-MM-DD/);
  erro400({ ...QUERY, feitoAte: '2026-02-31' }, /AAAA-MM-DD/);
  erro400({ ...QUERY, feitoDe: '2026-11-16' }, /termina antes/);
  erro400({ ...QUERY, vemAte: '2026-12-01' }, /no máximo 15 dias/);
  // 15 dias contando os dois extremos ainda vale; virada de ano tambem.
  assert.equal(parseReuniaoSemanalQuery({ ...QUERY, vemAte: '2026-11-30' }).vemAte, '2026-11-30');
  assert.equal(parseReuniaoSemanalQuery({ ...QUERY, vemDe: '2026-12-28', vemAte: '2027-01-03' }).vemAte, '2027-01-03');
});

test('janelaCruza: dentro, nas bordas, atravessando e fora', () => {
  const j = (dataInicio, dataFim) => ({ dataInicio, dataFim });
  assert.equal(janelaCruza(j('2026-11-10', '2026-11-10'), '2026-11-09', '2026-11-15'), true);
  assert.equal(janelaCruza(j('2026-11-15', '2026-11-16'), '2026-11-09', '2026-11-15'), true);
  assert.equal(janelaCruza(j('2026-11-08', '2026-11-09'), '2026-11-09', '2026-11-15'), true);
  assert.equal(janelaCruza(j('2026-11-01', '2026-11-30'), '2026-11-09', '2026-11-15'), true);
  assert.equal(janelaCruza(j('2026-11-16', '2026-11-16'), '2026-11-09', '2026-11-15'), false);
  assert.equal(janelaCruza(j('2026-11-08', null), '2026-11-09', '2026-11-15'), false);
  assert.equal(janelaCruza(j(null, null), '2026-11-09', '2026-11-15'), false);
  assert.equal(janelaCruza(undefined, '2026-11-09', '2026-11-15'), false);
});

test('classificarResultadoFeito: concluida, cancelada e janela que passou sem concluir', () => {
  assert.equal(classificarResultadoFeito(item({ statusExec: 'concluida' }), AGORA), 'concluida');
  assert.equal(classificarResultadoFeito(item({ ellevenEncerradoStatus: 'concluida', ellevenEncerradoEm: '2026-11-10T08:00:00.000Z' }), AGORA), 'concluida');
  assert.equal(classificarResultadoFeito(item({ ellevenEncerradoStatus: 'cancelada', ellevenEncerradoEm: '2026-11-09T08:00:00.000Z' }), AGORA), 'cancelada');
  // Cancelada direto no Voalle vence ate uma conclusao gravada.
  assert.equal(classificarResultadoFeito(item({ statusExec: 'concluida' }, { elleven: { status: 'Cancelado' } }), AGORA), 'cancelada');
  assert.equal(classificarResultadoFeito(item(), AGORA), 'nao_concluida');
  assert.equal(classificarResultadoFeito(item({ statusAreas: 'aprovada' }), AGORA), 'nao_concluida');
});

test('classificarResultadoFeito: janela ainda aberta e casos que ficam de fora', () => {
  // Termina hoje as 12:00 e agora sao 10:00: ainda nao da para cobrar.
  assert.equal(classificarResultadoFeito(item({ dataInicio: '2026-11-17', dataFim: '2026-11-17', horaFim: '12:00' }), AGORA), 'janela_aberta');
  assert.equal(classificarResultadoFeito(item({ dataInicio: '2026-11-17', dataFim: '2026-11-17', horaFim: '09:59' }), AGORA), 'nao_concluida');
  // Sem hora de fim vale o fim do dia.
  assert.equal(classificarResultadoFeito(item({ dataInicio: '2026-11-17', dataFim: null, horaFim: null }), AGORA), 'janela_aberta');
  // Nao liberada nunca "deixou de ser concluida".
  assert.equal(classificarResultadoFeito(item({ statusComite: 'pendente' }), AGORA), null);
  assert.equal(classificarResultadoFeito(item({ statusComite: 'negada' }), AGORA), null);
  assert.equal(classificarResultadoFeito(item({ statusAreas: 'pendente' }), AGORA), null);
  assert.equal(classificarResultadoFeito(item({ statusAreas: 'negada' }), AGORA), null);
  assert.equal(classificarResultadoFeito(item({ ellevenEncerradoStatus: 'negada', ellevenEncerradoEm: '2026-11-09T08:00:00.000Z' }), AGORA), null);
  assert.equal(classificarResultadoFeito(item({ ellevenEncerradoEm: '2026-11-09T08:00:00.000Z' }), AGORA), null);
});

test('entraNoVem: pendentes entram; cancelada, negada, concluida e encerrada nao', () => {
  assert.equal(entraNoVem(item()), true);
  assert.equal(entraNoVem(item({ statusComite: 'pendente', statusAreas: 'pendente' })), true);
  assert.equal(entraNoVem(item({ statusComite: 'negada' })), false);
  assert.equal(entraNoVem(item({ statusExec: 'concluida' })), false);
  assert.equal(entraNoVem(item({ ellevenEncerradoStatus: 'cancelada' })), false);
  assert.equal(entraNoVem(item({}, { elleven: { status: 'Cancelado pelo solicitante' } })), false);
  assert.equal(entraNoVem(item({ ellevenEncerradoEm: '2026-11-09T08:00:00.000Z' })), false);
});

test('sistemaDaGmud e toReuniaoItem: mapeamento dos campos', () => {
  assert.equal(sistemaDaGmud({ sistemaAfetado: ' Hub Apps ' }), 'Hub Apps');
  assert.equal(sistemaDaGmud({ sistemaExterno: 'Voalle' }), 'Voalle');
  assert.equal(sistemaDaGmud({ sistemaExterno: 'Outro (especificar)', sistemaExternoOutro: 'Portal X' }), 'Portal X');
  assert.equal(sistemaDaGmud(null), null);
  assert.equal(sistemaDaGmud('texto'), null);

  assert.deepEqual(
    toReuniaoItem(row({ categoria: 'sistemas_internos', categoriaData: { sistemaAfetado: 'Hub Apps' }, popSite: null }), {
      elleven: { status: 'Abertura' },
      areas: { areasTotal: 3, areasAprovadas: 1 },
      reagendada: true,
    }),
    {
      protocolo: 100,
      titulo: 'Troca de OLT',
      tipo: 'Programada',
      categoria: 'sistemas_internos',
      popSite: null,
      sistema: 'Hub Apps',
      janela: { dataInicio: '2026-11-10', horaInicio: '01:00', dataFim: '2026-11-10', horaFim: '05:00' },
      impactoParada: 'Sim',
      statusComite: 'aprovada',
      statusAreas: 'nao_aplicavel',
      areasTotal: 3,
      areasAprovadas: 1,
      statusExec: null,
      ellevenEncerradoEm: null,
      ellevenEncerradoStatus: null,
      statusVoalle: 'Abertura',
      reagendada: true,
    },
  );
  // Sem dados do Voalle nem de areas, vale o padrao.
  const semExtras = toReuniaoItem(row());
  assert.equal(semExtras.statusVoalle, '');
  assert.equal(semExtras.areasTotal, 0);
  assert.equal(semExtras.reagendada, false);
});

test('reagendadasParaFora: so quem estava na semana e saiu dela; vale o evento mais recente', () => {
  const ev = (voalleProtocol, previous, next, at) => ({ voalleProtocol, previous, next, at });
  const semana = { dataInicio: '2026-11-11', horaInicio: '01:00', dataFim: '2026-11-11', horaFim: '03:00' };
  const depois = { dataInicio: '2026-11-25', horaInicio: '01:00', dataFim: '2026-11-25', horaFim: '03:00' };
  const antes = { dataInicio: '2026-10-01', horaInicio: '01:00', dataFim: '2026-10-01', horaFim: '03:00' };
  const events = [
    ev(1, semana, depois, 'e1'), // saiu da semana
    ev(2, semana, { ...semana, dataInicio: '2026-11-13', dataFim: '2026-11-13' }, 'e2'), // continua na semana (esta em naSemana)
    ev(3, antes, depois, 'e3'), // nunca esteve na semana
    ev(1, antes, semana, 'e0'), // evento mais antigo do protocolo 1: ignorado
    ev(0, semana, depois, 'x'),
    { voalleProtocol: 4, previous: null, next: depois },
  ];
  const out = reagendadasParaFora(events, new Set([2]), '2026-11-09', '2026-11-15');
  assert.deepEqual([...out.keys()], [1]);
  assert.deepEqual(out.get(1), { previous: semana, next: depois, at: 'e1' });
  assert.equal(reagendadasParaFora(null, [], '2026-11-09', '2026-11-15').size, 0);
});

test('buildReuniaoSemanal: classifica o feito, inclui as reagendadas para fora e filtra o que vem', () => {
  const feitoRows = [
    row({ voalleProtocol: 3, dataInicio: '2026-11-12', dataFim: '2026-11-12', statusExec: 'concluida' }),
    row({ voalleProtocol: 1, dataInicio: '2026-11-10', dataFim: '2026-11-10' }), // janela passou sem concluir
    row({ voalleProtocol: 2, dataInicio: '2026-11-11', dataFim: '2026-11-11', statusComite: 'pendente' }), // fica de fora
    row({ voalleProtocol: 4, dataInicio: '2026-11-13', dataFim: '2026-11-13' }), // cancelada no Voalle
  ];
  const movedRows = [row({ voalleProtocol: 5, dataInicio: '2026-11-25', dataFim: '2026-11-25' })];
  const moved = new Map([[5, { previous: { dataInicio: '2026-11-09', horaInicio: '02:00', dataFim: '2026-11-09', horaFim: '04:00' }, next: {}, at: null }]]);
  const vemRows = [
    row({ voalleProtocol: 8, dataInicio: '2026-11-18', horaInicio: '03:00', dataFim: '2026-11-18', statusComite: 'pendente' }),
    row({ voalleProtocol: 7, dataInicio: '2026-11-18', horaInicio: '01:00', dataFim: '2026-11-18' }),
    row({ voalleProtocol: 9, dataInicio: '2026-11-19', dataFim: '2026-11-19', statusComite: 'negada' }),
    row({ voalleProtocol: 6, dataInicio: '2026-11-16', dataFim: '2026-11-16' }),
  ];
  const data = buildReuniaoSemanal({
    feitoRows,
    vemRows,
    moved,
    movedRows,
    ellevenByProtocol: new Map([[4, { status: 'Cancelado' }], [1, { status: 'Abertura' }]]),
    extrasByProtocol: new Map([[8, { areasTotal: 2, areasAprovadas: 1 }]]),
    reagendadas: new Set([5, 7]),
    agoraNaive: AGORA,
  });

  assert.deepEqual(data.feito.map((i) => [i.protocolo, i.resultado]), [
    [5, 'reagendada'],
    [1, 'nao_concluida'],
    [3, 'concluida'],
    [4, 'cancelada'],
  ]);
  const reagendada = data.feito[0];
  assert.equal(reagendada.janela.dataInicio, '2026-11-09'); // a janela em que ESTAVA
  assert.equal(reagendada.novaJanela.dataInicio, '2026-11-25'); // para onde foi
  assert.equal(reagendada.reagendada, true);
  assert.equal(data.feito[1].statusVoalle, 'Abertura');
  assert.equal(data.feito[1].novaJanela, null);

  assert.deepEqual(data.vem.map((i) => i.protocolo), [6, 7, 8]);
  assert.equal(data.vem[1].reagendada, true);
  assert.equal(data.vem[2].areasAprovadas, 1);
  assert.equal('resultado' in data.vem[0], false);
});

test('buildReuniaoSemanal: sem dados devolve listas vazias', () => {
  assert.deepEqual(buildReuniaoSemanal({ agoraNaive: AGORA }), { feito: [], vem: [] });
});
