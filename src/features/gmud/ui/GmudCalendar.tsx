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
import { AGENDA_TONE_CLASS, AGENDA_TONE_LABEL, agendaTone, upcomingInRange, type AgendaTone } from '@/features/gmud/lib/gmudAgendaTone'
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
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
  const items = agendaQuery.data ?? []

  // Próximos 7 dias: consulta própria, para não depender do mês que está na tela.
  const upcomingFrom = todayKey
  const upcomingTo = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return localDayKey(d)
  })()
  const upcomingQuery = useQuery({
    queryKey: ['gmud', 'agenda', upcomingFrom, upcomingTo],
    queryFn: () => fetchGmudAgenda(upcomingFrom, upcomingTo),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
  const upcoming = upcomingInRange(upcomingQuery.data ?? [], upcomingFrom, upcomingTo)
  const goToday = () => {
    const now = new Date()
    setCursor({ year: now.getFullYear(), month: now.getMonth() })
  }

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
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
    <div className="min-w-0 rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest">
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
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 transition hover:bg-surface-container-low dark:ring-white/10"
          >
            Hoje
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
                        isStart ? AGENDA_TONE_CLASS[agendaTone(item)].start : AGENDA_TONE_CLASS[agendaTone(item)].cont
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-200/70 px-4 py-2.5 text-[11px] text-on-surface-variant dark:border-white/10">
        {(['programada', 'emergencial', 'pre_aprovada', 'encerrada'] as AgendaTone[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${AGENDA_TONE_CLASS[t].dot}`} aria-hidden /> {AGENDA_TONE_LABEL[t]}
          </span>
        ))}
      </div>

      {!agendaQuery.isLoading && items.length === 0 && !agendaQuery.isError ? (
        <p className="border-t border-neutral-200/70 p-4 text-center text-sm text-on-surface-variant dark:border-white/10">
          Nenhuma GMUD liberada com janela neste mês. Só aparecem na agenda as GMUDs aprovadas pelo Comitê e pelas áreas.
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

    <aside className="min-w-0 rounded-2xl border border-neutral-200/90 bg-surface-container-lowest p-4 dark:border-white/10" aria-label="Próximos 7 dias">
      <p className="text-sm font-bold text-on-surface">Próximos 7 dias</p>
      {upcomingQuery.isLoading ? (
        <p className="mt-2 text-xs text-on-surface-variant">Carregando…</p>
      ) : upcoming.length === 0 ? (
        <p className="mt-2 text-xs text-on-surface-variant">Nenhuma GMUD liberada nos próximos 7 dias.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200/60 dark:divide-white/5">
          {upcoming.map((item) => (
            <li key={item.voalleProtocol} className="py-2">
              <button type="button" onClick={() => setEditing({ item, window: itemWindow(item) })} className="block w-full text-left">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                  <span className={`size-2 shrink-0 rounded-sm ${AGENDA_TONE_CLASS[agendaTone(item)].dot}`} aria-hidden />
                  {item.dataInicio < todayKey ? 'Em andamento' : `${item.dataInicio === todayKey ? 'Hoje' : item.dataInicio.split('-').reverse().slice(0, 2).join('/')} ${item.horaInicio}`}
                </p>
                <p className="mt-0.5 truncate text-xs text-on-surface-variant" title={item.titulo ?? undefined}>
                  {item.popSite ? `${item.popSite} · ` : ''}
                  {item.titulo || item.voalleProtocol}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
    </div>
  )
}
