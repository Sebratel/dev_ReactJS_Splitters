import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, MessageSquarePlus, X } from 'lucide-react'
import { sendGmudReport } from '@/features/gmud/api/gmudAgenda'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'

/** Monta o corpo do relato com cabeçalho de autoria (quem/quando) + o texto do usuário. */
function buildGmudReportDescription(text: string, user: string): string {
  const quem = user.trim() !== '' ? user.trim() : 'equipe Splitters'
  const now = new Date()
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const quando = `${d}/${m}/${now.getFullYear()} ${hh}:${mm}`
  return `RELATO (via plataforma) - ${quem} em ${quando}:\n${text.trim()}`
}

/**
 * Adiciona um relato livre ao protocolo da GMUD no Elleven, SEM mudar o status (envia o
 * `incidentStatusId` atual). Permite relatar o andamento direto da plataforma.
 */
export function GmudReportModal({
  protocol,
  assignmentId,
  incidentStatusId,
  onClose,
  onSent,
}: {
  protocol: number
  assignmentId: number | null
  incidentStatusId: number | null
  onClose: () => void
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const profile = useAccessAuthStore((s) => s.profile)
  const currentUser = profile?.displayName || profile?.email || ''

  const mutation = useMutation({
    mutationFn: async () => {
      if (assignmentId == null) {
        throw new Error('Não foi possível identificar o atendimento no Elleven (assignmentId) desta GMUD.')
      }
      await sendGmudReport({
        assignmentId,
        incidentStatusId: incidentStatusId ?? 1,
        description: buildGmudReportDescription(text, currentUser),
      })
    },
    onSuccess: () => onSent(),
  })

  const canSend = text.trim() !== '' && !mutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <MessageSquarePlus size={15} className="text-primary" /> Adicionar relato
            </p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">
              Protocolo <span className="font-mono">{protocol}</span> — registra no Elleven sem mudar o status.
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

        <div className="space-y-3 p-4">
          <textarea
            autoFocus
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Descreva o andamento, uma observação ou um ajuste no meio do caminho…"
            className="w-full resize-y rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          {assignmentId == null ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sem atendimento identificado no Elleven — o relato não poderá ser enviado para este protocolo.
            </p>
          ) : null}
          {mutation.isError ? (
            <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar o relato.'}
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
            disabled={!canSend}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90',
              !canSend && 'cursor-not-allowed opacity-60',
            )}
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
            Enviar relato
          </button>
        </div>
      </div>
    </div>
  )
}
