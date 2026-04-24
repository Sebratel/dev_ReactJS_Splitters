import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Linha curta de endereço para tabelas (mesmos dados de `cliente.address`). */
export function formatMassivaClienteLocationLine(c: SplitterCliente): string {
  const a = c.address
  if (a == null) {
    return '—'
  }
  const parts: string[] = []
  const street = a.street.trim()
  const number = a.number.trim()
  if (street !== '') {
    const line = number !== '' ? `${street}, ${number}` : street
    parts.push(line)
  }
  const bairro = a.neighborhood.trim()
  if (bairro !== '') parts.push(bairro)
  const city = a.city.trim()
  const state = a.state.trim()
  if (city !== '' || state !== '') {
    parts.push([city, state].filter(Boolean).join(' / '))
  }
  const combined = parts.filter(Boolean).join(' · ').trim()
  if (combined !== '') return combined
  const comp = a.complement?.trim()
  if (comp) return comp
  return '—'
}

export function hasMassivaClienteMapCoords(c: SplitterCliente): boolean {
  const lat = c.address?.latitude
  const lng = c.address?.longitude
  if (lat == null || lng == null) return false
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return true
}
