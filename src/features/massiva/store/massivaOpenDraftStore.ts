import { create } from 'zustand'

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
  /** true = técnico em campo; false = evento de rompimento */
  fieldTechnicianRequesting: boolean
  /**
   * Quando definido (ex.: clique em evento AutoISP), substitui a linha “Clientes afetados”
   * na descrição e o `affectedUsersQuantity` do POST em relação ao preview local.
   */
  affectedUsersQuantityAutoIspOverride: number | null

  setAssignmentDescription: (value: string) => void
  setDescriptionAutoSync: (value: boolean) => void
  setAssignmentForecastDate: (value: string) => void
  setAssignmentForecastTime: (value: string) => void
  setEventStartDate: (value: string) => void
  setEventStartTime: (value: string) => void
  setEventIdentifiedDate: (value: string) => void
  setEventIdentifiedTime: (value: string) => void
  setInitialReport: (value: string) => void
  setFieldTechnicianRequesting: (value: boolean) => void
  setAffectedUsersQuantityAutoIspOverride: (value: number | null) => void
  enableDescriptionAutoSync: () => void
  reset: () => void
}

const initial = {
  assignmentDescription: '',
  descriptionAutoSync: true,
  assignmentForecastDate: '',
  assignmentForecastTime: '',
  eventStartDate: '',
  eventStartTime: '',
  eventIdentifiedDate: '',
  eventIdentifiedTime: '',
  initialReport: '',
  fieldTechnicianRequesting: false,
  affectedUsersQuantityAutoIspOverride: null,
}

export const useMassivaOpenDraftStore = create<MassivaOpenDraftState>((set) => ({
  ...initial,
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
  setFieldTechnicianRequesting: (fieldTechnicianRequesting) =>
    set({ fieldTechnicianRequesting }),
  setAffectedUsersQuantityAutoIspOverride: (affectedUsersQuantityAutoIspOverride) =>
    set({ affectedUsersQuantityAutoIspOverride }),
  enableDescriptionAutoSync: () => set({ descriptionAutoSync: true }),
  reset: () => set(initial),
}))
