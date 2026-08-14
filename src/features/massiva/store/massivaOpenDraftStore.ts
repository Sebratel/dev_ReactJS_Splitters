import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MassivaInfraProtocolSelection } from '@/features/massiva/model/massivaInfraProtocol'

/** Quem identificou / solicitou a abertura do evento de massiva. */
export type MassivaEventIdentifiedBy = 'tecnico' | 'zabbix' | 'int6'

/**
 * Rascunho de abertura: campos do formulário + descrição técnica (template ou editada).
 */
type MassivaOpenDraftState = {
  assignmentDescription: string
  /** Quando true, a descrição é reescrita pelo modelo ao mudar topologia/campos. */
  descriptionAutoSync: boolean

  assignmentForecastDate: string
  assignmentForecastTime: string

  eventStartDate: string
  eventStartTime: string
  eventIdentifiedDate: string
  eventIdentifiedTime: string

  initialReport: string
  /** Quem identificou o evento: 'tecnico' | 'zabbix' | 'int6' */
  eventIdentifiedBy: MassivaEventIdentifiedBy
  /**
   * Quando definido (ex.: clique em evento AutoISP), substitui a linha “Clientes afetados”
   * na descrição e o `affectedUsersQuantity` do POST em relação ao preview local.
   */
  affectedUsersQuantityAutoIspOverride: number | null

  /** Protocolo de infraestrutura a abrir junto ('none' = nenhum). */
  infraProtocolType: MassivaInfraProtocolSelection
  /** Sinal aferido (dBm) — campo manual do tipo CTO Sinal Alto. */
  infraSignalDbm: string
  /** Tipo de avaria — campo manual do tipo CTO Avariada. */
  infraAvaria: string

  setAssignmentDescription: (value: string) => void
  setDescriptionAutoSync: (value: boolean) => void
  setAssignmentForecastDate: (value: string) => void
  setAssignmentForecastTime: (value: string) => void
  setEventStartDate: (value: string) => void
  setEventStartTime: (value: string) => void
  setEventIdentifiedDate: (value: string) => void
  setEventIdentifiedTime: (value: string) => void
  setInitialReport: (value: string) => void
  setEventIdentifiedBy: (value: MassivaEventIdentifiedBy) => void
  setAffectedUsersQuantityAutoIspOverride: (value: number | null) => void
  setInfraProtocolType: (value: MassivaInfraProtocolSelection) => void
  setInfraSignalDbm: (value: string) => void
  setInfraAvaria: (value: string) => void
  enableDescriptionAutoSync: () => void
  reset: () => void
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeInputValue(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

function buildInitialDraft() {
  const now = new Date()
  const today = formatDateInputValue(now)
  const currentTime = formatTimeInputValue(now)

  return {
    assignmentDescription: '',
    descriptionAutoSync: true,
    assignmentForecastDate: '',
    assignmentForecastTime: '',
    eventStartDate: today,
    eventStartTime: currentTime,
    eventIdentifiedDate: today,
    eventIdentifiedTime: currentTime,
    initialReport: '',
    eventIdentifiedBy: 'tecnico' as MassivaEventIdentifiedBy,
    affectedUsersQuantityAutoIspOverride: null,
    infraProtocolType: 'none' as MassivaInfraProtocolSelection,
    infraSignalDbm: '',
    infraAvaria: '',
  }
}

const initial = buildInitialDraft()

const createInitialState = () => ({
  assignmentDescription: '',
  descriptionAutoSync: true,
  assignmentForecastDate: '',
  assignmentForecastTime: '',
  eventStartDate: initial.eventStartDate,
  eventStartTime: initial.eventStartTime,
  eventIdentifiedDate: initial.eventIdentifiedDate,
  eventIdentifiedTime: initial.eventIdentifiedTime,
  initialReport: '',
  eventIdentifiedBy: 'tecnico' as MassivaEventIdentifiedBy,
  affectedUsersQuantityAutoIspOverride: null,
  infraProtocolType: 'none' as MassivaInfraProtocolSelection,
  infraSignalDbm: '',
  infraAvaria: '',
})

export const useMassivaOpenDraftStore = create<MassivaOpenDraftState>()(
  persist(
    (set) => ({
      ...createInitialState(),
      setAssignmentDescription: (assignmentDescription) =>
        set({ assignmentDescription }),
      setDescriptionAutoSync: (descriptionAutoSync) => set({ descriptionAutoSync }),
      setAssignmentForecastDate: (assignmentForecastDate) =>
        set({ assignmentForecastDate }),
      setAssignmentForecastTime: (assignmentForecastTime) =>
        set({ assignmentForecastTime }),
      setEventStartDate: (eventStartDate) => set({ eventStartDate }),
      setEventStartTime: (eventStartTime) => set({ eventStartTime }),
      setEventIdentifiedDate: (eventIdentifiedDate) =>
        set({ eventIdentifiedDate }),
      setEventIdentifiedTime: (eventIdentifiedTime) =>
        set({ eventIdentifiedTime }),
      setInitialReport: (initialReport) => set({ initialReport }),
      setEventIdentifiedBy: (eventIdentifiedBy) => set({ eventIdentifiedBy }),
      setAffectedUsersQuantityAutoIspOverride: (affectedUsersQuantityAutoIspOverride) =>
        set({ affectedUsersQuantityAutoIspOverride }),
      setInfraProtocolType: (infraProtocolType) => set({ infraProtocolType }),
      setInfraSignalDbm: (infraSignalDbm) => set({ infraSignalDbm }),
      setInfraAvaria: (infraAvaria) => set({ infraAvaria }),
      enableDescriptionAutoSync: () => set({ descriptionAutoSync: true }),
      reset: () => set(buildInitialDraft()),
    }),
    {
      name: 'nexaview.massiva.open-draft.v3',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        assignmentDescription: state.assignmentDescription,
        descriptionAutoSync: state.descriptionAutoSync,
        assignmentForecastDate: state.assignmentForecastDate,
        assignmentForecastTime: state.assignmentForecastTime,
        eventStartDate: state.eventStartDate,
        eventStartTime: state.eventStartTime,
        eventIdentifiedDate: state.eventIdentifiedDate,
        eventIdentifiedTime: state.eventIdentifiedTime,
        initialReport: state.initialReport,
        eventIdentifiedBy: state.eventIdentifiedBy,
        affectedUsersQuantityAutoIspOverride: state.affectedUsersQuantityAutoIspOverride,
        infraProtocolType: state.infraProtocolType,
        infraSignalDbm: state.infraSignalDbm,
        infraAvaria: state.infraAvaria,
      }),
    },
  ),
)
