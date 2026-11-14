import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPO_PRE_APROVADA, isPreAprovada } from './gmudPreAprovada.js';
import { deriveApprovalAreas } from './gmudAreaApproval.js';

test('isPreAprovada reconhece o tipo (com espaços) e nada além dele', () => {
  assert.equal(isPreAprovada('Pré-aprovada'), true);
  assert.equal(isPreAprovada('  Pré-aprovada '), true);
  assert.equal(isPreAprovada('Programada'), false);
  assert.equal(isPreAprovada('Emergencial'), false);
  assert.equal(isPreAprovada(undefined), false);
});

test('Pré-aprovada não tem áreas a aprovar, mesmo com áreas marcadas, em qualquer categoria', () => {
  const recursos = { 'T&TI/COR': 'executor', 'Oper/Infra': 'validador' };
  for (const categoria of ['rede_externa', 'sistemas_internos', 'sistemas_externos', null]) {
    assert.deepEqual(deriveApprovalAreas({ tipo: TIPO_PRE_APROVADA, categoria, recursosAdministrativos: recursos }), [], String(categoria));
  }
  // Programada continua exigindo aprovação das áreas marcadas
  assert.ok(deriveApprovalAreas({ tipo: 'Programada', categoria: 'rede_externa', recursosAdministrativos: recursos }).length > 0);
});
