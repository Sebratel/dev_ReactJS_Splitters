import { useId, useState } from 'react'
import { ArrowRight, Network } from 'lucide-react'
import { GMUD_CATEGORIA_LABEL, type GmudCategoria } from '@/features/gmud/model/gmudForm'
import { previaDoFormulario } from '@/features/gmud/lib/gmudWizard'
import { cn } from '@/shared/lib/utils'

const CATEGORIAS: GmudCategoria[] = ['rede_externa', 'sistemas_internos', 'sistemas_externos']
/** Coluna do meio: fica bem embaixo do nó central, então o caminho até ela não tem trecho horizontal. */
const CENTRO = 1

const DESCRICAO: Record<GmudCategoria, string> = {
  rede_externa: 'Infraestrutura, OLTs, backbone, sites',
  sistemas_internos: 'Hub Apps, plataformas, sistemas Sebratel',
  sistemas_externos: 'Voalle, GeoGrid, Matrix, fornecedores',
}

/** Traço das ilustrações: herda a cor do texto do quadro (escuro no claro, branco quando o cartão acende). */
const TRACO = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const
/** Peça em destaque: preenchida com o amarelo da marca e contornada, para nunca depender só do amarelo. */
const DESTAQUE = { ...TRACO, className: 'fill-primary' } as const
/** Pulso de luz que percorre a fibra (traço amarelo por cima do traço escuro; animado em index.css). */
const PULSO = { strokeWidth: 3, strokeLinecap: 'round', fill: 'none' } as const

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
      <path d="M50 40h42" pathLength={100} {...PULSO} className="gmud-fiber-trunk stroke-primary" />
      <path d="M92 32l20-10v36l-20-10z" {...DESTAQUE} />
      {casas.map((y) => (
        <g key={y}>
          <path d={`M112 40C138 40 136 ${y} 160 ${y}`} {...TRACO} />
          <path d={`M112 40C138 40 136 ${y} 160 ${y}`} pathLength={100} {...PULSO} className="gmud-fiber-fan stroke-primary" />
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
      {[14, 33, 52].map((y, i) => (
        <g key={y}>
          <rect x="76" y={y} width="48" height="14" rx="3" {...TRACO} />
          <circle cx="84" cy={y + 7} r="2.5" {...DESTAQUE} className="gmud-led fill-primary" style={{ '--d': `${i * 800}ms` } as React.CSSProperties} />
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
      <path d="M50 40h68" {...TRACO} strokeDasharray="5 6" className="gmud-link" />
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
/**
 * Trecho do "caminho aceso" (nó central → cartão sob o mouse/foco), por cima das linhas cinza e um pouco
 * mais grosso que elas. Ao sair, some em 120 ms; a animação de "ligando" fica nas classes gmud-wire-*.
 */
const ACESO = 'pointer-events-none absolute hidden bg-neutral-900 transition-opacity duration-[120ms] md:block dark:bg-white'

/** Cartão cujo caminho está desenhado; `seq` muda a cada nova ligação, para a animação recomeçar do nó. */
type Caminho = { cat: GmudCategoria; seq: number; aceso: boolean }

function CartaoCategoria({
  cat, indice, onEscolher, caminho, onHover, onFoco,
}: {
  cat: GmudCategoria
  indice: number
  onEscolher: (cat: GmudCategoria) => void
  caminho: Caminho | null
  onHover: (cat: GmudCategoria | null) => void
  onFoco: (cat: GmudCategoria | null) => void
}) {
  const id = useId()
  const Ilustracao = ILUSTRACAO[cat]
  const previa = previaDoFormulario(cat)
  const ultimo = indice === CATEGORIAS.length - 1
  const meu = caminho?.cat === cat ? caminho : null
  // Sem trecho horizontal (cartão do meio) a descida começa logo depois da haste.
  const atrasoDescida = indice === CENTRO ? 100 : 250

  return (
    <div className="relative flex md:px-2 md:pt-7">
      <button
        type="button"
        style={{ '--d': `${440 + indice * 30}ms` } as React.CSSProperties}
        onClick={() => onEscolher(cat)}
        onMouseEnter={() => onHover(cat)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onFoco(cat)}
        onBlur={() => onFoco(null)}
        aria-labelledby={`${id}-nome`}
        aria-describedby={`${id}-desc ${id}-previa`}
        className={cn(
          'gmud-pick-card group flex w-full flex-col rounded-xl border border-neutral-200/80 bg-surface-container-lowest p-3 text-left shadow-sm transition duration-200 sm:p-4 dark:border-white/10',
          'hover:shadow-md focus-visible:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 motion-reduce:transition-none',
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
        className={cn(LINHA, 'gmud-pick-bar top-0 h-0.5', indice === 0 ? 'left-1/2 right-0 origin-right' : ultimo ? 'left-0 right-1/2 origin-left' : 'inset-x-0 origin-center')}
      />
      <span
        aria-hidden
        className={cn(LINHA, 'gmud-pick-drop left-1/2 top-0 h-7 w-0.5 -translate-x-1/2')}
      />
      <span
        aria-hidden
        className="gmud-pick-dot pointer-events-none absolute left-1/2 top-7 hidden size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-400 bg-surface-container-lowest md:block dark:border-white/40"
      />
      {/* Fim do caminho aceso: a descida desta coluna e o ponto de porta preenchido. */}
      {meu ? (
        <>
          <span
            key={`descida-${meu.seq}`}
            aria-hidden
            data-testid="caminho-descida"
            data-categoria={cat}
            data-aceso={meu.aceso}
            style={{ '--d': `${atrasoDescida}ms` } as React.CSSProperties}
            className={cn(ACESO, 'gmud-wire-y left-1/2 top-0 h-7 w-[3px] -translate-x-1/2', meu.aceso ? 'opacity-100' : 'opacity-0')}
          />
          <span
            key={`porta-${meu.seq}`}
            aria-hidden
            data-testid="caminho-porta"
            data-categoria={cat}
            data-aceso={meu.aceso}
            style={{ '--d': `${atrasoDescida + 100}ms` } as React.CSSProperties}
            className={cn(
              'gmud-wire-dot pointer-events-none absolute left-1/2 top-7 hidden size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-primary transition-opacity duration-[120ms] md:block dark:border-white',
              meu.aceso ? 'opacity-100' : 'opacity-0',
            )}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * Tela inicial do "Abrir GMUD": a mudança no topo e, em árvore, as três frentes onde ela pode acontecer.
 * Cada frente é um cartão ilustrado com a prévia do que o formulário vai pedir. No celular vira lista.
 */
export function GmudCategoriaPicker({ onEscolher }: { onEscolher: (cat: GmudCategoria) => void }) {
  // Só visual: qual cartão está sob o mouse e qual tem o foco (o mouse manda quando há os dois).
  const [estado, setEstado] = useState<{ hover: GmudCategoria | null; foco: GmudCategoria | null; caminho: Caminho | null }>({
    hover: null,
    foco: null,
    caminho: null,
  })
  const atualizar = (mudanca: { hover?: GmudCategoria | null; foco?: GmudCategoria | null }) =>
    setEstado((prev) => {
      const hover = mudanca.hover !== undefined ? mudanca.hover : prev.hover
      const foco = mudanca.foco !== undefined ? mudanca.foco : prev.foco
      const ativo = hover ?? foco
      const antes = prev.caminho
      let caminho = antes
      if (ativo === null) caminho = antes ? { ...antes, aceso: false } : null
      else if (!antes || !antes.aceso || antes.cat !== ativo) caminho = { cat: ativo, seq: (antes?.seq ?? 0) + 1, aceso: true }
      return { hover, foco, caminho }
    })
  const { caminho } = estado
  const indiceAtivo = caminho ? CATEGORIAS.indexOf(caminho.cat) : -1

  return (
    <div role="group" aria-label="Categoria da GMUD" className="mt-4">
      <div className="gmud-pick-node flex items-center gap-3 rounded-xl border border-primary bg-primary px-4 py-3 text-neutral-900 shadow-sm md:mx-auto md:w-fit md:px-6">
        <Network size={26} aria-hidden className="shrink-0" />
        <span>
          <span className="block text-base font-bold">Abrir GMUD</span>
          <span className="block text-xs text-neutral-800">Escolha onde a mudança acontece</span>
        </span>
      </div>
      <span aria-hidden className="relative mx-auto hidden h-6 w-0.5 md:block">
        <span className="gmud-pick-stem absolute inset-0 bg-neutral-300 dark:bg-white/20" />
        {caminho ? (
          <span
            key={`haste-${caminho.seq}`}
            data-testid="caminho-haste"
            data-categoria={caminho.cat}
            data-aceso={caminho.aceso}
            className={cn(ACESO, 'gmud-wire-y inset-y-0 left-1/2 w-[3px] -translate-x-1/2', caminho.aceso ? 'opacity-100' : 'opacity-0')}
          />
        ) : null}
      </span>
      <div className="relative mt-3 flex flex-col gap-3 md:mt-0 md:grid md:grid-cols-3 md:gap-0">
        {CATEGORIAS.map((cat, i) => (
          <CartaoCategoria
            key={cat}
            cat={cat}
            indice={i}
            onEscolher={onEscolher}
            caminho={caminho}
            onHover={(c) => atualizar({ hover: c })}
            onFoco={(c) => atualizar({ foco: c })}
          />
        ))}
        {/* Trecho horizontal do caminho aceso: do centro (embaixo do nó) até o meio da coluna do cartão.
            As três colunas são iguais e sem espaço entre elas, então os meios ficam em 1/6, 1/2 e 5/6. */}
        {caminho && indiceAtivo !== CENTRO ? (
          <span
            key={`barra-${caminho.seq}`}
            aria-hidden
            data-testid="caminho-barra"
            data-categoria={caminho.cat}
            data-aceso={caminho.aceso}
            className={cn(
              ACESO,
              'gmud-wire-x top-0 h-[3px] -translate-y-[0.5px]',
              indiceAtivo < CENTRO ? 'left-1/6 right-1/2 origin-right' : 'left-1/2 right-1/6 origin-left',
              caminho.aceso ? 'opacity-100' : 'opacity-0',
            )}
          />
        ) : null}
      </div>
    </div>
  )
}
