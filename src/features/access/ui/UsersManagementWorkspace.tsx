import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react'
import type {
  SplittersAccessRequest,
  SplittersPermissionSet,
  SplittersUserProfile,
} from '@/features/access/model/access.types'
import {
  inferSplittersUserRole,
  loginRecency,
  SPLITTERS_PRESET_ROLE_IDS,
  SPLITTERS_ROLE_LABEL,
  applySplittersRolePreset,
  type SplittersRoleId,
} from '@/features/access/lib/splittersUserRoles'
import { SplittersUserAvatar } from '@/features/access/ui/SplittersUserAvatar'
import { UserEditDrawer } from '@/features/access/ui/UserEditDrawer'
import { AccessRequestsAdminPanel } from '@/features/access/ui/AccessRequestsAdminPanel'
import { cn } from '@/shared/lib/utils'

type UsersManagementWorkspaceProps = {
  users: SplittersUserProfile[]
  currentUid: string | undefined
  pending: boolean
  isInitialLoading: boolean
  onSaveUser: (payload: { uid: string; permissions: SplittersPermissionSet; isActive: boolean }) => void
  accessRequests?: {
    items: SplittersAccessRequest[]
    loading: boolean
    error: string | null
    busy: boolean
    onApprove: (input: { requestId: string; role: Exclude<SplittersRoleId, 'personalizado'> }) => void
    onReject: (input: { requestId: string; adminNote: string }) => void
  }
}

type SortColumn = 'user' | 'lastLogin' | 'role' | 'status'

const ROLE_SORT_INDEX: Record<SplittersRoleId, number> = {
  admin: 0,
  operador: 1,
  operador_massivas: 2,
  leitura: 3,
  personalizado: 4,
}

function compareUsersForSort(
  a: SplittersUserProfile,
  b: SplittersUserProfile,
  column: SortColumn,
  dir: 'asc' | 'desc',
): number {
  const flip = dir === 'desc' ? -1 : 1
  switch (column) {
    case 'user': {
      const nameA = (a.displayName || '').trim().toLowerCase() || a.email.toLowerCase()
      const nameB = (b.displayName || '').trim().toLowerCase() || b.email.toLowerCase()
      const byName = nameA.localeCompare(nameB, 'pt-BR')
      if (byName !== 0) return byName * flip
      return a.email.localeCompare(b.email, 'pt-BR') * flip
    }
    case 'lastLogin': {
      const ta = a.lastLoginAt?.getTime()
      const tb = b.lastLoginAt?.getTime()
      if (ta == null && tb == null) return 0
      if (ta == null) return 1
      if (tb == null) return -1
      return (ta - tb) * flip
    }
    case 'role': {
      const ra = ROLE_SORT_INDEX[inferSplittersUserRole(a.permissions)]
      const rb = ROLE_SORT_INDEX[inferSplittersUserRole(b.permissions)]
      return (ra - rb) * flip
    }
    case 'status': {
      const sa = a.isActive ? 0 : 1
      const sb = b.isActive ? 0 : 1
      return (sa - sb) * flip
    }
    default:
      return 0
  }
}

function SortHeaderButton({
  label,
  column,
  activeColumn,
  dir,
  onSort,
  className,
}: {
  label: string
  column: SortColumn
  activeColumn: SortColumn
  dir: 'asc' | 'desc'
  onSort: (c: SortColumn) => void
  className?: string
}) {
  const active = activeColumn === column
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        '-mx-1 inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left font-bold tracking-wider transition hover:bg-neutral-200/60 hover:text-neutral-800',
        className,
      )}
    >
      <span className="min-w-0">{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp className="size-3.5 shrink-0 text-amber-700" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5 shrink-0 text-amber-700" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-400 opacity-70" aria-hidden />
      )}
    </button>
  )
}

function LoginDot({ recency }: { recency: ReturnType<typeof loginRecency> }) {
  const cls =
    recency === 'recente'
      ? 'bg-emerald-500'
      : recency === 'medio'
        ? 'bg-amber-500'
        : recency === 'antigo'
          ? 'bg-rose-500'
          : 'bg-neutral-300'
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', cls)} aria-hidden />
}

const ACTION_MENU_W = 208
const ACTION_MENU_MIN_H = 120

function getVisualViewportBox(): {
  top: number
  left: number
  width: number
  height: number
} {
  const vv = window.visualViewport
  if (vv != null) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
    }
  }
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
}

