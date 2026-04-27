import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmployeePersonIdByEmail } from '@/features/massiva/api/fetchEmployeePersonIdByEmail'
import { buildMassivaOpenFinalContext } from '@/features/massiva/lib/buildMassivaOpenFinalContext'
import { buildMassivaOpeningTechnicalDescription } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import {
  getMassivaOpenDraftIssues,
  massivaOpenDraftFinalDateIsoUtc,
} from '@/features/massiva/lib/validateMassivaOpenDraft'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import type { MassivaOpenReadinessView } from '@/features/massiva/model/massivaOpenReadiness'
import type { MassivaOpeningPreparationView } from '@/features/massiva/model/massivaOpeningBasis'
import { useMassivaOpenDraftStore } from '@/features/massiva/store/massivaOpenDraftStore'
import { useSessionStore } from '@/features/session/store/sessionStore'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import {
  env,
  isFirebaseAuthConfigured,
  isLocalDevHostname,
} from '@/shared/config/env'

const PERSON_ID_STALE_MS = 5 * 60 * 1000

function normalizeOpenPath(path: string): string {
  const t = path.trim()
  if (t === '') return ''
  return t.startsWith('/') ? t : `/${t}`
}

/**
 * Autenticacao, personId, permissoes, rascunho de assignment e path de abertura.
 */
