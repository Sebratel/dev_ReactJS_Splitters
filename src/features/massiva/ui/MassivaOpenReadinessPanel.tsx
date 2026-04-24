import type { ReactNode } from 'react'
import { explainMassivaPostBlocked } from '@/features/massiva/lib/explainMassivaPostBlocked'
import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import type { MassivaOpenReadinessView } from '@/features/massiva/model/massivaOpenReadiness'
import { MassivaOpenDraftFields } from '@/features/massiva/ui/MassivaOpenDraftFields'
import { MassivaOpenMutationBar } from '@/features/massiva/ui/MassivaOpenMutationBar'
import { GoogleSignInButton } from '@/features/session/ui/GoogleSignInButton'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { isGoogleIdentityConfigured, isLocalDevHostname } from '@/shared/config/env'
import { formatQueryError } from '@/shared/lib/formatQueryError'
import { ErrorState } from '@/shared/ui/states/ErrorState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

type OpenMutationUi = {
  submitOpen: () => void
  dismissMutation: () => void
  canSubmitOpen: boolean
  isPending: boolean
  isSuccess: boolean
  isError: boolean
  data: MassivaOpenMutationSuccessPayload | undefined
  error: unknown
}

type MassivaOpenReadinessPanelProps = {
  readiness: MassivaOpenReadinessView
  draftFormEnabled: boolean
  onRetryPersonId: () => void
  openMutation: OpenMutationUi
}

function StatusBanner(props: {
  variant: 'neutral' | 'amber' | 'red' | 'green' | 'blue'
  title: string
  children?: ReactNode
}) {
  const styles = {
    neutral:
      'border-neutral-200 bg-neutral-50/90 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-100',
    amber:
      'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
    red: 'border-red-200 bg-red-50/90 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100',
    green:
      'border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100',
    blue: 'border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-sky-100',
  }[props.variant]

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${styles}`}
      role="status"
    >
      <p className="font-semibold">{props.title}</p>
      {props.children ? <div className="mt-2">{props.children}</div> : null}
    </div>
  )
}

export function MassivaOpenReadinessPanel({
  readiness,
  draftFormEnabled,
  onRetryPersonId,
  openMutation,
}: MassivaOpenReadinessPanelProps) {
  const showDraft = readiness.status !== 'blocked-preparation'
  const sessionToken = useSessionStore((s) => s.sessionToken)
  const hasBearer =
    typeof sessionToken === 'string' && sessionToken.trim() !== ''

  const submitBlockedReason = explainMassivaPostBlocked(readiness)
  const postAuthHint =
    readiness.status === 'ready-to-open' &&
    !hasBearer &&
    isLocalDevHostname()
      ? 'Sem token no navegador: o POST será enviado sem header Authorization. O BFF em produção costuma exigir o bearer do Hub. Use VITE_GOOGLE_CLIENT_ID para login do Google ou VITE_DEV_SESSION_TOKEN no .env.local.'
      : null

  return (
    <div className="space-y-4" aria-live="polite">
      {readiness.status === 'blocked-preparation' ? (
        <StatusBanner variant="amber" title="Complete a preparação da rota acima">
          <p className="text-xs opacity-90">
            O contexto final de abertura só é montado quando a preparação estiver em estado
            preparado.
          </p>
        </StatusBanner>
      ) : null}

      {readiness.status === 'missing-session' ? (
        <StatusBanner variant="neutral" title="Sessão necessária">
          <p className="text-xs opacity-90">
            {readiness.reason === 'token'
              ? 'Token de sessão ausente. Faça login para usar as APIs que exigem Authorization.'
              : readiness.reason === 'email'
                ? 'Perfil sem e-mail. Não é possível resolver personId no BFF.'
                : 'Perfil de sessão incompleto.'}
          </p>
          {readiness.reason === 'token' && isGoogleIdentityConfigured() ? (
            <div className="mt-3">
              <GoogleSignInButton />
            </div>
          ) : null}
        </StatusBanner>
      ) : null}

      {readiness.status === 'no-permission' ? (
        <StatusBanner variant="red" title="Sem permissão para abrir massiva">
          <p className="text-xs opacity-90">
            Paridade <code className="rounded bg-red-100/80 px-1 dark:bg-red-900/40">canOpenMassiva</code>{' '}
            no Flutter. O operador não pode disparar abertura.
          </p>
        </StatusBanner>
      ) : null}

      {readiness.status === 'resolving-person-id' ? (
        <LoadingState label="Resolvendo personId no BFF..." />
      ) : null}

      {readiness.status === 'person-id-error' ? (
        <ErrorState
          title="Falha ao obter personId"
          message={formatQueryError(readiness.error)}
          onRetry={onRetryPersonId}
        />
      ) : null}

      {readiness.status === 'person-id-invalid' ? (
        <StatusBanner variant="red" title="personId inválido">
          <p className="text-xs opacity-90">
            A sessão ou o BFF não devolveu um identificador numérico válido (&gt; 0).
          </p>
        </StatusBanner>
      ) : null}

      {readiness.status === 'missing-gateway-config' ? (
        <StatusBanner variant="amber" title="Configuração de abertura ausente">
          <p className="text-xs opacity-90">
            Defina <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/40">VITE_MASSIVA_OPEN_PATH</code>{' '}
            no ambiente (path do POST no BFF, paridade{' '}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/40">MASSIVA_API_GATEWAY_ENDPOINT</code>{' '}
            no Flutter).
          </p>
        </StatusBanner>
      ) : null}

      {readiness.status === 'missing-assignment' ? (
        <StatusBanner variant="amber" title="Dados de assignment incompletos">
          <ul className="list-inside list-disc space-y-1 text-xs">
            {readiness.issues.map((issue, i) => (
              <li key={`${i}-${issue}`}>{issue}</li>
            ))}
          </ul>
        </StatusBanner>
      ) : null}

      {showDraft ? (
        <MassivaOpenDraftFields disabled={openMutation.isPending || !draftFormEnabled} />
      ) : null}

      <MassivaOpenMutationBar
        canSubmitOpen={openMutation.canSubmitOpen}
        isPending={openMutation.isPending}
        isSuccess={openMutation.isSuccess}
        isError={openMutation.isError}
        successPayload={openMutation.data}
        error={openMutation.error}
        onSubmit={openMutation.submitOpen}
        onDismiss={openMutation.dismissMutation}
        submitBlockedReason={submitBlockedReason}
        postAuthHint={postAuthHint}
      />
    </div>
  )
}

