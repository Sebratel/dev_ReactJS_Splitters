import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isCondominiumTitle,
  extractCondominiumName,
  classifyLocationFromTitle,
} from './condominiumClassifier.js';

describe('isCondominiumTitle', () => {
  it('reconhece prefixo RES.', () => {
    assert.equal(isCondominiumTitle('RES. JARDIM DAS FLORES'), true);
  });

  it('reconhece prefixo COND.', () => {
    assert.equal(isCondominiumTitle('COND. PARQUE VERDE'), true);
  });

  it('reconhece prefixo ED.', () => {
    assert.equal(isCondominiumTitle('ED. TORRE NORTE'), true);
  });

  it('e case-insensitive', () => {
    assert.equal(isCondominiumTitle('res. jardim das flores'), true);
  });

  it('nao reconhece titulo sem prefixo de condominio', () => {
    assert.equal(isCondominiumTitle('RUA DAS ACACIAS 123'), false);
  });

  it('nao reconhece falso positivo dentro de outra palavra', () => {
    assert.equal(isCondominiumTitle('PRESIDENTE VARGAS'), false);
  });

  it('trata title nulo/indefinido como nao-condominio', () => {
    assert.equal(isCondominiumTitle(null), false);
    assert.equal(isCondominiumTitle(undefined), false);
  });
});

describe('extractCondominiumName', () => {
  it('extrai o nome apos o prefixo RES.', () => {
    assert.equal(extractCondominiumName('RES. JARDIM DAS FLORES'), 'JARDIM DAS FLORES');
  });

  it('extrai o nome apos o prefixo COND. sem espaco', () => {
    assert.equal(extractCondominiumName('COND.PARQUE VERDE'), 'PARQUE VERDE');
  });

  it('retorna null quando nao ha prefixo', () => {
    assert.equal(extractCondominiumName('RUA DAS ACACIAS 123'), null);
  });

  it('retorna null quando o nome apos o prefixo fica vazio', () => {
    assert.equal(extractCondominiumName('RES.'), null);
  });
});

describe('classifyLocationFromTitle', () => {
  it('classifica como CONDOMINIO com nome extraido', () => {
    assert.deepEqual(classifyLocationFromTitle('RES. JARDIM DAS FLORES'), {
      tipoLocal: 'CONDOMÍNIO',
      nomeCondominio: 'JARDIM DAS FLORES',
    });
  });

  it('classifica como UNIDADE quando nao ha prefixo', () => {
    assert.deepEqual(classifyLocationFromTitle('RUA DAS ACACIAS 123'), {
      tipoLocal: 'UNIDADE',
      nomeCondominio: null,
    });
  });
});
