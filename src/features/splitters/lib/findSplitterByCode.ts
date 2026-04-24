import type { Splitter } from '@/features/splitters/model/splitter'

export function findSplitterByCode(
  list: Splitter[],
  code: string,
): Splitter | undefined {
  return list.find((s) => s.code === code)
}
