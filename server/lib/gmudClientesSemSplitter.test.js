import test from 'node:test';
import assert from 'node:assert/strict';
import { composeClientesTexto, formatClientesSemSplitter, normalizeClientesSemSplitter } from './gmudClientesSemSplitter.js';
import { buildSearchParams, mapClienteRow } from './gmudClientesElleven.js';

test('normaliza: contrato obrigatório, sem repetir, tipo padrão ponto a ponto', () => {
  const lista = normalizeClientesSemSplitter({
    clientesSemSplitter: [
      { contractId: '123', nome: '  Empresa A ', pppoe: ' usuarioA ', tipo: 'fibra_apagada' },
      { contractId: 123, nome: 'repetido' },
      { contractId: 'x', nome: 'sem contrato' },
      { contractId: 0, nome: 'zero' },
      { contractId: 456, nome: 'Empresa B', tipo: 'qualquer' },
      null,
    ],
  });
  assert.deepEqual(lista, [
    { contractId: 123, nome: 'Empresa A', pppoe: 'usuarioA', tipo: 'fibra_apagada' },
    { contractId: 456, nome: 'Empresa B', pppoe: '', tipo: 'ponto_a_ponto' },
  ]);
  assert.deepEqual(normalizeClientesSemSplitter(null), []);
  assert.deepEqual(normalizeClientesSemSplitter({ clientesSemSplitter: 'x' }), []);
});

test('formata uma linha por cliente e compõe com a observação livre', () => {
  const cd = { clientesSemSplitter: [{ contractId: 1, nome: 'A', tipo: 'fibra_apagada' }, { contractId: 2, nome: '', tipo: 'ponto_a_ponto' }], clientesManuais: 'avisar o gerente' };
  assert.equal(formatClientesSemSplitter(normalizeClientesSemSplitter(cd)), 'A (contrato 1, fibra apagada)\nCliente (contrato 2, ponto a ponto)');
  assert.equal(composeClientesTexto(cd), 'A (contrato 1, fibra apagada)\nCliente (contrato 2, ponto a ponto)\navisar o gerente');
  assert.equal(composeClientesTexto({}), '');
  assert.equal(composeClientesTexto({ clientesManuais: 'só texto' }), 'só texto');
});

test('busca: termo curto não consulta; número vira contrato; texto escapa curingas', () => {
  assert.equal(buildSearchParams(''), null);
  assert.equal(buildSearchParams('ab'), null);
  assert.deepEqual(buildSearchParams('12'), { contractId: 12, like: null });
  assert.deepEqual(buildSearchParams('12345'), { contractId: 12345, like: '%12345%' });
  assert.deepEqual(buildSearchParams('Empresa'), { contractId: null, like: '%Empresa%' });
  assert.equal(buildSearchParams('100%_x').like, '%100\\%\\_x%');
});

test('mapeia a linha: produtos em lista e tipo sugerido pelo produto', () => {
  const r = mapClienteRow({ contrato: '9', nome: ' X ', pppoe: null, ponto_acesso: 'BNG_01', produtos: 'LINK TRANSPORTE 50MBPS ISP | LOCAÇÃO DE FIBRA APAGADA', em_splitter: false });
  assert.deepEqual(r, {
    contractId: 9,
    nome: 'X',
    pppoe: '',
    pontoAcesso: 'BNG_01',
    produtos: ['LINK TRANSPORTE 50MBPS ISP', 'LOCAÇÃO DE FIBRA APAGADA'],
    emSplitter: false,
    tipoSugerido: 'fibra_apagada',
  });
  assert.equal(mapClienteRow({ contrato: 1, produtos: 'LINK TRANSPORTE', em_splitter: true }).tipoSugerido, 'ponto_a_ponto');
  assert.deepEqual(mapClienteRow({ contrato: 1, produtos: null }).produtos, []);
});
