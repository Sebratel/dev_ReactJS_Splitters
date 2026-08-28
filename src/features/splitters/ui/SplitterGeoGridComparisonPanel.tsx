import type {
  SplitterGeoGridComparisonRow,
  SplitterGeoGridComparisonStatus,
} from '@/features/splitters/model/splitterGeoGridComparison'
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  GitCompareArrows,
  SearchX,
} from 'lucide-react'

type SplitterGeoGridComparisonPanelProps = {
  rows: readonly SplitterGeoGridComparisonRow[]
}

function statusMeta(status: SplitterGeoGridComparisonStatus): {
  label: string
  badgeClassName: string
  icon: typeof CheckCircle2
} {
  switch (status) {
    case 'match':
      return {
        label: 'Confere',
        badgeClassName: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200',
        icon: CheckCircle2,
      }
    case 'port-mismatch':
      return {
        label: 'Porta divergente',
        badgeClassName: 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-200',
        icon: GitCompareArrows,
      }
    case 'no-attendance':
      return {
        label: 'Sem atendimento',
        badgeClassName: 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200',
        icon: CircleSlash,
      }
    case 'not-found':
      return {
        label: 'Não encontrado',
        badgeClassName: 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200',
        icon: SearchX,
      }
    case 'ambiguous':
      return {
        label: 'Ambíguo',
        badgeClassName: 'border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200',
        icon: AlertTriangle,
      }
  }
}

function rowArticleClassName(status: SplitterGeoGridComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'rounded-xl border border-outline-variant/70 bg-surface-container-low/40 p-3'
    case 'port-mismatch':
      return 'rounded-xl border border-amber-200/90 dark:border-amber-800/50 border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/40 p-3 shadow-sm'
    default:
      return 'rounded-xl border border-rose-200/90 dark:border-rose-800/50 border-l-4 border-l-rose-600 bg-rose-50/55 dark:bg-rose-950/40 p-3 shadow-sm'
  }
}

/** Triângulo de alerta vermelho ao lado do nome quando não está 100% conferido. */
function RowWarningIcon({ status }: { status: SplitterGeoGridComparisonStatus }) {
  if (status === 'match') return null
  return (
    <AlertTriangle
      className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300"
      strokeWidth={2.25}
      aria-hidden
    />
  )
}

function displayPort(port: number | null): string {
  return port === null ? '—' : String(port)
}

export function SplitterGeoGridComparisonPanel({
  rows,
}: SplitterGeoGridComparisonPanelProps) {
  const matches = rows.filter((row) => row.status === 'match').length
  const mismatches = rows.filter((row) => row.status === 'port-mismatch').length
  const unresolved = rows.filter(
    (row) =>
      row.status === 'not-found' ||
      row.status === 'no-attendance' ||
      row.status === 'ambiguous',
  ).length

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
            <GitCompareArrows size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Comparativo
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-on-surface">
              Portas e GeoGrid
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/70">
              Conferência por nome dos clientes do splitter com os atendimentos retornados pela GeoGrid.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
          {matches}/{rows.length} conferem
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80">
            Conferem
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-200">
            {matches}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/80">
            Porta divergente
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-amber-700 dark:text-amber-200">
            {mismatches}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80">
            Sem resolução
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-on-surface-variant">
            {unresolved}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const meta = statusMeta(row.status)
          const Icon = meta.icon

          return (
            <article
              key={`${row.authenticationId}-${row.clientId}`}
              className={rowArticleClassName(row.status)}
              aria-label={
                row.status === 'match'
                  ? undefined
                  : `Cliente com divergência: ${meta.label}`
              }
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RowWarningIcon status={row.status} />
                    <h3 className="text-sm font-semibold tracking-tight text-on-surface">
                      {row.name || row.pppoe || 'Cliente'}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.badgeClassName}`}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-on-surface-variant/65">{row.pppoe}</p>
                </div>

                <div className="grid min-w-0 gap-2 text-xs text-on-surface-variant/75 sm:grid-cols-2 lg:min-w-[24rem]">
                  <div>
                    <span className="font-semibold uppercase tracking-wider text-on-surface-variant/55">
                      Porta Elleven
                    </span>
                    <p className="mt-1 font-mono text-sm text-on-surface">
                      {displayPort(row.splitterPort)}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase tracking-wider text-on-surface-variant/55">
                      Porta GeoGrid
                    </span>
                    <p className="mt-1 font-mono text-sm text-on-surface">
                      {displayPort(row.geogridPort)}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase tracking-wider text-on-surface-variant/55">
                      Equipamento
                    </span>
                    <p className="mt-1 truncate text-on-surface">
                      {row.geogridEquipmentSigla || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase tracking-wider text-on-surface-variant/55">
                      Cliente GeoGrid
                    </span>
                    <p className="mt-1 font-mono text-on-surface">{row.geogridClientId || '—'}</p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant/75">
                {row.note}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
