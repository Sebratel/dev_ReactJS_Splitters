/**
 * Paridade com `extractSlotAndPortFromSplitterTitle` / `parseSlotAndPortFromTitle` na web:
 * segmento antes da primeira `/`; todos os grupos `\d+`; slot = penúltimo, porta = último.
 * Usado na massiva (rotas e filtro de conexões) e alinhado ao detalhe de splitter na UI.
 *
 * @param {unknown} raw
 * @returns {{ slot: number | null; port: number | null }}
 */
export function parseOltSlotPortFromSplitterTitulo(raw) {
  const title = String(raw ?? '').trim();
  if (title === '') {
    return { slot: null, port: null };
  }
  const beforeSlash = title.split('/')[0] ?? '';
  const numbers = beforeSlash.match(/\d+/g) ?? [];
  if (numbers.length < 2) {
    return { slot: null, port: null };
  }
  const slot = Number.parseInt(numbers[numbers.length - 2] ?? '', 10);
  const port = Number.parseInt(numbers[numbers.length - 1] ?? '', 10);
  return {
    slot: Number.isFinite(slot) ? slot : null,
    port: Number.isFinite(port) ? port : null,
  };
}

/**
 * Tenta SPLT.SECUNDARIO; se não definir ambos, tenta código do splitter.
 *
 * @param {{ splitterTitle?: unknown; splitterCode?: unknown }} params
 */
export function resolveOltSlotPortFromSplitterLabels(params = {}) {
  const fromTitle = parseOltSlotPortFromSplitterTitulo(params.splitterTitle);
  if (fromTitle.slot != null && fromTitle.port != null) {
    return fromTitle;
  }
  return parseOltSlotPortFromSplitterTitulo(params.splitterCode);
}

/**
 * Filtro opcional por slot/porta (cada um pode ser `null` = ignora essa dimensão).
 * Só usa título/código (snapshot de alívio não carrega colunas SQL de fallback).
 *
 * @param {unknown} splitterTitle
 * @param {unknown} splitterCode
 * @param {number | null | undefined} slotFilter
 * @param {number | null | undefined} portFilter
 * @returns {boolean}
 */
export function splitterLabelsMatchOptionalPonFilter(
  splitterTitle,
  splitterCode,
  slotFilter,
  portFilter,
) {
  const slotWant = slotFilter == null ? null : slotFilter;
  const portWant = portFilter == null ? null : portFilter;
  if (slotWant === null && portWant === null) {
    return true;
  }

  const parsed = resolveOltSlotPortFromSplitterLabels({
    splitterTitle,
    splitterCode,
  });
  if (parsed.slot == null || parsed.port == null) {
    return false;
  }
  if (slotWant !== null && parsed.slot !== slotWant) return false;
  if (portWant !== null && parsed.port !== portWant) return false;
  return true;
}

/** @param {Record<string, unknown>} row resultado de SPLITTERS_BASE_QUERY / conexões */
export function resolveOltSlotPortFromSplitterRow(row) {
  const code =
    row['CÓDIGO[SPLT.SECUNDARIO]'] ??
    row['CODIGO[SPLT.SECUNDARIO]'] ??
    row['splitterCode'];
  return resolveOltSlotPortFromSplitterLabels({
    splitterTitle: row['SPLT.SECUNDARIO'],
    splitterCode: code,
  });
}

/**
 * Fallback igual ao SELECT antigo quando o título não traz dois números.
 * @param {Record<string, unknown>} row
 */
export function fallbackSqlOltSlotPort(row) {
  const slotRaw = row['SLOT[SPLT.SECUNDARIO]'];
  let slot = 0;
  if (slotRaw !== null && slotRaw !== undefined && slotRaw !== '') {
    const n = Number(slotRaw);
    if (Number.isFinite(n)) slot = Math.trunc(n);
  }
  let port = 0;
  const extra = row['PORTA EXTRAÍDA[SPLT.SECUNDARIO]'];
  const prim = row['PORTA[SPLT.PRIMARIO]'];
  for (const v of [extra, prim]) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) {
      port = Math.trunc(n);
      break;
    }
  }
  return { slot, port };
}

/** @returns {boolean} */
export function rowMatchesMassivaOltRoute(slotN, portN, row) {
  const parsed = resolveOltSlotPortFromSplitterRow(row);
  if (parsed.slot != null && parsed.port != null) {
    return parsed.slot === slotN && parsed.port === portN;
  }
  const fb = fallbackSqlOltSlotPort(row);
  return fb.slot === slotN && fb.port === portN;
}

/**
 * Resposta `/api/massiva/routes`: `slot`/`port` preferem nomenclatura do título/código;
 * caso não existam dois números antes de `/`, mantém valores agregadores do SELECT SQL.
 *
 * @param {Record<string, unknown>} row
 */
export function normalizeMassivaRouteRowTituloPreferido(row) {
  const parsed = resolveOltSlotPortFromSplitterLabels({
    splitterTitle: row.splitterTitle,
    splitterCode: row.splitterCode,
  });
  const useParsed = parsed.slot != null && parsed.port != null;
  const slotSql = Number(row.slot);
  const portSql = Number(row.port);
  return {
    ...row,
    slot: useParsed
      ? parsed.slot
      : Number.isFinite(slotSql)
        ? Math.trunc(slotSql)
        : 0,
    port: useParsed
      ? parsed.port
      : Number.isFinite(portSql)
        ? Math.trunc(portSql)
        : 0,
  };
}
