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
    <div className="sticky bottom-0 z-20 border-t border-neutral-200/80 bg-white/95 px-3 py-3 shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.2)] backdrop-blur sm:px-4 sm:py-4 lg:px-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Resumo
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{summary}</p>
          {!canSubmit && disabledReason ? (
            <p className="mt-1 text-xs text-neutral-500">{disabledReason}</p>
          ) : null}
          {isSuccess && successPayload ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-emerald-700">
                Massiva aberta com sucesso. Protocolos retornados: {successPayload.results.length}.
              </p>
              <div className="overflow-x-auto rounded-lg ring-1 ring-neutral-200/80">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-neutral-500">
                        Ponto de acesso
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-neutral-500">
                        Protocolo
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-neutral-500">
                        Assignment
                      </th>
                      <th className="px-2.5 py-2 font-semibold uppercase tracking-wide text-neutral-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 bg-white">
                    {successPayload.results.map((result) => {
                      const apCode = result.accessPointCode
                      const apTitle = apTitleByCode[apCode] ?? apCode
                      const isOpened = result.protocol !== null && result.assignmentId !== null
                      return (
                        <tr key={`${apCode}-${result.protocol ?? 'sem-protocolo'}`}>
                          <td className="px-2.5 py-2 text-neutral-900">
                            {apTitle} ({apCode})
                          </td>
                          <td className="px-2.5 py-2 font-mono text-neutral-700">
                            {result.protocol ?? '-'}
                          </td>
                          <td className="px-2.5 py-2 font-mono text-neutral-700">
                            {result.assignmentId ?? '-'}
                          </td>
                          <td className="px-2.5 py-2 font-semibold text-neutral-800">
                            {isOpened ? 'Aberto' : 'Parcial'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {isError ? (
            <p className="mt-1 text-xs text-red-700">{formatQueryError(error)}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {(isSuccess || isError) ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Limpar resultado
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
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
