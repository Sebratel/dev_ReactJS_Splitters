import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { getPreferredTheme, toggleTheme, type ThemeMode } from '@/shared/lib/theme'

/**
 * Botão de alternância claro/escuro. Estado inicial vem da preferência efetiva
 * (localStorage → SO). Usa `toggleTheme()`, que aplica a classe `.dark` no
 * <html> e persiste a escolha. `collapsed` = modo ícone (sidebar recolhido).
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>(() => getPreferredTheme())
  const isDark = mode === 'dark'
  const label = isDark ? 'Tema claro' : 'Tema escuro'

  return (
    <button
      type="button"
      onClick={() => setMode(toggleTheme())}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cn(
        'flex min-h-[44px] items-center rounded-2xl border border-transparent text-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container-low hover:text-on-surface',
        collapsed ? 'w-full justify-center px-0 py-3.5' : 'w-full gap-4 px-4 py-3.5',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
        {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
      </span>
      {!collapsed ? label : null}
    </button>
  )
}
