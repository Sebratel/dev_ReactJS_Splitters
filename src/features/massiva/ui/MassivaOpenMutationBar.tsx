import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import {
  isMassivaOpenAggregateError,
} from '@/features/massiva/model/massivaOpenMutation'
import { ApiError } from '@/shared/api/apiError'
import { formatQueryError } from '@/shared/lib/formatQueryError'

type MassivaOpenMutationBarProps = {
  canSubmitOpen: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  successPayload: MassivaOpenMutationSuccessPayload | undefined
  error: unknown
  onSubmit: () => void
  onDismiss: () => void
  /** Motivo do botão “Abrir” desabilitado (quando canSubmitOpen é false). */
  submitBlockedReason: string | null
  /** Aviso quando o fluxo está pronto mas o browser não tem Bearer (comum em localhost). */
  postAuthHint: string | null
}

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) return true
  if (isMassivaOpenAggregateError(error)) {
    return error.failures.some(
      (f) =>
        f.message.includes('401') ||
        f.message.toLowerCase().includes('não autorizada') ||
        f.message.toLowerCase().includes('nao autorizada'),
    )
  }
  const msg = formatQueryError(error).toLowerCase()
  return msg.includes('401') || msg.includes('sessão expirada')
}

function SingleResultLine(props: {
  r: MassivaOpenMutationSuccessPayload['results'][number]
}) {
  const { r } = props
  const bits: string[] = []
  if (r.protocol != null) bits.push(`protocolo ${r.protocol}`)
  if (r.assignmentId != null) bits.push(`assignment ${r.assignmentId}`)
  if (bits.length === 0) bits.push('sem identificadores retornados')
  if (r.message.trim() !== '') bits.push(r.message.trim())
  return (
    <li className="font-mono text-[11px] leading-relaxed">
      <span className="font-sans font-medium">{r.accessPointCode}</span>: {bits.join(' · ')}
    </li>
  )
}

export function MassivaOpenMutationBar({
  canSubmitOpen,
  isPending,
  isSuccess,
  isError,
  successPayload,
  error,
  onSubmit,
  onDismiss,
  submitBlockedReason,
  postAuthHint,
}: MassivaOpenMutationBarProps) {
  /** Após sucesso o rascunho é limpo; após erro mantém-se pronto para nova tentativa. */
  const showSubmit = !isSuccess
  const showDismiss = isSuccess || isError
  const unauthorized = isError && isUnauthorizedError(error)

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-neutral-50/90 to-white px-4 py-4 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03] dark:border-neutral-600 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
        Abertura da massiva (POST)
      </p>

      {!canSubmitOpen && submitBlockedReason ? (
        <p
          id="massiva-post-submit-blocked"
          className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950"
        >
          <span className="font-medium">Envio bloqueado — botão desativado: </span>
          {submitBlockedReason}
        </p>
      ) : null}

      {canSubmitOpen && postAuthHint ? (
        <p className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs text-sky-950">
          {postAuthHint}
        </p>
      ) : null}

      {showSubmit ? (
        <div className="space-y-1.5">
          <button
            type="button"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-400 disabled:opacity-70"
            disabled={!canSubmitOpen || isPending}
            onClick={onSubmit}
            aria-disabled={!canSubmitOpen || isPending}
            aria-describedby={
              !canSubmitOpen && submitBlockedReason
                ? 'massiva-post-submit-blocked'
                : undefined
            }
            title={
              !canSubmitOpen && submitBlockedReason
                ? 'Corrija o bloqueio acima para habilitar o envio.'
                : undefined
            }
          >
            {isPending ? 'Abrindo…' : 'Abrir massiva'}
          </button>
          {!canSubmitOpen && !isPending ? (
            <p className="text-[11px] text-neutral-500">
              O botão está desligado de propósito: nenhum POST é enviado até os requisitos acima
              estarem ok (não é falha de clique).
            </p>
          ) : null}
        </div>
      ) : null}

      {isPending ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400" role="status">
          Abrindo massiva e registrando afetados…
        </p>
      ) : null}

      {isSuccess && successPayload != null ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100"
          role="status"
        >
          <p className="font-medium">Massiva aberta com sucesso</p>
          {successPayload.autoClosedWithoutClients ? (
            <p className="mt-2 text-xs opacity-95">
              Nenhum cliente com PPPoE e contrato na seleção: o protocolo foi encerrado automaticamente
              (não foi acionado nenhum cliente na abertura).
            </p>
          ) : null}
          {typeof successPayload.afetadosPostedCount === 'number' ? (
            <p className="mt-2 text-xs opacity-95">
              Afetados registrados: {successPayload.afetadosPostedCount}
            </p>
          ) : null}
          {successPayload.infraProtocol != null ? (
            <div className="mt-2 rounded-md border border-sky-300/80 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-semibold">Protocolo de infraestrutura aberto junto</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed">
                <span className="font-sans font-medium">protocolo {successPayload.infraProtocol}</span>
                {successPayload.infraAssignmentId != null
                  ? ` · assignment ${successPayload.infraAssignmentId}`
                  : ''}
              </p>
              {(() => {
                const massivaProtocol = successPayload.results.find((r) => r.protocol != null)?.protocol
                return massivaProtocol != null ? (
                  <p className="mt-1 text-[11px] opacity-95">
                    Vinculado à massiva <span className="font-mono">{massivaProtocol}</span>.
                  </p>
                ) : null
              })()}
            </div>
          ) : null}
          {successPayload.followUpWarning != null && successPayload.followUpWarning !== '' ? (
            <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              {successPayload.followUpWarning}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {successPayload.results.map((r) => (
              <SingleResultLine key={r.accessPointCode} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {isError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
          role="alert"
        >
          <p className="font-medium">Falha na abertura</p>
          {isMassivaOpenAggregateError(error) ? (
            <div className="mt-2 space-y-2 text-xs">
              {error.successes.length > 0 ? (
                <div>
                  <p className="font-medium opacity-90">Abertas com sucesso (parcial)</p>
                  <ul className="mt-1 space-y-1">
                    {error.successes.map((r) => (
                      <SingleResultLine key={r.accessPointCode} r={r} />
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="font-medium opacity-90">Erros</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {error.failures.map((f) => (
                    <li key={f.accessPointCode}>
                      <span className="font-mono">{f.accessPointCode}</span>: {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs">{formatQueryError(error)}</p>
          )}
          {unauthorized ? (
            <p className="mt-2 text-xs text-red-900/90">
              Dica: em desenvolvimento local, defina{' '}
              <code className="rounded bg-red-100/80 px-1 text-[11px]">
                VITE_DEV_SESSION_TOKEN
              </code>{' '}
              no <code className="text-[11px]">.env.local</code> com o bearer válido do Hub (ou faça
              login que grave o token) e reinicie o{' '}
              <code className="text-[11px]">npm run dev</code>. Sem isso o BFF costuma responder
              401.
            </p>
          ) : null}
        </div>
      ) : null}

      {showDismiss ? (
        <button
          type="button"
          className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          onClick={onDismiss}
        >
          Limpar resultado
        </button>
      ) : null}
    </div>
  )
}
