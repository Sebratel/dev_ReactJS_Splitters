import { Link } from 'react-router-dom'
import type { GmudPlatformIndicators } from '@/features/gmud/api/gmudIndicators'
import { BarList, Heatmap, Panel, PlatformPending } from '@/features/gmud/ui/indicators/IndicatorPrimitives'
import { COLORS, formatHours } from '@/features/gmud/ui/indicators/indicatorTheme'

function Funnel({ steps }: { steps: { label: string; value: number; color: string }[] }) {
  const top = Math.max(1, ...steps.map((s) => s.value))
  return (
    <ul className="space-y-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs font-semibold text-on-surface-variant">{s.label}</span>
          <div className="h-7 flex-1 rounded-lg bg-surface-container-low">
            <div
              className="flex h-full items-center rounded-lg px-2 text-xs font-bold text-white"
              style={{ width: `${Math.max(8, (s.value / top) * 100)}%`, background: s.color }}
            >
              {s.value}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === 'danger' ? 'text-rose-600 dark:text-rose-300' : tone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-on-surface'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export function GmudPlatformSection({ data, error }: { data: GmudPlatformIndicators | null; error: string | null }) {
  if (error || !data) {
    return <PlatformPending>{error ?? 'Dados da plataforma indisponíveis.'}</PlatformPending>
  }
  const empty = data.total === 0
  return (
    <div className="space-y-4">
      {empty ? (
        <PlatformPending>
          Nenhuma GMUD foi aberta pela plataforma neste período. Os blocos abaixo passam a ser preenchidos com as
          aberturas, aprovações, reagendamentos e vínculos feitos aqui.
        </PlatformPending>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Comitê" subtitle="Funil de decisão das GMUDs abertas pela plataforma.">
          <Funnel
            steps={[
              { label: 'Abertas', value: data.total, color: COLORS.primary },
              { label: 'Pendentes', value: data.comite.pendente, color: COLORS.neutral },
              { label: 'Aprovadas', value: data.comite.aprovada, color: COLORS.closed },
              { label: 'Negadas', value: data.comite.negada, color: COLORS.overdue },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Taxa de aprovação" value={data.approvalRate == null ? '—' : `${data.approvalRate}%`} />
            <Stat label="Tempo até decidir" value={formatHours(data.medianHoursToDecision)} />
          </div>
        </Panel>

        <Panel title="Execução" subtitle="Status de execução e encerramento no Elleven.">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pendente" value={String(data.exec.pendente)} />
            <Stat label="Em execução" value={String(data.exec.em_execucao)} />
            <Stat label="Concluída" value={String(data.exec.concluida)} tone="success" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Encerradas (concluídas)" value={String(data.encerradas.concluida)} tone="success" />
            <Stat label="Canceladas (negadas)" value={String(data.encerradas.negada)} />
          </div>
        </Panel>

        <Panel title="Qualidade do planejamento" subtitle="Replanejamentos, não conformidades e pendências de fechamento.">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Reagendamentos" value={`${data.reagendamentos.total}`} />
            <Stat label="GMUDs reagendadas" value={`${data.reagendamentos.gmuds}`} />
            <Stat label="Com RNC" value={String(data.rnc)} tone={data.rnc > 0 ? 'danger' : undefined} />
            <Stat
              label="Janela passou, sem encerrar"
              value={String(data.pastWindowNotClosed.length)}
              tone={data.pastWindowNotClosed.length > 0 ? 'danger' : undefined}
            />
          </div>
          {data.pastWindowNotClosed.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {data.pastWindowNotClosed.slice(0, 5).map((g) => (
                <li key={g.voalleProtocol}>
                  <Link to={`/gmud/${g.voalleProtocol}`} className="text-primary hover:underline">
                    <span className="font-mono">{g.voalleProtocol}</span> · {g.title || 'GMUD'} · fim {g.dataFim.split('-').reverse().join('/')}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Tipo"><BarList items={data.tipos} color={COLORS.primary} /></Panel>
        <Panel title="Assunto da mudança"><BarList items={data.assuntos} color={COLORS.backlog} /></Panel>
        <Panel title="Impacto de parada"><BarList items={data.impactoParada} color={COLORS.overdue} /></Panel>
        <Panel title="Comunica cliente"><BarList items={data.comunicaCliente} color={COLORS.closed} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Ambiente afetado" subtitle="Uma GMUD pode afetar vários ambientes.">
          <BarList items={data.ambientes} color={COLORS.opened} max={10} />
        </Panel>
        <Panel title="POP / Site com mais mudanças"><BarList items={data.pops} color={COLORS.primary} max={10} /></Panel>
        <Panel title="Impacto na rede" subtitle="Massivas vinculadas às GMUDs e clientes afetados por elas.">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="GMUDs c/ massiva" value={String(data.impacto.gmudsComMassiva)} />
            <Stat label="Massivas" value={String(data.impacto.massivasVinculadas)} />
            <Stat label="Clientes" value={data.impacto.clientesAfetados.toLocaleString('pt-BR')} tone={data.impacto.clientesAfetados > 0 ? 'danger' : undefined} />
          </div>
          <BarList
            items={data.impacto.topImpact.map((t) => ({ key: `${t.gmudProtocol} · ${t.title || 'GMUD'}`, count: t.affectedClients }))}
            color={COLORS.overdue}
            emptyLabel="Nenhuma massiva vinculada a GMUDs no período."
            max={5}
          />
        </Panel>
      </div>

      <Panel title="Janelas de execução" subtitle="Dia da semana × hora de início das janelas planejadas.">
        <Heatmap matrix={data.windowHeatmap} color={COLORS.backlog} />
      </Panel>
    </div>
  )
}
