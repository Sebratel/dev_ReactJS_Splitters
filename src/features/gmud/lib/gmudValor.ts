/**
 * Valor investido da GMUD (R$). O campo trabalha em centavos: a pessoa digita só números e a máscara
 * vira "1.234,56". O servidor entende esse formato (server/lib/gmudMoney.js).
 */

/** Só dígitos -> "1.234,56". Vazio fica vazio (campo opcional). */
export function maskValorInvestido(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 14)
  if (digits === '') return ''
  const padded = digits.padStart(3, '0')
  const cents = padded.slice(-2)
  const intPart = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${intPart},${cents}`
}

/** Número (vindo do banco) -> "R$ 1.234,56". Null/inválido -> null. */
export function formatValorInvestido(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
