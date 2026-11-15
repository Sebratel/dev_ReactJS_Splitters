import type { GmudAttachment } from '@/features/gmud/api/gmudAttachments'

/**
 * Apresentação ao Comitê: um visualizador do fluxograma (como a mudança será executada) e dos anexos da GMUD.
 * Aqui ficam só as contas e os textos, sem tela.
 */

export type GmudSlide =
  | { kind: 'cover'; id: 'capa' }
  | { kind: 'flowchart'; id: 'fluxograma'; source: string }
  | { kind: 'attachment'; id: string; item: GmudAttachment }

/** Slides na ordem: capa, fluxograma (se houver) e um por anexo. Só entra o que existe. */
export function slidesDaApresentacao(mermaidSource: string | null | undefined, anexos: readonly GmudAttachment[]): GmudSlide[] {
  const slides: GmudSlide[] = [{ kind: 'cover', id: 'capa' }]
  const source = (mermaidSource ?? '').trim()
  if (source !== '') slides.push({ kind: 'flowchart', id: 'fluxograma', source })
  for (const item of anexos) slides.push({ kind: 'attachment', id: `anexo-${item.id}`, item })
  return slides
}

/** Nome do slide no índice e no topo. */
export function rotuloDoSlide(slide: GmudSlide): string {
  if (slide.kind === 'cover') return 'Capa'
  if (slide.kind === 'flowchart') return 'Fluxograma'
  return slide.item.filenameOriginal
}

/** Linha da capa: "Fluxograma e 2 anexos", "Fluxograma", "1 anexo" — sem citar o que não existe. */
export function resumoDaCapa(temFluxograma: boolean, anexos: number): string {
  const partes: string[] = []
  if (temFluxograma) partes.push('Fluxograma')
  if (anexos > 0) partes.push(`${anexos} ${anexos === 1 ? 'anexo' : 'anexos'}`)
  return partes.join(' e ')
}

/** Dá para apresentar? Precisa de fluxograma ou de pelo menos um anexo. */
export function podeApresentar(mermaidSource: string | null | undefined, anexos: number): boolean {
  return (mermaidSource ?? '').trim() !== '' || anexos > 0
}

export type GmudAnexoTipo = 'imagem' | 'pdf' | 'outro'

/** Como o anexo aparece na tela: imagem, PDF (página inteira) ou só para baixar (Word, Excel…). */
export function tipoDoAnexo(mimetype: string | null | undefined): GmudAnexoTipo {
  const tipo = (mimetype ?? '').toLowerCase()
  if (tipo.startsWith('image/')) return 'imagem'
  if (tipo === 'application/pdf') return 'pdf'
  return 'outro'
}

/** "1,2 MB", "340 KB". Vazio se o tamanho não for conhecido. */
export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** Zoom que faz o conteúdo (largura x altura naturais) caber inteiro na área; nunca amplia além de `max`. */
export function zoomParaCaber(natural: { w: number; h: number }, area: { w: number; h: number }, max = 2): number {
  if (!(natural.w > 0) || !(natural.h > 0) || !(area.w > 0) || !(area.h > 0)) return 1
  return Math.max(0.1, Math.min(area.w / natural.w, area.h / natural.h, max))
}
