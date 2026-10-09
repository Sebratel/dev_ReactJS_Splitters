import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Link2, Loader2, Lock, Plus, Trash2, X } from 'lucide-react'
import {
  fetchGmudLinks,
  linkMassivaToGmud,
  unlinkMassivaFromGmud,
} from '@/features/gmud/api/gmudLinks'
import { setPendingGmudLink } from '@/features/gmud/lib/pendingGmudLink'
import { isGmudDisponivel, type GmudListItem } from '@/features/gmud/model/gmud'
import { GmudOpenMassivaPicker } from '@/features/gmud/ui/GmudOpenMassivaPicker'

const FIELD =
  'w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

export function GmudLinksModal({ gmud, onClose }: { gmud: GmudListItem; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [massivaInput, setMassivaInput] = useState('')

  const linksQuery = useQuery({
    queryKey: ['gmud', 'links', gmud.protocol],
    queryFn: () => fetchGmudLinks(gmud.protocol),
  })

  const invalidate = () => {
    void linksQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: ['gmud', 'list'] })
  }

  const addMutation = useMutation({
    mutationFn: (massivaProtocol: number) => linkMassivaToGmud(gmud.protocol, massivaProtocol),
    onSuccess: () => {
      setMassivaInput('')
      invalidate()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (massivaProtocol: number) => unlinkMassivaFromGmud(gmud.protocol, massivaProtocol),
    onSuccess: invalidate,
  })

  const links = linksQuery.data ?? []
  const linkedProtocols = new Set(links.map((l) => l.massivaProtocol))
  const parsedInput = Number.parseInt(massivaInput, 10)
  // "Disponibilização": só GMUD aprovada pode ser vinculada/gerar massiva. Pendente/negada fica travada.
  const disponivel = isGmudDisponivel(gmud.extra?.statusComite)
  const canAdd =
    disponivel && Number.isFinite(parsedInput) && parsedInput > 0 && !addMutation.isPending

  const openLinkedMassiva = () => {
    if (!isGmudDisponivel(gmud.extra?.statusComite)) return
    setPendingGmudLink(gmud.protocol)
    navigate('/massiva')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <Link2 size={15} className="text-primary" /> Massivas vinculadas
            </p>
            <p className="mt-0.5 truncate text-xs text-on-surface-variant" title={gmud.title}>
              GMUD <span className="font-mono">{gmud.protocol}</span>
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
          {!disponivel ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>
                GMUD{' '}
                <span className="font-semibold">
                  {gmud.extra?.statusComite === 'negada' ? 'negada pelo Comitê' : 'pendente de aprovação'}
                </span>
                . O vínculo e a geração de massivas liberam somente após a{' '}
                <span className="font-semibold">aprovação do Comitê</span>.
              </span>
            </div>
          ) : null}

          {/* Seleção múltipla de massivas abertas */}
          <GmudOpenMassivaPicker
            gmudProtocol={gmud.protocol}
            linkedProtocols={linkedProtocols}
            disabled={!disponivel}
            onLinked={invalidate}
          />

          {/* Vincular existente por protocolo (ex.: massiva que não está mais aberta) */}
          <div className={disponivel ? '' : 'pointer-events-none select-none opacity-50'} aria-disabled={!disponivel}>
            <span className="text-xs font-semibold text-on-surface-variant">Vincular por protocolo</span>
            <div className="mt-1.5 flex gap-2">
              <input
                className={FIELD}
                inputMode="numeric"
                placeholder="Protocolo da massiva"
                value={massivaInput}
                onChange={(e) => setMassivaInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canAdd) addMutation.mutate(parsedInput)
                }}
              />
              <button
                type="button"
                onClick={() => canAdd && addMutation.mutate(parsedInput)}
                disabled={!canAdd}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {addMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Vincular
              </button>
            </div>
            {addMutation.isError ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                {addMutation.error instanceof Error ? addMutation.error.message : 'Falha ao vincular.'}
              </p>
            ) : null}
          </div>

          {/* Abrir nova vinculada */}
          <button
            type="button"
            onClick={openLinkedMassiva}
            disabled={!disponivel}
            title={disponivel ? undefined : 'Disponível após aprovação do Comitê'}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {disponivel ? <AlertTriangle className="size-4" /> : <Lock className="size-4" />} Abrir massiva nova
            vinculada a esta GMUD
          </button>

          {/* Lista */}
          <div>
            <span className="text-xs font-semibold text-on-surface-variant">
              Vinculadas ({links.length})
            </span>
            {linksQuery.isLoading ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">Carregando…</p>
            ) : links.length === 0 ? (
              <p className="py-4 text-center text-sm text-on-surface-variant">Nenhuma massiva vinculada.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {links.map((l) => (
                  <li
                    key={l.massivaProtocol}
                    className="flex items-center justify-between rounded-lg border border-neutral-200/70 dark:border-white/10 bg-surface-container-low px-3 py-2"
                  >
                    <span className="font-mono text-sm text-on-surface">{l.massivaProtocol}</span>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(l.massivaProtocol)}
                      disabled={removeMutation.isPending}
                      className="rounded p-1 text-on-surface-variant transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      aria-label="Desvincular"
                      title="Desvincular"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
