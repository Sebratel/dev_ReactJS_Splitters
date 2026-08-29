import {
  collectEllevenStatusTexts,
  inferEllevenMassivaLifecycle,
  type EllevenMassivaLifecycle,
} from '@/features/massiva/lib/inferEllevenMassivaLifecycle'
import {
  ellevenStatusTextIndicatesClosed,
  ellevenStatusTextIndicatesOpen,
  ellevenStatusTextsIndicateCancelled,
  ellevenStatusTextsIndicateClosed,
} from '@/features/massiva/lib/massivaEllevenStatusText'
import { MASSIVA_API_GATEWAY_DEFAULTS } from '@/features/massiva/model/massivaApiGatewayConstants'
import { env } from '@/shared/config/env'
import { isJsonObject } from '@/shared/lib/typeGuards'

export type { EllevenMassivaLifecycle }

/**
 * Paridade com `MassivaStatus` / `MassivaTicket` em `lib/models/massiva_models.dart`.
 */
export type MassivaStatus = 'aberta' | 'encerrada' | 'cancelada' | 'desconhecida'

export type MassivaTicket = {
  protocol: number
  assignmentId: number | null
  title: string
  /** Texto longo de ocorrência / descrição, quando a API expõe separado do título. */
  description: string
  apCode: string
  splitterCode: string
  team: string
  createdBy: string
  responsible: string
  status: MassivaStatus
  /**
   * Ciclo de vida inferido a partir do payload Elleven (vários campos de situação).
   * Usado para filtros e reconciliação com o histórico local NexaView.
   */
  ellevenLifecycle: EllevenMassivaLifecycle
  /** `incidentStatusId` bruto do BFF, quando presente (1 aberta, 4 encerrada no Elleven). */
  ellevenIncidentStatusId: number | null
  /** Situações textuais coletadas do payload Elleven (ex.: Cancelado, Encerrado). */
  ellevenStatusTexts: readonly string[]
  openedAt: Date | null
  expectedCloseAt: Date | null
  /**
   * Quem ajustou a previsão de encerramento (BFF, quando o registo o expuser).
   * Complementa-se em cliente com a sessão OIDC + memória local após *Guardar* em Nexaview.
   */
  previsaoEncerramentoAtualizadaPor: string
  /**
   * Tempo estimado de restauração (**horas**), ex.: `estimateTimeOfRestoration` no JSON do BFF.
   * Quando presente, o card exibe isso no lugar da data em "Previsão de encerramento".
   */
  estimateTimeOfRestoration: number | null
  closedAt: Date | null
  /** Relato de encerramento preenchido pelo operador (null = não preenchido ou ticket aberto). */
  closeDescription: string | null
  /** Autor do encerramento (usuário da plataforma). null quando não registrado localmente. */
  closedBy: string | null
  affectedClients: number
  /**
   * Discriminação PF/PJ quando a listagem ou o GET `…/afetados/protocol/{id}` a expuserem.
   * Ambos `null` = origem não discrimina (o cartão do *dashboard* agrega só o total).
   */
  affectedClientsResidential: number | null
  affectedClientsCorporate: number | null
  usedFallback: boolean
  /**
   * Protocolo de infraestrutura aberto junto com a massiva (1 por evento). Só existe na origem
   * local (histórico MySQL) — o payload ao vivo do Elleven não expõe esse vínculo. Null/ausente
   * quando não houve abertura de infra.
   */
  infraProtocol?: number | null
  infraAssignmentId?: number | null
  /**
   * Quem identificou o evento (tecnico/zabbix/int6). Só existe na origem local (histórico MySQL);
   * o payload ao vivo do Elleven não expõe. Null/ausente quando não informado ou massiva antiga.
   */
  identifiedBy?: 'tecnico' | 'zabbix' | 'int6' | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return isJsonObject(value) ? value : {}
}

function pickInt(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function pickString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function pickOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (s === '') return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Contagem ≥ 0 ou `null` se ausente / inválida. */
function pickOptionalNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = pickInt(value, -1)
  if (n < 0) return null
  return n
}

