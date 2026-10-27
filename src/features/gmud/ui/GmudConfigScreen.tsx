import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2, Plus, Trash2, Loader2, UserPlus, Mail, X, Users } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import {
  fetchGmudConfigLists,
  addGmudConfigItem,
  removeGmudConfigItem,
  type GmudConfigItem,
} from '@/features/gmud/api/gmudConfigLists'
import {
  fetchTeamApprovers,
  addTeamApprover,
  removeTeamApprover,
  type TeamApprover,
} from '@/features/gmud/api/gmudTeamApprovers'
import { listSplittersUsers, type SplittersUserProfile } from '@/features/access/api/firestoreUsers'

const LIST_META: Record<string, { label: string; hint: string }> = {
  areas: {
    label: 'Setores / Áreas',
    hint: 'Setores que aparecem nos campos "Áreas impactadas", "Áreas afetadas" e "Áreas a notificar".',
  },
  equipes: {
    label: 'Equipes',
    hint: 'Clique em uma equipe para gerenciar os aprovadores de e-mail (fluxo N8N).',
  },
  processos: {
    label: 'Processos de negócio',
    hint: 'Processos que aparecem nos campos "Processos de negócio" e "Processos dependentes".',
  },
  sistemas_internos: {
    label: 'Sistemas internos',
    hint: 'Catálogo de sistemas internos disponíveis no formulário de Sistemas Internos.',
  },
  sistemas_externos: {
    label: 'Sistemas externos',
    hint: 'Catálogo de sistemas externos (fornecedores) disponíveis no formulário de Sistemas Externos.',
  },
}

const CARD = 'rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest'
const FIELD =
  'flex-1 rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30'

