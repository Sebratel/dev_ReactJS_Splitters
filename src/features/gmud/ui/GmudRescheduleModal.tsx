import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { rescheduleGmud, sendGmudReport, type GmudAgendaItem } from '@/features/gmud/api/gmudAgenda'
import {
  buildRescheduleReport,
  formatWindow,
  isWindowValid,
  type GmudWindow,
} from '@/features/gmud/lib/gmudSchedule'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

const FIELD =
  'w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

type Outcome = { kind: 'ok' } | { kind: 'partial'; message: string }

/**
 * Reagendamento de uma GMUD: grava a nova janela na plataforma e registra um relato padrão no
 * protocolo do Elleven (sem alterar status nem datas do protocolo).
 */
export function GmudRescheduleModal({
  item,
  initialWindow,
  canReschedule,
  onClose,
  onDone,
}: {
  item: GmudAgendaItem
  initialWindow: GmudWindow
  canReschedule: boolean
  onClose: () => void
  onDone: () => void
}) {
  const profile = useAccessAuthStore((s) => s.profile)
  const user = profile?.displayName || profile?.email || ''
  const [win, setWin] = useState<GmudWindow>(initialWindow)
  const [motivo, setMotivo] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const previous: GmudWindow = {
    dataInicio: item.dataInicio,
    horaInicio: item.horaInicio,
    dataFim: item.dataFim || item.dataInicio,
    horaFim: item.horaFim,
  }
  const changed = formatWindow(win) !== formatWindow(previous)
  const encerrada = Boolean(item.ellevenEncerradoEm)
  const report = buildRescheduleReport({ previous, next: win, user, motivo })
  const canSubmit = canReschedule && !encerrada && changed && isWindowValid(win)

  const mutation = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const saved = await rescheduleGmud({ voalleProtocol: item.voalleProtocol, ...win })
      const assignmentId = saved.assignmentId ?? item.assignmentId
      const statusId = saved.ellevenStatusId ?? item.ellevenStatusId
      if (assignmentId == null || statusId == null) {
        return { kind: 'partial', message: 'Protocolo sem atendimento/status no Elleven — relato não enviado.' }
      }
      try {
        await sendGmudReport({ assignmentId, incidentStatusId: statusId, description: report })
        return { kind: 'ok' }
      } catch (error) {
        return { kind: 'partial', message: error instanceof Error ? error.message : 'Falha ao enviar o relato.' }
      }
    },
    onSuccess: (result) => {
      setOutcome(result)
      onDone()
    },
  })

  const set = (patch: Partial<GmudWindow>) => setWin((w) => ({ ...w, ...patch }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <CalendarClock size={15} className="text-primary" /> Reagendar GMUD
            </p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant" title={item.titulo ?? ''}>
              <span className="font-mono">{item.voalleProtocol}</span> · {item.titulo || 'GMUD'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          <p className="text-xs text-on-surface-variant">
            Janela atual: <span className="font-semibold text-on-surface">{formatWindow(previous)}</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-on-surface-variant">
              Início
              <input type="date" className={`${FIELD} mt-1`} value={win.dataInicio} onChange={(e) => set({ dataInicio: e.target.value })} disabled={!canReschedule} />
              <input type="time" className={`${FIELD} mt-1.5`} value={win.horaInicio} onChange={(e) => set({ horaInicio: e.target.value })} disabled={!canReschedule} />
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">
              Fim
              <input type="date" className={`${FIELD} mt-1`} value={win.dataFim} onChange={(e) => set({ dataFim: e.target.value })} disabled={!canReschedule} />
              <input type="time" className={`${FIELD} mt-1.5`} value={win.horaFim} onChange={(e) => set({ horaFim: e.target.value })} disabled={!canReschedule} />
            </label>
          </div>
          {!isWindowValid(win) ? <p className="text-xs text-red-600 dark:text-red-300">O fim da janela deve ser depois do início.</p> : null}

          <label className="block text-xs font-semibold text-on-surface-variant">
            Motivo (opcional, vai no relato)
            <input className={`${FIELD} mt-1`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: condição climática, indisponibilidade da equipe" disabled={!canReschedule} />
          </label>

          <div>
            <span className="text-xs font-semibold text-on-surface-variant">Relato que será registrado no protocolo do Elleven</span>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-container-low p-3 text-xs text-on-surface">{report}</pre>
          </div>

          {encerrada ? <p className="text-xs text-amber-700 dark:text-amber-300">GMUD já encerrada no Elleven — não pode ser reagendada.</p> : null}
          {!canReschedule ? <p className="text-xs text-on-surface-variant">Só quem aprova GMUDs (Comitê) pode reagendar.</p> : null}
          {mutation.isError ? (
            <p className="text-xs text-red-600 dark:text-red-300">{mutation.error instanceof Error ? mutation.error.message : 'Falha ao reagendar.'}</p>
          ) : null}
          {outcome?.kind === 'ok' ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Reagendada e relato registrado no Elleven.</p> : null}
          {outcome?.kind === 'partial' ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">Janela atualizada na plataforma, mas: {outcome.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low">
              {outcome ? 'Fechar' : 'Cancelar'}
            </button>
            {!outcome ? (
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={!canSubmit || mutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Reagendar e registrar relato
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
