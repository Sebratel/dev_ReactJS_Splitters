import type { Olt } from '@/features/splitters/model/olt'

/** Paridade com `OltService._oltByCode` / `getBySplitterCode`. */
export function findOltByCode(list: Olt[], code: string): Olt | undefined {
  return list.find((o) => o.code === code)
}