// ---------------------------------------------------------------------------
// Modal de aprovadores de uma equipe
// ---------------------------------------------------------------------------
function TeamApproversModal({
  equipeItem,
  approvers,
  allUsers,
  usersLoading,
  refetch,
  onClose,
}: {
  equipeItem: GmudConfigItem
  approvers: TeamApprover[]
  allUsers: SplittersUserProfile[]
  usersLoading: boolean
  refetch: () => void
  onClose: () => void
}) {
  const [selectedEmail, setSelectedEmail] = useState('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const availableUsers = allUsers.filter(
    (u) => u.isActive && !approvers.some((a) => a.userEmail === u.email),
  )

  const filteredUsers = search.trim() === ''
    ? availableUsers
    : availableUsers.filter((u) => {
        const q = search.toLowerCase()
        return u.email.toLowerCase().includes(q) || (u.displayName ?? '').toLowerCase().includes(q)
      })

  const addMutation = useMutation({
    mutationFn: () => {
      const user = allUsers.find((u) => u.email === selectedEmail)
      return addTeamApprover(equipeItem.id, selectedEmail, user?.displayName ?? null)
    },
    onSuccess: () => {
      setSelectedEmail('')
      qc.invalidateQueries({ queryKey: ['gmud-team-approvers'] })
      refetch()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeTeamApprover(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmud-team-approvers'] })
      refetch()
    },
  })

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-full max-w-xl flex-col rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest shadow-2xl" style={{width: 'min(560px, calc(100vw - 32px))' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200/70 dark:border-white/8 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mail size={15} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-on-surface">Aprovadores — {equipeItem.label}</p>
              <p className="text-xs text-on-surface-variant">E-mails notificados via N8N ao abrir uma GMUD</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-neutral-100 dark:hover:bg-white/8"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista de aprovadores */}
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {approvers.length === 0 ? (
            <p className="py-3 text-center text-sm text-on-surface-variant/60 italic">Nenhum aprovador cadastrado.</p>
          ) : (
            <ul className="space-y-1.5">
              {approvers.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 dark:border-white/8 bg-surface-container px-3 py-2"
                >
                  <div className="min-w-0">
                    {a.userDisplayName ? (
                      <p className="text-sm font-medium text-on-surface truncate">{a.userDisplayName}</p>
                    ) : null}
                    <p className="text-xs text-on-surface-variant truncate">{a.userEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remover "${a.userEmail}" como aprovador?`)) {
                        removeMutation.mutate(a.id)
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-on-surface-variant ring-1 ring-neutral-200/70 dark:ring-white/10 transition hover:text-error hover:ring-error/40 disabled:opacity-40"
                    title="Remover aprovador"
                  >
                    {removeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Adicionar aprovador */}
          <div className="border-t border-neutral-200/60 dark:border-white/6 pt-3 space-y-2">
            <p className="text-xs font-semibold text-on-surface-variant">Adicionar aprovador</p>
            {addMutation.isError ? (
              <p className="text-xs text-error">
                {addMutation.error instanceof Error ? addMutation.error.message : 'Erro ao adicionar.'}
              </p>
            ) : null}
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (selectedEmail) addMutation.mutate()
              }}
            >
              <div className="relative">
                <input
                  className={FIELD + ' w-full'}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedEmail('') }}
                  placeholder="Buscar por nome ou e-mail…"
                  disabled={usersLoading || availableUsers.length === 0}
                  autoComplete="off"
                />
                {search.trim() !== '' && !selectedEmail && filteredUsers.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest shadow-lg max-h-48 overflow-y-auto">
                    {filteredUsers.map((u) => (
                      <li
                        key={u.uid}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSelectedEmail(u.email)
                          setSearch(u.displayName ? `${u.displayName} (${u.email})` : u.email)
                        }}
                        className={`cursor-pointer px-3 py-2 text-sm transition hover:bg-primary/8 dark:hover:bg-primary/15 ${selectedEmail === u.email ? 'bg-primary/10 font-medium' : ''}`}
                      >
                        {u.displayName
                          ? <><span className="text-on-surface">{u.displayName}</span><span className="ml-1.5 text-xs text-on-surface-variant">{u.email}</span></>
                          : <span className="text-on-surface">{u.email}</span>
                        }
                      </li>
                    ))}
                  </ul>
                )}
                {search.trim() !== '' && !selectedEmail && filteredUsers.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface-variant/60 shadow-lg italic">
                    Nenhum resultado encontrado.
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={addMutation.isPending || selectedEmail === ''}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Adicionar aprovador
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel de uma lista configurável
// ---------------------------------------------------------------------------
function ListPanel({
  listKey,
  items,
  refetch,
  approversMap,
  allUsers,
  usersLoading,
  refetchApprovers,
}: {
  listKey: string
  items: GmudConfigItem[]
  refetch: () => void
  approversMap?: Record<number, TeamApprover[]>
  allUsers?: SplittersUserProfile[]
  usersLoading?: boolean
  refetchApprovers?: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [openApproversForId, setOpenApproversForId] = useState<number | null>(null)
  const qc = useQueryClient()
  const meta = LIST_META[listKey] ?? { label: listKey, hint: '' }
  const isEquipes = listKey === 'equipes'

  const addMutation = useMutation({
    mutationFn: () => addGmudConfigItem(listKey, newLabel.trim()),
    onSuccess: () => {
      setNewLabel('')
      qc.invalidateQueries({ queryKey: ['gmud-config-lists'] })
      refetch()
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeGmudConfigItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmud-config-lists'] })
      refetch()
    },
  })

  const openEquipeItem = openApproversForId != null
    ? items.find((i) => i.id === openApproversForId) ?? null
    : null

  return (
    <>
      <div className={CARD}>
        <div className="border-b border-neutral-200/70 dark:border-white/8 px-4 py-3">
          <p className="font-semibold text-sm text-on-surface">{meta.label}</p>
          {meta.hint ? <p className="mt-0.5 text-xs text-on-surface-variant">{meta.hint}</p> : null}
        </div>

        <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
          {items.length === 0 ? (
            <li className="px-4 py-4 text-sm text-on-surface-variant/60 italic">Nenhum item cadastrado.</li>
          ) : (
            items.map((item) => {
              const count = approversMap?.[item.id]?.length ?? 0
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  {isEquipes ? (
                    <button
                      type="button"
                      onClick={() => setOpenApproversForId(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title="Gerenciar aprovadores"
                    >
                      <span className="text-sm text-on-surface">{item.label}</span>
                      {count > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Users size={10} />
                          {count}
                        </span>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant/40 italic">sem aprovadores</span>
                      )}
                    </button>
                  ) : (
                    <span className="text-sm text-on-surface">{item.label}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remover "${item.label}" da lista "${meta.label}"?`)) {
                        removeMutation.mutate(item.id)
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-on-surface-variant ring-1 ring-neutral-200/70 dark:ring-white/10 transition hover:text-error hover:ring-error/40 disabled:opacity-40"
                    title="Remover este item"
                  >
                    {removeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Remover
                  </button>
                </li>
              )
            })
          )}
        </ul>

        <div className="border-t border-neutral-200/70 dark:border-white/8 px-4 py-3">
          {addMutation.isError ? (
            <p className="mb-2 text-xs text-error">
              {addMutation.error instanceof Error ? addMutation.error.message : 'Erro ao adicionar.'}
            </p>
          ) : null}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (newLabel.trim()) addMutation.mutate()
            }}
          >
            <input
              className={FIELD}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nome do novo item…"
              maxLength={191}
            />
            <button
              type="submit"
              disabled={addMutation.isPending || newLabel.trim() === ''}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Adicionar
            </button>
          </form>
        </div>
      </div>

      {isEquipes && openEquipeItem && approversMap && allUsers ? (
        <TeamApproversModal
          equipeItem={openEquipeItem}
          approvers={approversMap[openEquipeItem.id] ?? []}
          allUsers={allUsers}
          usersLoading={usersLoading ?? false}
          refetch={() => { refetch(); refetchApprovers?.() }}
          onClose={() => setOpenApproversForId(null)}
        />
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------
export function GmudConfigScreen() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['gmud-config-lists'],
    queryFn: fetchGmudConfigLists,
    staleTime: 0,
  })

  const { data: approversMap = {}, refetch: refetchApprovers } = useQuery({
    queryKey: ['gmud-team-approvers'],
    queryFn: fetchTeamApprovers,
    staleTime: 0,
  })

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['splitters-users'],
    queryFn: listSplittersUsers,
    staleTime: 5 * 60 * 1000,
  })

  const handleRefetch = () => { void refetch(); void refetchApprovers() }

  return (
    <div className="mx-auto min-w-0 max-w-[1200px] space-y-4">
      <AppPageHeader
        badge="Módulo GMUD"
        title="Configurações"
        description="Gerencie as listas de opções do formulário de GMUD: setores, equipes, sistemas e processos."
        icon={Settings2}
        primaryAction={{ to: '/gmud', label: 'Voltar às GMUDs' }}
      />

      <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
        <span className="font-semibold">Atenção:</span> Remover um item não afeta registros históricos — apenas oculta a opção em novos formulários.
        Itens removidos que já existem em GMUDs registradas continuam visíveis nos detalhes.
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant py-8">
          <Loader2 size={16} className="animate-spin" />
          Carregando listas…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error instanceof Error ? error.message : 'Falha ao carregar as listas de configuração.'}
        </div>
      ) : (
        <div className="pb-8 space-y-4">
          <ListPanel
            listKey="areas"
            items={data?.areas ?? []}
            refetch={handleRefetch}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListPanel
              listKey="equipes"
              items={data?.equipes ?? []}
              refetch={handleRefetch}
              approversMap={approversMap}
              allUsers={allUsers}
              usersLoading={usersLoading}
              refetchApprovers={refetchApprovers}
            />
            <ListPanel
              listKey="processos"
              items={data?.processos ?? []}
              refetch={handleRefetch}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListPanel
              listKey="sistemas_internos"
              items={data?.sistemas_internos ?? []}
              refetch={handleRefetch}
            />
            <ListPanel
              listKey="sistemas_externos"
              items={data?.sistemas_externos ?? []}
              refetch={handleRefetch}
            />
          </div>
        </div>
      )}
    </div>
  )
}
