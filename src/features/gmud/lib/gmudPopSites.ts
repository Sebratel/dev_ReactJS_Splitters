import type { GmudPopSite } from '@/features/gmud/api/gmudPopSites'

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Filtra os POPs/Sites pelo que foi digitado (código, cidade ou bairro; sem acento nem caixa).
 * Sem texto devolve todos. Quem começa com o texto vem antes de quem só contém.
 */
export function filterPopSites(sites: readonly GmudPopSite[], term: string): GmudPopSite[] {
  const t = norm(term)
  if (t === '') return [...sites]
  const starts: GmudPopSite[] = []
  const contains: GmudPopSite[] = []
  for (const s of sites) {
    const title = norm(s.title)
    if (title.startsWith(t)) starts.push(s)
    else if (title.includes(t) || norm(s.city ?? '').includes(t) || norm(s.neighborhood ?? '').includes(t)) contains.push(s)
  }
  return [...starts, ...contains]
}
