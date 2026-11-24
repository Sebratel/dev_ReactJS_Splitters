import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValorInvestido } from './gmudMoney.js';

test('formato brasileiro', () => {
  assert.equal(parseValorInvestido('1.234,56'), 1234.56);
  assert.equal(parseValorInvestido('R$ 12.500,00'), 12500);
  assert.equal(parseValorInvestido('0,5'), 0.5);
  assert.equal(parseValorInvestido('1.234.567,89'), 1234567.89);
});

test('sem vírgula: ponto de milhar ou número puro', () => {
  assert.equal(parseValorInvestido('1.234'), 1234);
  assert.equal(parseValorInvestido('1.234.567'), 1234567);
  assert.equal(parseValorInvestido('1500'), 1500);
  assert.equal(parseValorInvestido(1500.456), 1500.46);
});

test('vazio, inválido, negativo ou gigante viram null', () => {
  for (const v of [null, undefined, '', '  ', 'abc', '-5', '12a', NaN, -1, 1e15, '1e5']) {
    assert.equal(parseValorInvestido(v), null, String(v));
  }
});

test('zero é válido', () => {
  assert.equal(parseValorInvestido('0'), 0);
  assert.equal(parseValorInvestido(0), 0);
});