/**
 * Posiciona o menu junto ao botão usando altura/medidas reais (evita última linha invisível).
 */
function placeMenuNearAnchor(
  anchor: DOMRect,
  menuWidth: number,
  menuHeight: number,
): { top: number; left: number } {
  const margin = 4
  const pad = 8
  const vp = getVisualViewportBox()
  const vpBottom = vp.top + vp.height
  const vpRight = vp.left + vp.width

  const mh = Math.max(menuHeight, ACTION_MENU_MIN_H)

  const fitsBelow = anchor.bottom + margin + mh <= vpBottom - pad
  const fitsAbove = anchor.top - margin - mh >= vp.top + pad

  let top: number
  if (fitsBelow) {
    top = anchor.bottom + margin
  } else if (fitsAbove) {
    top = anchor.top - mh - margin
  } else {
    top = vpBottom - pad - mh
  }

  top = Math.max(vp.top + pad, Math.min(top, vpBottom - pad - mh))

  let left = anchor.right - menuWidth
  left = Math.max(vp.left + pad, Math.min(left, vpRight - pad - menuWidth))

  return { top, left }
}

function UsersTableSkeleton() {
  return (
    <div className="divide-y divide-neutral-100">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-4">
          <div className="size-10 rounded-full bg-neutral-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-neutral-200" />
            <div className="h-3 w-56 rounded bg-neutral-100" />
          </div>
          <div className="hidden h-8 w-24 rounded-lg bg-neutral-100 md:block" />
          <div className="hidden h-8 w-20 rounded-lg bg-neutral-100 lg:block" />
        </div>
      ))}
    </div>
  )
}