export function useMassivaOpenReadiness(
  openingPreparation: MassivaOpeningPreparationView,
): {
  readiness: MassivaOpenReadinessView
  draftFormEnabled: boolean
  refetchPersonId: () => void
} {
  const sessionToken = useSessionStore((s) => s.sessionToken)
  const sessionUser = useSessionStore((s) => s.user)
  const firebaseProfile = useAccessAuthStore((s) => s.profile)
  const firebaseCanOpenMassiva = useAccessAuthStore((s) => s.hasPermission('canOpenMassiva'))

  const assignmentDescription = useMassivaOpenDraftStore((s) => s.assignmentDescription)
  const descriptionAutoSync = useMassivaOpenDraftStore((s) => s.descriptionAutoSync)
  const assignmentForecastDate = useMassivaOpenDraftStore((s) => s.assignmentForecastDate)
  const assignmentForecastTime = useMassivaOpenDraftStore((s) => s.assignmentForecastTime)
  const eventStartDate = useMassivaOpenDraftStore((s) => s.eventStartDate)
  const eventStartTime = useMassivaOpenDraftStore((s) => s.eventStartTime)
  const eventIdentifiedDate = useMassivaOpenDraftStore((s) => s.eventIdentifiedDate)
  const eventIdentifiedTime = useMassivaOpenDraftStore((s) => s.eventIdentifiedTime)
  const initialReport = useMassivaOpenDraftStore((s) => s.initialReport)
  const fieldTechnicianRequesting = useMassivaOpenDraftStore((s) => s.fieldTechnicianRequesting)
  const affectedUsersQuantityAutoIspOverride = useMassivaOpenDraftStore(
    (s) => s.affectedUsersQuantityAutoIspOverride,
  )
  const setAssignmentDescription = useMassivaOpenDraftStore((s) => s.setAssignmentDescription)

  const firebaseUserFallback =
    isFirebaseAuthConfigured() && firebaseProfile
      ? {
          email: firebaseProfile.email,
          name: firebaseProfile.displayName,
          personId: null,
          canOpenMassiva: firebaseCanOpenMassiva,
        }
      : null

  const user = sessionUser ?? firebaseUserFallback

  const email = user?.email?.trim() ?? ''
  const sessionPersonId = user?.personId ?? null
  const canOpenMassiva = user?.canOpenMassiva ?? false

  const hasBearer = typeof sessionToken === 'string' && sessionToken.trim() !== ''
  const sessionCredentialOk =
    hasBearer || isLocalDevHostname() || isFirebaseAuthConfigured()

  const needsPersonIdFetch =
    openingPreparation.status === 'prepared' &&
    user !== null &&
    email !== '' &&
    canOpenMassiva &&
    (sessionPersonId === null || sessionPersonId <= 0)

  const personIdQuery = useQuery({
    queryKey: massivaKeys.personIdByEmail(email),
    queryFn: ({ signal }) => fetchEmployeePersonIdByEmail(email, signal),
    staleTime: PERSON_ID_STALE_MS,
    enabled: needsPersonIdFetch,
    retry: 1,
  })

  useEffect(() => {
    if (!descriptionAutoSync) return
    if (openingPreparation.status !== 'prepared') return

    const requester =
      user?.name?.trim() || user?.email?.trim() || 'Nao informado'
    const { basis, plan } = openingPreparation

    const affectedClientsCount =
      typeof affectedUsersQuantityAutoIspOverride === 'number' &&
      affectedUsersQuantityAutoIspOverride >= 0
        ? Math.floor(affectedUsersQuantityAutoIspOverride)
        : plan.routeCollectedClientCount

    const next = buildMassivaOpeningTechnicalDescription({
      requesterDisplayName: requester,
      initialReport,
      fieldTechnicianRequesting,
      basis,
      affectedClientsCount,
      eventStartDate,
      eventStartTime,
      eventIdentifiedDate,
      eventIdentifiedTime,
      forecastCloseDate: assignmentForecastDate,
      forecastCloseTime: assignmentForecastTime,
    })

    if (next === assignmentDescription) return
    setAssignmentDescription(next)
  }, [
    descriptionAutoSync,
    assignmentDescription,
    openingPreparation,
    user?.name,
    user?.email,
    initialReport,
    fieldTechnicianRequesting,
    eventStartDate,
    eventStartTime,
    eventIdentifiedDate,
    eventIdentifiedTime,
    assignmentForecastDate,
    assignmentForecastTime,
    affectedUsersQuantityAutoIspOverride,
    setAssignmentDescription,
  ])

  const readiness: MassivaOpenReadinessView = useMemo(() => {
    if (openingPreparation.status !== 'prepared') {
      return {
        status: 'blocked-preparation',
        preparation: openingPreparation,
      }
    }

    if (!sessionCredentialOk) {
      return { status: 'missing-session', reason: 'token' }
    }

    if (user === null) {
      return { status: 'missing-session', reason: 'user-profile' }
    }

    if (email === '') {
      return { status: 'missing-session', reason: 'email' }
    }

    if (!canOpenMassiva) {
      return { status: 'no-permission' }
    }

    if (needsPersonIdFetch) {
      if (personIdQuery.isPending) {
        return { status: 'resolving-person-id' }
      }
      if (personIdQuery.isError) {
        return { status: 'person-id-error', error: personIdQuery.error }
      }
      const d = personIdQuery.data
      if (typeof d !== 'number' || d <= 0) {
        return { status: 'person-id-invalid' }
      }
    } else if (sessionPersonId === null || sessionPersonId <= 0) {
      return { status: 'person-id-invalid' }
    }

    const personId =
      sessionPersonId !== null && sessionPersonId > 0
        ? sessionPersonId
        : (personIdQuery.data as number)

    if (personId <= 0) {
      return { status: 'person-id-invalid' }
    }

    const openPath = normalizeOpenPath(env.massivaOpenPath)
    if (openPath === '') {
      return { status: 'missing-gateway-config' }
    }

    const afetadosPath = normalizeOpenPath(env.massivaAfetadosPath)
    if (afetadosPath === '') {
      return { status: 'missing-gateway-config' }
    }

    const draftIssues = getMassivaOpenDraftIssues(
      assignmentDescription,
      assignmentForecastDate,
      assignmentForecastTime,
    )
    if (draftIssues.length > 0) {
      return { status: 'missing-assignment', issues: draftIssues }
    }

    const finalIso = massivaOpenDraftFinalDateIsoUtc(
      assignmentForecastDate,
      assignmentForecastTime,
    )
    if (finalIso === null) {
      return {
        status: 'missing-assignment',
        issues: ['Data/hora de encerramento invalida.'],
      }
    }

    const { basis, plan } = openingPreparation

    const context = buildMassivaOpenFinalContext({
      personId,
      operatorEmail: email,
      basis,
      plan,
      assignmentDescription,
      assignmentFinalDateIsoUtc: finalIso,
      massivaOpenPath: openPath,
      massivaAfetadosPath: afetadosPath,
      descriptionAutoSyncEnabled: descriptionAutoSync,
      affectedUsersQuantityOverride: affectedUsersQuantityAutoIspOverride,
    })

    return { status: 'ready-to-open', context }
  }, [
    openingPreparation,
    sessionCredentialOk,
    user,
    email,
    canOpenMassiva,
    needsPersonIdFetch,
    personIdQuery.isPending,
    personIdQuery.isError,
    personIdQuery.error,
    personIdQuery.data,
    sessionPersonId,
    assignmentDescription,
    descriptionAutoSync,
    assignmentForecastDate,
    assignmentForecastTime,
    affectedUsersQuantityAutoIspOverride,
  ])

  const refetchPersonId = () => {
    void personIdQuery.refetch()
  }

  const draftFormEnabled =
    openingPreparation.status === 'prepared' &&
    sessionCredentialOk &&
    user !== null &&
    email !== '' &&
    canOpenMassiva

  return {
    readiness,
    draftFormEnabled,
    refetchPersonId,
  }
}
