/**
 * Deixa os rótulos dos nós de um fluxograma Mermaid entre aspas.
 *
 * O Mermaid não aceita parênteses, colchetes e outros símbolos soltos dentro do texto
 * de um nó (ex.: `B[[Validar conectividade (Ping, VLANs)]]` quebra com "got 'PS'").
 * Entre aspas, o mesmo texto é válido. Rótulos que já estão entre aspas ficam como estão.
 */

const PADROES = [
  { re: /(\b[A-Za-z_]\w*)\(\[(.*?)\]\)/g, abre: '([', fecha: '])' },
  { re: /(\b[A-Za-z_]\w*)\[\[(.*?)\]\]/g, abre: '[[', fecha: ']]' },
  { re: /(\b[A-Za-z_]\w*)\(\((.*?)\)\)(?!\))/g, abre: '((', fecha: '))' },
  { re: /(\b[A-Za-z_]\w*)\{(.*?)\}/g, abre: '{', fecha: '}' },
  { re: /(\b[A-Za-z_]\w*)\[(?![[(])(.*?)\]/g, abre: '[', fecha: ']' },
];

function entreAspas(texto) {
  const t = texto.trim();
  if (t === '' || (t.startsWith('"') && t.endsWith('"') && t.length >= 2)) return null;
  return `"${t.replace(/"/g, "'")}"`;
}

function ajustarLinha(linha) {
  if (/^\s*%%/.test(linha)) return linha;
  let saida = linha;
  for (const { re, abre, fecha } of PADROES) {
    saida = saida.replace(re, (todo, id, rotulo) => {
      const q = entreAspas(rotulo);
      return q === null ? todo : `${id}${abre}${q}${fecha}`;
    });
  }
  return saida;
}

/** @param {string} source código Mermaid; devolve o mesmo código com os rótulos entre aspas. */
export function quoteMermaidLabels(source) {
  if (typeof source !== 'string' || source === '') return source;
  return source.split('\n').map(ajustarLinha).join('\n');
}