/** Horas (≥ 0, pode ser decimal) para estimativa de restauração; `null` se ausente. */
function pickRestorationHours(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (value === '') return null
  const s = String(value).trim().replace(/,/g, '.')
  const n = typeof value === 'number' ? value : Number.parseFloat(s)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Primeiro candidato com horas parseáveis (ETR no JSON costuma vir em sítios distintos). */
function pickFirstRestorationHours(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const n = pickRestorationHours(c)
    if (n !== null) return n
  }
  return null
}

/** Paridade `MassivaTicket._parseDate`. */
export function parseMassivaDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (text === '') return null

  // IMPORTANTE: o formato brasileiro DD/MM/YYYY é tratado ANTES do Date.parse, porque o
  // Date.parse interpreta "02/07/2026" como MM/DD (7 de fev) e troca dia↔mês quando o dia ≤ 12.
  const match =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      text,
    )
  if (match !== null) {
    const day = Number.parseInt(match[1] ?? '', 10)
    const month = Number.parseInt(match[2] ?? '', 10)
    const year = Number.parseInt(match[3] ?? '', 10)
    const hour = Number.parseInt(match[4] ?? '0', 10)
    const minute = Number.parseInt(match[5] ?? '0', 10)
    const second = Number.parseInt(match[6] ?? '0', 10)
    if ([day, month, year].every((n) => Number.isFinite(n)) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day, hour, minute, second)
      if (!Number.isNaN(d.getTime())) return d
    }
  }

  // ISO 8601 e demais formatos que o Date.parse resolve corretamente (ex.: 2026-07-02T08:00).
  const isoTry = Date.parse(text)
  if (!Number.isNaN(isoTry)) {
    const d = new Date(isoTry)
    if (!Number.isNaN(d.getTime())) return d
  }

  return null
}

function parseMassivaDateCandidates(
  candidates: unknown[],
  dateCandidate: unknown,
  timeCandidate: unknown,
): Date | null {
  const dateText = dateCandidate !== null && dateCandidate !== undefined
    ? String(dateCandidate).trim()
    : ''
  const timeText =
    timeCandidate !== null && timeCandidate !== undefined
      ? String(timeCandidate).trim()
      : ''

  // Prioriza a dupla data+hora explícita do payload (normalmente o prazo visível no card),
  // evitando que um candidato ISO com timezone (ex.: ...Z) sobreponha o valor local exibido.
  if (dateText !== '' && timeText !== '') {
    const combined = parseMassivaDate(`${dateText} ${timeText}`)
    if (combined !== null) return combined
  }

  for (const candidate of candidates) {
    const parsed = parseMassivaDate(candidate)
    if (parsed !== null) return parsed
  }

  if (dateText === '') return null
  return parseMassivaDate(dateText)
}

function pickOptionalPositiveStatusId(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const n = pickInt(candidate, -1)
    if (n > 0) return n
  }
  return null
}

/** Elleven: abertura costuma usar `incidentStatusId` 1; encerramento/cancelamento usa 4+ (ou env). */
export function resolveMassivaStatusFromIncidentStatusId(
  incidentStatusId: number | null,
  statusTexts: readonly string[] = [],
): MassivaStatus | null {
  // Cancelamento tem precedência sobre encerramento.
  if (ellevenStatusTextsIndicateCancelled(statusTexts)) return 'cancelada'

  const cancelFromEnv = Number.parseInt(env.massivaCancelIncidentStatusId, 10)
  const cancelledIds = new Set<number>([
    8,
    ...(Number.isFinite(cancelFromEnv) && cancelFromEnv > 0 ? [cancelFromEnv] : []),
  ])
  if (incidentStatusId !== null && cancelledIds.has(incidentStatusId)) return 'cancelada'

  if (ellevenStatusTextsIndicateClosed(statusTexts)) return 'encerrada'

  if (incidentStatusId === null) return null

  const closeFromEnv = Number.parseInt(env.massivaCloseIncidentStatusId, 10)
  const closedIds = new Set<number>([
    4,
    ...(Number.isFinite(closeFromEnv) && closeFromEnv > 0 ? [closeFromEnv] : []),
  ])
  const extraClosed = String(env.massivaClosedIncidentStatusIds ?? '')
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  for (const id of extraClosed) closedIds.add(id)

  if (closedIds.has(incidentStatusId)) return 'encerrada'

  if (incidentStatusId === MASSIVA_API_GATEWAY_DEFAULTS.incidentStatusId) {
    return 'aberta'
  }

  return null
}

