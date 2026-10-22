import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { updateGmudApproval, type GmudStatusComite } from '@/features/gmud/api/updateGmudApproval'
import { buildGmudCloseDescription, closeGmudInElleven } from '@/features/gmud/api/closeGmudInElleven'
import { sendGmudReport } from '@/features/gmud/api/gmudAgenda'
import type { GmudListItem } from '@/features/gmud/model/gmud'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { cn } from '@/shared/lib/utils'

/** Relato da decisão do Comitê para registrar no protocolo do Elleven. */
function buildComiteRelato(decisao: 'Aprovada' | 'Negada', user: string, dataCab: string, rnc: string, obs: string): string {
  const quem = user.trim() !== '' ? user.trim() : 'equipe Splitters'
  const now = new Date()
  const quando = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const linhas = [`AVALIACAO DO COMITE - ${decisao} por ${quem} em ${quando}.`]
  if (dataCab.trim() !== '') linhas.push(`Data CAB: ${dataCab.split('-').reverse().join('/')}`)
  if (rnc.trim() !== '') linhas.push(`RNC: ${rnc.trim()}`)
  if (obs.trim() !== '') linhas.push(`Observacoes: ${obs.trim()}`)
  return linhas.join('\n')
}

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
  const [dataCab, setDataCab] = useState(gmud.extra?.dataCab ?? '')
  const [rnc, setRnc] = useState(gmud.extra?.rnc ?? '')
  const [obs, setObs] = useState('')

  const profile = useAccessAuthStore((s) => s.profile)
  const currentUser = profile?.displayName || profile?.email || ''

  const prevComite = (gmud.extra?.statusComite as GmudStatusComite) || 'pendente'
  const assignmentId = gmud.extra?.assignmentId ?? gmud.assignmentId ?? null
  const jaEncerrado = Boolean(gmud.extra?.ellevenEncerradoEm)

  const mutation = useMutation({
    mutationFn: async () => {
      // A avaliação do Comitê é um ato único (Aprovar/Negar). A conclusão e o cancelamento
      // têm botões próprios no detalhe. Aqui só "Negar" encerra o protocolo (cancelamento).
      const vaiNegar = statusComite === 'negada' && prevComite !== 'negada'

      if (vaiNegar && !jaEncerrado && assignmentId != null) {
        const ok = window.confirm(
          `Negar esta GMUD vai ENCERRAR o protocolo ${gmud.protocol} no Elleven (cancelamento). Confirmar?`,
        )
        if (!ok) return { aborted: true }
        // Encerra com o relato da decisão (inclui Data CAB/RNC/observações).
        await closeGmudInElleven({
          assignmentId,
          mode: 'negada',
          description: `${buildGmudCloseDescription('negada', currentUser)}\n${buildComiteRelato('Negada', currentUser, dataCab, rnc, obs)}`,
        })
        await updateGmudApproval({
          voalleProtocol: gmud.protocol,
          statusComite,
          dataCab: dataCab || undefined,
          rnc: rnc || undefined,
          ellevenEncerrado: { status: 'negada' },
        })
        return { aborted: false }
      }

      if (vaiNegar && !jaEncerrado && assignmentId == null) {
        const ok = window.confirm(
          `Não identifiquei o atendimento no Elleven (assignmentId) do protocolo ${gmud.protocol}. ` +
            `A decisão será salva, mas encerre o protocolo manualmente no Elleven. Continuar?`,
        )
        if (!ok) return { aborted: true }
      }
      await updateGmudApproval({
        voalleProtocol: gmud.protocol,
        statusComite,
        dataCab: dataCab || undefined,
        rnc: rnc || undefined,
      })

      // Aprovada: registra a decisão como relato no Elleven (sem mudar o status). Best-effort —
      // a decisão já foi salva; uma falha no relato não deve derrubar a aprovação.
      if (statusComite === 'aprovada' && prevComite !== 'aprovada' && assignmentId != null) {
        try {
          await sendGmudReport({
            assignmentId,
            incidentStatusId: gmud.statusId ?? 1,
            description: buildComiteRelato('Aprovada', currentUser, dataCab, rnc, obs),
          })
        } catch {
          // Relato é auxiliar — ignora falha (a aprovação está salva).
        }
      }
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Data CAB</span>
              <input type="date" className={FIELD} value={dataCab} onChange={(e) => setDataCab(e.target.value)} />
              <span className="mt-1 block text-[11px] text-on-surface-variant/70">
                Data da reunião do Comitê (CAB — Change Advisory Board) que avaliou esta GMUD.
              </span>
            </label>
            <label>
              <span className={LABEL}>RNC</span>
              <input className={FIELD} value={rnc} onChange={(e) => setRnc(e.target.value)} placeholder="Opcional" />
              <span className="mt-1 block text-[11px] text-on-surface-variant/70">
                Registro de Não Conformidade — preencha se a mudança gerou desvio/incidente.
              </span>
            </label>
          </div>

          <label>
            <span className={LABEL}>Observações do Comitê</span>
            <textarea
              className={cn(FIELD, 'min-h-[70px] resize-y')}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Opcional — vai junto no relato registrado no protocolo do Elleven"
            />
          </label>

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
