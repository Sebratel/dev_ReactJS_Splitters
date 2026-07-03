import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Lock } from 'lucide-react'

/** Caminho público do visual do painel esquerdo (imagem full-bleed). */
export const LOGIN_HERO_IMAGE_SRC = '/login-hero.png'

/** Variantes de fundo (compat com `?bg=` / `VITE_LOGIN_BACKGROUND`). O layout Sebratel é fixo. */
export const LOGIN_BACKGROUND_VARIANTS = [
  'hero',
  'aurora',
  'mesh',
  'grid',
  'dots',
  'minimal',
  'noir',
] as const

export type LoginBackgroundVariant = (typeof LOGIN_BACKGROUND_VARIANTS)[number]

const VARIANT_SET = new Set<string>(LOGIN_BACKGROUND_VARIANTS)

export function parseLoginBackgroundVariant(raw: string | null | undefined): LoginBackgroundVariant {
  const v = (raw ?? '').trim().toLowerCase()
  if (VARIANT_SET.has(v)) return v as LoginBackgroundVariant
  return 'hero'
}

const AMBER = '#FFB000'

/** Logo do Google (4 cores) — inline, exatamente como no padrão Sebratel. */
const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

/** Hexágono âmbar com ícone no centro (grade decorativa do painel esquerdo). */
function HexIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative select-none"
      style={{ filter: 'drop-shadow(0 0 8px rgba(255,176,0,0.35))' }}
      aria-hidden
    >
      <svg width="64" height="72" viewBox="0 0 64 72">
        <polygon
          points="32,2 62,18 62,54 32,70 2,54 2,18"
          fill="rgba(255,176,0,0.10)"
          stroke="rgba(255,176,0,0.80)"
          strokeWidth="1.8"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: AMBER }}>
        {children}
      </div>
    </div>
  )
}

const IconBolt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const IconCloud = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
)
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
)
const IconBattery = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 11v2h-1V7a2 2 0 0 0-2-2H1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h19a2 2 0 0 0 2-2v-4h1zm-3 7H1V7h19v11z" />
  </svg>
)
const IconWifi = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4 2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
  </svg>
)
const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
  </svg>
)

export type ModernLoginScreenProps = {
  backgroundVariant: LoginBackgroundVariant
  submitting: boolean
  authBusy: boolean
  localError: string | null
  storeError: string | null
  onGoogleSignIn: () => void
  domainPill: string | null
  emailsWhitelistLabel: string | null
  authSuccess?: boolean
}

