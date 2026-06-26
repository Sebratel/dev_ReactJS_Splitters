import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { SplitterStatusBadge } from '@/features/splitters/ui/SplitterStatusBadge'
import { Building2, Mail, Phone, User } from 'lucide-react'

type ClienteDetailClienteSectionProps = {
  cliente: ClienteDetail
}

export function ClienteDetailClienteSection({
  cliente,
}: ClienteDetailClienteSectionProps) {
  return (
    <section
      className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm md:p-5"
      aria-labelledby="cliente-detail-cliente-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-primary">
          <User size={20} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Perfil
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2
              id="cliente-detail-cliente-heading"
              className="text-base font-semibold tracking-tight text-on-surface"
            >
              Cliente
            </h2>
            <SplitterStatusBadge
              active={cliente.status === 1}
              labels={{ active: 'Contrato ativo', inactive: 'Contrato suspenso' }}
              variant="neutral"
            />
            {cliente.isCorporate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                <Building2 size={12} strokeWidth={2} />
                Corporativo
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Nome
          </dt>
          <dd className="mt-1 font-semibold leading-snug text-on-surface">
            {cliente.name || '—'}
          </dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Usuário PPPoE
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-on-surface">
            {cliente.user || '—'}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Telefone
          </dt>
          <dd className="mt-1 text-on-surface">
            {cliente.phone ? (
              <a
                href={`tel:${cliente.phone}`}
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                <Phone size={14} strokeWidth={1.75} />
                {cliente.phone}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            E-mail
          </dt>
          <dd className="mt-1 text-on-surface">
            {cliente.email ? (
              <a
                href={`mailto:${cliente.email}`}
                className="inline-flex items-center gap-2 break-all font-semibold text-primary hover:underline"
              >
                <Mail size={14} strokeWidth={1.75} />
                {cliente.email}
              </a>
            ) : (
              '—'
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            Porta
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-on-surface">
            {cliente.port ?? '—'}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            ID autenticação
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-on-surface">
            {cliente.authenticationId}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
            ID cliente
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-on-surface">
            {cliente.clientId}
          </dd>
        </div>

        {cliente.splitterCode ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Splitter
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-primary">
              {cliente.splitterCode}
            </dd>
          </div>
        ) : null}

        {cliente.splitterTitle ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/55">
              Título do splitter
            </dt>
            <dd className="mt-1 font-semibold text-on-surface">
              {cliente.splitterTitle}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}
