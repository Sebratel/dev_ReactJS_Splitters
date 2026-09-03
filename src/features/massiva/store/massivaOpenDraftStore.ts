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
  /** Código do Site (authenticationSiteCode) — campo manual do tipo Backbone. */
  infraSiteCode: string

  /**
   * true quando as datas do evento (início/identificação) já foram auto-preenchidas
   * com a hora atual neste fluxo de abertura. Evita sobrescrever um ajuste manual ao
   * reentrar no passo. Não é persistido — cada fluxo começa rearmado.
   */
  eventDatesAutofilledForFlow: boolean

  /**
   * Assinatura (códigos das CTOs) do último auto-preenchimento do "Sinal aferido".
   * Enquanto igual, não refaz (preserva ajuste manual); quando os splitters mudam
   * ou o tipo é trocado, a assinatura muda e o valor é reavaliado. Não é persistido.
   */
  infraSignalAutofillKey: string

  /**
   * Assinatura da seleção (AP/slot/porta/splitters) para a qual os campos da abertura
   * (relato, quem identificou, protocolo de infra) valem. Quando a seleção muda, esses
   * campos são resetados para o padrão. Persistido para não resetar num reload.
   */
  openFieldsSelectionKey: string

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
  setInfraSiteCode: (value: string) => void
  enableDescriptionAutoSync: () => void
  /** Preenche início/identificação com a hora atual — só na 1ª vez do fluxo. */
  autofillEventDatesToNowOnce: () => void
  /** Rearma o auto-preenchimento (ex.: ao reiniciar o fluxo na Rota). */
  resetEventDatesAutofill: () => void
  /**
   * Reseta relato/quem identificou/infra para o padrão quando a assinatura da seleção
   * (`key`) muda. No-op quando `key` é igual à última (preserva ir-e-voltar sem mudança).
   */
  resetOpenFieldsForSelection: (key: string) => void
  /**
   * Preenche o "Sinal aferido (dBm)" do CTO Sinal Alto quando a assinatura das CTOs
   * (`key`) difere da última — refaz ao trocar splitters/tipo, preserva ajuste manual.
   */
  autofillInfraSignal: (value: string, key: string) => void
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

/** Datas de início/identificação do evento com a data e hora atuais. */
function nowEventDates() {
  const now = new Date()
  const today = formatDateInputValue(now)
  const currentTime = formatTimeInputValue(now)
  return {
    eventStartDate: today,
    eventStartTime: currentTime,
    eventIdentifiedDate: today,
    eventIdentifiedTime: currentTime,
  }
}

/** Padrão da previsão de finalização: agora + N horas (editável pelo operador). */
const MASSIVA_DEFAULT_FORECAST_HOURS = 4
function defaultForecastDates() {
  const t = new Date(Date.now() + MASSIVA_DEFAULT_FORECAST_HOURS * 60 * 60 * 1000)
  return {
    assignmentForecastDate: formatDateInputValue(t),
    assignmentForecastTime: formatTimeInputValue(t),
  }
}

function buildInitialDraft() {
  return {
    assignmentDescription: '',
    descriptionAutoSync: true,
    ...defaultForecastDates(),
    ...nowEventDates(),
    initialReport: '',
    eventIdentifiedBy: 'tecnico' as MassivaEventIdentifiedBy,
    affectedUsersQuantityAutoIspOverride: null,
    infraProtocolType: 'none' as MassivaInfraProtocolSelection,
    infraSignalDbm: '',
    infraAvaria: '',
    infraSiteCode: '',
    eventDatesAutofilledForFlow: false,
    infraSignalAutofillKey: '',
    openFieldsSelectionKey: '',
  }
}

const initial = buildInitialDraft()

const createInitialState = () => ({
  assignmentDescription: '',
  descriptionAutoSync: true,
  assignmentForecastDate: initial.assignmentForecastDate,
  assignmentForecastTime: initial.assignmentForecastTime,
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
  infraSiteCode: '',
  eventDatesAutofilledForFlow: false,
  infraSignalAutofillKey: '',
  openFieldsSelectionKey: '',
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
      setInfraProtocolType: (infraProtocolType) =>
        set({ infraProtocolType, infraSignalAutofillKey: '' }),
      setInfraSignalDbm: (infraSignalDbm) => set({ infraSignalDbm }),
      setInfraAvaria: (infraAvaria) => set({ infraAvaria }),
      setInfraSiteCode: (infraSiteCode) => set({ infraSiteCode }),
      enableDescriptionAutoSync: () => set({ descriptionAutoSync: true }),
      autofillEventDatesToNowOnce: () =>
        set((state) =>
          state.eventDatesAutofilledForFlow
            ? {}
            : {
                ...nowEventDates(),
                ...defaultForecastDates(),
                eventDatesAutofilledForFlow: true,
              },
        ),
      resetEventDatesAutofill: () => set({ eventDatesAutofilledForFlow: false }),
      resetOpenFieldsForSelection: (key) =>
        set((state) =>
          state.openFieldsSelectionKey === key
            ? {}
            : {
                initialReport: '',
                eventIdentifiedBy: 'tecnico' as MassivaEventIdentifiedBy,
                infraProtocolType: 'none' as MassivaInfraProtocolSelection,
                infraSignalDbm: '',
                infraAvaria: '',
                infraSiteCode: '',
                infraSignalAutofillKey: '',
                openFieldsSelectionKey: key,
              },
        ),
      autofillInfraSignal: (value, key) =>
        set((state) =>
          value.trim() === '' || state.infraSignalAutofillKey === key
            ? {}
            : { infraSignalDbm: value, infraSignalAutofillKey: key },
        ),
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
        infraSiteCode: state.infraSiteCode,
        openFieldsSelectionKey: state.openFieldsSelectionKey,
      }),
    },
  ),
)
