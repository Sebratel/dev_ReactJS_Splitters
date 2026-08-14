import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type {
  MassivaOpeningBasis,
  MassivaOpeningPlanDraft,
} from '@/features/massiva/model/massivaOpeningBasis'

export function buildMassivaOpenFinalContext(params: {
  personId: number
  operatorEmail: string
  operatorName: string
  basis: MassivaOpeningBasis
  plan: MassivaOpeningPlanDraft
  assignmentDescription: string
  assignmentFinalDateLocal: string
  assignmentBeginningDateLocal: string | null
  eventIdentifiedAtLocal: string | null
  massivaOpenPath: string
  massivaAfetadosPath: string
  descriptionAutoSyncEnabled: boolean
  /** Ex.: quantidade ONUs/circuitos do AutoISP ao aplicar evento na abertura. */
  affectedUsersQuantityOverride?: number | null
}): MassivaOpenFinalContext {
  const override = params.affectedUsersQuantityOverride
  const affectedUsersQuantityFlutterParity =
    typeof override === 'number' && override >= 0
      ? Math.floor(override)
      : params.plan.affectedUsersQuantityFlutterParity

  return {
    personId: params.personId,
    operatorEmail: params.operatorEmail.trim(),
    operatorName: params.operatorName.trim(),
    basis: params.basis,
    plan: params.plan,
    assignmentDescription: params.assignmentDescription.trim(),
    assignmentFinalDateLocal: params.assignmentFinalDateLocal,
    assignmentBeginningDateLocal: params.assignmentBeginningDateLocal,
    eventIdentifiedAtLocal: params.eventIdentifiedAtLocal,
    massivaOpenPath: params.massivaOpenPath.trim().startsWith('/')
      ? params.massivaOpenPath.trim()
      : `/${params.massivaOpenPath.trim()}`,
    massivaAfetadosPath: params.massivaAfetadosPath.trim().startsWith('/')
      ? params.massivaAfetadosPath.trim()
      : `/${params.massivaAfetadosPath.trim()}`,
    affectedUsersQuantityFlutterParity,
    descriptionAutoSyncEnabled: params.descriptionAutoSyncEnabled,
  }
}
