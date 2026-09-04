import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import { formatQueryError } from '@/shared/lib/formatQueryError'

type BottomActionBarProps = {
  summary: string
  disabledReason: string | null
  canSubmit: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  error: unknown
  successPayload: MassivaOpenMutationSuccessPayload | undefined
  apTitleByCode: Record<string, string>
  onSubmit: () => void
  onDismiss: () => void
}

export function BottomActionBar({
  summary,
  disabledReason,
  canSubmit,
  isPending,
  isSuccess,
  isError,
  error,
  successPayload,
  apTitleByCode,
  onSubmit,
  onDismiss,
}: BottomActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest/95 px-3 py-3 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.2)] backdrop-blur sm:px-4 sm:py-4 lg:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            Resumo
          </p>
          <p className="mt-1 text-sm font-medium text-on-surface">{summary}</p>
          {!canSubmit && disabledReason ? (
            <p className="mt-1 text-xs text-on-surface-variant">{disabledReason}</p>
          ) : null}
          {isSuccess && successPayload ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-200">
                Massiva aberta com sucesso. Protocolos retornados: {successPayload.results.length}.
              </p>
              <div className="overflow-x-auto rounded-lg ring-1 ring-neutral-200/80 dark:ring-white/10">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-on-surface-variant">
                        Ponto de acesso
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-on-surface-variant">
                        Protocolo
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-on-surface-variant">
                        Assignment
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-on-surface-variant">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-white/10 bg-surface-container-lowest">
                    {successPayload.results.map((result) => {
                      const apCode = result.accessPointCode
                      const apTitle = apTitleByCode[apCode] ?? apCode
                      const isOpened = result.protocol !== null && result.assignmentId !== null
                      return (
                        <tr key={`${apCode}-${result.protocol ?? 'sem-protocolo'}`}>
                          <td className="px-2.5 py-2 text-on-surface">
                            {apTitle} ({apCode})
                          </td>
                          <td className="px-2.5 py-2 font-mono text-on-surface-variant">
                            {result.protocol ?? '-'}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-on-surface-variant">
                            {result.assignmentId ?? '-'}
                          </td>
                          <td className="px-2.5 py-2 font-semibold text-on-surface">
                            {isOpened ? 'Aberto' : 'Parcial'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {successPayload.infraProtocol != null ? (
                <div className="rounded-lg border border-sky-300/70 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-2 text-xs text-sky-900 dark:text-sky-200">
                  <p className="font-semibold">Protocolo de infraestrutura aberto junto</p>
                  <p className="mt-0.5 font-mono">
                    protocolo {successPayload.infraProtocol}
                    {successPayload.infraAssignmentId != null
                      ? ` · assignment ${successPayload.infraAssignmentId}`
                      : ''}
                  </p>
                  {(() => {
                    const massivaProtocol = successPayload.results.find((r) => r.protocol != null)
                      ?.protocol
                    return massivaProtocol != null ? (
                      <p className="mt-0.5">
                        Vinculado à massiva <span className="font-mono">{massivaProtocol}</span>.
                      </p>
                    ) : null
                  })()}
                </div>
              ) : null}
              {successPayload.followUpWarning != null && successPayload.followUpWarning.trim() !== '' ? (
                <p className="whitespace-pre-line rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
                  {successPayload.followUpWarning}
                </p>
              ) : null}
            </div>
          ) : null}
          {isError ? (
            <p className="mt-1 text-xs text-red-700 dark:text-red-200">{formatQueryError(error)}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {(isSuccess || isError) ? (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-neutral-300 hover:bg-surface-container-low sm:w-auto"
            >
              Limpar resultado
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300 dark:disabled:bg-sky-900/50 sm:w-auto"
            aria-disabled={!canSubmit || isPending}
            title={!canSubmit && disabledReason ? disabledReason : undefined}
          >
            {isPending ? 'Abrindo massiva...' : 'Abrir massiva'}
          </button>
        </div>
      </div>
    </div>
  )
}