export function ModernLoginScreen({
  submitting,
  authBusy,
  localError,
  storeError,
  onGoogleSignIn,
  domainPill,
  emailsWhitelistLabel,
}: ModernLoginScreenProps) {
  const busy = submitting || authBusy
  const displayError = localError ?? storeError
  const [showHelp, setShowHelp] = useState(false)
  const domainText = domainPill ?? emailsWhitelistLabel

  return (
    <div
      className="flex h-svh w-full overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* ── Painel esquerdo (visível em lg+) ── */}
      <div
        className="relative hidden flex-1 flex-col justify-end overflow-hidden lg:flex"
        style={{ background: '#0d0a06' }}
      >
        <img
          src={LOGIN_HERO_IMAGE_SRC}
          alt=""
          aria-hidden
          draggable={false}
          className="animate-ken-burns absolute inset-0 h-full w-full object-cover object-center opacity-95"
        />
        {/* Overlay 1 — tom âmbar */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom right, rgba(45,24,0,0.60), transparent, rgba(13,10,6,0.40))',
          }}
        />
        {/* Overlay 2 — legibilidade inferior */}
        <div
          className="absolute bottom-0 left-0 right-0 h-52"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.70), rgba(0,0,0,0.30), transparent)',
          }}
        />

        <div className="relative z-10 flex items-end justify-between gap-6 px-12 py-10">
          <div>
            <div className="mb-5 flex items-center gap-2">
              <img
                src="/logo-circular-sebratel.png"
                alt="Sebratel"
                className="h-10 w-10 opacity-90"
                draggable={false}
              />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                Monitoramento de Splitters
              </span>
            </div>
            <h1 className="text-[2.4rem] font-black leading-[1.15] tracking-tight text-white">
              A conexão que
              <br />
              move <span style={{ color: AMBER }}>o que importa.</span>
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-white/50">
              Tecnologia e pessoas conectadas para levar o melhor todos os dias.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-1.5 pb-1">
            <div className="flex gap-1.5">
              <HexIcon><IconBolt /></HexIcon>
              <HexIcon><IconCloud /></HexIcon>
              <HexIcon><IconUsers /></HexIcon>
            </div>
            <div className="flex gap-1.5">
              <HexIcon><IconBattery /></HexIcon>
              <HexIcon><IconWifi /></HexIcon>
              <HexIcon><IconBarChart /></HexIcon>
            </div>
          </div>
        </div>
      </div>

      {/* ── Divisor âmbar ── */}
      <div className="hidden w-1.5 shrink-0 lg:block" style={{ background: AMBER, zIndex: 10 }} aria-hidden />

      {/* ── Painel direito (formulário) ── */}
      <div
        className="flex w-full shrink-0 flex-col overflow-y-auto lg:w-[35%]"
        style={{ background: '#efefed' }}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
          <div className="flex w-full max-w-[320px] flex-col items-center gap-6">
            {/* Badge neumórfico */}
            <span
              className="inline-flex items-center rounded-full px-5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: AMBER,
                background: '#efefed',
                boxShadow:
                  'inset 3px 3px 7px rgba(0,0,0,0.12), inset -2px -2px 6px rgba(255,255,255,0.85)',
              }}
            >
              Monitoramento de Splitters
            </span>

            {/* Título */}
            <div className="text-center">
              <h2 className="text-[1.75rem] font-black leading-tight tracking-tight text-[#1a0f00]">
                Acessar plataforma
              </h2>
              <p className="mt-2 text-sm leading-snug text-[#7a6a55]">
                Acesso com conta Google para controle de
                <br />
                permissões por módulo.
              </p>
            </div>

            {/* Cartão de domínio */}
            {domainText ? (
              <div
                className="flex w-full items-center gap-4 rounded-2xl px-5 py-4"
                style={{
                  background: '#efefed',
                  boxShadow:
                    '6px 6px 14px rgba(0,0,0,0.11), -4px -4px 10px rgba(255,255,255,0.9)',
                }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: '#efefed',
                    boxShadow:
                      'inset 2px 2px 5px rgba(0,0,0,0.12), inset -2px -2px 5px rgba(255,255,255,0.82)',
                  }}
                >
                  <Lock className="h-5 w-5" style={{ color: AMBER }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
                    {domainPill ? 'Domínio liberado:' : 'E-mails autorizados:'}
                  </p>
                  <p className="break-words text-sm font-bold text-[#1a0f00]">{domainText}</p>
                </div>
              </div>
            ) : null}

            {/* Erro */}
            {displayError ? (
              <div className="flex w-full items-start gap-2 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/[0.08] px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden />
                <p className="text-xs text-[#DC2626]">{displayError}</p>
              </div>
            ) : null}

            {/* CTA Google */}
            <button
              type="button"
              onClick={() => void onGoogleSignIn()}
              disabled={busy}
              aria-busy={busy}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-sm font-bold text-[#1a0f00] transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: AMBER,
                boxShadow: '0 4px 18px rgba(255,176,0,0.45), 0 1px 4px rgba(0,0,0,0.12)',
              }}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <GoogleMark />}
              {busy ? 'Autenticando…' : 'Entrar com Google'}
            </button>

            {/* Divisor "ou" */}
            <div className="flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-[#d8cfc0]" />
              <span className="text-[11px] font-semibold tracking-widest text-[#a0917d]">ou</span>
              <div className="h-px flex-1 bg-[#d8cfc0]" />
            </div>

            {/* Ajuda / suporte (o app é Google-only; sem login por e-mail/senha) */}
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
              style={{ color: AMBER }}
            >
              {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Problemas para acessar?
            </button>
            {showHelp ? (
              <div className="w-full animate-in fade-in slide-in-from-top-2 rounded-xl bg-white/70 px-4 py-3 text-center text-xs leading-relaxed text-[#7a6a55] ring-1 ring-[#d8cfc0] duration-200">
                O acesso é exclusivo por <span className="font-semibold text-[#1a0f00]">conta Google</span>{' '}
                {domainText ? (
                  <>
                    do domínio <span className="font-semibold text-[#1a0f00]">{domainText}</span>.
                  </>
                ) : (
                  'corporativa autorizada.'
                )}{' '}
                Se não conseguir entrar, fale com a TI/Operações.
                <a
                  href="mailto:?subject=Acesso%20Monitoramento%20de%20Splitters%20%E2%80%94%20suporte&body=Descreva%20o%20problema%20e%20o%20seu%20e-mail%20corporativo."
                  className="mt-2 block font-semibold"
                  style={{ color: AMBER }}
                >
                  Falar com o suporte
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <p className="select-none pb-5 text-center text-[10px] uppercase tracking-widest text-[#a0917d]">
          © {new Date().getFullYear()} Sebratel · Uso interno
        </p>
      </div>
    </div>
  )
}
