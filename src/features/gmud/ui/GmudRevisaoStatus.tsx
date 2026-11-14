import { cn } from '@/shared/lib/utils'

/** Para onde vai cada partícula do "tudo certo" (em unidades do desenho de 56 x 56). */
const PARTICULAS = [
  { dx: 0, dy: -30 },
  { dx: 26, dy: -15 },
  { dx: 26, dy: 15 },
  { dx: 0, dy: 30 },
  { dx: -26, dy: 15 },
  { dx: -26, dy: -15 },
]

/** Ícone do estado "tudo preenchido": disco verde que surge, anel que se desenha, check traçado, pulso e partículas. */
function IconeTudoCerto() {
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0 overflow-visible" aria-hidden focusable="false">
      <circle cx="28" cy="28" r="22" fill="none" strokeWidth="2" className="gmud-rv-pulse stroke-emerald-600 dark:stroke-emerald-400" />
      {PARTICULAS.map((p, i) => (
        <circle
          key={i}
          cx="28"
          cy="28"
          r="2"
          className="gmud-rv-particle fill-emerald-600 dark:fill-emerald-400"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as React.CSSProperties}
        />
      ))}
      <circle cx="28" cy="28" r="21" className="gmud-rv-pop fill-emerald-600 dark:fill-emerald-500" />
      <circle
        cx="28"
        cy="28"
        r="25.5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        transform="rotate(-90 28 28)"
        className="gmud-rv-ring stroke-emerald-600 dark:stroke-emerald-400"
      />
      <path
        d="M18.5 28.5l6.5 6.5 12.5-13.5"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray="100"
        className="gmud-rv-check stroke-white dark:stroke-emerald-950"
      />
    </svg>
  )
}

/** Ícone do estado "há pendências": triângulo âmbar que surge e balança uma vez, com a exclamação e dois pulsos. */
function IconePendencia() {
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0 overflow-visible" aria-hidden focusable="false">
      <circle cx="28" cy="30" r="22" fill="none" strokeWidth="2" className="gmud-rv-pulse gmud-rv-pulse-2x stroke-amber-600 dark:stroke-amber-400" />
      <g className="gmud-rv-pop gmud-rv-pop-forte">
        <g className="gmud-rv-wiggle">
          <path d="M28 8.5L49.5 46h-43z" strokeWidth="3" strokeLinejoin="round" className="fill-amber-400 stroke-amber-700 dark:stroke-amber-300" />
          <g className="gmud-rv-mark">
            <path d="M28 22v11" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-neutral-900" />
            <circle cx="28" cy="39.5" r="2.2" className="fill-neutral-900" />
          </g>
        </g>
      </g>
    </svg>
  )
}

/**
 * Faixa de situação no topo da Revisão: "Tudo preenchido" ou "N pendência(s) antes de abrir", com um ícone
 * animado. A animação roda uma vez quando a faixa é montada (ao chegar na Revisão) e de novo se a contagem
 * mudar; não repete a cada re-render. Com prefers-reduced-motion aparece direto o estado final.
 * `pendencias` é a mesma contagem usada na barra de ações (GmudRevisaoBarra).
 */
export function GmudRevisaoStatus({ pendencias }: { pendencias: number }) {
  const ok = pendencias <= 0
  return (
    <div
      role="status"
      aria-live="polite"
      data-estado={ok ? 'ok' : 'pendencia'}
      className={cn(
        'flex min-h-20 flex-col items-start gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 min-[380px]:flex-row min-[380px]:items-center',
        ok
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100'
          : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
      )}
    >
      {/* A key refaz o ícone e o texto (e a animação) só quando o estado ou a contagem mudam. */}
      {ok ? <IconeTudoCerto key="icone-ok" /> : <IconePendencia key={`icone-pendencia-${pendencias}`} />}
      <div key={ok ? 'texto-ok' : `texto-pendencia-${pendencias}`} className="gmud-rv-text min-w-0">
        <p className="text-base font-bold">{ok ? 'Tudo preenchido' : `${pendencias} ${pendencias === 1 ? 'pendência' : 'pendências'} antes de abrir`}</p>
        <p className="text-sm">{ok ? 'Confira e abra a GMUD quando quiser.' : 'Use Editar nas etapas marcadas para completar.'}</p>
      </div>
    </div>
  )
}
