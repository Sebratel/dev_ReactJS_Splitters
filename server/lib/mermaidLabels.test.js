import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteMermaidLabels } from './mermaidLabels.js';

test('coloca entre aspas o rótulo com parênteses (caso do erro "got PS")', () => {
  const entrada = 'flowchart TD\n    E[[Validar conectividade (Ping, VLANs, BGP)]] --> F{Passou?}';
  assert.equal(
    quoteMermaidLabels(entrada),
    'flowchart TD\n    E[["Validar conectividade (Ping, VLANs, BGP)"]] --> F{"Passou?"}',
  );
});

test('cobre todos os formatos: estádio, retângulo, losango, sub-rotina e círculo duplo', () => {
  const saida = quoteMermaidLabels(
    ['A([Início (NOC)])', 'B[Backup (TFTP)]', 'C{Falhou?}', 'D[[Checar (VLAN)]]', 'E((Fim (ok)))'].join('\n'),
  );
  assert.equal(
    saida,
    ['A(["Início (NOC)"])', 'B["Backup (TFTP)"]', 'C{"Falhou?"}', 'D[["Checar (VLAN)"]]', 'E(("Fim (ok)"))'].join('\n'),
  );
});

test('não mexe em rótulo já entre aspas nem repete aspas ao rodar de novo', () => {
  const ja = 'A["Já (ok)"] --> B[Passo]';
  const uma = quoteMermaidLabels(ja);
  assert.equal(uma, 'A["Já (ok)"] --> B["Passo"]');
  assert.equal(quoteMermaidLabels(uma), uma);
});

test('troca aspas duplas internas por simples, mantém setas, rótulos de aresta e comentários', () => {
  const src = '%% comentário [a (b)]\nA[Usar "modo" seguro] -->|Sim (ok)| B[Fim]';
  assert.equal(
    quoteMermaidLabels(src),
    '%% comentário [a (b)]\nA["Usar \'modo\' seguro"] -->|Sim (ok)| B["Fim"]',
  );
});

test('valores que não são texto passam sem erro', () => {
  assert.equal(quoteMermaidLabels(''), '');
  assert.equal(quoteMermaidLabels(null), null);
});
