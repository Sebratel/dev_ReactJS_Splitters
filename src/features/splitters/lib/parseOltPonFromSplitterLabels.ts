/**
 * Slot/porta OLT derivados do título ou código (dois últimos grupos numéricos antes da primeira `/`).
 * Paridade com `parseOltSlotPortFromSplitterTitulo` no BFF.
 */
export function parseOltSlotPortFromSplitterLabel(
  raw: string | null | undefined,
): { slot: number | null; port: number | null } {
  const title = String(raw ?? '').trim()
  if (title === '') return { slot: null, port: null }
  const beforeSlash = title.split('/')[0] ?? ''
  const numbers = beforeSlash.match(/\d+/g) ?? []
  if (numbers.length < 2) return { slot: null, port: null }
  const slot = Number.parseInt(numbers[numbers.length - 2] ?? '', 10)
  const port = Number.parseInt(numbers[numbers.length - 1] ?? '', 10)
  return {
    slot: Number.isFinite(slot) ? slot : null,
    port: Number.isFinite(port) ? port : null,
  }
}

export function resolveOltSlotPortFromSplitterTitleAndCode(
  title: string | null | undefined,
  code: string | null | undefined,
): { slot: number | null; port: number | null } {
  const fromTitle = parseOltSlotPortFromSplitterLabel(title)
  if (fromTitle.slot != null && fromTitle.port != null) return fromTitle
  return parseOltSlotPortFromSplitterLabel(code)
}
