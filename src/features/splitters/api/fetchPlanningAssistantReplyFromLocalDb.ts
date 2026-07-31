import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

export type IsaGravidade = 'baixa' | 'media' | 'alta' | 'critica' | ''

export type IsaCapilaridade = 'baixa' | 'media' | 'alta' | ''

export type IsaDecisaoOperacional =
  | 'EXPANSAO'
  | 'REMANEJO'
  | 'ALIVIO'
  | 'NOVA_CTO'
  | 'REBALANCEAMENTO'
  | 'SEM_VIABILIDADE'
  | ''

export type IsaCtoVizinhaAnalisada = {
  cto: string
  distancia_operacional: string
  ocupacao: string
  capacidade_livre: string
  /** Classificação geo da CTO vizinha (inclui OUTROS quando não couber no conjunto principal). */
  classificacao_geografica: string
  viabilidade: IsaCapilaridade
}

export type IsaClassificacaoGeografica =
  | 'ESQUINA'
  | 'ESQUINA_DIAGONAL'
  | 'MEIO_DE_QUADRA'
  | 'BIFURCACAO'
  | 'ROTATORIA'
  | 'CRUZAMENTO_COMPLEXO'
  | 'PONTA_DE_RUA'
  | 'VIA_PRINCIPAL'
  | 'VIA_SECUNDARIA'
  | ''

export type PlanningAssistantStructuredAnswer = {
  conclusao: string
  /** Um de: baixa | media | alta | critica; vazio se o modelo não informar. */
  gravidade: IsaGravidade
  classificacao_geografica: IsaClassificacaoGeografica
  confianca: string
  capilaridade: IsaCapilaridade
  distancia_operacional: string
  distancia_cruzamento: string
  angulo_vias: string
  decisao_operacional: IsaDecisaoOperacional
  viabilidade_remanejo: IsaCapilaridade
  viabilidade_expansao: IsaCapilaridade
  justificativa_decisao: string
  acao_prioritaria: string
  /** Soma aproximada dos pesos/penalidades (SCORE OPERACIONAL); null se indisponível. */
  score_operacional: number | null
  justificativa_score: string
  ruas_identificadas: string[]
  atendimento_prioritario: string[]
  ctos_vizinhas_analisadas: IsaCtoVizinhaAnalisada[]
  fatores: string[]
  evidencias: string[]
  inferencias: string[]
  riscos: string[]
  lacunas: string[]
  recomendacao: string
}

export type PlanningAssistantReply = {
  structuredAnswer: PlanningAssistantStructuredAnswer
  model: string
  contextPreview?: {
    splitterCode?: string | null
    splitterTitle?: string | null
    found?: boolean
  }
}

export type PlanningAssistantConversationTurn = {
  userPrompt: string
  assistantSummary: {
    conclusao: string
    decisao_operacional: IsaDecisaoOperacional
    acao_prioritaria: string
    recomendacao: string
  }
}

function toCleanString(value: unknown): string {
  return String(value ?? '').trim()
}

export function normalizeIsaGravidade(raw: unknown): IsaGravidade {
  const s = toCleanString(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (/crit/.test(s)) return 'critica'
  if (/alt/.test(s)) return 'alta'
  if (/medi/.test(s)) return 'media'
  if (/baix/.test(s)) return 'baixa'
  return ''
}

const ISA_CLASSIFICACAO_GEO_ALLOWED = new Set<string>([
  'ESQUINA',
  'ESQUINA_DIAGONAL',
  'MEIO_DE_QUADRA',
  'BIFURCACAO',
  'ROTATORIA',
  'CRUZAMENTO_COMPLEXO',
  'PONTA_DE_RUA',
  'VIA_PRINCIPAL',
  'VIA_SECUNDARIA',
])

export function normalizeIsaClassificacaoGeografica(raw: unknown): IsaClassificacaoGeografica {
  const s = toCleanString(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Z_]/g, '')
  if (ISA_CLASSIFICACAO_GEO_ALLOWED.has(s)) return s as IsaClassificacaoGeografica
  if (s.includes('ESQUINA') && s.includes('DIAGONAL')) return 'ESQUINA_DIAGONAL'
  if (/MEIO/.test(s) && /QUADRA/.test(s)) return 'MEIO_DE_QUADRA'
  if (/BIFURC/.test(s)) return 'BIFURCACAO'
  if (/ROTATOR/.test(s)) return 'ROTATORIA'
  if (/CRUZAMENTO/.test(s) && /COMPLEX/.test(s)) return 'CRUZAMENTO_COMPLEXO'
  if (/PONTA/.test(s) && /RUA/.test(s)) return 'PONTA_DE_RUA'
  if (/VIA_PRINCIPAL|PRINCIPAL/.test(s)) return 'VIA_PRINCIPAL'
  if (/VIA_SECUNDARIA|SECUNDARIA/.test(s)) return 'VIA_SECUNDARIA'
  if (s === 'ESQUINA') return 'ESQUINA'
  return ''
}

