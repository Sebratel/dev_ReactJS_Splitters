import { useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { SplittersUserAvatar } from '@/features/access/ui/SplittersUserAvatar'
import { inferSplittersUserRole, SPLITTERS_ROLE_LABEL } from '@/features/access/lib/splittersUserRoles'

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const profile = useAccessAuthStore((s) => s.profile)
  const signOutUser = useAccessAuthStore((s) => s.signOutUser)

  if (!profile) return null

  const roleLabel = SPLITTERS_ROLE_LABEL[inferSplittersUserRole(profile.permissions)]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu do perfil"
        className={cn(
          'flex items-center gap-2 rounded-full border border-neutral-200 dark:border-white/10 bg-surface-container-low py-1 pl-1 pr-1.5 transition hover:bg-surface-container-low/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:pr-2.5',
        )}
      >
        <SplittersUserAvatar user={profile} size="sm" className="size-8" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-bold leading-tight text-on-surface">
            {profile.displayName}
          </span>
          <span className="block text-[10px] leading-tight text-on-surface-variant">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 shrink-0 text-on-surface-variant sm:block" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-xl">
            <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-white/5 px-4 py-3">
              <SplittersUserAvatar user={profile} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-on-surface">{profile.displayName}</p>
                <p className="truncate text-xs text-on-surface-variant">{profile.email}</p>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {roleLabel}
                </span>
              </div>
            </div>
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void signOutUser()
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-on-surface-variant transition hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-200"
              >
                <LogOut className="size-4" aria-hidden />
                Sair
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
