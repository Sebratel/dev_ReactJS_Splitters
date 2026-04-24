import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  SplitterCliente,
  SplitterPortState,
} from '@/features/splitters/model/splitterCliente'
import type { GeogridReservaRow } from '@/features/splitters/model/geogridReservaRow'
import {
  User,
  ArrowRight,
  Activity,
  Hash,
  Lock,
  Building2,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type SplitterClientesListProps = {
  clientes: SplitterCliente[]
  capacity: number
  geogridRows?: GeogridReservaRow[]
  portStates?: SplitterPortState[]
}

function formatReservaDias(dataReserva: string | null): string {
  if (!dataReserva) return 'Sem data de reserva'
  const start = new Date(dataReserva)
  if (Number.isNaN(start.getTime())) return 'Sem data de reserva'
  const diffMs = Date.now() - start.getTime()
  const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  return `${days} ${days === 1 ? 'dia' : 'dias'} em reserva`
}

function formatReservaNome(row: GeogridReservaRow): string {
  if (row.clienteNome) return row.clienteNome
  if (row.idCliente) return `ID ${row.idCliente}`
  return 'Sem cliente informado'
}

function statusLabel(status: number): string {
  return status === 1 ? 'Ativo' : 'Inativo'
}

function ReservaBadge({ reserva }: { reserva: GeogridReservaRow }) {
  return (
    <div className="absolute right-3 top-3 z-10 w-44 rounded-xl border border-amber-300/60 bg-amber-50/95 px-2.5 py-2 shadow-sm backdrop-blur-[1px]">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-amber-700">
        <Lock size={10} />
        Porta reservada
      </div>
      <p className="mt-1 truncate text-[10px] font-bold text-amber-900">
        {formatReservaNome(reserva)}
      </p>
      <p className="text-[9px] font-medium text-amber-700">
        {formatReservaDias(reserva.dataReserva)}
      </p>
    </div>
  )
}

function PortBlockIndicator({ block }: { block: SplitterPortState }) {
  const description =
    block.blockedDescription?.trim() || 'Porta bloqueada sem descrição informada.'

  return (
    <div className="group/lock relative">
      <span
        className="inline-flex cursor-help items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700"
        title={description}
        aria-label={`Porta bloqueada. ${description}`}
      >
        <Lock size={11} />
        Bloqueio
      </span>

      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-rose-200 bg-white p-3 text-left shadow-lg group-hover/lock:block">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-700">
          <Lock size={11} />
          Porta com bloqueio
        </div>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-700">
          {description}
        </p>
      </div>
    </div>
  )
}

export function SplitterClientesList({
  clientes,
  capacity,
  geogridRows = [],
  portStates = [],
}: SplitterClientesListProps) {
  const [corporateOnly, setCorporateOnly] = useState(false)
  const ports = Array.from({ length: capacity }, (_, i) => i + 1)

  const clientsByPort = clientes.reduce((acc, c) => {
    if (c.port !== null) acc[c.port] = c
    return acc
  }, {} as Record<number, SplitterCliente>)
  const reservaByPort = geogridRows.reduce((acc, row) => {
    acc[row.porta] = row
    return acc
  }, {} as Record<number, GeogridReservaRow>)
  const blockByPort = portStates.reduce((acc, row) => {
    acc[row.port] = row
    return acc
  }, {} as Record<number, SplitterPortState>)

  const corporateCount = useMemo(
    () => clientes.filter((c) => c.isCorporate).length,
    [clientes],
  )

  const visiblePorts = corporateOnly
    ? ports.filter((portNum) => {
        const cl = clientsByPort[portNum]
        return !cl || cl.isCorporate
      })
    : ports

  return (
    <section aria-labelledby="splitter-clientes-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
            <User size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Clientes e portas
            </p>
            <h2
              id="splitter-clientes-heading"
              className="mt-0.5 text-lg font-semibold tracking-tight text-on-surface md:text-xl"
            >
              Mapeamento de portas
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant shadow-sm">
            <span className="tabular-nums text-on-surface">{clientes.length}</span> ocupadas
          </div>
          <div className="rounded-md border border-primary/25 bg-primary/[0.07] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary shadow-sm">
            <span className="tabular-nums">{capacity - clientes.length}</span> livres
          </div>
          {corporateCount > 0 ? (
            <div className="rounded-md border border-violet-200 bg-violet-50/90 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-900 shadow-sm">
              <span className="tabular-nums">{corporateCount}</span> corporativos
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCorporateOnly((v) => !v)}
            disabled={corporateCount === 0}
            title={
              corporateCount === 0
                ? 'Nenhum cliente corporativo neste splitter.'
                : undefined
            }
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm transition-colors',
              corporateCount === 0
                ? 'cursor-not-allowed border-outline-variant/50 bg-slate-50 text-on-surface-variant/50'
                : corporateOnly
                  ? 'border-violet-400 bg-violet-600 text-white'
                  : 'border-outline-variant bg-white text-on-surface-variant hover:border-violet-300 hover:bg-violet-50/50',
            )}
          >
            {corporateOnly ? 'Ver todos' : 'Só corporativos'}
          </button>
        </div>
      </div>

      {corporateOnly ? (
        <p className="text-[11px] font-medium text-on-surface-variant/80">
          Exibindo apenas portas livres ou com cliente corporativo. Demais portas ocupadas ficam ocultas neste modo.
        </p>
      ) : null}

      <ul className="grid gap-3 md:auto-rows-fr md:grid-cols-2">
        {visiblePorts.map((portNum) => {
          const c = clientsByPort[portNum]
          const reserva = reservaByPort[portNum]
          const blocked = blockByPort[portNum]
          const hasReservaNoCard = reserva?.hasReserva === true
          const hasBlock = blocked?.blocked === true

          if (!c) {
            return (
              <li
                key={`empty-port-${portNum}`}
                className="group relative flex min-h-[122px] flex-col justify-between rounded-xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/25 p-3 transition-all duration-200 hover:border-outline-variant hover:bg-surface-container-low/40 md:h-full"
              >
                {hasReservaNoCard && reserva && <ReservaBadge reserva={reserva} />}

                <div className={cn('min-w-0 flex-1', hasReservaNoCard && 'pr-44')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-outline-variant bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                      Porta {portNum}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-outline-variant/50 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/45">
                      Livre
                    </span>
                    {hasBlock && blocked ? <PortBlockIndicator block={blocked} /> : null}
                  </div>

                  <h3 className="mt-3 text-sm font-black uppercase tracking-widest text-on-surface-variant/45">
                    Porta disponível
                  </h3>
                  <p className="mt-1 text-[11px] font-medium text-on-surface-variant/35">
                    Sem conexão ativa nesta porta.
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-outline-variant/30 pt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/65">
                    Porta {portNum} livre
                  </div>
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/55">
                    Perfil
                    <ArrowRight size={14} />
                  </span>
                </div>
              </li>
            )
          }

          return (
            <li
              key={`${c.authenticationId}-${c.clientId}`}
              className="group relative flex min-h-[122px] flex-col justify-between rounded-xl border border-outline-variant bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md md:h-full"
            >
              {hasReservaNoCard && reserva && <ReservaBadge reserva={reserva} />}

                <div className={cn('min-w-0 flex-1', hasReservaNoCard && 'pr-44')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Porta {portNum}
                    </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                      c.status === 1
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-700',
                    )}
                    >
                      <Activity size={11} />
                      {statusLabel(c.status)}
                    </span>
                    {hasBlock && blocked ? <PortBlockIndicator block={blocked} /> : null}
                    {c.isCorporate ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                        <Building2 size={11} strokeWidth={2} />
                        Corporativo
                      </span>
                    ) : null}
                  </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/clientes/${c.authenticationId}`}
                      className="block text-sm font-bold leading-tight text-on-surface transition-colors hover:text-primary"
                    >
                      <span className="line-clamp-2">{c.name || c.user || '-'}</span>
                    </Link>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-on-surface-variant/65">
                      <Hash size={12} className="text-primary" />
                      <span className="truncate font-mono">{c.user}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-outline-variant/40 pt-2">
                <div className="min-w-0 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/75">
                  {c.accessPoint ? `AP ${c.accessPoint.code} · ${c.user}` : `Cliente ${c.user ?? 'sem login'}`}
                </div>
                <Link
                  to={`/clientes/${c.authenticationId}`}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-primary transition-all hover:gap-3"
                >
                  Perfil
                  <ArrowRight size={14} />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

