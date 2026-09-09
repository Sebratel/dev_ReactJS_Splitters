/**
 * Tema claro/escuro da aplicação.
 *
 * O dark mode é ativado pela classe `.dark` no <html> (ver `.dark` em index.css,
 * que redefine os tokens de cor do @theme). Aqui ficam a leitura da preferência
 * (localStorage → senão `prefers-color-scheme`) e a alternância persistida.
 *
 * `applyInitialTheme()` deve rodar ANTES do primeiro render (em main.tsx) para
 * não piscar (flash of wrong theme).
 */

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme'

/** Lê a preferência efetiva: escolha salva pelo usuário ou, na ausência, o SO. */
export function getPreferredTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Aplica a classe `.dark` conforme a preferência atual. Não persiste nada. */
export function applyInitialTheme(): void {
  document.documentElement.classList.toggle('dark', getPreferredTheme() === 'dark')
}

/** Define o tema, aplica no DOM e persiste a escolha do usuário. */
export function setTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

/** Alterna entre claro/escuro a partir do estado atual do DOM e persiste. */
export function toggleTheme(): ThemeMode {
  const next: ThemeMode = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
  setTheme(next)
  return next
}
