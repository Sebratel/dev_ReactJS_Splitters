import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APROVADA_FINAL_SQL,
  assertCommitteeMember,
  changesCommitteeDecision,
  isCommitteeMember,
  isGmudAprovadaFinal,
  normalizeEmail,
} from './gmudCommittee.js';

test('isGmudAprovadaFinal exige Comitê aprovado E áreas aprovadas (ou não aplicáveis)', () => {
  assert.equal(isGmudAprovadaFinal('aprovada', 'aprovada'), true);
  assert.equal(isGmudAprovadaFinal('aprovada', 'nao_aplicavel'), true);
  assert.equal(isGmudAprovadaFinal('aprovada', undefined), true);
  assert.equal(isGmudAprovadaFinal('aprovada', 'pendente'), false);
  assert.equal(isGmudAprovadaFinal('aprovada', 'negada'), false);
  assert.equal(isGmudAprovadaFinal('pendente', 'aprovada'), false);
  assert.equal(isGmudAprovadaFinal('negada', 'aprovada'), false);
});

test('APROVADA_FINAL_SQL espelha a regra (só aprovada/nao_aplicavel passam)', () => {
  assert.match(APROVADA_FINAL_SQL, /status_comite = 'aprovada'/);
  assert.match(APROVADA_FINAL_SQL, /status_areas IN \('nao_aplicavel', 'aprovada'\)/);
  assert.doesNotMatch(APROVADA_FINAL_SQL, /pendente/);
});

const members = [{ userEmail: 'Jonathan@Sebratel.com.br' }, { userEmail: 'daniel@sebratel.com.br' }];

test('normalizeEmail ignora caixa e espaços', () => {
  assert.equal(normalizeEmail('  Foo@BAR.com '), 'foo@bar.com');
  assert.equal(normalizeEmail(null), '');
});

test('isCommitteeMember reconhece membro sem diferenciar caixa', () => {
  assert.equal(isCommitteeMember(members, 'jonathan@sebratel.com.br'), true);
  assert.equal(isCommitteeMember(members, ' DANIEL@sebratel.com.br '), true);
});

test('isCommitteeMember recusa quem não é membro, e-mail vazio ou lista inválida', () => {
  assert.equal(isCommitteeMember(members, 'outro@sebratel.com.br'), false);
  assert.equal(isCommitteeMember(members, ''), false);
  assert.equal(isCommitteeMember(undefined, 'jonathan@sebratel.com.br'), false);
});

test('assertCommitteeMember passa para membro', () => {
  assert.doesNotThrow(() => assertCommitteeMember(members, 'daniel@sebratel.com.br'));
});

test('assertCommitteeMember lança 403 para quem não é membro', () => {
  assert.throws(
    () => assertCommitteeMember(members, 'outro@sebratel.com.br'),
    (e) => e.statusCode === 403 && /Somente membros do Comitê/.test(e.message),
  );
});

test('assertCommitteeMember com lista vazia bloqueia todo mundo (GMUD segue pendente)', () => {
  assert.throws(
    () => assertCommitteeMember([], 'jonathan@sebratel.com.br'),
    (e) => e.statusCode === 403 && /ainda não tem membros/.test(e.message),
  );
});

test('changesCommitteeDecision só é verdadeiro quando há statusComite informado', () => {
  assert.equal(changesCommitteeDecision('aprovada'), true);
  assert.equal(changesCommitteeDecision('negada'), true);
  assert.equal(changesCommitteeDecision('pendente'), true);
  assert.equal(changesCommitteeDecision(undefined), false);
  assert.equal(changesCommitteeDecision(null), false);
  assert.equal(changesCommitteeDecision('  '), false);
});
