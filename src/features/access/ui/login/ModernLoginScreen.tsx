import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Globe, Info, Loader2, Lock, Shield } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import operacaoSebratelMark from '@/assets/operacao-sebratel-mark.svg'

/** Caminho público do hero visual (login em tela cheia). */
export const LOGIN_HERO_IMAGE_SRC = '/login-hero.png'

/** Variantes de fundo reutilizáveis (troque com `?bg=mesh` na URL ou `VITE_LOGIN_BACKGROUND`). */
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

/** Camadas decorativas sobre o hero (âmbar / rede) — desativadas com prefers-reduced-motion. */
function HeroAmbientDecor({ reduced }: { reduced: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {!reduced ? (
        <>
          <motion.div
            className="absolute -left-[15%] top-[18%] h-[min(85vw,520px)] w-[min(85vw,520px)] rounded-full bg-primary/18 blur-[88px]"
            animate={{ opacity: [0.28, 0.48, 0.28], scale: [1, 1.06, 1] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-[8%] bottom-[12%] h-[min(70vw,420px)] w-[min(70vw,420px)] rounded-full bg-secondary/14 blur-[72px]"
            animate={{ opacity: [0.22, 0.42, 0.22], x: [0, -12, 0], y: [0, 8, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      ) : null}
      <div
        className={cn(
          'absolute -left-[45%] top-0 h-full w-[55%] bg-gradient-to-r from-transparent via-primary/18 to-transparent opacity-40 blur-3xl',
          !reduced && 'animate-login-hero-crawl',
        )}
      />
      <div
        className={cn(
          'absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_45%_42%,rgba(255,176,0,0.14),transparent_68%)] mix-blend-screen',
          !reduced && 'animate-login-hero-shimmer',
        )}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-screen"
        viewBox="0 0 1200 780"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M0,520 Q280,380 520,460 T920,400 T1200,360"
          fill="none"
          stroke="rgba(255,184,0,0.65)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M80,620 Q420,520 720,560 T1180,480"
          fill="none"
          stroke="rgba(255,143,0,0.45)"
          strokeWidth="1"
          opacity="0.8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M200,180 Q520,280 780,200 T1120,240"
          fill="none"
          stroke="rgba(255,184,0,0.35)"
          strokeWidth="0.85"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.25 1.3-1 2.4-2.1 3.1l3.4 2.6c2-1.8 3.1-4.5 3.1-7.7 0-.75-.07-1.5-.2-2.2H12z"
      />
      <path
        fill="#34A853"
        d="M5.8 14.1l-.9.7-2.5 1.9C4.2 20.8 7.9 23 12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.1 1-3.9 1-3 0-5.5-2-6.4-4.7z"
      />
      <path
        fill="#FBBC05"
        d="M5.5 9.3 2.9 7.1C1.1 10.4 1.1 14.3 2.9 17.6l2.6-2c-.4-1.2-.4-2.5 0-3.7z"
      />
      <path
        fill="#4285F4"
        d="M12 5.8c1.7 0 3.2.6 4.4 1.8l3.3-3.3C16.5 2.1 14.4 1 12 1 7.9 1 4.2 3.2 2.9 7.1l2.6 2C6.5 7.4 9.1 5.8 12 5.8z"
      />
    </svg>
  )
}

function LoginBackground({ variant }: { variant: LoginBackgroundVariant }) {
  const reduced = useReducedMotion()

  if (variant === 'hero') return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {variant === 'aurora' && (
        <>
          <div
            className={cn(
              'absolute -inset-[40%] bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,176,0,0.22),transparent_55%),radial-gradient(ellipse_at_70%_60%,rgba(255,143,0,0.14),transparent_50%),radial-gradient(ellipse_at_50%_100%,rgba(244,241,232,0.92),transparent_45%)]',
              !reduced && 'animate-login-aurora-drift',
            )}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-low/95 to-primary/[0.07]" />
        </>
      )}

      {variant === 'mesh' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-container-lowest to-primary/[0.06]" />
          <motion.div
            className="absolute -left-1/4 top-1/4 h-[min(80vw,520px)] w-[min(80vw,520px)] rounded-full bg-primary/18 blur-3xl"
            animate={
              reduced
                ? undefined
                : {
                    x: [0, 32, 0],
                    y: [0, 18, 0],
                  }
            }
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-1/4 bottom-0 h-[min(70vw,480px)] w-[min(70vw,480px)] rounded-full bg-secondary/22 blur-3xl"
            animate={
              reduced
                ? undefined
                : {
                    x: [0, -28, 0],
                    y: [0, -22, 0],
                  }
            }
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-primary/15 blur-2xl"
            animate={reduced ? undefined : { opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {variant === 'grid' && (
        <div
          className="absolute inset-0 bg-gradient-to-b from-surface-container-low to-surface-container-lowest"
          style={{
            backgroundImage: `
              linear-gradient(rgba(26,26,26,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(26,26,26,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
      )}

      {variant === 'dots' && (
        <div
          className="absolute inset-0 bg-surface"
          style={{
            backgroundImage: 'radial-gradient(rgba(26,26,26,0.07) 1.2px, transparent 1.2px)',
            backgroundSize: '20px 20px',
          }}
        />
      )}

      {variant === 'minimal' && (
        <div className="absolute inset-0 bg-gradient-to-b from-surface-container-low via-surface-container-lowest to-surface" />
      )}

      {variant === 'noir' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-inverse-surface via-neutral-900 to-neutral-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,176,0,0.14),transparent_55%)]" />
        </>
      )}
    </div>
  )
}

type LoginScreenCardProps = {
  appearance: 'standard' | 'hero'
  backgroundVariant: LoginBackgroundVariant
  reduceMotion: boolean
  authSuccess: boolean
  displayError: string | null
  busy: boolean
  onGoogleSignIn: () => void
  domainPill: string | null
  emailsWhitelistLabel: string | null
  domainTooltip: string
}

function LoginScreenCard({
  appearance,
  backgroundVariant,
  reduceMotion,
  authSuccess,
  displayError,
  busy,
  onGoogleSignIn,
  domainPill,
  emailsWhitelistLabel,
  domainTooltip,
}: LoginScreenCardProps) {
  const isHero = appearance === 'hero'
  const cardNoir = backgroundVariant === 'noir' && !isHero

  return (
    <motion.div
      className={cn('relative z-10 w-full', isHero ? 'max-w-[440px]' : 'max-w-[420px]')}
      initial={
        reduceMotion
          ? false
          : isHero
            ? { opacity: 0, y: 36, scale: 0.96, filter: 'blur(10px)' }
            : { opacity: 0, y: 20 }
      }
      animate={
        reduceMotion
          ? undefined
          : authSuccess
            ? { opacity: 0, y: -12, scale: 0.98, filter: 'blur(0px)' }
            : isHero
              ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
              : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{
        duration: authSuccess ? 0.36 : isHero ? 0.58 : 0.42,
        ease: [0.22, 1, 0.36, 1],
        delay: authSuccess ? 0 : isHero ? 0.06 : 0,
      }}
    >
      <motion.div
        className={cn(
          'relative overflow-hidden rounded-2xl border backdrop-blur-xl sm:rounded-3xl',
          isHero &&
            'border-white/30 bg-[#F7F6F0]/93 shadow-[0_32px_64px_-14px_rgba(0,0,0,0.58)] ring-1 ring-white/40',
          cardNoir
            ? 'border-neutral-200/90 bg-surface-container-lowest shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] text-on-surface'
            : !isHero &&
                'border-neutral-200/90 bg-surface-container-lowest/95 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.12)] ring-1 ring-outline-variant',
        )}
        animate={
          displayError && !reduceMotion && !authSuccess
            ? { x: [0, -6, 6, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.4 }}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-px',
            cardNoir
              ? 'bg-gradient-to-r from-transparent via-primary/55 to-transparent'
              : 'bg-gradient-to-r from-transparent via-primary/45 to-transparent',
          )}
        />

        <div className="relative space-y-6 p-7 sm:p-8">
          <header className="space-y-2">
            {isHero ? (
              <span className="inline-flex rounded-full bg-primary/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Operação Sebratel
              </span>
            ) : (
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
                Operação Sebratel
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-[1.65rem]">
              Acessar plataforma
            </h1>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {isHero
                ? 'Acesso com conta Google para controle de permissões por módulo.'
                : 'Acesso com conta Google para controle de permissões por módulo no painel operacional.'}
            </p>
          </header>

          {(domainPill || emailsWhitelistLabel) && (
            <div
              className={cn(
                'rounded-2xl border p-4 shadow-sm',
                isHero
                  ? 'border-amber-300/80 bg-[#FFFBEB]'
                  : 'border-primary/20 bg-primary/[0.06]',
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-primary',
                    isHero
                      ? 'border-amber-400/50 bg-amber-100/80'
                      : 'border-primary/25 bg-primary/15',
                  )}
                >
                  <Shield className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {isHero ? (
                    <>
                      <p className="text-sm text-on-surface">
                        Domínio liberado nesta fase:{' '}
                        {domainPill ? (
                          <span className="font-semibold text-on-surface">{domainPill}</span>
                        ) : emailsWhitelistLabel ? (
                          <span className="font-semibold text-on-surface">{emailsWhitelistLabel}</span>
                        ) : null}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-on-surface">Acesso restrito ao domínio</p>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          title={domainTooltip}
                          aria-label={domainTooltip}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                      {domainPill ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-primary/90" aria-hidden />
                          <span
                            className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary shadow-sm"
                            title={domainTooltip}
                          >
                            {domainPill}
                          </span>
                        </div>
                      ) : null}
                      {emailsWhitelistLabel ? (
                        <p className="text-xs leading-relaxed text-on-surface-variant">
                          E-mails autorizados nesta fase:{' '}
                          <span className="font-semibold text-on-surface">{emailsWhitelistLabel}</span>
                        </p>
                      ) : null}
                    </>
                  )}

                  {isHero && domainPill ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      title={domainTooltip}
                      aria-label={domainTooltip}
                    >
                      <Info className="h-3.5 w-3.5" />
                      Política de acesso
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayError ? (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex gap-2 rounded-xl border border-rose-200/90 bg-rose-50/95 px-3 py-2.5 text-sm text-rose-900 shadow-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                <span>{displayError}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => void onGoogleSignIn()}
            disabled={busy}
            aria-busy={busy}
            whileHover={reduceMotion || busy ? undefined : { scale: 1.02, y: -1 }}
            whileTap={reduceMotion || busy ? undefined : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={cn(
              'group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60',
              isHero
                ? 'bg-[#FFB800] text-on-surface hover:bg-[#e6a800] hover:shadow-lg'
                : 'bg-primary text-on-surface hover:bg-secondary hover:shadow-lg',
            )}
          >
            {busy ? (
              <Loader2 className="relative z-10 h-5 w-5 animate-spin text-on-surface" aria-hidden />
            ) : isHero ? (
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                <GoogleMark className="h-5 w-5" />
              </span>
            ) : (
              <GoogleMark className="relative z-10 h-5 w-5" />
            )}
            <span className="relative z-10">{busy ? 'A autenticar…' : 'Entrar com Google'}</span>
          </motion.button>

          {isHero ? (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-outline-variant" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">ou</span>
              <div className="h-px flex-1 bg-outline-variant" />
            </div>
          ) : null}

          <p className="text-center text-[11px] text-on-surface-variant">
            <a
              href="mailto:?subject=Acesso%20Opera%C3%A7%C3%A3o%20Sebratel%20%E2%80%94%20suporte&body=Descreva%20o%20problema%20e%20o%20seu%20e-mail%20corporativo."
              className={cn(
                'font-medium text-primary underline-offset-2 transition hover:text-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isHero && 'inline-flex items-center justify-center gap-1.5',
              )}
            >
              {isHero ? <Info className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden /> : null}
              Problemas para acessar?
            </a>
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

export type ModernLoginScreenProps = {
  backgroundVariant: LoginBackgroundVariant
  submitting: boolean
  authBusy: boolean
  /** Erro local (ex.: exceção do popup) */
  localError: string | null
  /** Erro vindo do store (ex.: e-mail não permitido) */
  storeError: string | null
  onGoogleSignIn: () => void
  /** Texto do domínio exibido em pill, ex. `@sebratel.com.br` */
  domainPill: string | null
  /** Lista fixa de e-mails permitidos (quando não há domínio) */
  emailsWhitelistLabel: string | null
  /** Sessão Firebase autenticada — anima saída suave antes do redirect */
  authSuccess?: boolean
}

export function ModernLoginScreen({
  backgroundVariant,
  submitting,
  authBusy,
  localError,
  storeError,
  onGoogleSignIn,
  domainPill,
  emailsWhitelistLabel,
  authSuccess = false,
}: ModernLoginScreenProps) {
  const reduceMotion = useReducedMotion()
  const busy = submitting || authBusy
  const displayError = localError ?? storeError

  const domainTooltip =
    'Apenas contas Google deste domínio podem solicitar acesso nesta fase. Utilize o e-mail corporativo.'

  if (backgroundVariant === 'hero') {
    const heroReduced = !!reduceMotion

    return (
      <div className="relative min-h-svh w-full overflow-hidden bg-[#0c0a08] text-on-surface">
        {/* Imagem em tela inteira + zoom quase imperceptível */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <motion.div
            className="absolute inset-[-3%] bg-cover bg-[center_32%] bg-no-repeat sm:bg-[left_28%_center] lg:bg-[left_22%_center]"
            style={{ backgroundImage: `url(${LOGIN_HERO_IMAGE_SRC})` }}
            animate={heroReduced ? undefined : { scale: [1, 1.032, 1] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
          />
          <HeroAmbientDecor reduced={heroReduced} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/52 via-black/26 to-[#0f0d0b]/58" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/10 to-black/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_78%_45%,rgba(247,246,240,0.16),transparent_52%)]" />
        </div>

        <div className="relative z-10 flex min-h-svh w-full flex-col pb-16 lg:flex-row lg:items-center lg:pb-20">
          <div className="order-1 flex flex-col gap-4 px-6 pt-10 text-white lg:order-1 lg:min-h-svh lg:flex-1 lg:justify-end lg:pb-32 lg:pl-10 lg:pr-6 lg:pt-0 xl:pl-14">
            <motion.div
              className="flex items-center gap-3 drop-shadow-md"
              initial={heroReduced ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible"
                aria-hidden
              >
                <img
                  src={operacaoSebratelMark}
                  alt=""
                  width={48}
                  height={48}
                  decoding="async"
                  className="h-10 w-10 object-contain motion-safe:animate-operacao-mark motion-reduce:animate-none"
                />
              </span>
              <span className="text-base font-bold uppercase tracking-[0.28em] sm:text-lg">
                Operação Sebratel
              </span>
            </motion.div>
            <motion.h2
              className="max-w-xl text-balance text-2xl font-bold leading-[1.15] tracking-tight drop-shadow-lg sm:text-3xl lg:text-[2rem] xl:text-4xl"
              initial={heroReduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              A conexão que move <span className="text-[#FFB800]">o que importa.</span>
            </motion.h2>
            <motion.p
              className="max-w-md text-sm leading-relaxed text-white/90 sm:text-base"
              initial={heroReduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              Tecnologia e pessoas conectadas para levar o melhor todos os dias.
            </motion.p>
          </div>

          <div className="order-2 flex w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:order-2 lg:w-[min(100%,460px)] lg:flex-none lg:px-8 xl:pr-15 motion-safe:-translate-x-5 sm:motion-safe:-translate-x-6 lg:motion-safe:-translate-x-15">
            <LoginScreenCard
              appearance="hero"
              backgroundVariant={backgroundVariant}
              reduceMotion={!!reduceMotion}
              authSuccess={authSuccess}
              displayError={displayError}
              busy={busy}
              onGoogleSignIn={onGoogleSignIn}
              domainPill={domainPill}
              emailsWhitelistLabel={emailsWhitelistLabel}
              domainTooltip={domainTooltip}
            />
          </div>
        </div>

        <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/55 py-2.5 text-center text-[11px] text-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-black/38">
          <span className="inline-flex items-center justify-center gap-2 px-4">
            <Lock className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
            Ambiente seguro e monitorado.
          </span>
        </footer>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex min-h-svh w-full flex-col items-center justify-center px-4 py-10 sm:px-6',
        backgroundVariant === 'noir' ? 'text-surface-container-lowest' : 'text-on-surface',
      )}
    >
      <LoginBackground variant={backgroundVariant} />

      <LoginScreenCard
        appearance="standard"
        backgroundVariant={backgroundVariant}
        reduceMotion={!!reduceMotion}
        authSuccess={authSuccess}
        displayError={displayError}
        busy={busy}
        onGoogleSignIn={onGoogleSignIn}
        domainPill={domainPill}
        emailsWhitelistLabel={emailsWhitelistLabel}
        domainTooltip={domainTooltip}
      />
    </div>
  )
}