export function UsersManagementWorkspace({
  users,
  currentUid,
  pending,
  isInitialLoading,
  onSaveUser,
  accessRequests,
}: UsersManagementWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<SplittersRoleId | 'all'>('all')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [editUser, setEditUser] = useState<SplittersUserProfile | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [actionMenu, setActionMenu] = useState<
    null | {
      user: SplittersUserProfile
      anchor: DOMRect
      placed?: { top: number; left: number }
    }
  >(null)
  const actionMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sort, setSort] = useState<{ column: SortColumn; dir: 'asc' | 'desc' }>({
    column: 'user',
    dir: 'asc',
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false
      if (statusFilter === 'inactive' && u.isActive) return false
      const role = inferSplittersUserRole(u.permissions)
      if (roleFilter !== 'all' && role !== roleFilter) return false
      if (q === '') return true
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      )
    })
  }, [users, search, statusFilter, roleFilter])

  const sortedRows = useMemo(() => {
    const next = [...filtered]
    next.sort((a, b) => compareUsersForSort(a, b, sort.column, sort.dir))
    return next
  }, [filtered, sort.column, sort.dir])

  const toggleSort = (column: SortColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { column, dir: 'asc' },
    )
  }

  const ariaSortFor = (column: SortColumn): 'ascending' | 'descending' | 'none' =>
    sort.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'

  const toggleSelect = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    if (selected.size === sortedRows.length && sortedRows.length > 0) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(sortedRows.map((u) => u.uid)))
  }

  const clearSelection = () => setSelected(new Set())

  const bulkSetActive = (active: boolean) => {
    const targets = filtered.filter((u) => selected.has(u.uid) && u.uid !== currentUid)
    if (targets.length === 0) {
      setToast(active ? 'Nenhum usuário elegível para ativar.' : 'Não é possível desativar a si mesmo.')
      return
    }
    for (const u of targets) {
      onSaveUser({ uid: u.uid, permissions: u.permissions, isActive: active })
    }
    clearSelection()
  }

  const bulkApplyRole = (role: Exclude<SplittersRoleId, 'personalizado'>) => {
    const targets = filtered.filter((u) => selected.has(u.uid))
    const perms = applySplittersRolePreset(role)
    for (const u of targets) {
      if (u.uid === currentUid) continue
      onSaveUser({ uid: u.uid, permissions: perms, isActive: u.isActive })
    }
    clearSelection()
    setToast(
      `Papel "${SPLITTERS_ROLE_LABEL[role]}" aplicado aos selecionados (o seu usuário não é alterado em lote).`,
    )
  }

  const openEdit = (u: SplittersUserProfile) => {
    setEditUser(u)
    setDrawerOpen(true)
    setActionMenu(null)
  }

  useLayoutEffect(() => {
    if (actionMenu === null || actionMenu.placed !== undefined) return
    const el = actionMenuPanelRef.current
    if (el === null) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setActionMenu((prev) => {
      if (!prev || prev.placed !== undefined) return prev
      return {
        ...prev,
        placed: placeMenuNearAnchor(prev.anchor, w, Math.max(h, 1)),
      }
    })
  }, [actionMenu])

  useEffect(() => {
    if (actionMenu === null) return
    const close = () => setActionMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [actionMenu])

  return (
    <div className="space-y-4 pb-20">
      {toast ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          {toast}
          <button
            type="button"
            className="ml-3 text-xs font-semibold underline"
            onClick={() => setToast(null)}
          >
            Fechar
          </button>
        </div>
      ) : null}

      {accessRequests ? (
        <AccessRequestsAdminPanel
          requests={accessRequests.items}
          loading={accessRequests.loading}
          error={accessRequests.error}
          busy={accessRequests.busy}
          currentUid={currentUid}
          onApprove={accessRequests.onApprove}
          onReject={accessRequests.onReject}
        />
      ) : null}

      {/* Toolbar */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-transparent text-xs font-bold text-neutral-900 outline-none"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600">
              Papel
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="max-w-[10rem] bg-transparent text-xs font-bold text-neutral-900 outline-none sm:max-w-none"
              >
                <option value="all">Todos</option>
                {SPLITTERS_PRESET_ROLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {SPLITTERS_ROLE_LABEL[id]}
                  </option>
                ))}
                <option value="personalizado">{SPLITTERS_ROLE_LABEL.personalizado}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              aria-label="Adicionar usuário"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-800/10 bg-amber-400 px-3 py-2.5 text-xs font-bold text-neutral-900 shadow-sm transition hover:bg-amber-500 sm:px-4"
            >
              <UserPlus className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Adicionar usuário</span>
            </button>
          </div>
        </div>

        {selected.size > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
            <span className="text-xs font-bold text-neutral-800">
              {selected.size} selecionado{selected.size === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkSetActive(true)}
              className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm ring-1 ring-neutral-200/80 hover:bg-neutral-50 disabled:opacity-50"
            >
              Ativar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkSetActive(false)}
              className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm ring-1 ring-neutral-200/80 hover:bg-neutral-50 disabled:opacity-50"
            >
              Desativar
            </button>
            <span className="text-neutral-300">|</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Aplicar papel</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkApplyRole('leitura')}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white/80"
            >
              Leitura
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkApplyRole('operador')}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white/80"
            >
              {SPLITTERS_ROLE_LABEL.operador}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkApplyRole('operador_massivas')}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white/80"
            >
              Operador (massivas)
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => bulkApplyRole('admin')}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-white/80"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-xs font-semibold text-neutral-600 underline"
            >
              Limpar seleção
            </button>
          </div>
        ) : null}
      </div>

      {/* Mobile: cards (sem scroll horizontal da tabela) */}
      <div className="space-y-3 md:hidden">
        {isInitialLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`m-sk-${i}`}
              className="animate-pulse rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="size-11 shrink-0 rounded-full bg-neutral-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-neutral-200" />
                  <div className="h-3 w-full max-w-xs rounded bg-neutral-100" />
                </div>
              </div>
              <div className="mt-4 h-10 w-full rounded-xl bg-neutral-100" />
            </div>
          ))
        ) : (
          sortedRows.map((u) => {
            const role = inferSplittersUserRole(u.permissions)
            const rec = loginRecency(u.lastLoginAt)
            const isSelf = u.uid === currentUid
            return (
              <article
                key={`m-${u.uid}`}
                className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1.5 size-[18px] shrink-0 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                    checked={selected.has(u.uid)}
                    onChange={() => toggleSelect(u.uid)}
                    aria-label={`Selecionar ${u.email}`}
                  />
                  <SplittersUserAvatar user={u} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900">{u.displayName || '—'}</p>
                    <p className="break-all text-xs text-neutral-500">{u.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (actionMenu?.user.uid === u.uid) {
                        setActionMenu(null)
                        return
                      }
                      setActionMenu({
                        user: u,
                        anchor: e.currentTarget.getBoundingClientRect(),
                      })
                    }}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                    aria-label={`Mais ações: ${u.email}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>

                <label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Papel
                  <select
                    value={role}
                    disabled={pending || isSelf}
                    onChange={(e) => {
                      const next = e.target.value as SplittersRoleId
                      if (next === 'personalizado') {
                        openEdit(u)
                        return
                      }
                      onSaveUser({
                        uid: u.uid,
                        permissions: applySplittersRolePreset(next as Exclude<SplittersRoleId, 'personalizado'>),
                        isActive: u.isActive,
                      })
                    }}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
                  >
                    {([...SPLITTERS_PRESET_ROLE_IDS, 'personalizado'] as const).map((id) => (
                      <option key={id} value={id}>
                        {SPLITTERS_ROLE_LABEL[id]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
                      u.isActive
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                        : 'bg-neutral-200 text-neutral-600 ring-1 ring-neutral-300/80',
                    )}
                  >
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <LoginDot recency={rec} />
                    <span>
                      {u.lastLoginAt ? u.lastLoginAt.toLocaleDateString('pt-BR') : 'Sem login'}
                    </span>
                  </div>
                </div>

              </article>
            )
          })
        )}
        {!isInitialLoading && sortedRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-10 text-center text-sm text-neutral-500">
            Nenhum usuário corresponde aos filtros atuais.
          </p>
        ) : null}
      </div>

      {/* Tabela — desktop / tablet */}
      <div className="hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm md:block">
        <div className="overflow-x-auto pb-8">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                    checked={sortedRows.length > 0 && selected.size === sortedRows.length}
                    onChange={toggleSelectAllVisible}
                    aria-label="Selecionar todos visíveis"
                  />
                </th>
                <th className="px-3 py-3" aria-sort={ariaSortFor('user')}>
                  <SortHeaderButton
                    label="Usuário"
                    column="user"
                    activeColumn={sort.column}
                    dir={sort.dir}
                    onSort={toggleSort}
                  />
                </th>
                <th className="hidden px-3 py-3 md:table-cell" aria-sort={ariaSortFor('lastLogin')}>
                  <SortHeaderButton
                    label="Último acesso"
                    column="lastLogin"
                    activeColumn={sort.column}
                    dir={sort.dir}
                    onSort={toggleSort}
                  />
                </th>
                <th className="hidden px-3 py-3 lg:table-cell" aria-sort={ariaSortFor('role')}>
                  <SortHeaderButton
                    label="Papel"
                    column="role"
                    activeColumn={sort.column}
                    dir={sort.dir}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-3" aria-sort={ariaSortFor('status')}>
                  <SortHeaderButton
                    label="Status"
                    column="status"
                    activeColumn={sort.column}
                    dir={sort.dir}
                    onSort={toggleSort}
                  />
                </th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isInitialLoading ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <UsersTableSkeleton />
                  </td>
                </tr>
              ) : null}
              {sortedRows.map((u) => {
                const role = inferSplittersUserRole(u.permissions)
                const rec = loginRecency(u.lastLoginAt)
                const isSelf = u.uid === currentUid
                return (
                  <tr key={u.uid} className="hover:bg-neutral-50/80">
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                        checked={selected.has(u.uid)}
                        onChange={() => toggleSelect(u.uid)}
                        aria-label={`Selecionar ${u.email}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <SplittersUserAvatar user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-900">{u.displayName || '—'}</p>
                          <p className="truncate text-xs text-neutral-500">{u.email}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-900/80 md:hidden">
                            {SPLITTERS_ROLE_LABEL[role]}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 md:hidden">
                            <LoginDot recency={rec} />
                            <span className="text-[10px] text-neutral-500">
                              {u.lastLoginAt ? u.lastLoginAt.toLocaleDateString('pt-BR') : 'Nunca'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 align-middle md:table-cell">
                      <div className="flex items-center gap-2">
                        <LoginDot recency={rec} />
                        <span className="text-sm text-neutral-700">
                          {u.lastLoginAt ? u.lastLoginAt.toLocaleString('pt-BR') : '—'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        {rec === 'recente'
                          ? 'Ativo recentemente'
                          : rec === 'medio'
                            ? 'Há algum tempo'
                            : rec === 'antigo'
                              ? 'Há muito tempo sem login'
                              : 'Sem registro'}
                      </p>
                    </td>
                    <td className="hidden align-middle lg:table-cell">
                      <select
                        value={role}
                        disabled={pending || isSelf}
                        title={isSelf ? 'Altere seu papel com outra conta admin' : 'Alterar papel (preset)'}
                        onChange={(e) => {
                          const next = e.target.value as SplittersRoleId
                          if (next === 'personalizado') {
                            openEdit(u)
                            return
                          }
                          onSaveUser({
                            uid: u.uid,
                            permissions: applySplittersRolePreset(next as Exclude<SplittersRoleId, 'personalizado'>),
                            isActive: u.isActive,
                          })
                        }}
                        className="max-w-[11rem] rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {([...SPLITTERS_PRESET_ROLE_IDS, 'personalizado'] as const).map((id) => (
                          <option key={id} value={id}>
                            {SPLITTERS_ROLE_LABEL[id]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80'
                              : 'bg-neutral-200 text-neutral-600 ring-1 ring-neutral-300/80',
                          )}
                        >
                          {u.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        {u.permissions.isAdmin ? (
                          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-200/80">
                            Admin
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (actionMenu?.user.uid === u.uid) {
                            setActionMenu(null)
                            return
                          }
                          setActionMenu({
                            user: u,
                            anchor: e.currentTarget.getBoundingClientRect(),
                          })
                        }}
                        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label={`Mais ações: ${u.email}`}
                        aria-expanded={actionMenu?.user.uid === u.uid}
                      >
                        <MoreHorizontal className="size-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {sortedRows.length === 0 && !isInitialLoading ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">
            Nenhum usuário corresponde aos filtros atuais.
          </p>
        ) : null}
      </div>

      {typeof document !== 'undefined' && actionMenu !== null
        ? createPortal(
            <>
              {actionMenu.placed ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                  aria-label="Fechar menu"
                  onClick={() => setActionMenu(null)}
                />
              ) : null}
              <div
                ref={actionMenuPanelRef}
                role="menu"
                className="pointer-events-auto fixed z-[9999] max-h-[min(22rem,calc(100dvh-16px))] w-52 overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-2xl outline-none ring-1 ring-black/5"
                style={
                  actionMenu.placed
                    ? { top: actionMenu.placed.top, left: actionMenu.placed.left, visibility: 'visible' }
                    : {
                        top: 0,
                        left: 0,
                        visibility: 'hidden',
                        pointerEvents: 'none',
                      }
                }
              >
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                  onClick={() => openEdit(actionMenu.user)}
                >
                  Editar permissões…
                </button>
                <button
                  type="button"
                  disabled={pending || actionMenu.user.uid === currentUid}
                  className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                  onClick={() => {
                    const u = actionMenu.user
                    onSaveUser({
                      uid: u.uid,
                      permissions: u.permissions,
                      isActive: !u.isActive,
                    })
                    setActionMenu(null)
                  }}
                >
                  {actionMenu.user.isActive ? 'Desativar conta' : 'Ativar conta'}
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                  onClick={() => {
                    setActionMenu(null)
                    setToast(
                      'Acesso via Google: a recuperação de senha é feita na conta Google do usuário. ' +
                        'Se usar outro provedor de auth no futuro, integre reset por e-mail no backend.',
                    )
                  }}
                >
                  Redefinir acesso…
                </button>
              </div>
            </>,
            document.body,
          )
        : null}

      <UserEditDrawer
        user={editUser}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditUser(null)
        }}
        onSave={(payload) => {
          onSaveUser(payload)
          setDrawerOpen(false)
          setEditUser(null)
        }}
        isCurrentUser={editUser != null && editUser.uid === currentUid}
        pending={pending}
      />

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
            aria-label="Fechar"
            onClick={() => setInviteOpen(false)}
          />
          <div className="relative max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
                <Plus className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Adicionar usuário</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                  Novos perfis são criados automaticamente no <strong>primeiro login</strong> com a conta corporativa
                  (Google). Garanta que o e-mail esteja na lista de domínios ou e-mails permitidos em{' '}
                  <code className="rounded bg-neutral-100 px-1 text-xs">env</code>.
                </p>
                <p className="mt-2 text-sm text-neutral-600">
                  Depois do primeiro acesso, o usuário aparece nesta lista e você pode ajustar papel e permissões.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="mt-6 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-neutral-900 hover:bg-amber-600"
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
