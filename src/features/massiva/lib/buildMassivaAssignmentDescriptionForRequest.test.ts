import { describe, expect, it } from 'vitest'
import { buildMassivaAssignmentDescriptionForRequest } from '@/features/massiva/lib/buildMassivaAssignmentDescriptionForRequest'
import { buildMassivaOpeningPlanDraft } from '@/features/massiva/lib/buildMassivaOpeningPlanDraft'
import { buildMassivaOpeningTechnicalDescription } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import type { MassivaOpeningBasis } from '@/features/massiva/model/massivaOpeningBasis'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'

function minimalBasis(twoAps: boolean): MassivaOpeningBasis {
  const routes = twoAps
    ? [
        {
          apCode: '25903',
          apDisplayTitle: 'OLT 04 - NHOPN',
          slot: 4,
          port: 1,
          effectiveSplitterDisplay: [{ code: 'X1', label: 'X1' }],
        },
        {
          apCode: '25903',
          apDisplayTitle: 'OLT 04 - NHOPN',
          slot: 4,
          port: 2,
          effectiveSplitterDisplay: [{ code: 'X2', label: 'X2' }],
        },
        {
          apCode: '27696',
          apDisplayTitle: 'OLT 02 - NHOCE',
          slot: 2,
          port: 1,
          effectiveSplitterDisplay: [{ code: 'Y1', label: 'Y1' }],
        },
      ]
    : [
        {
          apCode: '25903',
          apDisplayTitle: 'OLT 04 - NHOPN',
          slot: 4,
          port: 1,
          effectiveSplitterDisplay: [{ code: 'X1', label: 'X1' }],
        },
      ]

  return {
    topology: { routes },
    collectedClientes: [],
    previewTotals: { totalAffected: 0, totalPppoes: 0, totalCorporateAffected: 0 },
    uniqueAuthenticationIdsOnRoute: [],
    flutterStyleAffectedUsersQuantity: 0,
  }
}

describe('buildMassivaAssignmentDescriptionForRequest', () => {
  it('restringe Topologia e CTOs ao AP do protocolo (template com emojis)', () => {
    const basis = minimalBasis(true)
    const plan = buildMassivaOpeningPlanDraft(basis)
    const full = buildMassivaOpeningTechnicalDescription({
      requesterDisplayName: 'Teste',
      initialReport: 'r',
      fieldTechnicianRequesting: false,
      basis,
      affectedClientsCount: 99,
      eventStartDate: '2026-04-23',
      eventStartTime: '06:50',
      eventIdentifiedDate: '2026-04-23',
      eventIdentifiedTime: '14:57',
      forecastCloseDate: '',
      forecastCloseTime: '',
    })

    const context: MassivaOpenFinalContext = {
      personId: 1,
      operatorEmail: 'a@b.c',
      basis,
      plan,
      assignmentDescription: full,
      assignmentFinalDateIsoUtc: '',
      massivaOpenPath: '/m',
      massivaAfetadosPath: '/a',
      affectedUsersQuantityFlutterParity: 0,
      descriptionAutoSyncEnabled: true,
    }

    const reqA = plan.requests.find((r) => r.authenticationAccessPointCode === '25903')!
    const outA = buildMassivaAssignmentDescriptionForRequest(context, reqA)
    expect(outA).toContain('PA 25903')
    expect(outA).not.toContain('PA 27696')

    const reqB = plan.requests.find((r) => r.authenticationAccessPointCode === '27696')!
    const outB = buildMassivaAssignmentDescriptionForRequest(context, reqB)
    expect(outB).toContain('PA 27696')
    expect(outB).not.toContain('PA 25903')
  })
})
