import { Bot, Shield } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchIsaPromptConfig,
  restoreIsaPromptConfigFallback,
  updateIsaPromptConfig,
} from '@/features/access/api/isaPromptConfig'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { AccessDeniedState } from '@/features/access/ui/AccessDeniedState'
import { IsaSettingsWorkspace } from '@/features/access/ui/IsaSettingsWorkspace'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'

const isaPromptConfigQueryKey = ['admin', 'isa-prompt-config'] as const

export function IsaSettingsPage() {
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: isaPromptConfigQueryKey,
    queryFn: fetchIsaPromptConfig,
    enabled: isAdmin,
  })

  const saveMutation = useMutation({
    mutationFn: updateIsaPromptConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: isaPromptConfigQueryKey })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: restoreIsaPromptConfigFallback,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: isaPromptConfigQueryKey })
    },
  })

  if (!isAdmin) {
    return (
      <AccessDeniedState description="Somente administradores podem alterar a configuração da ISA." />
    )
  }

  return (
    <div className="mx-auto max-w-[1680px] min-w-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AppPageHeader
        icon={Bot}
        badge="Administração"
        title="Configuração da ISA"
        description="Edite os blocos do prompt base da ISA sem novo deploy. A próxima requisição já usa a configuração salva."
        primaryAction={{ to: '/', label: 'Voltar ao painel' }}
        trailing={
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 dark:border-violet-800/50 bg-surface-container-lowest/80 px-3 py-2 text-xs font-bold uppercase tracking-wide text-violet-900 dark:text-violet-200 shadow-sm">
            <Shield className="size-4" aria-hidden />
            Admin only
          </span>
        }
      />

      {configQuery.isLoading ? (
        <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-6 text-sm text-on-surface-variant shadow-sm">
          Carregando configuração da ISA...
        </div>
      ) : configQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 shadow-sm">
          {configQuery.error instanceof Error
            ? configQuery.error.message
            : 'Falha ao carregar a configuração da ISA.'}
        </div>
      ) : configQuery.data ? (
        <IsaSettingsWorkspace
          config={configQuery.data}
          busy={saveMutation.isPending || restoreMutation.isPending}
          errorMessage={
            saveMutation.isError
              ? saveMutation.error instanceof Error
                ? saveMutation.error.message
                : 'Falha ao salvar a configuração da ISA.'
              : restoreMutation.isError
                ? restoreMutation.error instanceof Error
                  ? restoreMutation.error.message
                  : 'Falha ao restaurar o fallback da ISA.'
                : null
          }
          onSave={(sections) => saveMutation.mutate({ sections })}
          onRestoreFallback={() => restoreMutation.mutate()}
        />
      ) : null}
    </div>
  )
}
