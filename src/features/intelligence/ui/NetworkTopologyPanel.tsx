import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Cpu,
  Layers,
  Network,
  Radio,
  Server,
  TrendingUp,
  Users,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatOltLabel } from '@/features/splitters/lib/formatOltLabel'
import { useOnuSummaryBySplitter } from '@/features/onu/hooks/useOnuSummaryBySplitter'
import type {
  TopologyMetrics,
  TopologyOltNode,
  TopologyPonNode,
  TopologyRiskBand,
  TopologySlotNode,
} from '@/features/intelligence/lib/buildNetworkTopology'

type NetworkTopologyPanelProps = {
  topology: TopologyOltNode[]
  /** Rótulo do delta de referência ativo (Δ7d / Δ30d). */
  deltaReferenceLabel: string
}

/** Mesma nomenclatura de OLT dos cards de splitter (ex.: "BNG_01_SPSCE_NE8K" → "OLT 01 - SPSCE"). */
function oltDisplayLabel(oltDescription: string): string {
  return formatOltLabel(oltDescription) ?? oltDescription
}

const BAND_LABEL: Record<TopologyRiskBand, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  moderado: 'Moderado',
  baixo: 'Baixo',
}

function bandBadgeClass(band: TopologyRiskBand): string {
  switch (band) {
    case 'critico':
      return 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
    case 'alto':
      return 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
    case 'moderado':
      return 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200'
    default:
      return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
  }
}

function usageBarClass(usage: number): string {
  if (usage >= 95) return 'bg-rose-500'
  if (usage >= 85) return 'bg-amber-500'
  if (usage >= 70) return 'bg-sky-500'
  return 'bg-emerald-500'
}

function formatDelta(value: number): string {
  if (value === 0) return '0,0 pp'
  const fixed = Math.abs(value).toFixed(1).replace('.', ',')
  return `${value > 0 ? '+' : '−'}${fixed} pp`
}

/** Faixas de RX alinhadas ao ONU_BUCKET_CASE do BFF (−25 atenuado · −28 crítico). */
function rxTextClass(rx: number): string {
  if (rx <= -28) return 'text-rose-700 dark:text-rose-200'
  if (rx <= -25) return 'text-amber-700 dark:text-amber-200'
  return 'text-emerald-700 dark:text-emerald-200'
}

function formatRx(rx: number | null): string {
  if (rx == null) return '—'
  return `${rx.toFixed(1).replace('.', ',')} dBm`
}

/** Mini-barra empilhada de saúde de sinal (online · atenuado · offline). */
function SignalHealthBar({
  online,
  degraded,
  offline,
}: {
  online: number
  degraded: number
  offline: number
}) {
  const total = online + degraded + offline
  if (total <= 0) return null
  const pct = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
      {online > 0 ? <div className="h-full bg-emerald-500" style={{ width: pct(online) }} /> : null}
      {degraded > 0 ? <div className="h-full bg-amber-500" style={{ width: pct(degraded) }} /> : null}
      {offline > 0 ? <div className="h-full bg-rose-500" style={{ width: pct(offline) }} /> : null}
    </div>
  )
}