export function normalizeIsaCapilaridade(raw: unknown): IsaCapilaridade {
  const s = toCleanString(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (/alt/.test(s)) return 'alta'
  if (/medi/.test(s)) return 'media'
  if (/baix/.test(s)) return 'baixa'
  return ''
}

const ISA_DECISAO_OPERACIONAL = new Set<string>([
  'EXPANSAO',
  'REMANEJO',
  'ALIVIO',
  'NOVA_CTO',
  'REBALANCEAMENTO',
  'SEM_VIABILIDADE',
])

export function normalizeIsaDecisaoOperacional(raw: unknown): IsaDecisaoOperacional {
  const s = toCleanString(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\|\s*/g, '|')
  const head = (s.split('|')[0] ?? s).replace(/[^A-Z_]/g, '')
  if (ISA_DECISAO_OPERACIONAL.has(head)) return head as IsaDecisaoOperacional
  if (/^EXPAND|^EXPANS/.test(head)) return 'EXPANSAO'
  if (/ALIV/.test(head)) return 'ALIVIO'
  if (/REMANE/.test(head)) return 'REMANEJO'
  if (/NOVACTO|NOVA_CTO|NOVACT/.test(head)) return 'NOVA_CTO'
  if (/REBAL/.test(head)) return 'REBALANCEAMENTO'
  if (/SEMVIABIL|SEM_VIABIL/.test(head)) return 'SEM_VIABILIDADE'
  return ''
}

export function normalizeIsaScoreOperacional(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw)
  const s = toCleanString(raw)
  if (s === '' || /^null$/i.test(s) || /^n\/a$/i.test(s)) return null
  const m = s.match(/-?\d+/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? Math.round(n) : null
}

function combinedUtf8MojibakePenalty(text: string): number {
  const s = text.normalize('NFC')
  const c3 = (s.match(/\u00c3/g) || []).length
  const c2Tail = (s.match(/\u00c2[\u00a1-\u00bf]/g) || []).length
  return c3 + c2Tail
}

function looksLikeLayeredUtf8Mojibake(text: string): boolean {
  const s = text.normalize('NFC')
  return /\u00c3/.test(s) || /\u00c2[\u00a1-\u00bf]/.test(s)
}

function stripLeadingEmojiGraphic(text: string): { prefix: string; rest: string } {
  try {
    const m = text.match(
      /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D|\p{Extended_Pictographic})*\s*)+/u,
    )
    return m ? { prefix: m[0], rest: text.slice(m[0].length) } : { prefix: '', rest: text }
  } catch {
    return { prefix: '', rest: text }
  }
}

/**
 * Compatível com o reparo do servidor: várias camadas UTF-8/Latin-1 (sem usar Buffer no browser).
 */
function repairUtf8MojibakeLayers(text: string): string {
  if (text === '' || !looksLikeLayeredUtf8Mojibake(text)) return text

  const { prefix, rest } = stripLeadingEmojiGraphic(text)
  if (!looksLikeLayeredUtf8Mojibake(rest)) return text

  let cur = rest
  let prevPenalty = combinedUtf8MojibakePenalty(cur)

  for (let i = 0; i < 24; i += 1) {
    let next: string
    try {
      const bytes = Uint8Array.from(cur, (ch) => ch.charCodeAt(0) & 0xff)
      next = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      break
    }
    if (!next || next === cur) break
    if (next.includes('\uFFFD')) break

    const nextPenalty = combinedUtf8MojibakePenalty(next)
    if (nextPenalty > prevPenalty) break

    cur = next
    prevPenalty = nextPenalty
    if (nextPenalty === 0) break
  }

  return prefix + cur
}

function mojibakeScore(text: string): number {
  const matches = text.match(/[ÃÂâð]/g)
  return matches ? matches.length : 0
}

function replacementCharCount(text: string): number {
  const matches = text.match(/\uFFFD/g)
  return matches ? matches.length : 0
}

function tryDecodeLatin1AsUtf8(text: string): string | null {
  try {
    const bytes = Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff)
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export function normalizeIsaText(value: unknown): string {
  let current = repairUtf8MojibakeLayers(toCleanString(value))
  if (current === '') return current

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (!/[ÃÂâð]/.test(current)) break

    const repaired = tryDecodeLatin1AsUtf8(current)?.trim()
    if (!repaired || repaired === current) break
    if (replacementCharCount(repaired) > 0) break
    if (mojibakeScore(repaired) > mojibakeScore(current)) break

    current = repaired
  }

  return current
    .replaceAll('Ã¢â‚¬Â¢', '\u2022')
    .replaceAll('Ã¢â‚¬â€œ', '\u2013')
    .replaceAll('Ã¢â‚¬â€', '\u2014')
    .replaceAll('Ã¢â‚¬Å“', '\u201c')
    .replaceAll('Ã¢â‚¬Â', '\u201d')
    .replaceAll('Ã¢â‚¬Ëœ', '\u2018')
    .replaceAll('Ã¢â‚¬â„¢', '\u2019')
    .replaceAll('Ã¢â‚¬Â¦', '\u2026')
    .replaceAll('Ã¢Å“â€¦', '\u2705')
    .replaceAll('Ã¢Å¡Â Ã¯Â¸Â', '\u26a0\ufe0f')
    .replaceAll('Ã°Å¸â€Å½', '\ud83d\udd0e')
    .normalize('NFC')
}

