import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade com `MassivaStatus` / `MassivaTicket` em `lib/models/massiva_models.dart`.
 */
export type MassivaStatus = 'aberta' | 'encerrada' | 'desconhecida'

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
  affectedClients: number
  usedFallback: boolean
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

  const isoTry = Date.parse(text)
  if (!Number.isNaN(isoTry)) {
    const d = new Date(isoTry)
    if (!Number.isNaN(d.getTime())) return d
  }

  const match =
    /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      text,
    )
  if (match === null) return null

  const day = Number.parseInt(match[1] ?? '', 10)
  const month = Number.parseInt(match[2] ?? '', 10)
  const year = Number.parseInt(match[3] ?? '', 10)
  const hour = Number.parseInt(match[4] ?? '0', 10)
  const minute = Number.parseInt(match[5] ?? '0', 10)
  const second = Number.parseInt(match[6] ?? '0', 10)

  if (![day, month, year].every((n) => Number.isFinite(n))) return null
  const d = new Date(year, month - 1, day, hour, minute, second)
  return Number.isNaN(d.getTime()) ? null : d
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

function resolveMassivaStatus(statusRaw: string): MassivaStatus {
  const s = statusRaw.trim().toLowerCase()
  if (s.includes('abert')) return 'aberta'
  if (
    s.includes('encerr') ||
    s.includes('fech') ||
    s.includes('close')
  ) {
    return 'encerrada'
  }
  return 'desconhecida'
}

export function formatMassivaStatusLabel(status: MassivaStatus): string {
  switch (status) {
    case 'aberta':
      return 'Aberta'
    case 'encerrada':
      return 'Encerrada'
    default:
      return 'Desconhecida'
  }
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

  const statusRaw = pickString(
    merged.status ??
      merged.situation ??
      incidentStatus.title ??
      merged.situationDescription ??
      merged.incidentSituation ??
      merged.incidentSituationDescription ??
      merged.solicitationSituation ??
      '',
  )

  const status = resolveMassivaStatus(statusRaw)

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
    inputAssignment.responsavel ??
      merged.responsavel ??
      merged.createdBy ??
      merged.criadoPor ??
      '',
  )

  const responsible = pickString(
    merged.responsavel ?? merged.responsible ?? '',
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

  const expectedCloseAt = parseMassivaDateCandidates(
    [
      merged.sla,
      inputAssignment.sla,
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
    ],
    merged.maintenanceDate ??
      merged.forecastClosingDate ??
      merged.finalDate ??
      merged.finalData,
    merged.maintenanceTime ??
      merged.forecastClosingTime ??
      merged.finalTime,
  )

  const closedAt = parseMassivaDateCandidates(
    [
      merged.closedAt,
      merged.finalizado,
      merged.finalizationDate,
      merged.closedDate,
      merged.closureDate,
      merged.closedData,
    ],
    merged.closedDate ?? merged.closureDate,
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
    openedAt,
    expectedCloseAt,
    previsaoEncerramentoAtualizadaPor,
    estimateTimeOfRestoration,
    closedAt,
    affectedClients,
    usedFallback,
  }
}
