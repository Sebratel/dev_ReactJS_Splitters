/**
 * Converte DATETIME do MySQL (sem fuso) para ISO com offset de Brasília.
 * Independente do TZ do processo Node (ex.: UTC no Docker).
 */

/** Horário civil de Brasília (sem DST desde 2019). */
export const BRAZIL_MYSQL_DATETIME_OFFSET = '-03:00';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Extrai componentes “de parede” gravados no MySQL (não o instante UTC do Date).
 * @param {unknown} value
 */
export function parseMysqlNaiveDateTimeParts(value) {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      y: value.getFullYear(),
      mo: value.getMonth() + 1,
      d: value.getDate(),
      h: value.getHours(),
      mi: value.getMinutes(),
      s: value.getSeconds(),
    };
  }

  const text = String(value).trim();
  if (text === '') return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  return {
    y: Number(match[1]),
    mo: Number(match[2]),
    d: Number(match[3]),
    h: Number(match[4]),
    mi: Number(match[5]),
    s: Number(match[6] ?? 0),
  };
}

/**
 * @param {unknown} value DATETIME do MySQL (Date do mysql2 ou string)
 * @returns {string | null} Ex.: 2026-05-19T17:00:00-03:00
 */
export function mysqlNaiveDateTimeToIso(value) {
  const parts = parseMysqlNaiveDateTimeParts(value);
  if (!parts) return null;

  const { y, mo, d, h, mi, s } = parts;
  return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}${BRAZIL_MYSQL_DATETIME_OFFSET}`;
}
