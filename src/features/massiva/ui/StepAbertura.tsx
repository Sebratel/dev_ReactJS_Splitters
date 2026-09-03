import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eraser } from 'lucide-react'
import { GoogleSignInButton } from '@/features/session/ui/GoogleSignInButton'
import { buildMassivaAssignmentDescriptionForRequest } from '@/features/massiva/lib/buildMassivaAssignmentDescriptionForRequest'
import { fetchMassivaConnectionsFromLocalDbByRoutes } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import { fetchOnuSummaryBySplitter } from '@/features/onu/api/fetchOnuSummaryBySplitter'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import type { MassivaOpenReadinessView } from '@/features/massiva/model/massivaOpenReadiness'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { MassivaOpenDraftFields } from '@/features/massiva/ui/MassivaOpenDraftFields'
import { isGoogleIdentityConfigured } from '@/shared/config/env'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type StepAberturaProps = {
  readiness: MassivaOpenReadinessView
  openingPreparation: MassivaOpeningPreparationView
  draftFormEnabled: boolean
  onRetryPersonId: () => void
}

function Notice({
  title,
  description,
  tone = 'neutral',
}: {
  title: string
  description: string
  tone?: 'neutral' | 'warning' | 'error'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
      : tone === 'error'
        ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-100'
        : 'border-neutral-200 dark:border-white/10 bg-surface-container-low text-on-surface'

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed opacity-90">{description}</p>
    </div>
  )
}

