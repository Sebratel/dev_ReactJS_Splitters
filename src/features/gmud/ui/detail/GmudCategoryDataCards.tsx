import { Monitor, Server } from 'lucide-react'
import type { GmudRedeExternaImpactoData, GmudSistemasExternosData, GmudSistemasInternosData } from '@/features/gmud/model/gmudForm'
import { formatEscopoRede } from '@/features/gmud/model/gmudEscopoRede'
import { CardTitle } from '@/features/gmud/ui/detail/GmudDetailCards'
import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { cn } from '@/shared/lib/utils'

function Field({ label, value }: { label: string; value: string | string[] | null | undefined }) {
  const raw = Array.isArray(value) ? value.filter(Boolean).join(', ') : (value ?? '').toString().trim()
  if (!raw) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant/70">{label}</p>
      <p className="text-sm text-on-surface whitespace-pre-wrap">{raw}</p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-primary/70">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export function GmudRedeExternaImpactoCard({ data }: { data: GmudRedeExternaImpactoData }) {
  const abrangencia = formatEscopoRede(data.escopoRede)
  const temImpacto = Boolean(data.tipoIndisponibilidade || data.duracaoEstimada)
  if (!temImpacto && abrangencia === '') return null
  return (
    <section className={cn(DETAIL_CARD, 'space-y-5 p-4')}>
      <CardTitle icon={<Server size={16} />}>{temImpacto ? 'Impacto de parada e abrangência' : 'Abrangência na rede'}</CardTitle>
      {temImpacto ? (
        <Group title="Indisponibilidade">
          <Field label="Tipo de indisponibilidade" value={data.tipoIndisponibilidade} />
          <Field label="Duração estimada" value={data.duracaoEstimada} />
        </Group>
      ) : null}
      {abrangencia !== '' ? (
        <Group title="Abrangência">
          <Field label="Afunilamento no POP/Site" value={abrangencia} />
        </Group>
      ) : null}
    </section>
  )
}

export function GmudSistemasInternosCard({ data }: { data: GmudSistemasInternosData }) {
  return (
    <section className={cn(DETAIL_CARD, 'space-y-5 p-4')}>
      <CardTitle icon={<Monitor size={16} />}>Dados do Sistema Interno</CardTitle>

      <Group title="Identificação">
        <Field label="Sistema afetado" value={data.sistemaAfetado || data.sistemaAfetadoOutro} />
        <Field label="Ambiente" value={data.ambiente} />
        <Field label="Natureza da mudança" value={data.natureza} />
      </Group>

      <Group title="Impacto">
        <Field label="Áreas impactadas" value={data.areasImpactadas} />
        <Field label="Tipo de indisponibilidade" value={data.tipoIndisponibilidade} />
        <Field label="Duração estimada" value={data.duracaoEstimada} />
      </Group>
    </section>
  )
}

export function GmudSistemasExternosCard({ data }: { data: GmudSistemasExternosData }) {
  return (
    <section className={cn(DETAIL_CARD, 'space-y-5 p-4')}>
      <CardTitle icon={<Server size={16} />}>Dados do Sistema Externo</CardTitle>

      <Group title="Identificação">
        <Field label="Sistema externo" value={data.sistemaExterno || data.sistemaExternoOutro} />
        <Field label="Fornecedor" value={data.fornecedor} />
        <Field label="Natureza da mudança" value={data.natureza} />
        {data.chamadoFornecedor ? <Field label="Chamado no fornecedor" value={data.chamadoFornecedor} /> : null}
      </Group>

      <Group title="Impacto">
        <Field label="Áreas afetadas" value={data.areasAfetadas} />
        <Field label="Tipo de indisponibilidade" value={data.tipoIndisponibilidade} />
        <Field label="Duração estimada" value={data.duracaoEstimada} />
      </Group>
    </section>
  )
}
