import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { SplittersPermissionSet, SplittersUserProfile } from '@/features/access/model/access.types'
import {
  inferSplittersUserRole,
  SPLITTERS_PRESET_ROLE_IDS,
  SPLITTERS_ROLE_DESCRIPTION,
  SPLITTERS_ROLE_LABEL,
  applySplittersRolePreset,
  type SplittersRoleId,
} from '@/features/access/lib/splittersUserRoles'
import { SplittersUserAvatar } from '@/features/access/ui/SplittersUserAvatar'
import { cn } from '@/shared/lib/utils'

type UserEditDrawerProps = {
  user: SplittersUserProfile | null
  open: boolean
  onClose: () => void
  onSave: (payload: { uid: string; permissions: SplittersPermissionSet; isActive: boolean }) => void
  isCurrentUser: boolean
  pending: boolean
}

function SwitchRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-2',
          checked ? 'border-amber-500 bg-amber-500' : 'border-neutral-300 bg-neutral-200',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export function UserEditDrawer({
  user,
  open,
  onClose,
  onSave,
  isCurrentUser,
  pending,
}: UserEditDrawerProps) {
  const [permissions, setPermissions] = useState<SplittersPermissionSet | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [role, setRole] = useState<SplittersRoleId>('operador')

  useEffect(() => {
    if (!user || !open) return
    setPermissions({ ...user.permissions })
    setIsActive(user.isActive)
    setRole(inferSplittersUserRole(user.permissions))
  }, [user, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !user || !permissions) return null

  const setRoleChoice = (next: SplittersRoleId) => {
    setRole(next)
    if (next === 'personalizado') return
    setPermissions(applySplittersRolePreset(next))
  }

  const patchPermissions = (patch: Partial<SplittersPermissionSet>) => {
    setRole('personalizado')
    setPermissions((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const handleSave = () => {
    onSave({ uid: user.uid, permissions, isActive })
  }

  const canOpenMassivaDisabled = !permissions.canViewMassiva

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="user-edit-title">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300 sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <SplittersUserAvatar user={user} size="md" className="mt-0.5" />
            <div className="min-w-0">
              <p id="user-edit-title" className="text-lg font-semibold tracking-tight text-neutral-900">
                Editar usuário
              </p>
              <p className="mt-1 truncate text-sm text-neutral-600">{user.displayName || 'Sem nome'}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Dados básicos</h3>
            <SwitchRow
              title="Conta ativa"
              description="Usuário inativo não acessa o sistema após login."
              checked={isActive}
              disabled={pending || isCurrentUser}
              onCheckedChange={setIsActive}
            />
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Papel (preset)</h3>
            <p className="text-xs text-neutral-600">
              Presets aplicam um pacote de permissões. Escolha <strong>Personalizado</strong> para ajustar item a item
              abaixo.
            </p>
            <label className="block">
              <span className="sr-only">Papel</span>
              <select
                value={role}
                disabled={pending}
                onChange={(e) => setRoleChoice(e.target.value as SplittersRoleId)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                {([...SPLITTERS_PRESET_ROLE_IDS, 'personalizado'] as const).map((id) => (
                  <option
                    key={id}
                    value={id}
                    title={
                      id !== 'personalizado'
                        ? SPLITTERS_ROLE_DESCRIPTION[id as Exclude<SplittersRoleId, 'personalizado'>]
                        : undefined
                    }
                  >
                    {SPLITTERS_ROLE_LABEL[id]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Operações</h3>
            <SwitchRow
              title="Ver splitters"
              description="Acesso à listagem e detalhes de equipamentos."
              checked={permissions.canViewSplitters}
              disabled={pending}
              onCheckedChange={(v) => patchPermissions({ canViewSplitters: v })}
            />
            <SwitchRow
              title="Ver massivas"
              description="Visualizar protocolos e painel de massivas."
              checked={permissions.canViewMassiva}
              disabled={pending}
              onCheckedChange={(v) =>
                patchPermissions({
                  canViewMassiva: v,
                  canOpenMassiva: v ? permissions.canOpenMassiva : false,
                })
              }
            />
            <SwitchRow
              title="Abrir massiva"
              description="Permite abrir novos protocolos (depende de ver massivas)."
              checked={permissions.canOpenMassiva}
              disabled={pending || canOpenMassivaDisabled}
              onCheckedChange={(v) => patchPermissions({ canOpenMassiva: v })}
            />
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Inteligência</h3>
            <SwitchRow
              title="Ver inteligência de rede"
              description="Painel analítico (ocupação, risco, mapas)."
              checked={permissions.canViewIntelligence}
              disabled={pending}
              onCheckedChange={(v) => patchPermissions({ canViewIntelligence: v })}
            />
            <SwitchRow
              title="Usar assistente ISA"
              description="Libera o modo conversacional da ISA para análises complexas do time de planejamento."
              checked={permissions.canUsePlanningAssistant}
              disabled={pending}
              onCheckedChange={(v) => patchPermissions({ canUsePlanningAssistant: v })}
            />
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Administração</h3>
            <SwitchRow
              title="Administrador"
              description="Gestão de usuários e permissões. Não pode ser removido do próprio usuário."
              checked={permissions.isAdmin}
              disabled={pending || isCurrentUser}
              onCheckedChange={(v) => patchPermissions({ isAdmin: v })}
            />
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
          >
            {pending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </aside>
    </div>
  )
}


