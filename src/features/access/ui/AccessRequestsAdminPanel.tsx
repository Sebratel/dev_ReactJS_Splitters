import { useMemo, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type { SplittersAccessRequest } from '@/features/access/model/access.types'
import { labelForRequestedModule } from '@/features/access/model/accessRequestModules'
import {
  SPLITTERS_PRESET_ROLE_IDS,
  SPLITTERS_ROLE_LABEL,
  type SplittersRoleId,
} from '@/features/access/lib/splittersUserRoles'
import { cn } from '@/shared/lib/utils'

type ApproveRole = Exclude<SplittersRoleId, 'personalizado'>

type AccessRequestsAdminPanelProps = {
  requests: SplittersAccessRequest[]
  loading: boolean
  error: string | null
  busy: boolean
  currentUid: string | undefined
  onApprove: (input: { requestId: string; role: ApproveRole }) => void
  onReject: (input: { requestId: string; adminNote: string }) => void
}

function formatWhen(d: Date | null): string {
  if (!d) return '—'
  try {
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function AccessRequestsAdminPanel({
  requests,
  loading,
  error,
  busy,
  currentUid,
  onApprove,
  onReject,
}: AccessRequestsAdminPanelProps) {
  const [rejectForId, setRejectForId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [roleById, setRoleById] = useState<Record<string, ApproveRole>>({})

  const sorted = useMemo(() => {
    const next = [...requests]
    next.sort((a, b) => {
      const ta = a.createdAt?.getTime() ?? 0
      const tb = b.createdAt?.getTime() ?? 0
      return ta - tb
    })
    return next
  }, [requests])

  if (!loading && sorted.length === 0 && !error) return null

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/70">
            Aprovações
          </p>
          <h2 className="text-base font-semibold tracking-tight text-neutral-950">
            Solicitações de acesso pendentes
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-600">
            Aprove com um papel padrão (as permissões são gravadas no cadastro do usuário) ou recuse com
            uma mensagem visível para o solicitante.
          </p>
        </div>
        {loading ? (
          <div className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
            <Loader2 className="size-4 animate-spin text-amber-700" aria-hidden />
            Carregando…
          </div>
        ) : (
          <span className="inline-flex w-fit items-center rounded-lg border border-amber-200/90 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950">
            {sorted.length} pendente{sorted.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {sorted.map((r) => {
            const defaultRole: ApproveRole = r.requestedModules.includes('intelligence')
              ? 'operador'
              : r.requestedModules.includes('massiva_open')
                ? 'operador_massivas'
                : 'leitura'
            const selectedRole = roleById[r.id] ?? defaultRole
            const rejecting = rejectForId === r.id
            return (
              <li
                key={r.id}
                className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-neutral-950">{r.displayName || r.email}</p>
                    <p className="text-[11px] text-neutral-500">{r.email}</p>
                    {r.requestedModules.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5 pt-1">
                        {r.requestedModules.map((id) => (
                          <li
                            key={id}
                            className="rounded-md border border-amber-200/80 bg-amber-50/90 px-2 py-0.5 text-[10px] font-semibold text-amber-950"
                          >
                            {labelForRequestedModule(id)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-[12px] leading-relaxed text-neutral-700">{r.message}</p>
                    <p className="text-[10px] font-medium tabular-nums text-neutral-400">
                      Recebida em {formatWhen(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 lg:items-end">
                      Papel ao aprovar
                      <select
                        value={selectedRole}
                        onChange={(e) =>
                          setRoleById((prev) => ({
                            ...prev,
                            [r.id]: e.target.value as ApproveRole,
                          }))
                        }
                        className="w-full min-w-[12rem] rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs font-bold text-neutral-900 lg:w-auto"
                      >
                        {SPLITTERS_PRESET_ROLE_IDS.map((id) => (
                          <option key={id} value={id}>
                            {SPLITTERS_ROLE_LABEL[id]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy || r.uid === currentUid}
                        title={r.uid === currentUid ? 'Use outro administrador para alterar o seu próprio acesso.' : undefined}
                        onClick={() =>
                          onApprove({
                            requestId: r.id,
                            role: selectedRole,
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-700/15 bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="size-3.5" aria-hidden />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectForId((prev) => (prev === r.id ? null : r.id))
                          setRejectNote('')
                        }}
                        className={cn(
                          'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold shadow-sm transition',
                          rejecting
                            ? 'border-rose-400 bg-rose-50 text-rose-950'
                            : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50',
                        )}
                      >
                        <X className="size-3.5" aria-hidden />
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
                {rejecting ? (
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <label className="block text-[11px] font-semibold text-neutral-700" htmlFor={`reject-${r.id}`}>
                      Mensagem para o usuário (opcional)
                    </label>
                    <textarea
                      id={`reject-${r.id}`}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-sm text-neutral-900 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Explique o motivo da recusa ou próximos passos."
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          onReject({ requestId: r.id, adminNote: rejectNote.trim() })
                          setRejectForId(null)
                          setRejectNote('')
                        }}
                        className="rounded-lg border border-rose-200 bg-rose-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                      >
                        Confirmar recusa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectForId(null)
                          setRejectNote('')
                        }}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : loading ? (
        <div className="mt-4 rounded-xl border border-neutral-100 bg-white/60 px-4 py-8 text-center text-sm text-neutral-500">
          Buscando solicitações…
        </div>
      ) : null}
    </div>
  )
}