/** Qualquer campo de situação com hint de encerramento/cancelamento prevalece sobre “Em andamento”. */
function resolveMassivaStatusFromTexts(texts: readonly string[]): MassivaStatus {
  if (ellevenStatusTextsIndicateCancelled(texts)) return 'cancelada'
  if (texts.some(ellevenStatusTextIndicatesClosed)) return 'encerrada'
  if (texts.some(ellevenStatusTextIndicatesOpen)) return 'aberta'
  return 'desconhecida'
}

export function formatMassivaStatusLabel(
  status: MassivaStatus,
  options?: { statusTexts?: readonly string[] },
): string {
  const texts = options?.statusTexts ?? []
  if (status === 'cancelada' || ellevenStatusTextsIndicateCancelled(texts)) {
    return 'Cancelada'
  }
  if (status === 'encerrada' || ellevenStatusTextsIndicateClosed(texts)) {
    if (texts.some((t) => /cancelad/i.test(t))) return 'Cancelada'
    return 'Encerrada'
  }
  switch (status) {
    case 'aberta':
      return 'Aberta'
    default:
      return 'Desconhecida'
  }
}

/** Rótulo para UI a partir do ticket (status efetivo + textos Elleven quando disponíveis). */
export function formatMassivaTicketStatusLabel(ticket: {
  status: MassivaStatus
  ellevenLifecycle: EllevenMassivaLifecycle
  ellevenStatusTexts?: readonly string[]
  title?: string
  description?: string
}): string {
  const hintTexts = [
    ...(ticket.ellevenStatusTexts ?? []),
    ticket.title ?? '',
    ticket.description ?? '',
  ]
  const effective: MassivaStatus =
    ticket.status === 'cancelada' ||
    ellevenStatusTextsIndicateCancelled(ticket.ellevenStatusTexts ?? [])
      ? 'cancelada'
      : ticket.ellevenLifecycle === 'closed' ||
          ticket.status === 'encerrada' ||
          ellevenStatusTextsIndicateClosed(ticket.ellevenStatusTexts ?? [])
        ? 'encerrada'
        : ticket.status
  return formatMassivaStatusLabel(effective, { statusTexts: hintTexts })
}

/**
 * Primeiro string não vazio. Importante: `??` em cadeia NÃO ignora `""` — muitas APIs
 * mandam chaves vazias e a descrição real ficava inacessível.
 */
function firstNonEmptyString(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = pickString(c).trim()
    if (s !== '') return s
  }
  return ''
}

/**
 * Reúne texto de ocorrência a partir de `merged` e objetos aninhados comuns no BFF.
 * `catalogo` costuma ser só o tipo ("Registro Incidente Massivo"); o texto de detalhe vem
 * em outras chaves. Usa add sequencial (não `a ?? b`) para não travar em `""`.
 */