/** Linha de métricas compacta reutilizada em cada card de nó. */
function NodeMetrics({
  metrics,
  deltaReferenceLabel,
}: {
  metrics: TopologyMetrics
  deltaReferenceLabel: string
}) {
  return (
    <>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
          <span>Ocupação (média · máx)</span>
          <span className="tabular-nums text-on-surface">
            {metrics.avgUsagePercent.toFixed(1)}% · {metrics.maxUsagePercent.toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
          <div
            className={cn('h-full rounded-full transition-all', usageBarClass(metrics.maxUsagePercent))}
            style={{ width: `${Math.min(100, Math.max(2, metrics.maxUsagePercent))}%` }}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <Cpu className="size-3.5 text-on-surface-variant/60" aria-hidden />
          {metrics.splitters} splitters
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle
            className={cn('size-3.5', metrics.criticalSplitters > 0 ? 'text-rose-500' : 'text-on-surface-variant/60')}
            aria-hidden
          />
          {metrics.criticalSplitters} críticos
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="size-3.5 text-on-surface-variant/60" aria-hidden />
          {deltaReferenceLabel} {formatDelta(metrics.avgDeltaReference)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Activity
            className={cn('size-3.5', metrics.openTickets > 0 ? 'text-amber-500' : 'text-on-surface-variant/60')}
            aria-hidden
          />
          {metrics.openTickets} massivas abertas
        </span>
        {metrics.affectedClientsTotal > 0 ? (
          <span className="col-span-2 inline-flex items-center gap-1 text-on-surface-variant">
            <Users className="size-3.5 text-on-surface-variant/60" aria-hidden />
            {metrics.affectedClientsTotal} clientes impactados no período
          </span>
        ) : null}
      </div>
      {metrics.monitoredOnus > 0 ? (
        <div className="mt-3 border-t border-slate-100 dark:border-white/5 pt-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <Radio className="size-3.5 text-on-surface-variant/60" aria-hidden />
              RX médio
            </span>
            <span className={cn('tabular-nums', metrics.avgRxPower != null ? rxTextClass(metrics.avgRxPower) : 'text-on-surface-variant/60')}>
              {formatRx(metrics.avgRxPower)}
            </span>
          </div>
          <div className="mt-1.5">
            <SignalHealthBar
              online={metrics.onlineOnus}
              degraded={metrics.degradedOnus}
              offline={metrics.offlineOnus}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-on-surface-variant">
            <span>{metrics.monitoredOnus} ONUs monitoradas</span>
            <span>
              <span className="text-emerald-600 dark:text-emerald-300">{metrics.onlineOnus}</span>
              {' · '}
              <span className="text-amber-600 dark:text-amber-300">{metrics.degradedOnus}</span>
              {' · '}
              <span className="text-rose-600 dark:text-rose-300">{metrics.offlineOnus}</span>
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}

type NodeCardProps = {
  icon: typeof Server
  title: string
  subtitle?: string
  metrics: TopologyMetrics
  deltaReferenceLabel: string
  onClick?: () => void
  /** Sem drill-down (nível folha) — não mostra a seta nem vira botão. */
  leaf?: boolean
}

function NodeCard({ icon: Icon, title, subtitle, metrics, deltaReferenceLabel, onClick, leaf }: NodeCardProps) {
  const interactive = !leaf && onClick != null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'group flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-surface-container-lowest p-4 text-left shadow-sm transition',
        interactive ? 'hover:border-primary/40 hover:shadow-md' : 'cursor-default',
        metrics.worstRiskBand === 'critico' ? 'ring-1 ring-rose-200 dark:ring-rose-800/50' : null,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-on-surface">{title}</p>
            {subtitle ? <p className="truncate text-[10px] font-medium text-on-surface-variant">{subtitle}</p> : null}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
            bandBadgeClass(metrics.worstRiskBand),
          )}
        >
          {BAND_LABEL[metrics.worstRiskBand]}
        </span>
      </div>
      <NodeMetrics metrics={metrics} deltaReferenceLabel={deltaReferenceLabel} />
      {interactive ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 transition group-hover:opacity-100">
          Abrir <ChevronRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </button>
  )
}

function Crumb({ label, onClick, active }: { label: string; onClick?: () => void; active?: boolean }) {
  if (active || !onClick) {
    return <span className="font-black text-on-surface">{label}</span>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-primary transition hover:underline"
    >
      {label}
    </button>
  )
}

function gridClass(): string {
  return 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
}

export function NetworkTopologyPanel({ topology, deltaReferenceLabel }: NetworkTopologyPanelProps) {
  const [oltCode, setOltCode] = useState<string | null>(null)
  const [slotKey, setSlotKey] = useState<string | null>(null)
  const [ponKey, setPonKey] = useState<string | null>(null)

  // Mapa de sinal por código (compartilhado/deduplicado com o hook de inteligência).
  const signalByCode = useOnuSummaryBySplitter().data

  const selectedOlt = useMemo<TopologyOltNode | null>(
    () => (oltCode == null ? null : topology.find((o) => o.accessPointCode === oltCode) ?? null),
    [topology, oltCode],
  )
  const selectedSlot = useMemo<TopologySlotNode | null>(
    () => (selectedOlt == null || slotKey == null ? null : selectedOlt.slots.find((s) => s.slot === slotKey) ?? null),
    [selectedOlt, slotKey],
  )
  const selectedPon = useMemo<TopologyPonNode | null>(
    () => (selectedSlot == null || ponKey == null ? null : selectedSlot.pons.find((p) => p.pon === ponKey) ?? null),
    [selectedSlot, ponKey],
  )

  const goRoot = () => {
    setOltCode(null)
    setSlotKey(null)
    setPonKey(null)
  }
  const goOlt = (code: string) => {
    setOltCode(code)
    setSlotKey(null)
    setPonKey(null)
  }
  const goSlot = (key: string) => {
    setSlotKey(key)
    setPonKey(null)
  }

  const slotLabel = (slot: TopologySlotNode) => (slot.hasSlot ? `Slot ${slot.slot}` : 'Slot não informado')
  const ponLabel = (pon: TopologyPonNode) => (pon.hasPon ? `PON ${pon.pon}` : 'PON não informada')

  // Frase extra de sinal quando o RX médio do nó indica atenuação/criticidade.
  const signalNote = (node: { avgRxPower: number | null; degradedOnus: number; offlineOnus: number }): string => {
    if (node.avgRxPower != null && node.avgRxPower <= -25) {
      return ` Atenção ao sinal: RX médio ${node.avgRxPower.toFixed(1).replace('.', ',')} dBm.`
    }
    if (node.offlineOnus > 0 || node.degradedOnus > 0) {
      return ` Sinal: ${node.degradedOnus} atenuada(s) e ${node.offlineOnus} offline.`
    }
    return ''
  }

  // Narrativa contextual: aponta o nó de maior pressão no nível atual.
  const narrative = useMemo(() => {
    if (selectedPon) {
      const worst = selectedPon.rows[0]
      if (!worst) return 'Nenhum splitter nesta PON no recorte atual.'
      return `${selectedPon.splitters} splitter(s) nesta PON. Pior caso: ${worst.splitterTitle || worst.splitterCode} com ${worst.currentUsagePercent.toFixed(1)}% de ocupação.${signalNote(selectedPon)}`
    }
    if (selectedSlot) {
      const worstPon = selectedSlot.pons[0]
      if (!worstPon) return 'Sem PONs neste slot.'
      return `${selectedSlot.pons.length} PON(s) neste slot. A que mais pressiona é ${ponLabel(worstPon)} (ocupação máx ${worstPon.maxUsagePercent.toFixed(1)}%, ${worstPon.criticalSplitters} crítico(s)).${signalNote(selectedSlot)}`
    }
    if (selectedOlt) {
      const worstSlot = selectedOlt.slots[0]
      if (!worstSlot) return 'Sem slots nesta OLT.'
      return `${selectedOlt.slots.length} slot(s) nesta OLT. Comece pelo ${slotLabel(worstSlot)} (${worstSlot.criticalSplitters} crítico(s), ocupação máx ${worstSlot.maxUsagePercent.toFixed(1)}%).${signalNote(selectedOlt)}`
    }
    if (topology.length === 0) return 'Nenhum equipamento no recorte filtrado.'
    const worst = topology[0]
    const totalCritical = topology.reduce((s, o) => s + o.criticalSplitters, 0)
    return `${topology.length} OLT(s) no recorte · ${totalCritical} splitter(s) crítico(s). Maior pressão hoje: ${oltDisplayLabel(worst.accessPointTitle)} (${worst.criticalSplitters} crítico(s)).`
  }, [topology, selectedOlt, selectedSlot, selectedPon])

  return (
    <div className="space-y-4">
      {/* Breadcrumb + narrativa */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-50 dark:from-white/5 to-white dark:to-surface-container-lowest p-4">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs">
          <Crumb label="Todas as OLTs" onClick={goRoot} active={!selectedOlt} />
          {selectedOlt ? (
            <>
              <ChevronRight className="size-3.5 text-on-surface-variant/60" aria-hidden />
              <Crumb
                label={oltDisplayLabel(selectedOlt.accessPointTitle)}
                onClick={() => goOlt(selectedOlt.accessPointCode)}
                active={!selectedSlot}
              />
            </>
          ) : null}
          {selectedSlot ? (
            <>
              <ChevronRight className="size-3.5 text-on-surface-variant/60" aria-hidden />
              <Crumb label={slotLabel(selectedSlot)} onClick={() => goSlot(selectedSlot.slot)} active={!selectedPon} />
            </>
          ) : null}
          {selectedPon ? (
            <>
              <ChevronRight className="size-3.5 text-on-surface-variant/60" aria-hidden />
              <Crumb label={ponLabel(selectedPon)} active />
            </>
          ) : null}
        </nav>
        <p className="mt-2 text-sm font-medium text-on-surface-variant">{narrative}</p>
      </div>

      {/* Nível 0 — OLTs */}
      {!selectedOlt ? (
        topology.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 dark:border-white/10 bg-surface-container-low/80 py-10 text-center text-sm text-on-surface-variant">
            Sem dados de topologia no recorte filtrado.
          </p>
        ) : (
          <motion.div
            key="olts"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={gridClass()}
          >
            {topology.map((olt) => (
              <NodeCard
                key={olt.accessPointCode}
                icon={Server}
                title={oltDisplayLabel(olt.accessPointTitle)}
                subtitle={undefined}
                metrics={olt}
                deltaReferenceLabel={deltaReferenceLabel}
                onClick={() => goOlt(olt.accessPointCode)}
              />
            ))}
          </motion.div>
        )
      ) : null}

      {/* Nível 1 — Slots da OLT */}
      {selectedOlt && !selectedSlot ? (
        <motion.div
          key={`slots-${selectedOlt.accessPointCode}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={gridClass()}
        >
          {selectedOlt.slots.map((slot) => (
            <NodeCard
              key={slot.slot}
              icon={Layers}
              title={slotLabel(slot)}
              metrics={slot}
              deltaReferenceLabel={deltaReferenceLabel}
              onClick={() => goSlot(slot.slot)}
            />
          ))}
        </motion.div>
      ) : null}

      {/* Nível 2 — PONs do Slot */}
      {selectedSlot && !selectedPon ? (
        <motion.div
          key={`pons-${selectedOlt?.accessPointCode}-${selectedSlot.slot}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={gridClass()}
        >
          {selectedSlot.pons.map((pon) => (
            <NodeCard
              key={pon.pon}
              icon={Network}
              title={ponLabel(pon)}
              metrics={pon}
              deltaReferenceLabel={deltaReferenceLabel}
              onClick={() => setPonKey(pon.pon)}
            />
          ))}
        </motion.div>
      ) : null}

      {/* Nível 3 — Splitters da PON */}
      {selectedPon ? (
        <motion.div
          key={`splitters-${selectedPon.pon}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-2"
        >
          {selectedPon.rows.map((row) => (
            <Link
              key={row.splitterCode}
              to={`/splitters/${encodeURIComponent(row.splitterCode)}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-surface-container-lowest p-3.5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">
                  {row.splitterTitle || row.splitterCode}
                </p>
                <p className="font-mono text-[10px] text-on-surface-variant">{row.splitterCode}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {(() => {
                  const sig = signalByCode?.get(row.splitterCode)
                  if (!sig || sig.total <= 0) return null
                  return (
                    <div className="hidden text-right sm:block">
                      <p
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-bold tabular-nums',
                          sig.avgRxPower != null ? rxTextClass(sig.avgRxPower) : 'text-on-surface-variant/60',
                        )}
                      >
                        <Radio className="size-3.5" aria-hidden />
                        {formatRx(sig.avgRxPower)}
                      </p>
                      <p className="text-[10px] font-medium text-on-surface-variant">
                        <span className="text-emerald-600 dark:text-emerald-300">{sig.online}</span>
                        {' · '}
                        <span className="text-amber-600 dark:text-amber-300">{sig.degraded}</span>
                        {' · '}
                        <span className="text-rose-600 dark:text-rose-300">{sig.offline}</span>
                      </p>
                    </div>
                  )
                })()}
                <div className="text-right">
                  <p className="text-sm font-black tabular-nums text-on-surface">
                    {row.currentUsagePercent.toFixed(1)}%
                  </p>
                  <p className="text-[10px] font-medium text-on-surface-variant">
                    {deltaReferenceLabel} {formatDelta(row.selectedDelta)}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    bandBadgeClass(row.riskBand),
                  )}
                >
                  {BAND_LABEL[row.riskBand]}
                </span>
                <ChevronRight className="size-4 text-on-surface-variant/60" aria-hidden />
              </div>
            </Link>
          ))}
        </motion.div>
      ) : null}
    </div>
  )
}
