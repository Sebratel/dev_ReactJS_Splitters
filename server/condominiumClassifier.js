/**
 * Classificação Condomínio × Unidade (rua) — fonte única de verdade no backend.
 *
 * Regra canônica (paridade com SPLITTERS_BASE_QUERY no index.js e com o roteamento de
 * vizinhos): o título do splitter começa/contém o prefixo RES./COND./ED. → é condomínio;
 * o nome do condomínio é o que vem depois do prefixo. Manter em UM lugar evita divergência
 * entre módulos (splitters, massivas, cancelamentos, intelligence).
 */

/** Prefixo de condomínio no título (RES., COND., ED.), com fronteira de palavra. */
const CONDOMINIUM_TITLE_PREFIX_REGEX = /\b(?:RES|COND|ED)\./i;

/** Tipos de local possíveis. */
export const LOCATION_TYPES = /** @type {const} */ (['CONDOMÍNIO', 'UNIDADE']);

/**
 * @param {unknown} title
 * @returns {boolean}
 */
export function isCondominiumTitle(title) {
  return CONDOMINIUM_TITLE_PREFIX_REGEX.test(String(title ?? ''));
}

/**
 * Extrai o nome do condomínio a partir do título (o texto após RES./COND./ED.).
 * @param {unknown} title
 * @returns {string | null}
 */
export function extractCondominiumName(title) {
  const raw = String(title ?? '');
  const match = raw.match(/\b(?:RES|COND|ED)\.\s?(.*)$/i);
  if (!match) return null;
  const name = match[1].trim();
  return name === '' ? null : name;
}

/**
 * Classifica um título em `{ tipoLocal, nomeCondominio }`.
 * @param {unknown} title
 * @returns {{ tipoLocal: 'CONDOMÍNIO' | 'UNIDADE', nomeCondominio: string | null }}
 */
export function classifyLocationFromTitle(title) {
  if (isCondominiumTitle(title)) {
    return { tipoLocal: 'CONDOMÍNIO', nomeCondominio: extractCondominiumName(title) };
  }
  return { tipoLocal: 'UNIDADE', nomeCondominio: null };
}