function normalizeIsaClassificacaoVizinha(raw: unknown): string {
  const std = normalizeIsaClassificacaoGeografica(raw)
  if (std) return std
  const t = toCleanString(raw).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/\bOUTROS?\b/.test(t)) return 'OUTROS'
  return toCleanString(raw)
}

function normalizeIsaCtoVizinhaEntry(raw: unknown): IsaCtoVizinhaAnalisada | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const cto = normalizeIsaText(o.cto)
  if (!cto) return null
  return {
    cto,
    distancia_operacional: normalizeIsaText(o.distancia_operacional),
    ocupacao: normalizeIsaText(o.ocupacao),
    capacidade_livre: normalizeIsaText(o.capacidade_livre),
    classificacao_geografica: normalizeIsaText(
      normalizeIsaClassificacaoVizinha(o.classificacao_geografica),
    ),
    viabilidade: normalizeIsaCapilaridade(o.viabilidade),
  }
}

export function normalizeIsaCtosVizinhasAnalisadas(raw: unknown): IsaCtoVizinhaAnalisada[] {
  if (!Array.isArray(raw)) return []
  const out: IsaCtoVizinhaAnalisada[] = []
  for (const item of raw) {
    const row = normalizeIsaCtoVizinhaEntry(item)
    if (row) out.push(row)
  }
  return out
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeIsaText(item))
    .filter((item) => item !== '')
}

export async function fetchPlanningAssistantReplyFromLocalDb(input: {
  message: string
  splitterCode?: string
  straightRadiusMeters?: number
  maxRouteMeters?: number
  conversationHistory?: PlanningAssistantConversationTurn[]
}): Promise<PlanningAssistantReply> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/isa/planning-assistant/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: input.message,
        splitterCode: input.splitterCode?.trim() || undefined,
        straightRadiusMeters: input.straightRadiusMeters,
        maxRouteMeters: input.maxRouteMeters,
        conversationHistory: Array.isArray(input.conversationHistory)
          ? input.conversationHistory.map((turn) => ({
              userPrompt: toCleanString(turn.userPrompt),
              assistantSummary: {
                conclusao: toCleanString(turn.assistantSummary?.conclusao),
                decisao_operacional: normalizeIsaDecisaoOperacional(
                  turn.assistantSummary?.decisao_operacional,
                ),
                acao_prioritaria: toCleanString(turn.assistantSummary?.acao_prioritaria),
                recomendacao: toCleanString(turn.assistantSummary?.recomendacao),
              },
            }))
          : undefined,
      }),
    },
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(
      String(payload?.message || `Erro ao consultar assistente ISA: ${response.status}`),
    )
  }

  const structured = payload.structuredAnswer ?? {}

  return {
    structuredAnswer: {
      conclusao: normalizeIsaText(structured.conclusao),
      gravidade: normalizeIsaGravidade(structured.gravidade),
      classificacao_geografica: normalizeIsaClassificacaoGeografica(
        structured.classificacao_geografica,
      ),
      confianca: normalizeIsaText(structured.confianca),
      capilaridade: normalizeIsaCapilaridade(structured.capilaridade),
      distancia_operacional: normalizeIsaText(structured.distancia_operacional),
      distancia_cruzamento: normalizeIsaText(structured.distancia_cruzamento),
      angulo_vias: normalizeIsaText(structured.angulo_vias),
      decisao_operacional: normalizeIsaDecisaoOperacional(structured.decisao_operacional),
      viabilidade_remanejo: normalizeIsaCapilaridade(structured.viabilidade_remanejo),
      viabilidade_expansao: normalizeIsaCapilaridade(structured.viabilidade_expansao),
      justificativa_decisao: normalizeIsaText(structured.justificativa_decisao),
      acao_prioritaria: normalizeIsaText(structured.acao_prioritaria),
      score_operacional: normalizeIsaScoreOperacional(structured.score_operacional),
      justificativa_score: normalizeIsaText(structured.justificativa_score),
      ruas_identificadas: toStringList(structured.ruas_identificadas),
      atendimento_prioritario: toStringList(structured.atendimento_prioritario),
      ctos_vizinhas_analisadas: normalizeIsaCtosVizinhasAnalisadas(structured.ctos_vizinhas_analisadas),
      fatores: toStringList(structured.fatores),
      evidencias: toStringList(structured.evidencias),
      inferencias: toStringList(structured.inferencias),
      riscos: toStringList(structured.riscos),
      lacunas: toStringList(structured.lacunas),
      recomendacao: normalizeIsaText(structured.recomendacao),
    },
    model: String(payload.model ?? '').trim(),
    contextPreview:
      payload.contextPreview && typeof payload.contextPreview === 'object'
        ? {
            splitterCode:
              payload.contextPreview.splitterCode == null
                ? null
                : String(payload.contextPreview.splitterCode),
            splitterTitle:
              payload.contextPreview.splitterTitle == null
                ? null
                : String(payload.contextPreview.splitterTitle),
            found: Boolean(payload.contextPreview.found),
          }
        : undefined,
  }
}
