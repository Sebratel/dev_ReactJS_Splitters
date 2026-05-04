import { env } from '@/shared/config/env'

/** PNG em `public/` quando não há `VITE_ACCESS_REQUEST_FAB_IMAGE`. */
export const DEFAULT_ACCESS_REQUEST_FAB_IMAGE_PATH = '/access-request-fab.png'

export function normalizeAccessRequestFabUrl(raw: string): string {
  const t = raw.trim()
  if (t === '') return ''
  if (t.includes('://') || t.startsWith('/')) return t
  return `/${t}`
}

export function resolveAccessRequestFabImageSrc(): string {
  const fromEnv = normalizeAccessRequestFabUrl(env.accessRequestFabImage)
  if (fromEnv !== '') return fromEnv
  return DEFAULT_ACCESS_REQUEST_FAB_IMAGE_PATH
}

/** PNG em `public/` quando não há `VITE_ISA_HERO_IMAGE`. */
export const DEFAULT_ISA_HERO_IMAGE_PATH = '/isa-hero.png'

export function resolveIsaHeroImageSrc(): string {
  const fromEnv = normalizeAccessRequestFabUrl(env.isaHeroImage)
  if (fromEnv !== '') return fromEnv
  return DEFAULT_ISA_HERO_IMAGE_PATH
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
