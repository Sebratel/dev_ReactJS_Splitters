import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckSquare, Loader2, Square } from 'lucide-react'
import { linkMassivasToGmud, type GmudBulkLinkResult } from '@/features/gmud/api/gmudLinks'
import { useHomeDashboardMassivaOpen } from '@/features/massiva/hooks/useHomeDashboardMassivaOpen'

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Seleção múltipla de massivas em aberto para vincular a uma GMUD numa única operação.
 * Fonte: as mesmas massivas abertas do Dashboard (Elleven + histórico local).
 */
export function GmudOpenMassivaPicker({
  gmudProtocol,
  linkedProtocols,
  disabled,
  onLinked,
}: {
  gmudProtocol: number
  linkedProtocols: ReadonlySet<number>
  disabled: boolean
  onLinked: () => void
}) {
  // Carrega mesmo travada (GMUD não aprovada): o operador vê o que poderá vincular após a aprovação.
  const { openMassivas, pending, notConfigured } = useHomeDashboardMassivaOpen()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [lastResult, setLastResult] = useState<GmudBulkLinkResult | null>(null)

  const candidates = useMemo(
    () =>
      openMassivas
        .filter((m) => m.protocol > 0 && !linkedProtocols.has(m.protocol))
        .sort((a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0)),
    [openMassivas, linkedProtocols],
  )
  // Seleção só vale para o que ainda está na lista (massiva pode ter sido vinculada/encerrada).
  const selectedVisible = candidates.filter((m) => selected.has(m.protocol)).map((m) => m.protocol)
  const allSelected = candidates.length > 0 && selectedVisible.length === candidates.length

  const bulkMutation = useMutation({
    mutationFn: () => linkMassivasToGmud(gmudProtocol, selectedVisible),
    onSuccess: (result) => {
      setLastResult(result)
      setSelected(new Set(result.failed.map((f) => f.massivaProtocol)))
      if (result.linked.length > 0) onLinked()
    },
  })

  const toggle = (protocol: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(protocol)) next.delete(protocol)
      else next.add(protocol)
      return next
    })

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(candidates.map((m) => m.protocol)))

  return (
    <div className={disabled ? 'pointer-events-none select-none opacity-50' : ''} aria-disabled={disabled}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-on-surface-variant">
          Massivas em aberto ({candidates.length})
        </span>
        {candidates.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {allSelected ? 'Limpar seleção' : 'Selecionar todas'}
          </button>
        ) : null}
      </div>

      {pending ? (
        <p className="py-3 text-center text-sm text-on-surface-variant">Carregando massivas abertas…</p>
      ) : notConfigured ? (
        <p className="py-3 text-center text-sm text-on-surface-variant">Fonte de massivas não configurada.</p>
      ) : candidates.length === 0 ? (
        <p className="py-3 text-center text-sm text-on-surface-variant">
          Nenhuma massiva aberta disponível para vincular.
        </p>
      ) : (
        <ul className="mt-1.5 max-h-56 space-y-1 overflow-y-auto pr-1">
          {candidates.map((m) => {
            const checked = selected.has(m.protocol)
            return (
              <li key={m.protocol}>
                <button
                  type="button"
                  onClick={() => toggle(m.protocol)}
                  aria-pressed={checked}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    checked
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-neutral-200/70 dark:border-white/10 bg-surface-container-low hover:border-primary/40'
                  }`}
                >
                  {checked ? (
                    <CheckSquare size={16} className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <Square size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-on-surface" title={m.title}>
                      {m.title || 'Massiva sem título'}
                    </span>
                    <span className="block text-xs text-on-surface-variant">
                      <span className="font-mono">{m.protocol}</span>
                      {' · '}
                      {m.affectedClients} afetado{m.affectedClients === 1 ? '' : 's'}
                      {m.openedAt ? ` · aberta ${DATE_FMT.format(m.openedAt)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {candidates.length > 0 ? (
        <button
          type="button"
          onClick={() => bulkMutation.mutate()}
          disabled={selectedVisible.length === 0 || bulkMutation.isPending}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {bulkMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Vincular selecionadas ({selectedVisible.length})
        </button>
      ) : null}

      {lastResult ? (
        <p
          className={`mt-1.5 text-xs ${
            lastResult.failed.length > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {lastResult.linked.length} vinculada{lastResult.linked.length === 1 ? '' : 's'}
          {lastResult.failed.length > 0
            ? ` · ${lastResult.failed.length} falhou: ${lastResult.failed
                .map((f) => `${f.massivaProtocol} (${f.message})`)
                .join('; ')}`
            : '.'}
        </p>
      ) : null}
    </div>
  )
}
