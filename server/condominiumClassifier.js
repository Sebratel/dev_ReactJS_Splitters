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

/**
 * RES. = residência individual (casa/sobrado) — não tem andar nem apartamento.
 * Diferente de COND./ED. que são edifícios com múltiplos andares.
 */
const RESIDENCE_TITLE_REGEX = /\bRES\./i;

/**
 * Alçapão (forro): título terminado em "- ALÇ°". A caixa foi colocada no forro
 * a pedido do síndico — não há andar melhor disponível, então fica FORA da análise
 * de redistribuição (nem pendência, nem sugestão), assim como RES.
 */
const ALCAPAO_TITLE_REGEX = /[-–]\s*ALÇ°/i;

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
 * Retorna true se o splitter for do tipo RES. (residência individual).
 * Esses splitters não têm andar por natureza — não devem aparecer
 * em pendências de andar nem em análises de redistribuição vertical.
 * @param {unknown} title
 * @returns {boolean}
 */
export function isResidenceTitle(title) {
  return RESIDENCE_TITLE_REGEX.test(String(title ?? ''));
}

/**
 * Retorna true se o splitter for de alçapão/forro ("- ALÇ°"). Esses casos têm
 * andar conhecido (o forro) e são colocados deliberadamente ali — não devem gerar
 * pendência de andar nem sugestão de realocação.
 * @param {unknown} title
 * @returns {boolean}
 */
export function isAlcapaoTitle(title) {
  return ALCAPAO_TITLE_REGEX.test(String(title ?? ''));
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

/**
 * Normaliza o nome do condomínio removendo sufixo de andar (ex: "- 8°").
 * Útil para agrupar splitters do mesmo edifício/bloco independente do andar.
 *
 * "RESIDENCIAL PREMIERE - BL A - 8°" → "RESIDENCIAL PREMIERE - BL A"
 * "RESIDENCIAL PREMIERE - BL A"      → "RESIDENCIAL PREMIERE - BL A"
 * "ED. MONTELUPONE - 9°"             → "ED. MONTELUPONE"
 *
 * @param {unknown} condoName
 * @returns {string}
 */
export function normalizeCondoNameForGrouping(condoName) {
  return String(condoName ?? '')
    .replace(/\s*[-–]\s*\d{1,3}°\s*$/, '')
    .trim();
}

// ── Extração de Bloco e Andar ─────────────────────────────────────────────────

/** Regex para extrair bloco do título do splitter (ex: "BL A", "BL B"). */
const BLOCK_REGEX = /\bBL(?:OCO)?\s+([A-Z0-9]+)/i;

/** Regex para extrair andar do título do splitter (ex: "- 8°", "- 12°"). */
const FLOOR_FROM_TITLE_REGEX = /[-–]\s*(\d{1,3})°/;

/** Térreo cadastrado no título como "- T°" — equivale ao andar 0. */
const TERREO_TITLE_REGEX = /[-–]\s*T°/i;

/**
 * Regex para extrair número do apartamento do complemento do cliente.
 * Aceita: APARTAMENTO 901, APTO 1203, APT 42, AP 101
 */
const APT_NUMBER_REGEX = /\b(?:APARTAMENTO|APTO?)\s*(\d+)/i;

/** Regex para extrair bloco do complemento do cliente (ex: "BLOCO D", "BL A"). */
const BLOCK_FROM_COMPLEMENT_REGEX = /\bBL(?:OCO)?\s+([A-Z0-9]+)/i;

/**
 * Extrai o bloco do título de um splitter de condomínio.
 * @param {unknown} title — ex: "SLE-C-3919-3-2-10/7 - COND. RESIDENCIAL PREMIERE - BL A - 8°"
 * @returns {string | null} — ex: "A"
 */
export function extractBlockFromTitle(title) {
  const match = String(title ?? '').match(BLOCK_REGEX);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extrai o andar do título de um splitter de condomínio.
 * Sem sufixo de andar (ex: "- BL A" sem "°") → retorna null (andar desconhecido).
 * Retorna 0 quando o título tiver "- 0°" ou "- T°" (térreo cadastrado).
 * @param {unknown} title
 * @returns {number | null} — andar, ou null se não cadastrado no título
 */
export function extractFloorFromTitle(title) {
  const raw = String(title ?? '');
  // Térreo escrito como "- T°" = andar 0
  if (TERREO_TITLE_REGEX.test(raw)) return 0;
  const match = raw.match(FLOOR_FROM_TITLE_REGEX);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Extrai o andar do cliente a partir do complemento de endereço.
 *
 * Convenção brasileira: primeiros dígitos do número do apartamento = andar.
 *   APTO 42   → andar 4
 *   APTO 901  → andar 9
 *   APTO 1203 → andar 12
 *   APTO 8    → andar 8 (single-digit = o próprio número)
 *
 * @param {unknown} complement — ex: "BLOCO D - APARTAMENTO 42"
 * @returns {number | null} — andar, ou null se não conseguir extrair
 */
export function extractFloorFromComplement(complement) {
  const raw = String(complement ?? '').toUpperCase();
  const match = raw.match(APT_NUMBER_REGEX);
  if (!match) return null;

  const aptNumber = Number.parseInt(match[1], 10);
  if (!Number.isFinite(aptNumber) || aptNumber <= 0) return null;

  // Convenção: primeiros dígitos = andar
  if (aptNumber < 10) return aptNumber;           // APTO 8 → andar 8
  if (aptNumber < 100) return Math.floor(aptNumber / 10);  // APTO 42 → andar 4
  if (aptNumber < 1000) return Math.floor(aptNumber / 100); // APTO 901 → andar 9
  return Math.floor(aptNumber / 100);              // APTO 1203 → andar 12
}

/**
 * Extrai o bloco do complemento de endereço do cliente.
 * @param {unknown} complement — ex: "BLOCO D - APARTAMENTO 42"
 * @returns {string | null} — ex: "D"
 */
export function extractBlockFromComplement(complement) {
  const match = String(complement ?? '').match(BLOCK_FROM_COMPLEMENT_REGEX);
  return match ? match[1].toUpperCase() : null;
}
