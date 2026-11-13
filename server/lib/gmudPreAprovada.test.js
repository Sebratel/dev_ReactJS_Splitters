import test from 'node:test';
import assert from 'node:assert/strict';
import { TIPO_PRE_APROVADA, isPreAprovada, preAprovadaCreateError } from './gmudPreAprovada.js';
import { deriveApprovalAreas } from './gmudAreaApproval.js';

test('isPreAprovada reconhece o tipo (com espaços) e nada além dele', () => {
  assert.equal(isPreAprovada('Pré-aprovada'), true);
  assert.equal(isPreAprovada('  Pré-aprovada '), true);
  assert.equal(isPreAprovada('Programada'), false);
  assert.equal(isPreAprovada('Emergencial'), false);
  assert.equal(isPreAprovada(undefined), false);
});

test('só rede externa (ou legado sem categoria) pode ser Pré-aprovada', () => {
  assert.equal(preAprovadaCreateError({ tipo: TIPO_PRE_APROVADA, categoria: 'rede_externa' }), null);
  assert.equal(preAprovadaCreateError({ tipo: TIPO_PRE_APROVADA, categoria: null }), null);
  assert.equal(preAprovadaCreateError({ tipo: TIPO_PRE_APROVADA, categoria: '' }), null);
  assert.match(preAprovadaCreateError({ tipo: TIPO_PRE_APROVADA, categoria: 'sistemas_internos' }), /só está disponível para Rede Externa/);
  assert.match(preAprovadaCreateError({ tipo: TIPO_PRE_APROVADA, categoria: 'sistemas_externos' }), /Rede Externa/);
});

test('outros tipos não são afetados pela regra', () => {
  assert.equal(preAprovadaCreateError({ tipo: 'Programada', categoria: 'sistemas_internos' }), null);
  assert.equal(preAprovadaCreateError({}), null);
});

test('Pré-aprovada não tem áreas a aprovar, mesmo com áreas marcadas', () => {
  const recursos = { 'T&TI/COR': 'executor', 'Oper/Infra': 'validador' };
  assert.deepEqual(deriveApprovalAreas({ tipo: 'Pré-aprovada', categoria: 'rede_externa', recursosAdministrativos: recursos }), []);
  // Programada continua exigindo aprovação das áreas marcadas
  assert.ok(deriveApprovalAreas({ tipo: 'Programada', categoria: 'rede_externa', recursosAdministrativos: recursos }).length > 0);
});
