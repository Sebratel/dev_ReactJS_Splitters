import { Link, useLocation } from 'react-router-dom'
import type { Splitter } from '@/features/splitters/model/splitter'
import { ChevronRight, Cpu, Building2 } from 'lucide-react'
import { formatOltLabel } from '@/features/splitters/lib/formatOltLabel'

type SplitterRowProps = {
  splitter: Splitter
}

export function SplitterRow({ splitter }: SplitterRowProps) {
  const location = useLocation()
  const to = `/splitters/${encodeURIComponent(splitter.code)}`
  const isCondominio = splitter.tipoLocal === 'CONDOMÍNIO'

  return (
    <li className="group animate-in fade-in duration-300">
      <Link
        to={to}
        state={{ splittersListHref: `${location.pathname}${location.search}` }}
        className="flex items-center justify-between rounded-3xl bg-surface-container-lowest p-6 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/5 dark:ring-1 dark:ring-white/10"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface-variant transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            {isCondominio ? <Building2 size={24} /> : <Cpu size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold tracking-tight text-on-surface">
                {splitter.nomeCondominio || splitter.title || splitter.code}
              </span>
              <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-mono text-[10px] font-bold text-on-surface-variant">
                {splitter.code}
              </span>
              {isCondominio && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Building2 size={12} />
                  CONDOMÍNIO
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-on-surface-variant/70">
              {formatOltLabel(splitter.accessPointTitle ?? splitter.accessPointCode ?? splitter.oltDescription ?? splitter.oltCode) && (
                <span className="flex items-center gap-1">
                  OLT: <span className="font-semibold">{formatOltLabel(splitter.accessPointTitle ?? splitter.accessPointCode ?? splitter.oltDescription ?? splitter.oltCode)}</span>
                </span>
              )}
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span>{splitter.outPorts} Portas</span>
              <span className="h-1 w-1 rounded-full bg-outline-variant" />
              <span className={splitter.active ? 'text-primary font-bold' : 'text-tertiary font-bold'}>
                {splitter.active ? 'Ativo' : 'Inativo'}
              </span>
              {splitter.nomeCondominio && splitter.nomeCondominio !== splitter.title && (
                <>
                  <span className="h-1 w-1 rounded-full bg-outline-variant" />
                  <span className="italic text-[12px]">{splitter.title}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="rounded-xl p-2 text-on-surface-variant/30 transition-all group-hover:translate-x-1 group-hover:text-primary">
          <ChevronRight size={20} />
        </div>
      </Link>
    </li>
  )
}

