import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  GitFork,
  Loader2,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import {
  assistGmudFlowchart,
  deleteGmudFlowchart,
  fetchGmudFlowchart,
  generateGmudFlowchartWithAI,
  saveGmudFlowchart,
  type AssistType,
  type GmudFlowchart,
} from '@/features/gmud/api/gmudFlowchart'
import { CARD as DETAIL_CARD } from '@/features/gmud/ui/indicators/indicatorTheme'
import { gmudConfirm } from '@/features/gmud/lib/gmudConfirm'
import { renderMermaid } from '@/features/gmud/lib/gmudMermaid'
import { cn } from '@/shared/lib/utils'
import { showGmudError } from '@/features/gmud/lib/gmudFeedback'

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------
const ACTION =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-40'

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
      <Bot size={10} /> Sugestão IA — requer validação humana
    </span>
  )
}

function WarningBanner({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <ul className="space-y-0.5">
        {warnings.map((w, i) => <li key={i}>{w}</li>)}
      </ul>
    </div>
  )
}

function MermaidPreview({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!source || !containerRef.current) return
    setLoading(true)
    setError(null)
    renderMermaid(source, containerRef.current)
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Erro ao renderizar o fluxograma.')
        setLoading(false)
      })
  }, [source])

  return (
    <div className="relative min-h-[120px] max-h-[460px] rounded-xl bg-white dark:bg-surface-container-low p-2 overflow-auto">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-on-surface-variant" />
        </div>
      )}
      {error ? (
        <div className="flex items-center gap-2 p-4 text-xs text-rose-600 dark:text-rose-300">
          <X size={14} /> Erro ao renderizar: {error}. Verifique a sintaxe Mermaid.
        </div>
      ) : null}
      <div ref={containerRef} className={cn('mermaid-output', loading ? 'invisible' : '')} />
    </div>
  )
}

function MermaidEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      className="w-full min-h-[220px] rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`flowchart TD\n    A([Início]) --> B[Etapa 1]\n    B --> C{Decisão?}\n    C -->|Sim| D[Sucesso]\n    C -->|Não| E[Rollback]\n    D --> F([Fim])`}
      spellCheck={false}
    />
  )
}

