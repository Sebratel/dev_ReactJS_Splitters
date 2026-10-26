import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings2, Plus, Trash2, Loader2 } from 'lucide-react'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'
import {
  fetchGmudConfigLists,
  addGmudConfigItem,
  removeGmudConfigItem,
  type GmudConfigItem,
} from '@/features/gmud/api/gmudConfigLists'

const LIST_META: Record<string, { label: string; hint: string }> = {
  areas: {
    label: 'Setores / Áreas',
    hint: 'Setores que aparecem nos campos "Áreas impactadas", "Áreas afetadas" e "Áreas a notificar".',
  },
  equipes: {
    label: 'Equipes',
    hint: 'Equipes técnicas disponíveis no campo "Equipes a informar" de Sistemas Internos.',
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
// Painel de uma lista configurável
// ---------------------------------------------------------------------------
function ListPanel({ listKey, items, refetch }: {
  listKey: string
  items: GmudConfigItem[]
  refetch: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const qc = useQueryClient()
  const meta = LIST_META[listKey] ?? { label: listKey, hint: '' }

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

  return (
    <div className={CARD}>
      <div className="border-b border-neutral-200/70 dark:border-white/8 px-4 py-3">
        <p className="font-semibold text-sm text-on-surface">{meta.label}</p>
        {meta.hint ? <p className="mt-0.5 text-xs text-on-surface-variant">{meta.hint}</p> : null}
      </div>

      {/* Lista de itens ativos */}
      <ul className="divide-y divide-neutral-200/60 dark:divide-white/5">
        {items.length === 0 ? (
          <li className="px-4 py-4 text-sm text-on-surface-variant/60 italic">Nenhum item cadastrado.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-on-surface">{item.label}</span>
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
          ))
        )}
      </ul>

      {/* Adicionar novo item */}
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
          {/* Setores/Áreas ocupa largura total — tem mais itens e é usada em 3 campos */}
          <ListPanel
            listKey="areas"
            items={data?.areas ?? []}
            refetch={refetch}
          />

          {/* Equipes + Processos lado a lado */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListPanel
              listKey="equipes"
              items={data?.equipes ?? []}
              refetch={refetch}
            />
            <ListPanel
              listKey="processos"
              items={data?.processos ?? []}
              refetch={refetch}
            />
          </div>

          {/* Catálogos de sistemas lado a lado */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ListPanel
              listKey="sistemas_internos"
              items={data?.sistemas_internos ?? []}
              refetch={refetch}
            />
            <ListPanel
              listKey="sistemas_externos"
              items={data?.sistemas_externos ?? []}
              refetch={refetch}
            />
          </div>
        </div>
      )}
    </div>
  )
}
