import { env } from '@/shared/config/env'

/** PNG em `public/` quando não há `VITE_ACCESS_REQUEST_FAB_IMAGE`. */
export const DEFAULT_ACCESS_REQUEST_FAB_IMAGE_PATH = '/access-request-fab.png'

/** URL absoluta (`https:` / `data:` / protocol-relative `//`). */
function isAbsoluteOrSpecialUrl(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//') || s.startsWith('data:')
}

/**
 * Prefixa caminhos relativos ao `import.meta.env.BASE_URL` (deploy com subpath, ex. `/app/`).
 */
export function withVitePublicBase(assetPath: string): string {
  const trimmed = assetPath.trim()
  if (trimmed === '' || isAbsoluteOrSpecialUrl(trimmed)) return trimmed
  const base = import.meta.env.BASE_URL ?? '/'
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (base === '/') return path
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  return `${b}${path}`
}

export function normalizeAccessRequestFabUrl(raw: string): string {
  const t = raw.trim()
  if (t === '') return ''
  if (t.includes('://') || t.startsWith('/')) return t
  return `/${t}`
}

export function resolveAccessRequestFabImageSrc(): string {
  const fromEnv = normalizeAccessRequestFabUrl(env.accessRequestFabImage)
  if (fromEnv !== '') return isAbsoluteOrSpecialUrl(fromEnv) ? fromEnv : withVitePublicBase(fromEnv)
  return withVitePublicBase(DEFAULT_ACCESS_REQUEST_FAB_IMAGE_PATH)
}

/** PNG em `public/` quando não há `VITE_ISA_HERO_IMAGE`. */
export const DEFAULT_ISA_HERO_IMAGE_PATH = '/isa-hero.png'

export function resolveIsaHeroImageSrc(): string {
  const fromEnv = normalizeAccessRequestFabUrl(env.isaHeroImage)
  const raw = fromEnv !== '' ? fromEnv : DEFAULT_ISA_HERO_IMAGE_PATH
  return isAbsoluteOrSpecialUrl(raw) ? raw : withVitePublicBase(raw)
}

const PRELOAD_LINK_ID = 'preload-access-request-fab-image'

/**
 * Dispara o fetch da imagem do FAB o mais cedo possível (antes da rota montar o botão),
 * para aquecer cache HTTP e reduzir o tempo até `onLoad` no `<img>`.
 */
export function preloadAccessRequestFabImage(): void {
  if (typeof document === 'undefined') return
  const src = resolveAccessRequestFabImageSrc()
  if (src === '') return
  if (document.getElementById(PRELOAD_LINK_ID)) return
  const link = document.createElement('link')
  link.id = PRELOAD_LINK_ID
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  document.head.appendChild(link)
}

const PRELOAD_ISA_HERO_ID = 'preload-isa-hero-image'

/** Pré-carrega o retrato ISA do hero (primeira paint mais rápida). */
export function preloadIsaHeroImage(): void {
  if (typeof document === 'undefined') return
  const src = resolveIsaHeroImageSrc()
  if (src === '') return
  if (document.getElementById(PRELOAD_ISA_HERO_ID)) return
  const link = document.createElement('link')
  link.id = PRELOAD_ISA_HERO_ID
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  document.head.appendChild(link)
}