function buildMassivaDescriptionFromRow(
  json: Record<string, unknown>,
  merged: Record<string, unknown>,
  input: Record<string, unknown>,
  inputAssignment: Record<string, unknown>,
  assignment: Record<string, unknown>,
  chamado: Record<string, unknown>,
  atendimento: Record<string, unknown>,
): string {
  const ocorrenciaM = asRecord(merged.ocorrencia ?? json.ocorrencia)
  const ocorrenciaI = asRecord(input.ocorrencia)
  const dadosO = asRecord(merged.dadosOcorrencia ?? json.dadosOcorrencia ?? merged.dadosRegistro)
  const dadosIn = asRecord(input.dadosOcorrencia)
  const solicitacao = asRecord(merged.solicitacao ?? json.solicitacao)
  const incident = asRecord(json.incident ?? json.incidente ?? json.Incident)
  const task = asRecord(json.task)
  const relato = asRecord(merged.relato ?? json.relato)
  const atendimentoOco = asRecord(atendimento.ocorrencia)
  const chOco = asRecord(chamado.ocorrencia)

  const seen = new Set<string>()
  const out: string[] = []
  const add = (value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return
    }
    const t = pickString(value).trim()
    if (t === '' || t === '[object Object]' || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  for (const c of [
    merged.descricao,
    merged.description,
    merged.textoOcorrencia,
    merged.textoChamado,
    merged.textoLivre,
    merged.assignmentText,
    merged.assignmentDescription,
    merged.detalhamento,
    merged.descricaoCompleta,
    merged.descricaoLivre,
    merged.conteudo,
    merged.mensagem,
    merged.narrativa,
    relato.texto,
    relato.descricao,
    ocorrenciaM.descricao,
    ocorrenciaM.texto,
    ocorrenciaI.descricao,
    ocorrenciaI.texto,
    dadosO.descricao,
    dadosO.textoOcorrencia,
    dadosO.texto,
    dadosIn.textoOcorrencia,
    dadosIn.descricao,
    input.textoOcorrencia,
    input.description,
    input.descricao,
    input.descricaoLivre,
    input.mensagem,
    input.complemento,
    inputAssignment.notes,
    inputAssignment.texto,
    inputAssignment.text,
    inputAssignment.description,
    assignment.text,
    assignment.description,
    assignment.descricao,
    assignment.detalhamento,
    assignment.assignmentText,
    chamado.textoOcorrencia,
    chOco.descricao,
    chOco.texto,
    chamado.descricaoLivre,
    chamado.descricao,
    chamado.texto,
    chamado.mensagem,
    atendimentoOco.descricao,
    atendimentoOco.texto,
    atendimentoOco.mensagem,
    atendimento.descricaoLivre,
    atendimento.descricao,
    atendimento.texto,
    atendimento.mensagem,
    atendimento.complemento,
    atendimento.relatorio,
    atendimento.observacao,
    incident.texto,
    incident.description,
    incident.descricao,
    solicitacao.texto,
    solicitacao.descricao,
    solicitacao.mensagem,
    task.description,
    task.notes,
    merged.observacao,
    merged.observacoes,
    merged.complemento,
    merged.historico,
    merged.comentario,
    merged.comentarios,
    merged.informacaoComplementar,
    ocorrenciaM.observacao,
    merged.privateReport,
    json.descricao,
    json.description,
    json.notes,
    json.observacoes,
  ]) {
    add(c)
  }
  if (out.length > 0) {
    return out.join('\n\n')
  }
  return firstNonEmptyString(merged.assignmentText, merged.assignmentDescription)
}

/**
 * Extração do template técnico da abertura NexaView:
 * "Horario que iniciou o evento: 05/05/2026, 10:30"
 */
function parseOpenedAtFromDescription(description: string): Date | null {
  const t = description.trim()
  if (t === '') return null
  const m =
    /Horario que iniciou o evento:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2})/i.exec(t)
  if (m == null) return null
  return parseMassivaDate(`${m[1]} ${m[2]}`)
}

/**
 * Extração do template técnico da abertura NexaView:
 * "Prazo inicial de normalização: 05/05/2026, 19:00 - (...)"
 */
function parseExpectedCloseFromDescription(description: string): Date | null {
  const t = description.trim()
  if (t === '') return null
  const m =
    /Prazo inicial de normaliza[cç][aã]o:\s*(\d{2}\/\d{2}\/\d{4}),\s*(\d{2}:\d{2})/i.exec(
      t,
    )
  if (m == null) return null
  return parseMassivaDate(`${m[1]} ${m[2]}`)
}

/**
 * Paridade com `MassivaTicket.fromJson` — aliases e merges de `input` / `assignment` / `incidentStatus`.
 */
