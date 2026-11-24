import { useState } from 'react'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import type { MassivaClientConflicts } from '@/features/massiva/model/massivaClientConflicts'

const ORIGIN_LABEL = { massiva: 'Massiva', gmud: 'GMUD' } as const
const MAX_CLIENTS_SHOWN = 60

type Props = {
  conflicts: MassivaClientConflicts
  includeAnyway: boolean
  onIncludeAnywayChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * Aviso de que parte da seleção já faz parte de OUTRO evento aberto. Não bloqueia a abertura:
 * por padrão esses clientes ficam de fora (não duplicam); a lista mostra quem são e de qual
 * evento, com a previsão de encerramento dele.
 */
export function MassivaClientConflictsAlert({
  conflicts,
  includeAnyway,
  onIncludeAnywayChange,
  disabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const total = conflicts.contractIds.length
  if (total === 0 || conflicts.events.length === 0) return null

  return (
    <div
      className="rounded-lg border border-amber-300/80 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40 px-4 py-3 text-amber-950 dark:text-amber-100"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {total === 1
              ? '1 cliente já faz parte de outro evento aberto'
              : `${total} clientes já fazem parte de outro evento aberto`}
          </p>
          <p className="mt-1 text-sm leading-relaxed opacity-90">
            {includeAnyway
              ? 'Eles serão incluídos também nesta massiva (pode duplicar o aviso ao cliente).'
              : 'Eles não vão junto nesta massiva: já estão sinalizados no outro evento. Você pode abrir normalmente.'}
          </p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            {expanded ? 'Esconder clientes' : 'Ver clientes'}
          </button>

          {expanded ? (
            <div className="mt-2 space-y-3">
              {conflicts.events.map((ev) => (
                <div key={`${ev.origin}-${ev.protocol}`} className="rounded-md border border-amber-300/60 dark:border-amber-800/50 bg-white/60 dark:bg-black/20 px-3 py-2">
                  <p className="text-xs font-semibold">
                    {ORIGIN_LABEL[ev.origin]} {ev.protocol}
                    {ev.title !== '' ? ` · ${ev.title}` : ''}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {ev.clients.length} {ev.clients.length === 1 ? 'cliente' : 'clientes'} · previsão de encerramento{' '}
                    {formatBrazilDateTimeShortDisplay(ev.finishDate)}
                  </p>
                  <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                    {ev.clients.slice(0, MAX_CLIENTS_SHOWN).map((c) => (
                      <li key={c.contractId} className="flex justify-between gap-3">
                        <span className="truncate">{c.pppoe !== '' ? c.pppoe : '—'}</span>
                        <span className="shrink-0 opacity-70">contrato {c.contractId}</span>
                      </li>
                    ))}
                    {ev.clients.length > MAX_CLIENTS_SHOWN ? (
                      <li className="opacity-70">… e mais {ev.clients.length - MAX_CLIENTS_SHOWN}</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <label className="mt-3 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
              checked={includeAnyway}
              disabled={disabled}
              onChange={(e) => onIncludeAnywayChange(e.target.checked)}
            />
            <span>
              Incluir mesmo assim.{' '}
              <span className="opacity-80">Use só se o outro evento já acabou ou foi esquecido aberto.</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
