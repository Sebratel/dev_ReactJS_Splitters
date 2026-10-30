import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEscopoRede, normalizeEscopoRede, rowMatchesEscopoRede } from './gmudEscopoRede.js';

const row = (over = {}) => ({
  'PONTO DE ACESSO CODE': 'AP-1',
  'PONTO DE ACESSO': 'OLT 01',
  'CÓDIGO[SPLT.SECUNDARIO]': 'SPL-A',
  'SPLT.SECUNDARIO': 'OLT01-2-4/SPL A',
  ...over,
});

test('normalizeEscopoRede: sem ponto de acesso não há afunilamento', () => {
  assert.equal(normalizeEscopoRede(null), null);
  assert.equal(normalizeEscopoRede({ apCode: '  ', slot: 2 }), null);
});

test('normalizeEscopoRede: PON só vale com slot; limpa repetidos e ordena', () => {
  assert.deepEqual(normalizeEscopoRede({ apCode: 'AP-1', apTitle: 'OLT 01', slot: null, ports: [3] }), {
    apCode: 'AP-1', apTitle: 'OLT 01', slot: null, ports: [], splitters: [],
  });
  const e = normalizeEscopoRede({
    apCode: 'AP-1', slot: 2, ports: [5, 4, 5],
    splitters: [{ code: 'S1', title: 'Um' }, { code: 'S1', title: 'Um' }, { code: '', title: 'x' }],
  });
  assert.deepEqual(e.ports, [4, 5]);
  assert.equal(e.apTitle, 'AP-1');
  assert.equal(e.splitters.length, 1);
});

test('formatEscopoRede', () => {
  assert.equal(formatEscopoRede(null), '');
  assert.equal(formatEscopoRede({ apCode: 'AP-1', apTitle: 'OLT 01' }), 'OLT 01');
  assert.equal(
    formatEscopoRede({ apCode: 'AP-1', apTitle: 'OLT 01', slot: 2, ports: [4, 5], splitters: [{ code: 'A', title: 'SPL A' }] }),
    'OLT 01 · Slot 2 · PONs 4, 5 · Splitter: SPL A',
  );
});

test('rowMatchesEscopoRede: só ponto de acesso', () => {
  const e = normalizeEscopoRede({ apCode: 'AP-1' });
  assert.equal(rowMatchesEscopoRede(row(), e), true);
  assert.equal(rowMatchesEscopoRede(row({ 'PONTO DE ACESSO CODE': 'AP-2' }), e), false);
});

test('rowMatchesEscopoRede: slot e PON vêm do título do splitter (slot-porta antes da barra)', () => {
  assert.equal(rowMatchesEscopoRede(row(), normalizeEscopoRede({ apCode: 'AP-1', slot: 2 })), true);
  assert.equal(rowMatchesEscopoRede(row(), normalizeEscopoRede({ apCode: 'AP-1', slot: 3 })), false);
  assert.equal(rowMatchesEscopoRede(row(), normalizeEscopoRede({ apCode: 'AP-1', slot: 2, ports: [4, 5] })), true);
  assert.equal(rowMatchesEscopoRede(row(), normalizeEscopoRede({ apCode: 'AP-1', slot: 2, ports: [7] })), false);
});

test('rowMatchesEscopoRede: splitter tolera caixa, acento e pontuação', () => {
  const e = normalizeEscopoRede({ apCode: 'AP-1', splitters: [{ code: 'spl_a', title: 'x' }] });
  assert.equal(rowMatchesEscopoRede(row(), e), true);
  assert.equal(
    rowMatchesEscopoRede(row({ 'CÓDIGO[SPLT.SECUNDARIO]': 'SPL-B', 'SPLT.SECUNDARIO': 'OLT01-2-4/SPL B' }), e),
    false,
  );
});
