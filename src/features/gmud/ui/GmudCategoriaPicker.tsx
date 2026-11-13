import { useId } from 'react'
import { ArrowRight, Network } from 'lucide-react'
import { GMUD_CATEGORIA_LABEL, type GmudCategoria } from '@/features/gmud/model/gmudForm'
import { previaDoFormulario } from '@/features/gmud/lib/gmudWizard'
import { cn } from '@/shared/lib/utils'

const CATEGORIAS: GmudCategoria[] = ['rede_externa', 'sistemas_internos', 'sistemas_externos']

const DESCRICAO: Record<GmudCategoria, string> = {
  rede_externa: 'Infraestrutura, OLTs, backbone, sites',
  sistemas_internos: 'Hub Apps, plataformas, sistemas Sebratel',
  sistemas_externos: 'Voalle, GeoGrid, Matrix, fornecedores',
}

/** Traço das ilustrações: herda a cor do texto do quadro (escuro no claro, branco quando o cartão acende). */
const TRACO = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const
/** Peça em destaque: preenchida com o amarelo da marca e contornada, para nunca depender só do amarelo. */
const DESTAQUE = { ...TRACO, className: 'fill-primary' } as const

/** Rede externa: a OLT, a fibra, o splitter e a fibra se abrindo para as casas dos clientes. */
function IlustracaoRedeExterna() {
  const casas = [12, 31, 50, 69]
  return (
    <>
      <rect x="10" y="26" width="40" height="28" rx="4" {...TRACO} />
      <circle cx="20" cy="35" r="2.5" {...DESTAQUE} />
      <circle cx="29" cy="35" r="2.5" {...DESTAQUE} />
      <path d="M18 45h24" {...TRACO} />
      <path d="M50 40h42" {...TRACO} strokeWidth={3} />
      <path d="M92 32l20-10v36l-20-10z" {...DESTAQUE} />
      {casas.map((y) => (
        <g key={y}>
          <path d={`M112 40C138 40 136 ${y} 160 ${y}`} {...TRACO} />
          <path d={`M162 ${y + 6}v-7l8-6 8 6v7z`} {...DESTAQUE} />
        </g>
      ))}
    </>
  )
}

/** Sistemas internos: o rack de servidores da casa ligado às telas de quem usa. */
function IlustracaoSistemasInternos() {
  return (
    <>
      <rect x="70" y="8" width="60" height="64" rx="5" {...TRACO} />
      {[14, 33, 52].map((y) => (
        <g key={y}>
          <rect x="76" y={y} width="48" height="14" rx="3" {...TRACO} />
          <circle cx="84" cy={y + 7} r="2.5" {...DESTAQUE} />
          <path d={`M94 ${y + 7}h22`} {...TRACO} />
        </g>
      ))}
      <rect x="14" y="24" width="40" height="26" rx="3" {...TRACO} />
      <path d="M34 50v7M24 57h20" {...TRACO} />
      <path d="M54 37h16" {...TRACO} />
      <rect x="146" y="24" width="40" height="28" rx="3" {...TRACO} />
      <path d="M146 33h40" {...TRACO} />
      <circle cx="152" cy="28.5" r="1.5" {...DESTAQUE} strokeWidth={1} />
      <path d="M153 41h26M153 46h16" {...TRACO} />
      <path d="M130 38h16" {...TRACO} />
    </>
  )
}

/** Sistemas externos: o nosso lado ligado, por um enlace, à nuvem do fornecedor. */
function IlustracaoSistemasExternos() {
  return (
    <>
      <rect x="12" y="26" width="38" height="28" rx="4" {...TRACO} />
      <circle cx="22" cy="35" r="2.5" {...DESTAQUE} />
      <path d="M20 45h22" {...TRACO} />
      <path d="M50 40h68" {...TRACO} strokeDasharray="5 6" />
      <circle cx="84" cy="40" r="6" {...DESTAQUE} />
      <path
        d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
        transform="translate(112 5) scale(3.2)"
        vectorEffect="non-scaling-stroke"
        {...DESTAQUE}
      />
    </>
  )
}

const ILUSTRACAO: Record<GmudCategoria, () => React.JSX.Element> = {
  rede_externa: IlustracaoRedeExterna,
  sistemas_internos: IlustracaoSistemasInternos,
  sistemas_externos: IlustracaoSistemasExternos,
}

/** Linha da árvore (só a partir de `md`; no celular os cartões viram lista e a árvore some). */
const LINHA = 'pointer-events-none absolute hidden bg-neutral-300 md:block dark:bg-white/20'

