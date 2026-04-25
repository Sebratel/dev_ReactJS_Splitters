import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { MassivaPage } from '@/features/massiva/ui/MassivaPage'

export function MassivaScreen() {
  return (
    <div className="mx-auto max-w-[1720px] animate-in fade-in px-4 pb-8 pt-0 duration-500 xl:px-8">
      <header className="relative mb-4 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 shadow-[0_4px_24px_-8px_rgba(180,83,9,0.18)] ring-1 ring-amber-100/80">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-72 rounded-full bg-yellow-200/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:py-5 xl:px-7">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-600/10 text-amber-900 shadow-inner ring-1 ring-amber-300/50">
              <Sparkles size={22} aria-hidden className="opacity-90" />
            </div>
            <div className="min-w-0 space-y-1">
              <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-white/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-900/90 shadow-sm backdrop-blur-sm">
                Centro de operação
              </span>
              <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                Operação de Massivas
              </h1>
              <p className="hidden max-w-xl text-sm leading-relaxed text-neutral-600 sm:block">
                Fluxo guiado de abertura com preview de rota, formulário e apoio do AutoISP — tudo
                organizado em painéis claros.
              </p>
            </div>
          </div>
          <Link
            to="/splitters"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-neutral-200/90 bg-white/90 px-4 py-2.5 text-xs font-semibold text-neutral-800 shadow-sm backdrop-blur-sm transition hover:border-amber-300/60 hover:bg-amber-50/80 hover:text-amber-950 xl:text-sm"
          >
            <ArrowLeft size={15} aria-hidden className="text-neutral-500" />
            Voltar aos Splitters
          </Link>
        </div>
      </header>

      <MassivaPage />
    </div>
  )
}
