import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Filter, MapPin, Radio, Search, Zap } from 'lucide-react'
import type { IntelligenceRiskRankingRow } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import type { CancellationBucket } from '@/features/cancellations/model/cancellationsSummary'
import type { MassivaImpactRow } from '@/features/cancellations/model/cancellationsExtras'
import { formatOltLabel } from '@/features/splitters/lib/formatOltLabel'
import { ChurnHeatMap, type ChurnHeatPoint } from '@/features/cancellations/ui/ChurnHeatMap'

type OnuLite = { total: number; degraded: number; offline: number }

type CancellationsExplorerProps = {
  riskRanking: IntelligenceRiskRankingRow[]
  bySplitter: CancellationBucket[]
  onuByCode?: Map<string, OnuLite>
  massivaImpact?: MassivaImpactRow[]
}

type ExplorerRow = {
  splitterTitle: string
  splitterCode: string
  oltLabel: string
  slot: number | null
  pon: number | null
  lat: number | null
  lng: number | null
  usage: number
  activeClients: number
  signalPct: number | null
  rede: number
  total: number
  postMassivaRede: number
}

const SIGNAL_MIN_SAMPLE = 5

function norm(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function ratePer100(rede: number, base: number): number | null {
  return base > 0 ? (rede / base) * 100 : null
}

export function CancellationsExplorer({
  riskRanking,
  bySplitter,
  onuByCode,
  massivaImpact,
}: CancellationsExplorerProps) {
  const [olt, setOlt] = useState('all')
  const [slot, setSlot] = useState('all')
  const [pon, setPon] = useState('all')
  const [search, setSearch] = useState('')

  const churnByTitle = useMemo(() => {
    const m = new Map<string, CancellationBucket>()
    for (const b of bySplitter) m.set(norm(b.key), b)
    return m
  }, [bySplitter])

  const impactByTitle = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of massivaImpact ?? []) m.set(norm(r.splitterTitle), r.redeCount)
    return m
  }, [massivaImpact])

  // Universo = rede inteira (riskRanking), com churn/sinal/massiva juntados por título/código.
  const rows = useMemo((): ExplorerRow[] => {
    return riskRanking.map((r) => {
      const churn = churnByTitle.get(norm(r.splitterTitle))
      const onu = onuByCode?.get(r.splitterCode)
      const signalPct =
        onu && onu.total >= SIGNAL_MIN_SAMPLE
          ? ((onu.degraded + onu.offline) / onu.total) * 100
          : null
      return {
        splitterTitle: r.splitterTitle || r.splitterCode,
        splitterCode: r.splitterCode,
        oltLabel: formatOltLabel(r.oltDescription ?? r.oltCode) ?? (r.oltCode || '—'),
        slot: r.oltSlot,
        pon: r.oltPort,
        lat: r.latitude,
        lng: r.longitude,
        usage: r.currentUsagePercent,
        activeClients: r.activeClients,
        signalPct,
        rede: churn?.rede ?? 0,
        total: churn?.total ?? 0,
        postMassivaRede: impactByTitle.get(norm(r.splitterTitle)) ?? 0,
      }
    })
  }, [riskRanking, churnByTitle, onuByCode, impactByTitle])

  // Opções em cascata (toda a rede, para poder vasculhar qualquer ponto).
  const oltOptions = useMemo(
    () => [...new Set(rows.map((r) => r.oltLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows],
  )
  const slotOptions = useMemo(() => {
    const set = new Set<number>()
    for (const r of rows) {
      if (olt !== 'all' && r.oltLabel !== olt) continue
      if (r.slot != null) set.add(r.slot)
    }
    return [...set].sort((a, b) => a - b)
  }, [rows, olt])
  const ponOptions = useMemo(() => {
    const set = new Set<number>()
    for (const r of rows) {
      if (olt !== 'all' && r.oltLabel !== olt) continue
      if (slot !== 'all' && String(r.slot) !== slot) continue
      if (r.pon != null) set.add(r.pon)
    }
    return [...set].sort((a, b) => a - b)
  }, [rows, olt, slot])

  const filtered = useMemo(() => {
    const q = norm(search)
    return rows.filter((r) => {
      if (olt !== 'all' && r.oltLabel !== olt) return false
      if (slot !== 'all' && String(r.slot) !== slot) return false
      if (pon !== 'all' && String(r.pon) !== pon) return false
      if (q !== '') {
        const hay = `${r.splitterTitle} ${r.splitterCode} ${r.oltLabel}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, olt, slot, pon, search])

  const scope = useMemo(() => {
    let rede = 0
    let total = 0
    let active = 0
    let churnedSplitters = 0
    let postMassiva = 0
    for (const r of filtered) {
      rede += r.rede
      total += r.total
      active += r.activeClients
      if (r.rede > 0) churnedSplitters += 1
      postMassiva += r.postMassivaRede
    }
    // Mix de motivos (categorias) do recorte — soma dos buckets de churn dos splitters filtrados.
    const mix = { rede: 0, tecnico: 0, financeiro: 0, pre_instalacao: 0, mudanca: 0, operacional: 0, outros: 0 }
    for (const r of filtered) {
      const b = churnByTitle.get(norm(r.splitterTitle))
      if (!b) continue
      mix.rede += b.rede; mix.tecnico += b.tecnico; mix.financeiro += b.financeiro
      mix.pre_instalacao += b.pre_instalacao; mix.mudanca += b.mudanca
      mix.operacional += b.operacional; mix.outros += b.outros
    }
    return {
      rede, total, active, churnedSplitters, postMassiva,
      splitters: filtered.length,
      rate: ratePer100(rede, active),
      mix,
    }
  }, [filtered, churnByTitle])

  const ranking = useMemo(
    () => [...filtered].filter((r) => r.total > 0).sort((a, b) => b.rede - a.rede || b.total - a.total).slice(0, 100),
    [filtered],
  )

  const heatPoints = useMemo<ChurnHeatPoint[]>(
    () =>
      filtered
        .filter((r) => r.rede > 0 && r.lat != null && r.lng != null)
        .map((r) => ({
          splitterTitle: r.splitterTitle,
          oltLabel: r.oltLabel,
          lat: r.lat as number,
          lng: r.lng as number,
          rede: r.rede,
          total: r.total,
          usage: r.usage,
          signalPct: r.signalPct,
        })),
    [filtered],
  )

  const hasFilter = olt !== 'all' || slot !== 'all' || pon !== 'all' || search.trim() !== ''
  const clearFilters = () => {
    setOlt('all'); setSlot('all'); setPon('all'); setSearch('')
  }

  const exportCsv = () => {
    const header = ['Splitter', 'Codigo', 'OLT', 'Slot', 'PON', 'Ocupacao(%)', 'Clientes ativos', 'Sinal deg+off(%)', 'Churn rede', 'Churn total', 'Churn pos-massiva']
    const lines = ranking.map((r) =>
      [r.splitterTitle, r.splitterCode, r.oltLabel, r.slot ?? '', r.pon ?? '',
        Math.round(r.usage), r.activeClients, r.signalPct != null ? r.signalPct.toFixed(1).replace('.', ',') : '',
        r.rede, r.total, r.postMassivaRede]
        .map((v) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s })
        .join(';'),
    )
    const csv = [header.join(';'), ...lines].join('\r\n')
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `churn-explorer-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const selectCls = 'rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700'

  return (
    <div className="space-y-4">
      {/* Filtros / drill-down */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500">
          <Radio className="size-4 text-indigo-500" aria-hidden />
          Explorar a rede
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar splitter, código ou OLT…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pl-7 pr-2 text-xs text-neutral-700"
            />
          </div>
          <select value={olt} onChange={(e) => { setOlt(e.target.value); setSlot('all'); setPon('all') }} className={selectCls}>
            <option value="all">OLT: todas</option>
            {oltOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={slot} onChange={(e) => { setSlot(e.target.value); setPon('all') }} className={selectCls}>
            <option value="all">Slot: todos</option>
            {slotOptions.map((s) => <option key={s} value={String(s)}>Slot {s}</option>)}
          </select>
          <select value={pon} onChange={(e) => setPon(e.target.value)} className={selectCls}>
            <option value="all">PON: todas</option>
            {ponOptions.map((p) => <option key={p} value={String(p)}>PON {p}</option>)}
          </select>
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-lg font-bold tabular-nums text-neutral-800">{fmt(scope.churnedSplitters)}</span>
            <span className="text-[10px] leading-tight text-neutral-500">splitters<br />com churn</span>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilter}
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
              hasFilter ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
            }`}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* KPIs do recorte + mix de motivos */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Churn de rede" value={fmt(scope.rede)} tone="danger" />
          <Kpi label="Churn total" value={fmt(scope.total)} />
          <Kpi
            label="Taxa / 100 ativos"
            value={scope.rate != null ? scope.rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}
            tone={scope.rate != null && scope.rate >= 2 ? 'danger' : undefined}
          />
          <Kpi label="Pós-massiva (rede)" value={fmt(scope.postMassiva)} tone={scope.postMassiva > 0 ? 'warn' : undefined} />
        </div>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-3 lg:w-64">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Mix de motivos no recorte</p>
          {scope.total > 0 ? (
            <div className="space-y-1">
              <MixBar label="Rede/qualidade" value={scope.mix.rede} total={scope.total} color="bg-rose-500" />
              <MixBar label="Financeiro" value={scope.mix.financeiro} total={scope.total} color="bg-slate-400" />
              <MixBar label="Mudança" value={scope.mix.mudanca} total={scope.total} color="bg-violet-400" />
              <MixBar label="Técnico" value={scope.mix.tecnico} total={scope.total} color="bg-amber-500" />
              <MixBar label="Outros" value={scope.mix.pre_instalacao + scope.mix.operacional + scope.mix.outros} total={scope.total} color="bg-neutral-300" />
            </div>
          ) : (
            <p className="text-xs text-neutral-400">Sem cancelamentos no recorte.</p>
          )}
        </div>
      </div>

      {/* Mapa de calor */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm">
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
          <MapPin className="size-4 text-rose-500" aria-hidden />
          Mapa de calor — churn de rede {hasFilter ? '(recorte filtrado)' : '(rede toda)'}
        </p>
        <ChurnHeatMap points={heatPoints} />
      </div>

      {/* Ranking / drill */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Filter className="size-4 text-neutral-500" aria-hidden />
            Splitters no recorte {ranking.length > 0 ? `(top ${ranking.length})` : ''}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={ranking.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-300"
          >
            <Download className="size-3.5" aria-hidden />
            Exportar CSV
          </button>
        </div>
        <div className="max-h-[30rem] overflow-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-white">
              <tr className="border-b border-neutral-200/90 text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Splitter</th>
                <th className="px-3 py-2.5">OLT</th>
                <th className="px-3 py-2.5">Slot/PON</th>
                <th className="px-3 py-2.5 text-right">Ocup.</th>
                <th className="px-3 py-2.5 text-right">Sinal</th>
                <th className="px-3 py-2.5 text-right">Rede</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">Pós-massiva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ranking.map((r) => (
                <tr key={r.splitterCode || r.splitterTitle} className="hover:bg-neutral-50/70">
                  <td className="px-4 py-2 font-medium text-neutral-900">{r.splitterTitle}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setOlt(r.oltLabel); setSlot('all'); setPon('all') }} className="text-indigo-600 hover:underline">
                      {r.oltLabel}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-neutral-600">
                    {r.slot != null && r.pon != null ? (
                      <button type="button" onClick={() => { setOlt(r.oltLabel); setSlot(String(r.slot)); setPon(String(r.pon)) }} className="hover:underline">
                        {r.slot} / {r.pon}
                      </button>
                    ) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.usage >= 85 ? 'font-bold text-amber-700' : 'text-neutral-600'}`}>
                    {Math.round(r.usage)}%
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.signalPct != null && r.signalPct >= 15 ? 'font-bold text-rose-700' : 'text-neutral-500'}`}>
                    {r.signalPct != null ? `${r.signalPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-rose-700">{r.rede > 0 ? fmt(r.rede) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{fmt(r.total)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.postMassivaRede > 0 ? 'font-semibold text-amber-700' : 'text-neutral-400'}`}>
                    {r.postMassivaRede > 0 ? (
                      <span className="inline-flex items-center gap-1" title="Churn de rede em até 30d após massiva">
                        <Zap className="size-3" aria-hidden />{r.postMassivaRede}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Nenhum cancelamento no recorte selecionado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-1.5 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
          <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />
          Clique na OLT ou no Slot/PON para descer o recorte. "Sinal" = % de ONUs degradadas/offline; "Pós-massiva" = churn de rede em até 30 dias após uma massiva do splitter.
        </p>
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warn' }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone === 'danger' ? 'border-rose-300 bg-rose-50/70' : tone === 'warn' ? 'border-amber-300 bg-amber-50/70' : 'border-neutral-200/80 bg-white'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-neutral-900'}`}>{value}</p>
    </div>
  )
}

function MixBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-600">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-800">{value.toLocaleString('pt-BR')} ({pct}%)</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