export function StepAbertura({
  readiness,
  openingPreparation,
  draftFormEnabled,
  onRetryPersonId,
}: StepAberturaProps) {
  const assignmentDescription = useMassivaOpenDraftStore((s) => s.assignmentDescription)
  const descriptionAutoSync = useMassivaOpenDraftStore((s) => s.descriptionAutoSync)
  const resetDraft = useMassivaOpenDraftStore((s) => s.reset)

  // Preview por AP usa amostra de 50 do batch-summary; na abertura buscamos a lista
  // completa por rota para a contagem de afetados bater com a validação.
  const preparedBasis =
    openingPreparation.status === 'prepared' ? openingPreparation.basis : null
  const fullRoutes = useMemo(
    () =>
      preparedBasis
        ? preparedBasis.topology.routes.map((route) => ({
            apCode: route.apCode,
            slot: route.slot,
            port: route.port,
            splitterCodes: [...route.effectiveSplitterCodes],
          }))
        : [],
    [preparedBasis],
  )
  const fullConnectionsQuery = useQuery({
    queryKey: ['massiva', 'open', 'full-connections', JSON.stringify(fullRoutes)],
    queryFn: () => fetchMassivaConnectionsFromLocalDbByRoutes(fullRoutes),
    enabled: fullRoutes.length > 0,
    staleTime: 60_000,
  })
  const fullConnections = fullConnectionsQuery.data ?? []

  // "CTO Sinal Alto": auto-preenche o Sinal aferido (dBm) com o avgRxPower do splitter
  // (mesmo dado do card "SINAL ONU — MÉDIA DO SPLITTER"). Por CTO quando há mais de uma.
  const infraProtocolType = useMassivaOpenDraftStore((s) => s.infraProtocolType)
  const autofillInfraSignal = useMassivaOpenDraftStore((s) => s.autofillInfraSignal)
  const splitterSignalQuery = useQuery({
    queryKey: ['onu', 'summary-by-splitter'],
    queryFn: fetchOnuSummaryBySplitter,
    staleTime: 60_000,
    enabled: infraProtocolType === 'cto_sinal_alto',
  })
  const ctosDaRota = useMemo(() => {
    const byCode = new Map<string, string>()
    for (const route of preparedBasis?.topology.routes ?? []) {
      for (const s of route.effectiveSplitterDisplay ?? []) {
        const code = String(s.code ?? '').trim()
        if (code && !byCode.has(code)) byCode.set(code, String(s.label ?? code).trim() || code)
      }
    }
    return [...byCode.entries()].map(([code, label]) => ({ code, label }))
  }, [preparedBasis])
  const infraSignalAutofillValue = useMemo(() => {
    if (infraProtocolType !== 'cto_sinal_alto') return ''
    const summary = splitterSignalQuery.data
    if (!summary || ctosDaRota.length === 0) return ''
    const comSinal = ctosDaRota
      .map((cto) => ({ ...cto, avg: summary.get(cto.code)?.avgRxPower ?? null }))
      .filter((c): c is { code: string; label: string; avg: number } => c.avg != null)
    if (comSinal.length === 0) return ''
    // 1 CTO: número puro (a descrição acrescenta " dBm"). Várias: 1 CTO por linha.
    return comSinal.length === 1
      ? comSinal[0].avg.toFixed(1)
      : comSinal.map((c) => `${c.label}: ${c.avg.toFixed(1)} dBm`).join('\n')
  }, [infraProtocolType, splitterSignalQuery.data, ctosDaRota])
  // Assinatura das CTOs selecionadas: muda quando o operador troca de splitters,
  // rearmando o auto-preenchimento (sem isso, ficaria o sinal das CTOs anteriores).
  const ctoCodesKey = useMemo(
    () => ctosDaRota.map((c) => c.code).sort().join('|'),
    [ctosDaRota],
  )
  useEffect(() => {
    if (infraProtocolType === 'cto_sinal_alto' && infraSignalAutofillValue !== '') {
      autofillInfraSignal(infraSignalAutofillValue, ctoCodesKey)
    }
  }, [infraProtocolType, infraSignalAutofillValue, ctoCodesKey, autofillInfraSignal])

  const requestsByAp = readiness.status === 'ready-to-open'
    ? readiness.context.plan.requests
    : openingPreparation.status === 'prepared'
      ? openingPreparation.plan.requests
      : []

  const contextForPreview = readiness.status === 'ready-to-open'
    ? readiness.context
    : openingPreparation.status === 'prepared'
      ? {
          personId: 0,
          operatorEmail: '',
          basis: openingPreparation.basis,
          plan: openingPreparation.plan,
          assignmentDescription,
          assignmentFinalDateLocal: '',
          assignmentBeginningDateLocal: null,
          eventIdentifiedAtLocal: null,
          massivaOpenPath: '',
          massivaAfetadosPath: '',
          affectedUsersQuantityFlutterParity: openingPreparation.plan.affectedUsersQuantityFlutterParity,
          descriptionAutoSyncEnabled: descriptionAutoSync,
        }
      : null

  const effectiveContextForPreview =
    contextForPreview !== null &&
    fullConnections.length > contextForPreview.basis.collectedClientes.length
      ? {
          ...contextForPreview,
          basis: { ...contextForPreview.basis, collectedClientes: fullConnections },
        }
      : contextForPreview

  const descriptionByAp =
    effectiveContextForPreview !== null
      ? requestsByAp.map((request) => ({
          apCode: request.authenticationAccessPointCode,
          apTitle: request.assignmentTitle,
          description: buildMassivaAssignmentDescriptionForRequest(
            effectiveContextForPreview,
            request,
          ),
        }))
      : []

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-on-surface">Abertura</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Complete dados operacionais, gere a descrição técnica e revise bloqueios antes do envio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Limpar os dados da abertura? (datas voltam para agora, protocolo de infra, sinal, quem identificou e relato são resetados)')) {
              resetDraft()
            }
          }}
          disabled={!draftFormEnabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-white/10 bg-surface-container-lowest px-2.5 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-low disabled:opacity-50"
          title="Limpar os campos da abertura e recomeçar"
        >
          <Eraser className="size-3.5" />
          <span className="hidden sm:inline">Limpar dados</span>
        </button>
      </div>

      {readiness.status === 'blocked-preparation' ? (
        <Notice
          tone="warning"
          title="Validação obrigatória"
          description="Conclua rota e validação antes de preencher a abertura final."
        />
      ) : null}

      {readiness.status === 'missing-session' ? (
        <div className="space-y-3">
          <Notice
            title="Sessão necessária"
            description={
              readiness.reason === 'token'
                ? 'Faça login para usar as APIs que exigem autorização.'
                : readiness.reason === 'email'
                  ? 'O perfil precisa de e-mail para resolver personId.'
                  : 'O perfil de sessão está incompleto.'
            }
          />
          {readiness.reason === 'token' && isGoogleIdentityConfigured() ? (
            <GoogleSignInButton />
          ) : null}
        </div>
      ) : null}

      {readiness.status === 'no-permission' ? (
        <Notice
          tone="error"
          title="Sem permissão"
          description="O usuário atual não pode abrir massiva neste ambiente."
        />
      ) : null}

      {readiness.status === 'resolving-person-id' ? (
        <LoadingState label="Resolvendo personId..." />
      ) : null}

      {readiness.status === 'person-id-error' ? (
        <ErrorState
          title="Falha ao obter personId"
          message={formatQueryError(readiness.error)}
          onRetry={onRetryPersonId}
        />
      ) : null}

      {readiness.status === 'person-id-invalid' ? (
        <Notice
          tone="error"
          title="personId inválido"
          description="Sessão ou endpoint de funcionário não retornou um identificador válido."
        />
      ) : null}

      {readiness.status === 'missing-gateway-config' ? (
        <Notice
          tone="warning"
          title="Configuração ausente"
          description="Defina VITE_MASSIVA_OPEN_PATH e VITE_MASSIVA_AFETADOS_PATH no ambiente."
        />
      ) : null}

      {readiness.status === 'missing-assignment' ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-950 dark:text-amber-100">
          <p className="text-sm font-semibold">Campos obrigatórios pendentes</p>
          <ul className="mt-2 space-y-1 text-sm">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {requestsByAp.length > 0 ? (
        <div className="space-y-3">
          {readiness.status === 'ready-to-open' ? (
            <Notice
              title="Fluxo pronto"
              description="A abertura está pronta para envio. Revise a descrição e use a ação principal fixa no rodapé."
            />
          ) : null}
          <div className="rounded-lg border border-sky-200 dark:border-sky-800/50 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sky-950 dark:text-sky-100">
            <p className="text-sm font-semibold">
              Protocolos previstos: {requestsByAp.length} (1 por ponto de acesso)
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {requestsByAp.map((request) => (
                <li key={request.authenticationAccessPointCode}>
                  {request.assignmentTitle} ({request.authenticationAccessPointCode})
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <MassivaOpenDraftFields
        disabled={!draftFormEnabled}
        descriptionByAp={descriptionByAp}
      />
    </div>
  )
}