export function parseMassivaTicketFromApi(
  json: Record<string, unknown>,
): MassivaTicket {
  const input = asRecord(json.input)
  const inputAssignment = asRecord(input.assignment)
  const assignment = asRecord(json.assignment)
  const incidentStatus = asRecord(json.incidentStatus)
  const chamado = asRecord(json.chamado ?? json.chamada)
  const atendimento = asRecord(json.atendimento ?? json.incident ?? json.task)
  /** Blocos irmãos: `atendimento ?? incident` do parser ignora o outro; ETR costuma vir em `incident` só. */
  const atendimentoJson = asRecord(json.atendimento)
  const incidentJson = asRecord(json.incident)
  const taskJson = asRecord(json.task)

  const merged: Record<string, unknown> = { ...input, ...json }

  const dadosOcorrenciaJson = asRecord(
    merged.dadosOcorrencia ?? json.dadosOcorrencia ?? merged.dadosRegistro,
  )

  const assignmentIdRaw =
    merged.assignmentId ??
    merged.assignment_id ??
    merged.idAssignment ??
    merged.id_assignment ??
    merged.incidentAssignmentId ??
    merged.incident_assignment_id ??
    merged.atendimentoId ??
    merged.atendimento_id ??
    merged.codigoAssignment ??
    merged.codigo_assignment ??
    inputAssignment.id ??
    inputAssignment.ID ??
    inputAssignment.assignmentId ??
    assignment.id ??
    assignment.ID ??
    assignment.assignmentId ??
    chamado.assignmentId ??
    chamado.id ??
    atendimento.assignmentId ??
    atendimento.id ??
    merged.assignmentIdValue ??
    merged.id ??
    merged.ID ??
    ''

  const protocolRaw =
    merged.protocol ?? merged.protocolo ?? merged.id ?? input.id

  const closedAtEarly = parseMassivaDateCandidates(
    [
      merged.closedAt,
      merged.finalizado,
      merged.finalizationDate,
      merged.closedDate,
      merged.closureDate,
      merged.closedData,
      merged.dataEncerramento,
      merged.dataFechamento,
    ],
    merged.closedDate ?? merged.closureDate ?? merged.dataEncerramento,
    merged.closedTime ?? merged.closureTime,
  )

  const cancelledAtEarly = parseMassivaDateCandidates(
    [
      merged.cancelledAt,
      merged.canceledAt,
      merged.dataCancelamento,
      merged.dataCancelada,
      merged.cancelamentoEm,
      merged.cancelledDate,
      merged.cancellationDate,
    ],
    merged.dataCancelamento ?? merged.cancelledDate ?? merged.cancellationDate,
    merged.cancelledTime ?? merged.cancellationTime,
  )

  const incidentStatusId = pickOptionalPositiveStatusId(
    merged.incidentStatusId,
    merged.incident_status_id,
    incidentStatus.id,
    incidentStatus.ID,
    input.incidentStatusId,
    atendimento.incidentStatusId,
    incidentJson.incidentStatusId,
    chamado.incidentStatusId,
  )
  const statusTexts = collectEllevenStatusTexts({
    merged,
    incidentStatus,
    assignment,
    atendimento,
    chamado,
  })

  const expectedCloseAtEarly = parseMassivaDateCandidates(
    [
      inputAssignment.finalDate,
      inputAssignment.finalData,
      assignment.finalDate,
      assignment.finalData,
      merged.finalDate,
      merged.finalData,
      merged.maintenanceDate,
      merged.forecastClosingDate,
      merged.expectedCloseAt,
      merged.expectedClosureDate,
      merged.previsionClosingDate,
      merged.previsionCloseAt,
      merged.sla,
      inputAssignment.sla,
    ],
    merged.maintenanceDate ??
      merged.forecastClosingDate ??
      merged.finalDate ??
      merged.finalData,
    merged.maintenanceTime ??
      merged.forecastClosingTime ??
      merged.finalTime,
  )

  const ellevenLifecycle = inferEllevenMassivaLifecycle({
    statusTexts,
    incidentStatusId,
    closedAt: closedAtEarly,
    cancelledAt: cancelledAtEarly,
    expectedCloseAt: expectedCloseAtEarly,
  })

  const statusFromTexts = resolveMassivaStatusFromTexts(statusTexts)
  const statusFromIncidentId = resolveMassivaStatusFromIncidentStatusId(
    incidentStatusId,
    statusTexts,
  )
  const textsIndicateClosed = ellevenStatusTextsIndicateClosed(statusTexts)
  const textsIndicateCancelled = ellevenStatusTextsIndicateCancelled(statusTexts)

  const status: MassivaStatus =
    cancelledAtEarly != null || textsIndicateCancelled || statusFromIncidentId === 'cancelada'
      ? 'cancelada'
      : closedAtEarly != null || ellevenLifecycle === 'closed' || textsIndicateClosed
        ? 'encerrada'
        : ellevenLifecycle === 'open'
          ? 'aberta'
          : statusFromIncidentId ?? statusFromTexts

  const title = pickString(
    merged.title ??
      assignment.title ??
      merged.tituloIncidente ??
      merged.catalogo ??
      merged.descricao ??
      merged.description ??
      merged.subject ??
      'Massiva',
  )

  const description = buildMassivaDescriptionFromRow(
    json,
    merged,
    input,
    inputAssignment,
    assignment,
    chamado,
    atendimento,
  )

  const apCode = pickString(
    merged.apCode ??
      merged.pontoDeAcesso ??
      merged.accessPoint ??
      merged.accessPointCode ??
      '',
  )

  const splitterCode = pickString(
    merged.splitterCode ?? merged.splitter ?? merged.networkBoxCode ?? '',
  )

  const team = pickString(merged.team ?? merged.equipe ?? '')

  const createdBy = pickString(
    merged.criadoPor ??
      merged.createdBy ??
      merged.solicitante ??
      merged.requester ??
      '',
  )

  const responsible = pickString(
    merged.responsavel ??
      merged.responsible ??
      merged.assignedTo ??
      merged.responsibleName ??
      merged.atendente ??
      '',
  )

  const openedAt = parseMassivaDate(
    merged.openedAt ??
      inputAssignment.beginningDate ??
      inputAssignment.beginningData ??
      assignment.beginningDate ??
      assignment.beginningData ??
      merged.beginningDate ??
      merged.beginningData ??
      merged.criacao ??
      merged.creationDate ??
      merged.createdAt ??
      merged.openingDate,
  )
  const openedAtFromDescription = parseOpenedAtFromDescription(description)

  const expectedCloseAt = parseMassivaDateCandidates(
    [
      inputAssignment.finalDate,
      inputAssignment.finalData,
      assignment.finalDate,
      assignment.finalData,
      merged.finalDate,
      merged.finalData,
      merged.maintenanceDate,
      merged.forecastClosingDate,
      merged.expectedCloseAt,
      merged.expectedClosureDate,
      merged.previsionClosingDate,
      merged.previsionCloseAt,
      merged.sla,
      inputAssignment.sla,
    ],
    merged.maintenanceDate ??
      merged.forecastClosingDate ??
      merged.finalDate ??
      merged.finalData,
    merged.maintenanceTime ??
      merged.forecastClosingTime ??
      merged.finalTime,
  )
  const expectedCloseFromDescription =
    parseExpectedCloseFromDescription(description)

  const closedAt =
    closedAtEarly ??
    parseMassivaDateCandidates(
      [
        merged.closedAt,
        merged.finalizado,
        merged.finalizationDate,
        merged.closedDate,
        merged.closureDate,
        merged.closedData,
        merged.dataEncerramento,
        merged.dataFechamento,
      ],
      merged.closedDate ?? merged.closureDate ?? merged.dataEncerramento,
      merged.closedTime ?? merged.closureTime,
    )

  const affectedClients = pickInt(
    merged.affectedClients ??
      merged.affectedUsersQuantity ??
      merged.quantidadeAfetados ??
      merged.qtdAfetados ??
      merged.totalAfetados ??
      merged.impacted ??
      merged.impactedClients ??
      merged.contractsCounter ??
      merged.clientsCount ??
      merged.affected_users ??
      0,
  )

  const affectedClientsResidential = pickOptionalNonNegativeInt(
    merged.affectedClientsResidential ??
      merged.quantidadeAfetadosResidencial ??
      merged.qtdAfetadosResidencial ??
      merged.totalAfetadosResidencial ??
      merged.afetadosResidenciais ??
      merged.residentialAffected ??
      merged.affectedResidential ??
      merged.affected_clients_residential,
  )
  const affectedClientsCorporate = pickOptionalNonNegativeInt(
    merged.affectedClientsCorporate ??
      merged.quantidadeAfetadosCorporativo ??
      merged.qtdAfetadosCorporativo ??
      merged.totalAfetadosCorporativo ??
      merged.afetadosCorporativos ??
      merged.corporateAffected ??
      merged.affectedCorporate ??
      merged.affected_clients_corporate,
  )
  const hasListSplit =
    affectedClientsResidential !== null && affectedClientsCorporate !== null

  const usedFallback =
    pickString(merged.strategy) === 'bulk_individual' ||
    merged.usedFallback === true

  const ocorrenciaM = asRecord(merged.ocorrencia ?? json.ocorrencia)

  const previsaoEncerramentoAtualizadaPor = firstNonEmptyString(
    merged.previsaoEncerramentoAtualizadaPor,
    merged.previsaoAlteradaPor,
    merged.usuarioAlteracaoPrevisao,
    merged.finishDateUpdatedBy,
    merged.expectedCloseUpdatedBy,
    merged.usuarioAtualizouPrevisao,
    assignment.previsaoEncerramentoAtualizadaPor,
    assignment.usuarioAtualizouPrevisao,
    assignment.finishDateUpdatedBy,
    inputAssignment.previsaoEncerramentoAtualizadaPor,
    inputAssignment.usuarioAtualizouPrevisao,
    atendimento.previsaoEncerramentoAtualizadaPor,
    atendimento.usuarioAtualizouPrevisao,
    atendimento.ultimaAlteracaoPrevisaoPor,
    input.previsaoEncerramentoAtualizadaPor,
  )

  const estimateTimeOfRestoration = pickFirstRestorationHours(
    merged.estimateTimeOfRestoration,
    merged.estimateTimeOfRestorationMinutes,
    merged.estimate_time_of_restoration,
    merged['EstimateTimeOfRestoration'],
    input.estimateTimeOfRestoration,
    input.estimate_time_of_restoration,
    inputAssignment.estimateTimeOfRestoration,
    assignment.estimateTimeOfRestoration,
    assignment.estimate_time_of_restoration,
    atendimentoJson.estimateTimeOfRestoration,
    atendimentoJson.estimate_time_of_restoration,
    incidentJson.estimateTimeOfRestoration,
    incidentJson.estimate_time_of_restoration,
    taskJson.estimateTimeOfRestoration,
    taskJson.estimate_time_of_restoration,
    atendimento.estimateTimeOfRestoration,
    chamado.estimateTimeOfRestoration,
    dadosOcorrenciaJson.estimateTimeOfRestoration,
    ocorrenciaM.estimateTimeOfRestoration,
    incidentStatus.estimateTimeOfRestoration,
  )

  return {
    protocol: pickInt(protocolRaw),
    assignmentId: pickOptionalPositiveInt(assignmentIdRaw),
    title,
    description,
    apCode,
    splitterCode,
    team,
    createdBy,
    responsible,
    status,
    ellevenLifecycle,
    ellevenIncidentStatusId: incidentStatusId,
    ellevenStatusTexts: statusTexts,
    openedAt: openedAtFromDescription ?? openedAt,
    expectedCloseAt: expectedCloseFromDescription ?? expectedCloseAt,
    previsaoEncerramentoAtualizadaPor,
    estimateTimeOfRestoration,
    closedAt,
    closeDescription: null,
    closedBy: null,
    affectedClients,
    affectedClientsResidential: hasListSplit ? affectedClientsResidential : null,
    affectedClientsCorporate: hasListSplit ? affectedClientsCorporate : null,
    usedFallback,
  }
}