// ---------------------------------------------------------------------------
// Painel de geração com IA
// ---------------------------------------------------------------------------
function AIGeneratePanel({
  protocol,
  gmudContext,
  onGenerated,
}: {
  protocol: number
  gmudContext?: string
  onGenerated: (f: GmudFlowchart, w: string[]) => void
}) {
  const [description, setDescription] = useState('')
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível gerar o fluxograma'),
    mutationFn: () => generateGmudFlowchartWithAI(protocol, description, gmudContext),
    onSuccess: ({ flowchart, warnings }) => {
      onGenerated(flowchart, warnings)
      setOpen(false)
    },
  })

  return (
    <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-950/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-on-surface"
      >
        <span className="flex items-center gap-2"><Bot size={15} className="text-violet-600 dark:text-violet-400" /> Gerar fluxograma com IA</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-violet-200/70 dark:border-violet-800/40 px-4 pb-4 pt-3">
          <AIBadge />

          {/* Guia rápido */}
          <div className="rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/30 px-3 py-2.5 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Como descrever para um bom fluxograma</p>
            <ul className="space-y-1 text-[11px] text-violet-800/80 dark:text-violet-300/80">
              <li>✅ <strong>Início e fim</strong> — ex: "Abrir janela no Elleven" / "Encerrar protocolo"</li>
              <li>✅ <strong>Etapas em ordem</strong> — numere ou use conectores ("depois", "em seguida")</li>
              <li>✅ <strong>Decisões com dois caminhos</strong> — ex: "Se os testes passarem… senão…"</li>
              <li>✅ <strong>Rollback</strong> — descreva o que fazer se der errado</li>
              <li>❌ <strong>Não precisa</strong> de código Mermaid — só texto corrido</li>
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
              Descreva o procedimento técnico *
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-neutral-200 dark:border-white/10 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Exemplo:\n1. Notificar equipe e abrir janela no Elleven.\n2. Fazer backup da config via TFTP.\n3. Instalar o novo equipamento e aplicar config.\n4. Validar conectividade (ping + VLANs).\n5. Se falhar: reverter para o equipamento antigo.\n6. Se passar: atualizar inventário e encerrar janela.`}
              disabled={mutation.isPending}
            />
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {description.length}/8000 · A IA não inventa etapas — se faltar info, sinaliza no fluxograma.
            </p>
          </div>
          <button
            type="button"
            disabled={mutation.isPending || description.trim().length < 20}
            onClick={() => mutation.mutate()}
            className={cn(ACTION, 'bg-violet-600 text-white ring-violet-600 hover:bg-violet-700')}
          >
            {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
            {mutation.isPending ? 'Gerando…' : 'Gerar fluxograma'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel de assistência técnica (Phase 4)
// ---------------------------------------------------------------------------
function AIAssistPanel({ protocol, description, gmudContext }: { protocol: number; description: string; gmudContext?: string }) {
  const [activeType, setActiveType] = useState<AssistType | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  const mutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível usar o assistente'),
    mutationFn: (type: AssistType) => assistGmudFlowchart(protocol, type, description, gmudContext),
    onSuccess: ({ result: r }) => setResult(r),
  })

  const ASSIST_TYPES: { key: AssistType; label: string; icon: React.ReactNode }[] = [
    { key: 'checklist', label: 'Checklist', icon: <ClipboardList size={12} /> },
    { key: 'risks', label: 'Riscos', icon: <AlertTriangle size={12} /> },
    { key: 'summary', label: 'Resumo Comitê', icon: <Shield size={12} /> },
  ]

  const handle = (type: AssistType) => {
    setActiveType(type)
    setResult(null)
    mutation.mutate(type)
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Assistência técnica</p>
      <div className="flex flex-wrap gap-2">
        {ASSIST_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={mutation.isPending || description.trim().length < 10}
            onClick={() => handle(t.key)}
            className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}
          >
            {mutation.isPending && activeType === t.key ? <Loader2 size={12} className="animate-spin" /> : t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {result ? (
        <div className="space-y-1">
          <AIBadge />
          <pre className="overflow-auto rounded-xl bg-surface-container-low p-3 text-[11px] text-on-surface whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function GmudFlowchartSection({
  protocol,
  closed,
  gmudContext,
  description: gmudDescription,
}: {
  protocol: number
  closed: boolean
  gmudContext?: string
  description?: string
}) {
  const queryClient = useQueryClient()
  const canApprove = useAccessAuthStore((s) => s.hasPermission('canApproveGmud'))

  const [mode, setMode] = useState<'view' | 'edit' | 'import'>('view')
  const [editSource, setEditSource] = useState('')
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['gmud', 'flowchart', protocol],
    queryFn: () => fetchGmudFlowchart(protocol),
    staleTime: 30_000,
  })

  const flowchart: GmudFlowchart | null = data ?? null

  const saveMutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível salvar o fluxograma'),
    mutationFn: ({ source, origin }: { source: string; origin: 'manual' | 'imported' }) =>
      saveGmudFlowchart(protocol, source, { origin }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'flowchart', protocol] })
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'detail', protocol] })
      setMode('view')
    },
  })

  const deleteMutation = useMutation({
    onError: (error) => showGmudError(error, 'Não foi possível remover o fluxograma'),
    mutationFn: () => deleteGmudFlowchart(protocol),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gmud', 'flowchart', protocol] })
      setMode('view')
    },
  })

  const handleStartEdit = () => {
    setEditSource(flowchart?.mermaidSource ?? '')
    setMode('edit')
  }

  const handleSave = () => {
    if (!editSource.trim()) return
    saveMutation.mutate({ source: editSource, origin: 'manual' })
  }

  const handleAIGenerated = useCallback((_flowchart: GmudFlowchart, warnings: string[]) => {
    setAiWarnings(warnings)
    void queryClient.invalidateQueries({ queryKey: ['gmud', 'flowchart', protocol] })
    void queryClient.invalidateQueries({ queryKey: ['gmud', 'detail', protocol] })
  }, [queryClient, protocol])

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    if (file.size > 200_000) {
      setImportError('Arquivo muito grande. Limite: 200 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '').trim()
      if (!text) { setImportError('Arquivo vazio.'); return }
      if (!/^(flowchart|graph)\s/i.test(text)) {
        setImportError('Arquivo não parece ser Mermaid válido (deve começar com "flowchart" ou "graph").')
        return
      }
      saveMutation.mutate({ source: text, origin: 'imported' })
    }
    reader.onerror = () => setImportError('Erro ao ler o arquivo.')
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportSVG = () => {
    const svg = document.querySelector('.mermaid-output svg')
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `gmud-${protocol}-fluxograma.svg`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportMermaid = () => {
    if (!flowchart?.mermaidSource) return
    const blob = new Blob([flowchart.mermaidSource], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `gmud-${protocol}-fluxograma.mmd`; a.click()
    URL.revokeObjectURL(url)
  }

  const canEdit = !closed
  const hasFlowchart = Boolean(flowchart?.mermaidSource)

  return (
    <>
    <section className={cn(DETAIL_CARD, 'space-y-4 p-4')}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-on-surface">
          <span className="text-primary"><GitFork size={16} /></span>
          Fluxograma de Execução
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {hasFlowchart && mode === 'view' ? (
            <>
              {/* .mmd = fonte — compatível com importação */}
              <button
                type="button"
                onClick={handleExportMermaid}
                title="Exporta o código-fonte (.mmd) — pode ser reimportado aqui depois"
                className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}
              >
                <Download size={12} /> Exportar .mmd
              </button>
              {/* SVG = imagem — só para apresentação, não importável */}
              <button
                type="button"
                onClick={handleExportSVG}
                title="Exporta como imagem SVG — apenas para apresentações, não pode ser reimportado"
                className={cn(ACTION, 'text-on-surface-variant ring-neutral-200/50 hover:bg-surface-container-low dark:ring-white/5')}
              >
                <Download size={12} /> Imagem SVG
              </button>
              {canEdit ? (
                <button type="button" onClick={handleStartEdit} className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}>
                  <Edit3 size={12} /> Editar
                </button>
              ) : null}
              {canApprove ? (
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void gmudConfirm({
                      titulo: 'Remover o fluxograma desta GMUD?',
                      confirmar: 'Remover',
                      cancelar: 'Manter',
                      tom: 'destrutivo',
                    }).then(({ confirmado }) => {
                      if (confirmado) deleteMutation.mutate()
                    })
                  }}
                  className={cn(ACTION, 'text-rose-600 ring-rose-200/70 hover:bg-rose-50 dark:text-rose-300 dark:ring-rose-800/40')}
                >
                  {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Remover
                </button>
              ) : null}
            </>
          ) : null}
          {mode === 'edit' ? (
            <>
              <button type="button" onClick={() => setMode('view')} className={cn(ACTION, 'text-on-surface ring-neutral-200/70')}>
                <X size={12} /> Cancelar
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || !editSource.trim()}
                onClick={handleSave}
                className={cn(ACTION, 'bg-primary text-neutral-900 ring-primary hover:bg-primary/90')}
              >
                {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Metadados */}
      {flowchart ? (
        <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
          <span>v{flowchart.version}</span>
          {flowchart.origin === 'ai' ? <AIBadge /> : <span className="rounded-full bg-surface-container-low px-2 py-0.5 font-semibold">{flowchart.origin === 'imported' ? 'Importado' : 'Manual'}</span>}
          {flowchart.reviewStatus === 'reviewed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check size={10} /> Revisado
            </span>
          ) : null}
          {flowchart.updatedBy ? <span>Atualizado por {flowchart.updatedBy}</span> : null}
        </div>
      ) : null}

      {/* Warnings da IA */}
      <WarningBanner warnings={aiWarnings} />

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-on-surface-variant" />
        </div>
      ) : null}

      {/* Preview ou editor */}
      {!isLoading && mode === 'view' && hasFlowchart ? (
        <MermaidPreview source={flowchart!.mermaidSource} />
      ) : null}

      {!isLoading && mode === 'edit' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('view')} className={cn(ACTION, 'text-on-surface-variant ring-neutral-200/70')}>
              <Eye size={12} /> Preview
            </button>
          </div>
          <MermaidEditor value={editSource} onChange={setEditSource} />
          {editSource.trim() ? <MermaidPreview source={editSource} /> : null}
        </div>
      ) : null}

      {/* Sem fluxograma */}
      {!isLoading && !hasFlowchart && mode === 'view' ? (
        <p className="rounded-xl bg-surface-container-low px-3 py-3 text-sm text-on-surface-variant">
          Nenhum fluxograma criado para esta GMUD.
        </p>
      ) : null}

      {/* Ações de criação (apenas quando não há fluxograma ativo ou GMUD não encerrada) */}
      {!isLoading && canEdit ? (
        <div className="space-y-3 border-t border-neutral-200/60 pt-3 dark:border-white/5">
          {/* Geração com IA */}
          <AIGeneratePanel
            protocol={protocol}
            gmudContext={gmudContext}
            onGenerated={handleAIGenerated}
          />

          {/* Importar arquivo .mmd */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mmd,.txt"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saveMutation.isPending}
              title="Aceita arquivos .mmd exportados por esta plataforma ou gerados por ferramentas Mermaid"
              className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}
            >
              <Upload size={12} /> Importar .mmd
            </button>
            {!hasFlowchart ? (
              <button
                type="button"
                onClick={() => { setEditSource(''); setMode('edit') }}
                className={cn(ACTION, 'text-on-surface ring-neutral-200/70 hover:bg-surface-container-low dark:ring-white/10')}
              >
                <Edit3 size={12} /> Criar manualmente
              </button>
            ) : null}
          </div>
          {importError ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">{importError}</p>
          ) : null}

          {/* Assistência técnica (Phase 4) — só se tiver uma descrição */}
          {gmudDescription && gmudDescription.length >= 10 ? (
            <AIAssistPanel protocol={protocol} description={gmudDescription} gmudContext={gmudContext} />
          ) : null}
        </div>
      ) : null}
    </section>

    </>
  )
}
