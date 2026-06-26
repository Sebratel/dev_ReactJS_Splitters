import { Router, Cpu, HardDrive, Hash, Tag, FileText } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useClientePatrimonies } from '@/features/clientes/hooks/useClientePatrimonies'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'
import type { ClientePatrimony } from '@/features/clientes/model/clientePatrimony'

type ClienteDetailPatrimoniesSectionProps = {
  clientId: number
}

/** Heurística simples para escolher o ícone pelo tipo de equipamento. */
function patrimonyIcon(title: string | null): typeof Router {
  const t = (title ?? '').toLowerCase()
  if (t.includes('onu') || t.includes('ont')) return Cpu
  if (t.includes('roteador') || t.includes('router') || t.includes('wi-fi') || t.includes('wifi')) {
    return Router
  }
  return HardDrive
}

function Field({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string
  value: string | null
  icon?: typeof Hash
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
        {Icon ? <Icon size={12} strokeWidth={1.75} /> : null}
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 truncate font-semibold leading-snug text-on-surface',
          mono && 'font-mono text-[13px]',
        )}
        title={value ?? undefined}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}

const STATUS_TONE: Record<string, string> = {
  ativo: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  suspenso: 'border-amber-200 bg-amber-50 text-amber-800',
  bloqueado: 'border-rose-200 bg-rose-50 text-rose-800',
}

function statusToneClass(status: string | null): string {
  const key = (status ?? '').trim().toLowerCase()
  return STATUS_TONE[key] ?? 'border-outline-variant bg-surface-container-low text-on-surface-variant'
}

function PatrimonyCard({ item }: { item: ClientePatrimony }) {
  const Icon = patrimonyIcon(item.patrimonyTitle)
  return (
    <li className="rounded-xl border border-outline-variant/70 bg-surface-container-low/30 p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
          <Icon size={17} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold leading-tight text-on-surface" title={item.patrimonyTitle ?? undefined}>
              {item.patrimonyTitle ?? 'Equipamento sem descrição'}
            </h3>
            {item.contractStatus ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                  statusToneClass(item.contractStatus),
                )}
              >
                {item.contractStatus}
              </span>
            ) : null}
          </div>

          <dl className="mt-3 grid gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="MAC" value={item.mac} icon={Hash} mono />
            <Field label="Serial" value={item.serialNumber} icon={HardDrive} mono />
            <Field label="Patrimônio (tag)" value={item.tagNumber} icon={Tag} mono />
            <Field
              label="Contrato"
              value={item.contractNumber}
              icon={FileText}
            />
            <Field label="Tipo de contrato" value={item.contractTypeTitle} />
          </dl>
        </div>
      </div>
    </li>
  )
}

/**
 * Equipamentos (patrimônios) vinculados ao cliente — roteador, ONU etc.,
 * do banco principal. Complementa o Diagnóstico da ONU (que traz só o modelo
 * coletado pela OLT) com os dados cadastrais do equipamento.
 */
export function ClienteDetailPatrimoniesSection({
  clientId,
}: ClienteDetailPatrimoniesSectionProps) {
  const query = useClientePatrimonies(clientId)
  const items = query.data ?? []

  return (
    <section
      className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-patrimonies-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
          <Router size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Cadastro
          </p>
          <h2
            id="cliente-detail-patrimonies-heading"
            className="mt-0.5 text-base font-semibold tracking-tight text-on-surface"
          >
            Equipamentos (patrimônio)
          </h2>
        </div>
        {items.length > 0 ? (
          <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 text-[10px] font-bold tabular-nums text-on-surface-variant">
            {items.length}
          </span>
        ) : null}
      </div>

      {query.isPending ? (
        <div className="mt-4">
          <LoadingState label="Consultando equipamentos do cliente…" />
        </div>
      ) : query.isError ? (
        <div className="mt-4">
          <ErrorState
            title="Não foi possível carregar os equipamentos"
            message={formatQueryError(query.error)}
            onRetry={() => query.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-on-surface-variant/75">
          Nenhum equipamento ativo vinculado a este cliente no cadastro.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => (
            <PatrimonyCard key={`${item.mac ?? item.serialNumber ?? 'pat'}-${index}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}
