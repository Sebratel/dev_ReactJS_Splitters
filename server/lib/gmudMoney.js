/**
 * Valor investido da GMUD (R$). O formulário manda texto no formato brasileiro ("1.234,56"),
 * mas aceitamos também número puro e "R$". Vazio/inválido/negativo vira null (campo opcional).
 */
const MAX_VALOR = 999_999_999_999.99;

export function parseValorInvestido(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input >= 0 && input <= MAX_VALOR ? Math.round(input * 100) / 100 : null;
  }
  let t = String(input).replace(/R\$/gi, '').replace(/\s/g, '');
  if (t === '' || /[^0-9.,]/.test(t)) return null;
  if (t.includes(',')) {
    // Formato brasileiro: ponto separa milhar, vírgula separa os centavos.
    t = t.replace(/\./g, '').replace(',', '.');
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, ''); // "1.234.567" = milhar
  } else if (/^\d{1,3}\.\d{3}$/.test(t)) {
    t = t.replace('.', ''); // "1.234" = mil, não 1,234
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= MAX_VALOR ? Math.round(n * 100) / 100 : null;
}
