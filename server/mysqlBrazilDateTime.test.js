import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mysqlNaiveDateTimeToIso } from './mysqlBrazilDateTime.js';

describe('mysqlNaiveDateTimeToIso', () => {
  it('interpreta string MySQL como horário de Brasília', () => {
    assert.equal(mysqlNaiveDateTimeToIso('2026-05-19 17:00:00'), '2026-05-19T17:00:00-03:00');
  });

  it('usa componentes locais do Date (como mysql2 em UTC)', () => {
    const asUtcContainer = new Date(2026, 4, 19, 17, 0, 0);
    assert.equal(mysqlNaiveDateTimeToIso(asUtcContainer), '2026-05-19T17:00:00-03:00');
  });
});
