import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import {
  GMUD_STATUS_EXEC_LABEL,
  updateGmudApproval,
  type GmudStatusComite,
  type GmudStatusExec,
} from '@/features/gmud/api/updateGmudApproval'
import { buildGmudCloseDescription, closeGmudInElleven } from '@/features/gmud/api/closeGmudInElleven'
import type { GmudListItem } from '@/features/gmud/model/gmud'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'

const FIELD =
  'mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'
const LABEL = 'block text-xs font-semibold text-on-surface-variant'

const COMITE_CHOICES: { value: GmudStatusComite; label: string; cls: string }[] = [
  { value: 'aprovada', label: 'Aprovar', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200' },
  { value: 'negada', label: 'Negar', cls: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200' },
  { value: 'pendente', label: 'Pendente', cls: 'border-neutral-300 bg-surface-container-low text-on-surface-variant dark:border-white/10' },
]

export function GmudApprovalModal({
  gmud,
  onClose,
  onSaved,
}: {
  gmud: GmudListItem
  onClose: () => void
  onSaved: () => void
}) {
  const [statusComite, setStatusComite] = useState<GmudStatusComite>(
    (gmud.extra?.statusComite as GmudStatusComite) || 'pendente',
  )
  const [statusExec, setStatusExec] = useState<GmudStatusExec>(
    (gmud.extra?.statusExec as GmudStatusExec) || 'pendente',
  )
  const [dataCab, setDataCab] = useState(gmud.extra?.dataCab ?? '')
  const [rnc, setRnc] = useState(gmud.extra?.rnc ?? '')

  const profile = useAccessAuthStore((s) => s.profile)
  const currentUser = profile?.displayName || profile?.email || ''

  const prevComite = (gmud.extra?.statusComite as GmudStatusComite) || 'pendente'
  const prevExec = (gmud.extra?.statusExec as GmudStatusExec) || 'pendente'
  const assignmentId = gmud.extra?.assignmentId ?? gmud.assignmentId ?? null
  const jaEncerrado = Boolean(gmud.extra?.ellevenEncerradoEm)

  const mutation = useMutation({
    mutationFn: async () => {
      // Transições que encerram o protocolo no Elleven:
      //  - Comitê → Negada  => cancelamento (incidentStatusId 8)
      //  - Execução → Concluída => encerramento (incidentStatusId de encerrado)
      // "Negada" tem prioridade (uma GMUD negada não segue para concluída).
      const vaiNegar = statusComite === 'negada' && prevComite !== 'negada'
      const vaiConcluir = statusExec === 'concluida' && prevExec !== 'concluida'
      const encerra: 'negada' | 'concluida' | null = vaiNegar
        ? 'negada'
        : vaiConcluir
          ? 'concluida'
          : null

      if (encerra && !jaEncerrado && assignmentId != null) {
        const label = encerra === 'negada' ? 'cancelamento' : 'encerramento'
        const ok = window.confirm(
          `Esta ação vai ENCERRAR o protocolo ${gmud.protocol} no Elleven (${label}). Confirmar?`,
        )
        if (!ok) return { aborted: true }
        await closeGmudInElleven({
          assignmentId,
          mode: encerra,
          description: buildGmudCloseDescription(encerra, currentUser),
        })
        await updateGmudApproval({
          voalleProtocol: gmud.protocol,
          statusComite,
          statusExec,
          dataCab: dataCab || undefined,
          rnc: rnc || undefined,
          ellevenEncerrado: { status: encerra },
        })
        return { aborted: false }
      }

      // Sem encerramento (ou já encerrado, ou sem assignmentId): só registra a avaliação.
      if (encerra && !jaEncerrado && assignmentId == null) {
        const ok = window.confirm(
          `Não identifiquei o atendimento no Elleven (assignmentId) do protocolo ${gmud.protocol}. ` +
            `A avaliação será salva, mas encerre o protocolo manualmente no Elleven. Continuar?`,
        )
        if (!ok) return { aborted: true }
      }
      await updateGmudApproval({
        voalleProtocol: gmud.protocol,
        statusComite,
        statusExec,
        dataCab: dataCab || undefined,
        rnc: rnc || undefined,
      })
      return { aborted: false }
    },
    onSuccess: (result) => {
      if (result?.aborted) return
      onSaved()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface">Avaliação do Comitê</p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant" title={gmud.title}>
              Protocolo <span className="font-mono">{gmud.protocol}</span> — {gmud.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <span className={LABEL}>Decisão do Comitê</span>
            <div className="mt-1.5 flex gap-2">
              {COMITE_CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setStatusComite(c.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
                    statusComite === c.value
                      ? c.cls
                      : 'border-neutral-200 dark:border-white/10 text-on-surface-variant hover:bg-surface-container-low',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className={LABEL}>Status de execução</span>
            <select
              className={FIELD}
              value={statusExec}
              onChange={(e) => setStatusExec(e.target.value as GmudStatusExec)}
            >
              {(Object.keys(GMUD_STATUS_EXEC_LABEL) as GmudStatusExec[]).map((s) => (
                <option key={s} value={s}>
                  {GMUD_STATUS_EXEC_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Data CAB</span>
              <input type="date" className={FIELD} value={dataCab} onChange={(e) => setDataCab(e.target.value)} />
            </label>
            <label>
              <span className={LABEL}>RNC</span>
              <input className={FIELD} value={rnc} onChange={(e) => setRnc(e.target.value)} placeholder="Opcional" />
            </label>
          </div>

          {mutation.isError ? (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {mutation.error instanceof Error ? mutation.error.message : 'Falha ao salvar.'}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-200/70 dark:border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar avaliação
          </button>
        </div>
      </div>
    </div>
  )
}
