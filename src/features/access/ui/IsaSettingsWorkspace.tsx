import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, RotateCcw, Save, Sparkles } from 'lucide-react'
import type { IsaPromptConfig } from '@/features/access/api/isaPromptConfig'
import { composeIsaPromptPreviewFromSections } from '@/features/access/api/isaPromptConfig'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

type IsaSettingsWorkspaceProps = {
  config: IsaPromptConfig
  busy: boolean
  errorMessage?: string | null
  onSave: (sections: Record<string, string>) => void
  onRestoreFallback: () => void
}

function buildDraftState(config: IsaPromptConfig): Record<string, string> {
  return Object.fromEntries(config.sections.map((section) => [section.key, section.value]))
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Ainda não salvo'
  return formatBrazilDateTimeShortDisplay(value, value)
}

function sourceLabel(source: string): string {
  return source === 'db' ? 'Banco ativo' : 'Fallback do código'
}

export function IsaSettingsWorkspace({
  config,
  busy,
  errorMessage,
  onSave,
  onRestoreFallback,
}: IsaSettingsWorkspaceProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => buildDraftState(config))

  useEffect(() => {
    setDraft(buildDraftState(config))
  }, [config])

  const dirty = useMemo(
    () => config.sections.some((section) => (draft[section.key] ?? '') !== section.value),
    [config.sections, draft],
  )

  const previewPrompt = useMemo(
    () =>
      composeIsaPromptPreviewFromSections(
        config.sections.map((section) => ({
          value: draft[section.key] ?? '',
        })),
        config.responseFormatNote,
      ),
    [config.responseFormatNote, config.sections, draft],
  )

  return (
    <div className="space-y-4 pb-16">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Origem ativa</p>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Database className="size-4 text-amber-700 dark:text-amber-200" aria-hidden />
            {sourceLabel(config.source)}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Versão</p>
          <p className="mt-2 text-sm font-semibold text-on-surface">
            {config.version == null ? 'Padrão' : `v${config.version}`}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Última atualização</p>
          <p className="mt-2 text-sm font-semibold text-on-surface">{formatDateTime(config.updatedAt)}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Responsável</p>
          <p className="mt-2 text-sm font-semibold text-on-surface">
            {config.updatedByEmail ?? 'Fallback do código'}
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/40 p-4 text-sm text-amber-950 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">Alterações entram em vigor na próxima requisição da ISA.</p>
            <p>
              O contrato JSON da resposta continua fixo no backend. Aqui você edita apenas os blocos
              textuais do prompt base.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest px-4 py-3 shadow-sm">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
            dirty
              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 ring-1 ring-amber-200/80'
              : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200/80',
          )}
        >
          {dirty ? 'Alterações locais pendentes' : 'Sem alterações pendentes'}
        </span>

        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!dirty || busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-neutral-900 shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden />
          Salvar configuração
        </button>

        <button
          type="button"
          onClick={onRestoreFallback}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="size-4" aria-hidden />
          Restaurar fallback do código
        </button>

        <button
          type="button"
          onClick={() => setDraft(buildDraftState(config))}
          disabled={!dirty || busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
        >
          Descartar alterações locais
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="space-y-4">
          {config.sections.map((section) => {
            const value = draft[section.key] ?? ''
            const rows = Math.min(22, Math.max(8, value.split('\n').length + 2))

            return (
              <article
                key={section.key}
                className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-on-surface">{section.label}</h2>
                    {section.description ? (
                      <p className="text-sm text-on-surface-variant">{section.description}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-neutral-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                    {value.length} chars
                  </span>
                </div>

                <textarea
                  value={value}
                  rows={rows}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [section.key]: e.target.value,
                    }))
                  }
                  spellCheck={false}
                  className="mt-3 w-full rounded-2xl border border-neutral-200 dark:border-white/10 bg-surface-container-low/70 px-4 py-3 text-sm leading-6 text-on-surface shadow-inner outline-none transition focus:border-amber-400 focus:bg-surface-container-lowest focus:ring-2 focus:ring-amber-500/20"
                />

                <details className="mt-3 rounded-xl border border-dashed border-neutral-200 dark:border-white/10 bg-surface-container-low/70 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Ver valor padrão deste bloco
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-on-surface-variant">
                    {section.defaultValue}
                  </pre>
                </details>
              </article>
            )
          })}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-700 dark:text-amber-200" aria-hidden />
              <h2 className="text-base font-semibold text-on-surface">Preview do prompt final</h2>
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              Prévia montada com os blocos acima e a instrução fixa de formato JSON.
            </p>
            <pre className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-950 px-4 py-4 text-xs leading-6 text-neutral-100 whitespace-pre-wrap break-words">
              {previewPrompt}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  )
}
