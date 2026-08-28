import { Radio, RefreshCw, Thermometer, Ruler, Gauge, AlertTriangle, Zap, WifiOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useOnuDiagnostic } from '@/features/onu/hooks/useOnuDiagnostic'
import { useProjectedSignal } from '@/features/onu/hooks/useProjectedSignal'
import { OnuStatusBadge } from '@/features/onu/ui/OnuStatusBadge'
import {
  deriveAttenuation,
  deriveOnuSignalStatus,
  deriveTempLevel,
  formatAgo,
  isNoOpticalSignal,
  ATTENUATION_MAX_MARGIN_DB,
  RX_POWER_CRITICAL_DBM,
  ONU_TEMP_WARM_C,
  ONU_TEMP_HOT_C,
  type OnuSignalStatus,
} from '@/features/onu/model/onuDiagnostic'

type ClienteDetailOnuSectionProps = {
  /** Usuário PPPoE do cliente (= cliente.user). */
  username: string
  /** Nome do cliente (= cliente.name) — chave do sinal projetado na GeoGrid. */
  clientName?: string | null
}

function fmtDbm(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)} dBm`
}

function fmtDistance(meters: number | null): string {
  if (meters === null) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

function fmtTemp(celsius: number | null): string {
  return celsius === null ? '—' : `${celsius.toFixed(1)} °C`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

/** Mapeia rxPower (-40..0 dBm) para 0..100% de "força" para a barra visual. */
function rxPowerToPercent(rxPower: number | null): number {
  if (rxPower === null) return 0
  const clamped = Math.max(-40, Math.min(0, rxPower))
  return Math.round(((clamped + 40) / 40) * 100)
}

const BAR_COLOR: Record<OnuSignalStatus, string> = {
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-rose-500',
  unknown: 'bg-slate-400',
}

function Metric({
  label,
  value,
  icon: Icon,
  valueClassName,
  breakAll,
}: {
  label: string
  value: string
  icon?: typeof Gauge
  valueClassName?: string
  breakAll?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
        {Icon ? <Icon size={12} strokeWidth={1.75} /> : null}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-semibold tabular-nums leading-snug text-on-surface',
          breakAll && 'break-all font-mono text-xs tracking-normal',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  )
}

const TEMP_VALUE_CLASS: Record<ReturnType<typeof deriveTempLevel>, string> = {
  hot: 'text-orange-600 dark:text-orange-300',
  warm: 'text-amber-600 dark:text-amber-300',
  ok: 'text-on-surface',
  unknown: 'text-on-surface',
}

/**
 * Painel de diagnóstico da ONU do cliente (sinal, estado e hardware), com
 * polling automático. Estruturado para receber, na Fase 2, o sinal projetado
 * da porta e exibir o comparativo de atenuação.
 */
export function ClienteDetailOnuSection({
  username,
  clientName,
}: ClienteDetailOnuSectionProps) {
  const query = useOnuDiagnostic(username)
  const projectedQuery = useProjectedSignal(clientName)

  // Mescla o projetado (Fase 2) no diagnóstico para o comparativo de atenuação.
  // Quando `ambiguous === true` (possível homônimo), não passamos o projetado
  // para evitar disparar um alarme de atenuação potencialmente falso.
  const projectedData = projectedQuery.data
  const projectedRxPower =
    projectedData?.ambiguous ? null : (projectedData?.projectedRxPower ?? null)
  const diagnostic = query.data
    ? { ...query.data, projectedRxPower }
    : null

  const status = deriveOnuSignalStatus(diagnostic)
  const attenuation = deriveAttenuation(diagnostic)
  const noSignal = isNoOpticalSignal(diagnostic)
  // 0.0 dBm = sem luz: barra vazia (não 100%, que rxPowerToPercent daria para 0).
  const pct = noSignal ? 0 : rxPowerToPercent(diagnostic?.rxPower ?? null)
  const tempLevel = deriveTempLevel(diagnostic?.temperature ?? null)
  const statusFreshness = formatAgo(diagnostic?.statusSeenAgeSeconds ?? null)
  const offlineSince = formatAgo(diagnostic?.lastOffAgeSeconds ?? null)

  const offlineReason: 'power_fail' | 'loss_signal' | null = (() => {
    if (status !== 'offline') return null
    const fields = [diagnostic?.oltOnuStatus, diagnostic?.calculatedStatus, diagnostic?.rxGood]
      .map((v) => (v ?? '').trim().toLowerCase())
    if (fields.some((v) => v === 'power_fail')) return 'power_fail'
    if (fields.some((v) => v === 'loss_signal')) return 'loss_signal'
    return null
  })()

  return (
    <section
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-onu-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
            <Radio size={18} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Monitoramento
            </p>
            <h2
              id="cliente-detail-onu-heading"
              className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
            >
              Diagnóstico da ONU
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <OnuStatusBadge diagnostic={diagnostic} loading={query.isPending} />
          {query.isFetching && !query.isPending ? (
            <RefreshCw size={13} className="animate-spin text-on-surface-variant/40" aria-label="Atualizando" />
          ) : null}
        </div>
      </div>

      {query.isPending ? (
        <p className="mt-4 text-xs text-on-surface-variant/65">Consultando monitoramento da ONU…</p>
      ) : !diagnostic ? (
        <p className="mt-4 text-xs leading-relaxed text-on-surface-variant/75">
          Sem dados de ONU para o usuário <span className="font-mono">{username}</span> na
          plataforma de monitoramento.
        </p>
      ) : (
        <>
          {/* Alerta de atenuação: sinal atual muito abaixo do projetado. */}
          {attenuation.level === 'critical' || attenuation.level === 'warning' ? (
            <div
              className={cn(
                'mt-4 flex items-start gap-2.5 rounded-xl border p-3',
                attenuation.level === 'critical'
                  ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                  : 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200',
              )}
              role="alert"
            >
              <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wide">
                  {attenuation.level === 'critical' ? 'Atenuação crítica' : 'Atenuação acima da margem'}
                </p>
                <p className="mt-0.5">
                  Sinal atual <span className="font-semibold tabular-nums">{fmtDbm(diagnostic.rxPower)}</span> está{' '}
                  <span className="font-semibold tabular-nums">{attenuation.deltaDb?.toFixed(2)} dB</span> abaixo do
                  projetado <span className="font-semibold tabular-nums">{fmtDbm(diagnostic.projectedRxPower)}</span>{' '}
                  (margem de {ATTENUATION_MAX_MARGIN_DB} dB). Verificar fibra/emendas/porta.
                </p>
              </div>
            </div>
          ) : null}

          {/* Alerta térmico: ONU operando acima da faixa recomendada. */}
          {tempLevel === 'hot' || tempLevel === 'warm' ? (
            <div
              className={cn(
                'mt-4 flex items-start gap-2.5 rounded-xl border p-3',
                tempLevel === 'hot'
                  ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-200'
                  : 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200',
              )}
              role="alert"
            >
              <Thermometer size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wide">
                  {tempLevel === 'hot' ? 'Temperatura crítica' : 'Temperatura elevada'}
                </p>
                <p className="mt-0.5">
                  ONU operando a{' '}
                  <span className="font-semibold tabular-nums">{fmtTemp(diagnostic.temperature)}</span>
                  {tempLevel === 'hot'
                    ? ` (≥ ${ONU_TEMP_HOT_C} °C) — risco térmico de falha de hardware. Verificar ventilação/posicionamento do equipamento.`
                    : ` (≥ ${ONU_TEMP_WARM_C} °C) — acima da faixa ideal. Monitorar.`}
                </p>
              </div>
            </div>
          ) : null}

          {/* Motivo do offline: power_fail ou loss_signal reportado pela OLT. */}
          {offlineReason === 'power_fail' ? (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-orange-300 bg-orange-50 dark:bg-orange-950/40 p-3 text-orange-800 dark:text-orange-200"
              role="alert"
            >
              <Zap size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wide">Falha de energia</p>
                <p className="mt-0.5">
                  ONU sem alimentação elétrica no local. Verificar energia no ponto do cliente.
                </p>
              </div>
            </div>
          ) : offlineReason === 'loss_signal' ? (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 text-rose-800 dark:text-rose-200"
              role="alert"
            >
              <WifiOff size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wide">Perda de sinal óptico</p>
                <p className="mt-0.5">
                  Sem luz na fibra — verificar emendas, conectores ou roteamento da fibra até o cliente.
                </p>
              </div>
            </div>
          ) : null}

          {/* Barra de força do sinal de recepção (lado ONU). */}
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              <span className="min-w-0">Sinal de recepção (RX) — ONU</span>
              <span className="shrink-0 tabular-nums text-on-surface">
                {noSignal ? 'Sem sinal' : fmtDbm(diagnostic.rxPower)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all', BAR_COLOR[status])}
                style={{ width: `${pct}%` }}
              />
            </div>
            {noSignal ? (
              <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                Sem sinal óptico (0.0 dBm / LOS) — ONU sem luz: possível queda, falta de energia
                ou problema na fibra. O estado pode levar minutos para consolidar no monitoramento.
              </p>
            ) : diagnostic.rxPower !== null && diagnostic.rxPower <= RX_POWER_CRITICAL_DBM ? (
              <p className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
                Sinal abaixo do limite recomendado — verificar atenuação na fibra/porta.
              </p>
            ) : null}
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="RX OLT" value={fmtDbm(diagnostic.oltOltRxPower)} icon={Gauge} />
            <Metric label="TX (ONU)" value={fmtDbm(diagnostic.txPower)} icon={Gauge} />
            <Metric
              label="Temperatura"
              value={fmtTemp(diagnostic.temperature)}
              icon={Thermometer}
              valueClassName={TEMP_VALUE_CLASS[tempLevel]}
            />
            <Metric label="Distância da OLT" value={fmtDistance(diagnostic.distance)} icon={Ruler} />
            <Metric label="Modelo da ONU" value={diagnostic.onuModel ?? '—'} breakAll />
            <Metric label="OLT" value={diagnostic.oltHostname ?? '—'} breakAll />
            <Metric
              label="PON link"
              value={diagnostic.ponlink ?? diagnostic.relatedPonlink ?? '—'}
              breakAll
            />
            <Metric label="MAC" value={diagnostic.mac ?? '—'} breakAll />
            <Metric
              label="Serial"
              value={diagnostic.serialNumber ?? diagnostic.relatedSerialNumber ?? '—'}
              breakAll
            />
          </dl>

          {/* Fonte Zabbix (quando divergir/complementar a leitura da OLT). */}
          {(diagnostic.zabbixOnuRxPower !== null || diagnostic.zabbixOltRxPower !== null) && (
            <dl className="mt-3 grid gap-3 border-t border-outline-variant/40 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="RX ONU (Zabbix)" value={fmtDbm(diagnostic.zabbixOnuRxPower)} />
              <Metric label="RX OLT (Zabbix)" value={fmtDbm(diagnostic.zabbixOltRxPower)} />
            </dl>
          )}

          {/* Comparativo com o sinal projetado da porta (GeoGrid). */}
          <div
            className={cn(
              'mt-4 grid gap-3 rounded-xl border px-3 py-2.5 sm:grid-cols-3',
              attenuation.level === 'critical'
                ? 'border-rose-200 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-950/40'
                : attenuation.level === 'warning'
                  ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/40'
                  : 'border-outline-variant/60 bg-surface-container-low/30',
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                Sinal projetado da porta
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">
                {projectedQuery.isPending
                  ? '…'
                  : projectedData?.projectedRxPower != null
                    ? fmtDbm(projectedData.projectedRxPower)
                    : 'Sem projeção na GeoGrid'}
              </p>
              {projectedData?.ambiguous ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-200">
                  <AlertTriangle size={11} strokeWidth={2} className="shrink-0" />
                  Múltiplos registros — confirmar manualmente
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                Diferença (atual vs projetado)
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">
                {attenuation.deltaDb !== null ? `${attenuation.deltaDb.toFixed(2)} dB` : '—'}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
                Perda projetada do enlace
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-on-surface">
                {projectedQuery.data?.lossTotal != null
                  ? `${projectedQuery.data.lossTotal.toFixed(2)} dB`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Frescor: o STATUS up/down é near-real-time (trap); as MÉTRICAS
              (rxPower etc.) são lidas em ciclos mais longos. Separados para não
              passar a impressão de dado velho. */}
          <div className="mt-3 flex flex-col items-start gap-1.5 text-[11px] text-on-surface-variant/55 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            {statusFreshness ? (
              <span className="inline-flex items-center gap-1 font-medium text-on-surface-variant/75">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    status === 'offline' ? 'bg-rose-500' : 'bg-emerald-500',
                  )}
                />
                Status verificado {statusFreshness}
              </span>
            ) : null}
            {status === 'offline' && offlineSince ? (
              <span className="text-rose-600 dark:text-rose-300">Offline desde {offlineSince}</span>
            ) : null}
            <span>Métricas lidas em {fmtDateTime(diagnostic.statusUpdatedAt)}</span>
          </div>
        </>
      )}
    </section>
  )
}
