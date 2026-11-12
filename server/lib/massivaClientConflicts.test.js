import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CONTRACT_IDS, groupConflictsByEvent, normalizeContractIds } from './massivaClientConflicts.js';

test('normalizeContractIds mantém só inteiros positivos, sem repetição', () => {
  assert.deepEqual(normalizeContractIds([1, '2', 2, 0, -3, 'x', null, 4.5, 7]), [1, 2, 7]);
  assert.deepEqual(normalizeContractIds(undefined), []);
  assert.deepEqual(normalizeContractIds('1,2'), []);
});

test('normalizeContractIds limita a quantidade', () => {
  const many = Array.from({ length: MAX_CONTRACT_IDS + 50 }, (_, i) => i + 1);
  assert.equal(normalizeContractIds(many).length, MAX_CONTRACT_IDS);
});

test('groupConflictsByEvent agrupa por protocolo e junta os clientes', () => {
  const { events, contractIds } = groupConflictsByEvent([
    { contract_id: 10, user_pppoe: 'ana', protocol: 1888, title: 'OLT 01', opened_at: '2026-11-12T10:00:00Z', finish_date: '2026-11-12T14:00:00Z' },
    { contract_id: 11, user_pppoe: 'beto', protocol: 1888, title: 'OLT 01', opened_at: '2026-11-12T10:00:00Z', finish_date: '2026-11-12T14:00:00Z' },
    { contract_id: 10, user_pppoe: 'ana', protocol: 1700, title: 'OLT 02', opened_at: '2026-11-12T08:00:00Z', finish_date: '2026-11-12T12:00:00Z' },
  ]);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.protocol), [1700, 1888]);
  assert.equal(events[1].origin, 'massiva');
  assert.deepEqual(events[1].clients, [
    { contractId: 10, pppoe: 'ana' },
    { contractId: 11, pppoe: 'beto' },
  ]);
  assert.equal(events[1].finishDate, '2026-11-12T14:00:00.000Z');
  assert.deepEqual(contractIds.sort((a, b) => a - b), [10, 11]);
});

test('groupConflictsByEvent não repete o cliente no mesmo evento e ignora linhas inválidas', () => {
  const { events, contractIds } = groupConflictsByEvent([
    { contract_id: 10, user_pppoe: 'ana', protocol: 5 },
    { contract_id: 10, user_pppoe: 'ana', protocol: 5 },
    { contract_id: 0, user_pppoe: 'x', protocol: 5 },
    { contract_id: 3, user_pppoe: 'y', protocol: 'abc' },
    null,
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].clients.length, 1);
  assert.deepEqual(contractIds, [10]);
  assert.equal(events[0].finishDate, null);
});

test('groupConflictsByEvent sem linhas devolve vazio', () => {
  assert.deepEqual(groupConflictsByEvent([]), { events: [], contractIds: [] });
  assert.deepEqual(groupConflictsByEvent(undefined), { events: [], contractIds: [] });
});