function CartaoCategoria({ cat, indice, onEscolher }: { cat: GmudCategoria; indice: number; onEscolher: (cat: GmudCategoria) => void }) {
  const id = useId()
  const Ilustracao = ILUSTRACAO[cat]
  const previa = previaDoFormulario(cat)
  const ultimo = indice === CATEGORIAS.length - 1

  return (
    <div className="relative flex md:px-2 md:pt-7">
      <button
        type="button"
        onClick={() => onEscolher(cat)}
        aria-labelledby={`${id}-nome`}
        aria-describedby={`${id}-desc ${id}-previa`}
        className={cn(
          'group peer flex w-full flex-col rounded-xl border border-neutral-200/80 bg-surface-container-lowest p-3 text-left shadow-sm transition-colors sm:p-4 dark:border-white/10',
          'hover:border-primary hover:bg-primary focus-visible:border-primary focus-visible:bg-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest dark:focus-visible:ring-white',
        )}
      >
        {/* Quadro da ilustração: escurece quando o cartão acende, para o desenho continuar legível sobre o amarelo. */}
        <span
          aria-hidden
          className="block rounded-lg bg-surface-container-low px-3 py-2 text-on-surface transition-colors group-hover:bg-neutral-900 group-hover:text-white group-focus-visible:bg-neutral-900 group-focus-visible:text-white"
        >
          <svg viewBox="0 0 200 80" className="mx-auto block h-20 w-full max-w-[260px]" focusable="false">
            <Ilustracao />
          </svg>
        </span>

        <span id={`${id}-nome`} className="mt-3 block text-base font-bold text-on-surface transition-colors group-hover:text-neutral-900 group-focus-visible:text-neutral-900">
          {GMUD_CATEGORIA_LABEL[cat]}
        </span>
        <span id={`${id}-desc`} className="mt-0.5 block text-xs text-on-surface-variant transition-colors group-hover:text-neutral-800 group-focus-visible:text-neutral-800">
          {DESCRICAO[cat]}
        </span>

        {/* Prévia do formulário: sempre visível (não depende de hover), vem das etapas reais do formulário. */}
        <span id={`${id}-previa`} className="mt-3 block border-t border-neutral-200/80 pt-3 transition-colors group-hover:border-neutral-900/25 group-focus-visible:border-neutral-900/25 dark:border-white/10">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant transition-colors group-hover:text-neutral-800 group-focus-visible:text-neutral-800">
            Você vai informar<span className="sr-only">:</span>
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {previa.especificas.map((secao, i) => (
              <span
                key={secao}
                className="rounded-md border border-neutral-300 bg-surface-container-low px-2 py-0.5 text-xs font-semibold text-on-surface transition-colors group-hover:border-neutral-900/40 group-hover:bg-neutral-900/10 group-hover:text-neutral-900 group-focus-visible:border-neutral-900/40 group-focus-visible:bg-neutral-900/10 group-focus-visible:text-neutral-900 dark:border-white/15"
              >
                {secao}
                {i < previa.especificas.length - 1 ? <span className="sr-only">,</span> : <span className="sr-only">.</span>}
              </span>
            ))}
          </span>
          <span className="mt-2 block text-xs text-on-surface-variant transition-colors group-hover:text-neutral-800 group-focus-visible:text-neutral-800">
            Depois: {previa.comuns.join(' e ')}.
          </span>
        </span>

        <span className="mt-auto flex items-center justify-end gap-1.5 pt-3 text-xs font-bold text-on-surface transition-colors group-hover:text-neutral-900 group-focus-visible:text-neutral-900" aria-hidden>
          Escolher
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" />
        </span>
      </button>

      {/* Árvore: barra horizontal até o centro da coluna e descida reta até o meio do topo do cartão. */}
      <span
        aria-hidden
        className={cn(LINHA, 'top-0 h-0.5', indice === 0 ? 'left-1/2 right-0' : ultimo ? 'left-0 right-1/2' : 'inset-x-0')}
      />
      <span
        aria-hidden
        className={cn(LINHA, 'left-1/2 top-0 h-7 w-0.5 -translate-x-1/2 transition-colors peer-hover:bg-neutral-900 peer-focus-visible:bg-neutral-900 dark:peer-hover:bg-white dark:peer-focus-visible:bg-white')}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-7 hidden size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-400 bg-surface-container-lowest transition-colors peer-hover:border-neutral-900 peer-hover:bg-primary peer-focus-visible:border-neutral-900 peer-focus-visible:bg-primary md:block dark:border-white/40"
      />
    </div>
  )
}

/**
 * Tela inicial do "Abrir GMUD": a mudança no topo e, em árvore, as três frentes onde ela pode acontecer.
 * Cada frente é um cartão ilustrado com a prévia do que o formulário vai pedir. No celular vira lista.
 */
export function GmudCategoriaPicker({ onEscolher }: { onEscolher: (cat: GmudCategoria) => void }) {
  return (
    <div role="group" aria-label="Categoria da GMUD" className="mt-4">
      <div className="flex items-center gap-3 rounded-xl border border-primary bg-primary px-4 py-3 text-neutral-900 shadow-sm md:mx-auto md:w-fit md:px-6">
        <Network size={26} aria-hidden className="shrink-0" />
        <span>
          <span className="block text-base font-bold">Abrir GMUD</span>
          <span className="block text-xs text-neutral-800">Escolha onde a mudança acontece</span>
        </span>
      </div>
      <span aria-hidden className="mx-auto hidden h-6 w-0.5 bg-neutral-300 md:block dark:bg-white/20" />
      <div className="mt-3 flex flex-col gap-3 md:mt-0 md:grid md:grid-cols-3 md:gap-0">
        {CATEGORIAS.map((cat, i) => (
          <CartaoCategoria key={cat} cat={cat} indice={i} onEscolher={onEscolher} />
        ))}
      </div>
    </div>
  )
}
