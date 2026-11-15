import { ArrowLeft } from 'lucide-react'
import { GmudDiscardDraftButton } from '@/features/gmud/ui/GmudDiscardDraftButton'

/** "2026-11-14T13:05:00.000Z" → "10:05" (hora local). Vazio se a data for inválida. */
function horaLocal(iso: string): string {
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * [item 5] Topo enxuto da etapa de Revisão: a barra da categoria e o aviso de rascunho em UMA linha.
 * Só aparece na Revisão; nas outras etapas o formulário mostra os dois blocos de sempre.
 */
export function GmudRevisaoTopo({
  categoriaLabel,
  rascunhoSalvoEm,
  onTrocarCategoria,
  onDescartarRascunho,
}: {
  categoriaLabel: string
  /** Quando o rascunho recuperado foi salvo (ISO); sem rascunho, só a categoria aparece. */
  rascunhoSalvoEm?: string | null
  onTrocarCategoria: () => void
  onDescartarRascunho: () => void
}) {
  const hora = rascunhoSalvoEm ? horaLocal(rascunhoSalvoEm) : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-neutral-200/90 bg-surface-container-lowest px-3 py-2 dark:border-white/15">
      <p aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant">
        Categoria
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-neutral-900">{categoriaLabel}</span>
        {rascunhoSalvoEm ? (
          <span>
            · Rascunho de hoje{hora !== '' ? <span className="font-semibold text-on-surface"> {hora}</span> : null}, expira 23:59
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTrocarCategoria}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:border-white/20 dark:focus-visible:ring-white"
        >
          <ArrowLeft size={13} aria-hidden /> Trocar categoria
        </button>
        {rascunhoSalvoEm ? <GmudDiscardDraftButton compact rotulo="Limpar tudo e começar do zero" onConfirmar={onDescartarRascunho} /> : null}
      </div>
    </div>
  )
}
