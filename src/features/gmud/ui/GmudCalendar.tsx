import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { fetchGmudAgenda, type GmudAgendaItem } from '@/features/gmud/api/gmudAgenda'
import {
  buildMonthGrid,
  localDayKey,
  shiftWindowToDay,
  windowCoversDay,
  type GmudWindow,
} from '@/features/gmud/lib/gmudSchedule'
import { GmudRescheduleModal } from '@/features/gmud/ui/GmudRescheduleModal'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_FMT = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const DRAG_TYPE = 'application/x-gmud-protocol'

function itemWindow(item: GmudAgendaItem): GmudWindow {
  return {
    dataInicio: item.dataInicio,
    horaInicio: item.horaInicio,
    dataFim: item.dataFim || item.dataInicio,
    horaFim: item.horaFim,
  }
}

/**
 * Agenda das GMUDs aprovadas (visão mensal). Arraste a GMUD para outro dia — ou clique nela — para
 * reagendar: a janela muda na plataforma e um relato padrão é registrado no protocolo do Elleven.
 */
export function GmudCalendar() {
  const canReschedule = useAccessAuthStore((s) => s.hasPermission('canApproveGmud'))
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [editing, setEditing] = useState<{ item: GmudAgendaItem; window: GmudWindow } | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])
  const from = localDayKey(weeks[0][0])
  const to = localDayKey(weeks[weeks.length - 1][6])
  const todayKey = localDayKey(new Date())

  const agendaQuery = useQuery({
    queryKey: ['gmud', 'agenda', from, to],
    queryFn: () => fetchGmudAgenda(from, to),
    staleTime: 30_000,
  })
  const items = agendaQuery.data ?? []

  const move = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })

  const isMovable = (item: GmudAgendaItem) => canReschedule && !item.ellevenEncerradoEm

  const onDrop = (day: string, protocolRaw: string) => {
    setDragOverDay(null)
    const item = items.find((i) => String(i.voalleProtocol) === protocolRaw)
    if (!item || !isMovable(item) || day === item.dataInicio) return
    setEditing({ item, window: shiftWindowToDay(itemWindow(item), day) })
  }

  return (
    <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/70 dark:border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low" aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-40 text-center text-sm font-bold text-on-surface">
            {(() => {
              const label = MONTH_FMT.format(new Date(cursor.year, cursor.month, 1))
              return label.charAt(0).toUpperCase() + label.slice(1)
            })()}
          </p>
          <button type="button" onClick={() => move(1)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low" aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
          {agendaQuery.isFetching ? <Loader2 className="size-4 animate-spin text-on-surface-variant" /> : null}
        </div>
        <p className="text-xs text-on-surface-variant">
          {canReschedule
            ? 'Arraste uma GMUD para outro dia (ou clique nela) para reagendar.'
            : 'Somente aprovadas aparecem na agenda. Reagendar exige permissão de aprovação.'}
        </p>
      </div>

      {agendaQuery.isError ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-300">
          {agendaQuery.error instanceof Error ? agendaQuery.error.message : 'Falha ao carregar a agenda.'}
        </p>
      ) : null}

      <div className="grid grid-cols-7 border-b border-neutral-200/70 dark:border-white/10 text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((date) => {
          const day = localDayKey(date)
          const inMonth = date.getMonth() === cursor.month
          const dayItems = items.filter((i) => windowCoversDay(itemWindow(i), day))
          return (
            <div
              key={day}
              onDragOver={(e) => {
                if (!canReschedule) return
                e.preventDefault()
                setDragOverDay(day)
              }}
              onDragLeave={() => setDragOverDay((d) => (d === day ? null : d))}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(day, e.dataTransfer.getData(DRAG_TYPE))
              }}
              className={`min-h-28 border-b border-r border-neutral-200/60 dark:border-white/5 p-1.5 ${
                inMonth ? '' : 'bg-surface-container-low/60'
              } ${dragOverDay === day ? 'bg-primary/10 ring-2 ring-inset ring-primary/40' : ''}`}
            >
              <p
                className={`mb-1 text-right text-xs tabular-nums ${
                  day === todayKey
                    ? 'font-bold text-primary'
                    : inMonth
                      ? 'text-on-surface'
                      : 'text-on-surface-variant/60'
                }`}
              >
                {date.getDate()}
              </p>
              <div className="space-y-1">
                {dayItems.map((item) => {
                  const isStart = item.dataInicio === day
                  const movable = isStart && isMovable(item)
                  return (
                    <button
                      type="button"
                      key={item.voalleProtocol}
                      draggable={movable}
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, String(item.voalleProtocol))}
                      onClick={() => setEditing({ item, window: itemWindow(item) })}
                      title={`${item.voalleProtocol} · ${item.titulo ?? ''} (${item.horaInicio}–${item.horaFim})`}
                      className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition ${
                        item.ellevenEncerradoEm
                          ? 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
                          : isStart
                            ? 'bg-primary/90 text-white hover:bg-primary'
                            : 'bg-primary/15 text-primary'
                      } ${movable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      {isStart ? `${item.horaInicio} ` : '↳ '}
                      {item.popSite ? `${item.popSite} · ` : ''}
                      {item.titulo || item.voalleProtocol}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {!agendaQuery.isLoading && items.length === 0 && !agendaQuery.isError ? (
        <p className="p-4 text-center text-sm text-on-surface-variant">
          Nenhuma GMUD aprovada com janela neste período.
        </p>
      ) : null}

      {editing ? (
        <GmudRescheduleModal
          item={editing.item}
          initialWindow={editing.window}
          canReschedule={canReschedule}
          onClose={() => setEditing(null)}
          onDone={() => void agendaQuery.refetch()}
        />
      ) : null}
    </div>
  )
}
