import { Buffer } from 'node:buffer';

import logger from './logger.js';
import { ISA_PLANNING_TEAM_INSTRUCTIONS } from './isaPlanningTeamInstructions.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

function getGeminiConfig() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const model =
    String(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  return { apiKey, model };
}

export function isPlanningAssistantConfigured() {
  const { apiKey } = getGeminiConfig();
  return apiKey !== '';
}

function flattenGeminiCandidate(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  const rawText = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  const finishReason = toCleanString(first?.finishReason);
  return { rawText, finishReason };
}

/** Gemini pode devolver finishReason MAX_TOKENS mesmo com JSON parseável por cima de string cortada. */
function geminiFinishIndicatesOutputTruncated(finishReason) {
  const fr = toCleanString(finishReason).toUpperCase();
  if (!fr) return false;
  if (fr.includes('MAX') && fr.includes('TOKEN')) return true;
  if (fr.includes('MAX') && fr.includes('OUTPUT')) return true;
  if (fr.includes('LENGTH')) return true;
  return false;
}

function extractJsonObject(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function toCleanString(value) {
  return String(value ?? '').trim();
}

/** Valores esperados no JSON da ISA: baixa | media | alta | critica */
function normalizeGravidade(raw) {
  const s = toCleanString(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/crit/.test(s)) return 'critica';
  if (/alt/.test(s)) return 'alta';
  if (/medi/.test(s) || /^media$/.test(s)) return 'media';
  if (/baix/.test(s)) return 'baixa';
  return '';
}

/** Valores esperados: baixa | media | alta */
function normalizeCapilaridadeIsa(raw) {
  const s = toCleanString(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/alt/.test(s)) return 'alta';
  if (/medi/.test(s) || /^media$/.test(s)) return 'media';
  if (/baix/.test(s)) return 'baixa';
  return '';
}

const ISA_CLASSIFICACAO_GEO_SET = new Set([
  'ESQUINA',
  'ESQUINA_DIAGONAL',
  'MEIO_DE_QUADRA',
  'BIFURCACAO',
  'ROTATORIA',
  'CRUZAMENTO_COMPLEXO',
  'PONTA_DE_RUA',
  'VIA_PRINCIPAL',
  'VIA_SECUNDARIA',
]);

function normalizeClassificacaoGeografica(raw) {
  const s = toCleanString(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Z_]/g, '');
  if (ISA_CLASSIFICACAO_GEO_SET.has(s)) return s;
  if (s.includes('ESQUINA') && s.includes('DIAGONAL')) return 'ESQUINA_DIAGONAL';
  if (/MEIO/.test(s) && /QUADRA/.test(s)) return 'MEIO_DE_QUADRA';
  if (/BIFURC/.test(s)) return 'BIFURCACAO';
  if (/ROTATOR/.test(s)) return 'ROTATORIA';
  if (/CRUZAMENTO/.test(s) && /COMPLEX/.test(s)) return 'CRUZAMENTO_COMPLEXO';
  if (/PONTA/.test(s) && /RUA/.test(s)) return 'PONTA_DE_RUA';
  if (/VIA_PRINCIPAL|PRINCIPAL/.test(s)) return 'VIA_PRINCIPAL';
  if (/VIA_SECUNDARIA|SECUNDARIA/.test(s)) return 'VIA_SECUNDARIA';
  if (s === 'ESQUINA') return 'ESQUINA';
  return '';
}

/** Soma ponderada aproximada (seção SCORE OPERACIONAL); null se não calculável. */
function normalizeScoreOperacional(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
  const s = toCleanString(raw);
  if (s === '' || /^null$/i.test(s) || /^n\/a$/i.test(s)) return null;
  const m = s.match(/-?\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const ISA_DECISAO_OPERACIONAL_SET = new Set([
  'EXPANSAO',
  'REMANEJO',
  'ALIVIO',
  'NOVA_CTO',
  'REBALANCEAMENTO',
  'SEM_VIABILIDADE',
]);

/** Resposta da ISA: uma das decisões finais obrigatórias (string). */
function normalizeDecisaoOperacional(raw) {
  let s = toCleanString(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\|\s*/g, '|');
  const head = s.split('|')[0] ?? s;
  const token = head.replace(/[^A-Z_]/g, '');
  if (ISA_DECISAO_OPERACIONAL_SET.has(token)) return token;
  if (/^EXPAND|^EXPANS/.test(token)) return 'EXPANSAO';
  if (/ALIV/.test(token)) return 'ALIVIO';
  if (/REMANE/.test(token)) return 'REMANEJO';
  if (/NOVACTO|NOVA_CTO|NOVACT/.test(token)) return 'NOVA_CTO';
  if (/REBAL/.test(token)) return 'REBALANCEAMENTO';
  if (/SEMVIABIL|SEM_VIABIL/.test(token)) return 'SEM_VIABILIDADE';
  return '';
}

function normalizeClassificacaoGeoVizinha(raw) {
  const std = normalizeClassificacaoGeografica(raw);
  if (std) return std;
  const u = toCleanString(raw).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bOUTROS?\b/.test(u)) return 'OUTROS';
  return repairUtf8Mojibake(toCleanString(raw));
}

function normalizeCtrosVizinhasAnalisadas(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const cto = repairUtf8Mojibake(toCleanString(item.cto));
    if (!cto) continue;
    out.push({
      cto,
      distancia_operacional: repairUtf8Mojibake(toCleanString(item.distancia_operacional)),
      ocupacao: repairUtf8Mojibake(toCleanString(item.ocupacao)),
      capacidade_livre: repairUtf8Mojibake(toCleanString(item.capacidade_livre)),
      classificacao_geografica: normalizeClassificacaoGeoVizinha(item.classificacao_geografica),
      viabilidade: normalizeCapilaridadeIsa(repairUtf8Mojibake(toCleanString(item.viabilidade))),
    });
  }
  return out;
}

/** Penalidade para saber se ainda parece UTF-8 sobre Latin-1 (Ã… ou Â + byte acentuado). */
function combinedUtf8MojibakePenalty(text) {
  const s = String(text).normalize('NFC');
  const c3 = (s.match(/\u00c3/g) || []).length;
  const c2Tail = (s.match(/\u00c2[\u00a1-\u00bf]/g) || []).length;
  return c3 + c2Tail;
}

function looksLikeLayeredUtf8Mojibake(text) {
  const s = String(text).normalize('NFC');
  return /\u00c3/.test(s) || /\u00c2[\u00a1-\u00bf]/.test(s);
}

/** Emojis no começo (⚠️, 💡 …) não são bytes Latin-1 — isola antes do reparo UTF-8. */
function stripLeadingEmojiGraphic(text) {
  const raw = String(text);
  try {
    const m = raw.match(
      /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D|\p{Extended_Pictographic})*\s*)+/u,
    );
    return m ? { prefix: m[0], rest: raw.slice(m[0].length) } : { prefix: '', rest: raw };
  } catch {
    return { prefix: '', rest: raw };
  }
}

/**
 * Desfaz várias camadas de "double UTF-8" (bytes UTF-8 tratados como Latin-1).
 * Chars > U+00FF viram byte baixo (como Buffer latin1 no Node), para cobrir padrões com ƒ U+0192 etc.
 * Para quando a penalidade some ou sobe (decode inválido).
 */
function repairUtf8Mojibake(text) {
  const raw = typeof text === 'string' ? text : '';
  if (raw === '' || !looksLikeLayeredUtf8Mojibake(raw)) return raw;

  const { prefix, rest } = stripLeadingEmojiGraphic(raw);
  if (!looksLikeLayeredUtf8Mojibake(rest)) return raw;

  let cur = rest;
  let prevPenalty = combinedUtf8MojibakePenalty(cur);

  for (let i = 0; i < 24; i += 1) {
    let next;
    try {
      next = Buffer.from(cur, 'latin1').toString('utf8');
    } catch {
      break;
    }
    if (!next || next === cur) break;
    if (next.includes('\uFFFD')) break;

    const nextPenalty = combinedUtf8MojibakePenalty(next);
    if (nextPenalty > prevPenalty) break;

    cur = next;
    prevPenalty = nextPenalty;
    if (nextPenalty === 0) break;
  }

  return prefix + cur;
}

/**
 * Remove IDs numéricos internos do cadastro (ex.: 10445) das strings exibidas ao analista.
 * Mantém códigos operacionais (SLE-C-...), contagens curtas e percentuais.
 */
function stripInternalSplitterNumericIds(text, context) {
  let s = String(text ?? '').trim();
  if (!s) return s;
  const splitter = context?.splitter;
  if (splitter?.found && splitter?.id != null) {
    const id = Math.trunc(Number(splitter.id));
    if (Number.isFinite(id) && id > 0) {
      s = s.replace(new RegExp(`\\b${id}\\b`, 'g'), '');
    }
  }
  s = s.replace(/\bCTO\s+\d{4,}\b/gi, 'CTO');
  s = s.replace(/\bsplitter\s+\d{4,}\b/gi, 'splitter');
  s = s.replace(/\(\s*\d{4,}\s*\)/g, '');
  s = s.replace(/\b\d{4,}\s*\(\s*(?=SLE-)/gi, '(');
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/\(\s*\(/g, '(').trim();
  return s;
}

function repairStructuredPlanningAnswer(structured, context = null) {
  const strip = (raw) => {
    const r = repairUtf8Mojibake(toCleanString(raw));
    return context ? stripInternalSplitterNumericIds(r, context) : r;
  };
  const stripList = (arr) =>
    toStringList(arr).map((item) => {
      const r = repairUtf8Mojibake(item);
      return context ? stripInternalSplitterNumericIds(r, context) : r;
    });

  const fatores = stripList(structured?.fatores);
  const evidencias = stripList(structured?.evidencias);
  const inferencias = stripList(structured?.inferencias);
  const riscos = stripList(structured?.riscos);
  const lacunas = stripList(structured?.lacunas);
  const ruasIdentificadas = stripList(structured?.ruas_identificadas);
  const atendimentoPrioritario = stripList(structured?.atendimento_prioritario);

  return {
    conclusao: strip(structured?.conclusao),
    gravidade: normalizeGravidade(repairUtf8Mojibake(toCleanString(structured?.gravidade))),
    classificacao_geografica: normalizeClassificacaoGeografica(
      repairUtf8Mojibake(toCleanString(structured?.classificacao_geografica)),
    ),
    confianca: repairUtf8Mojibake(toCleanString(structured?.confianca)),
    capilaridade: normalizeCapilaridadeIsa(repairUtf8Mojibake(toCleanString(structured?.capilaridade))),
    distancia_operacional: strip(structured?.distancia_operacional),
    distancia_cruzamento: strip(structured?.distancia_cruzamento),
    angulo_vias: strip(structured?.angulo_vias),
    decisao_operacional: normalizeDecisaoOperacional(structured?.decisao_operacional),
    viabilidade_remanejo: normalizeCapilaridadeIsa(
      repairUtf8Mojibake(toCleanString(structured?.viabilidade_remanejo)),
    ),
    viabilidade_expansao: normalizeCapilaridadeIsa(
      repairUtf8Mojibake(toCleanString(structured?.viabilidade_expansao)),
    ),
    justificativa_decisao: strip(structured?.justificativa_decisao),
    acao_prioritaria: strip(structured?.acao_prioritaria),
    ruas_identificadas: ruasIdentificadas,
    atendimento_prioritario: atendimentoPrioritario,
    score_operacional: normalizeScoreOperacional(structured?.score_operacional),
    justificativa_score: strip(structured?.justificativa_score),
    ctos_vizinhas_analisadas: normalizeCtrosVizinhasAnalisadas(structured?.ctos_vizinhas_analisadas).map(
      (row) => ({
        ...row,
        cto: strip(row.cto),
        distancia_operacional: strip(row.distancia_operacional),
        ocupacao: strip(row.ocupacao),
        capacidade_livre: strip(row.capacidade_livre),
        classificacao_geografica: normalizeClassificacaoGeoVizinha(
          context
            ? stripInternalSplitterNumericIds(
                repairUtf8Mojibake(toCleanString(row.classificacao_geografica)),
                context,
              )
            : repairUtf8Mojibake(toCleanString(row.classificacao_geografica)),
        ),
        viabilidade: normalizeCapilaridadeIsa(
          context
            ? stripInternalSplitterNumericIds(
                repairUtf8Mojibake(toCleanString(row.viabilidade)),
                context,
              )
            : repairUtf8Mojibake(toCleanString(row.viabilidade)),
        ),
      }),
    ),
    fatores,
    evidencias,
    inferencias,
    riscos,
    lacunas,
    recomendacao: strip(structured?.recomendacao),
  };
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toCleanString(item))
    .filter((item) => item !== '');
}

function normalizeBulletLine(line) {
  return String(line ?? '')
    .replace(/^\s*(?:[-*•\u2022]|\d+[.)])\s*/, '')
    .trim();
}

function pushSectionLine(target, key, line) {
  const cleaned = normalizeBulletLine(line);
  if (cleaned === '') return;
  const bucket = target[key];
  if (!Array.isArray(bucket)) return;
  bucket.push(cleaned);
}

function parseStructuredTextFallback(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const sections = {
    conclusao: [],
    gravidade: [],
    classificacao_geografica: [],
    confianca: [],
    capilaridade: [],
    distancia_operacional: [],
    distancia_cruzamento: [],
    angulo_vias: [],
    decisao_operacional: [],
    viabilidade_remanejo: [],
    viabilidade_expansao: [],
    justificativa_decisao: [],
    acao_prioritaria: [],
    score_operacional: [],
    justificativa_score: [],
    ruas_identificadas: [],
    atendimento_prioritario: [],
    fatores: [],
    evidencias: [],
    inferencias: [],
    riscos: [],
    lacunas: [],
    recomendacao: [],
  };

  let currentKey = null;
  for (const line of lines) {
    const normalized = line
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (/conclus/.test(normalized)) {
      currentKey = 'conclusao';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/gravida/.test(normalized)) {
      currentKey = 'gravidade';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/classifica/.test(normalized) && /geogra/.test(normalized)) {
      currentKey = 'classificacao_geografica';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/confian/.test(normalized)) {
      currentKey = 'confianca';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/capilarida/.test(normalized)) {
      currentKey = 'capilaridade';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/distancia.*operacional/.test(normalized) || /distância.*operacional/.test(line.toLowerCase())) {
      currentKey = 'distancia_operacional';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/distancia.*cruzamento/.test(normalized) || /distância.*cruzamento/.test(line.toLowerCase())) {
      currentKey = 'distancia_cruzamento';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/angulo.*vias/.test(normalized) || /ângulo.*vias/.test(line.toLowerCase())) {
      currentKey = 'angulo_vias';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/decis[aã]o.*operacional/.test(normalized)) {
      currentKey = 'decisao_operacional';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/viabilidade.*remanej/.test(normalized)) {
      currentKey = 'viabilidade_remanejo';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/viabilidade.*expans/.test(normalized)) {
      currentKey = 'viabilidade_expansao';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/justificativa.*decis/.test(normalized)) {
      currentKey = 'justificativa_decisao';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/a[cç][aã]o.*priorit/.test(normalized)) {
      currentKey = 'acao_prioritaria';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/justificativa/.test(normalized) && /score/.test(normalized)) {
      currentKey = 'justificativa_score';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (
      (/score/.test(normalized) && /operacional/.test(normalized)) ||
      /^score_operacional/i.test(line.trim())
    ) {
      currentKey = 'score_operacional';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/ruas.*identificadas/.test(normalized)) {
      currentKey = 'ruas_identificadas';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/atendimento.*priorit/.test(normalized)) {
      currentKey = 'atendimento_prioritario';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/fatores?/.test(normalized)) {
      currentKey = 'fatores';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/eviden/.test(normalized)) {
      currentKey = 'evidencias';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/infer/.test(normalized)) {
      currentKey = 'inferencias';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/lacunas?/.test(normalized)) {
      currentKey = 'lacunas';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/riscos?/.test(normalized)) {
      currentKey = 'riscos';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/recomend/.test(normalized)) {
      currentKey = 'recomendacao';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }

    if (currentKey) {
      pushSectionLine(sections, currentKey, line);
    }
  }

  const gravidadeRaw = sections.gravidade.join(' ').trim();

  return {
    conclusao: sections.conclusao.join(' ').trim(),
    gravidade: gravidadeRaw ? normalizeGravidade(gravidadeRaw) : '',
    classificacao_geografica: normalizeClassificacaoGeografica(
      sections.classificacao_geografica.join(' ').trim(),
    ),
    confianca: sections.confianca.join(' ').trim(),
    capilaridade: normalizeCapilaridadeIsa(sections.capilaridade.join(' ').trim()),
    distancia_operacional: sections.distancia_operacional.join(' ').trim(),
    distancia_cruzamento: sections.distancia_cruzamento.join(' ').trim(),
    angulo_vias: sections.angulo_vias.join(' ').trim(),
    decisao_operacional: normalizeDecisaoOperacional(sections.decisao_operacional.join(' ').trim()),
    viabilidade_remanejo: normalizeCapilaridadeIsa(sections.viabilidade_remanejo.join(' ').trim()),
    viabilidade_expansao: normalizeCapilaridadeIsa(sections.viabilidade_expansao.join(' ').trim()),
    justificativa_decisao: sections.justificativa_decisao.join(' ').trim(),
    acao_prioritaria: sections.acao_prioritaria.join(' ').trim(),
    score_operacional: normalizeScoreOperacional(sections.score_operacional.join(' ').trim()),
    justificativa_score: sections.justificativa_score.join(' ').trim(),
    ruas_identificadas: sections.ruas_identificadas,
    atendimento_prioritario: sections.atendimento_prioritario,
    ctos_vizinhas_analisadas: [],
    fatores: sections.fatores,
    evidencias: sections.evidencias,
    inferencias: sections.inferencias,
    riscos: sections.riscos,
    lacunas: sections.lacunas,
    recomendacao: sections.recomendacao.join(' ').trim(),
  };
}

function splitLooseParagraphs(text) {
  return String(text ?? '')
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((part) => normalizeBulletLine(part))
    .filter((part) => part !== '');
}

function extractFirstSentence(text) {
  const cleaned = toCleanString(text);
  if (!cleaned) return '';
  const match = cleaned.match(/^.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : cleaned;
}

function buildLooseStructuredAnswer(rawText) {
  const paragraphs = splitLooseParagraphs(rawText);
  const firstParagraph = paragraphs[0] || '';
  const conclusao = extractFirstSentence(firstParagraph);

  const remainingParagraphs = paragraphs.slice(1);
  const remainingFirstParagraph =
    firstParagraph && conclusao && firstParagraph !== conclusao
      ? normalizeBulletLine(firstParagraph.slice(conclusao.length))
      : '';

  const fatores = [
    remainingFirstParagraph,
    ...remainingParagraphs,
  ].filter((item) => item !== '');

  return {
    conclusao:
      conclusao || 'A ISA recebeu a pergunta, mas a resposta veio sem um resumo inicial claro.',
    gravidade: '',
    classificacao_geografica: '',
    confianca: '',
    capilaridade: '',
    distancia_operacional: '',
    distancia_cruzamento: '',
    angulo_vias: '',
    decisao_operacional: '',
    viabilidade_remanejo: '',
    viabilidade_expansao: '',
    justificativa_decisao: '',
    acao_prioritaria: '',
    ruas_identificadas: [],
    atendimento_prioritario: [],
    ctos_vizinhas_analisadas: [],
    score_operacional: null,
    justificativa_score: '',
    fatores:
      fatores.length > 0
        ? fatores
        : ['O modelo respondeu de forma livre, sem detalhar fatores em blocos separados.'],
    evidencias: [],
    inferencias: [],
    riscos: [],
    lacunas: [],
    recomendacao:
      'Revise o caso com os dados atuais e, se necessário, refine a pergunta para obter uma análise mais específica.',
  };
}

function hasGenericFallbackFactors(fatores) {
  return (
    Array.isArray(fatores) &&
    fatores.length === 1 &&
    fatores[0] === 'Não foram destacados fatores separados na resposta recebida.'
  );
}

function hasGenericFallbackRecommendation(recomendacao) {
  return (
    toCleanString(recomendacao) ===
    'Use a resposta como apoio inicial e complemente a análise com o contexto operacional disponível.'
  );
}

function normalizeStructuredAnswer(parsed) {
  const conclusao = toCleanString(parsed?.conclusao);
  const gravidade = normalizeGravidade(parsed?.gravidade);
  const classificacao_geografica = normalizeClassificacaoGeografica(parsed?.classificacao_geografica);
  const confianca = toCleanString(parsed?.confianca);
  const capilaridade = normalizeCapilaridadeIsa(parsed?.capilaridade);
  const distancia_operacional = toCleanString(parsed?.distancia_operacional);
  const distancia_cruzamento = toCleanString(parsed?.distancia_cruzamento);
  const angulo_vias = toCleanString(parsed?.angulo_vias);
  const ruas_identificadas = toStringList(parsed?.ruas_identificadas);
  const atendimento_prioritario = toStringList(parsed?.atendimento_prioritario);
  const score_operacional = normalizeScoreOperacional(parsed?.score_operacional);
  const justificativa_score = toCleanString(parsed?.justificativa_score);
  const fatores = toStringList(parsed?.fatores);
  const evidencias = toStringList(parsed?.evidencias);
  const inferencias = toStringList(parsed?.inferencias);
  const riscos = toStringList(parsed?.riscos);
  const lacunas = toStringList(parsed?.lacunas);
  const recomendacao = toCleanString(parsed?.recomendacao);
  const decisao_operacional = normalizeDecisaoOperacional(parsed?.decisao_operacional);
  const viabilidade_remanejo = normalizeCapilaridadeIsa(parsed?.viabilidade_remanejo);
  const viabilidade_expansao = normalizeCapilaridadeIsa(parsed?.viabilidade_expansao);
  const justificativa_decisao = toCleanString(parsed?.justificativa_decisao);
  const acao_prioritaria = toCleanString(parsed?.acao_prioritaria);
  const ctos_vizinhas_analisadas = normalizeCtrosVizinhasAnalisadas(parsed?.ctos_vizinhas_analisadas);

  return {
    conclusao:
      conclusao ||
      'A ISA respondeu, mas não trouxe uma conclusão objetiva no formato esperado.',
    gravidade,
    classificacao_geografica,
    confianca,
    capilaridade,
    distancia_operacional,
    distancia_cruzamento,
    angulo_vias,
    decisao_operacional,
    viabilidade_remanejo,
    viabilidade_expansao,
    justificativa_decisao,
    acao_prioritaria,
    ruas_identificadas,
    atendimento_prioritario,
    score_operacional,
    justificativa_score,
    ctos_vizinhas_analisadas,
    fatores:
      fatores.length > 0
        ? fatores
        : ['Não foram destacados fatores separados na resposta recebida.'],
    evidencias,
    inferencias,
    riscos,
    lacunas,
    recomendacao:
      recomendacao ||
      'Use a resposta como apoio inicial e complemente a análise com o contexto operacional disponível.',
  };
}

function parseGeminiStructuredAnswer(rawText) {
  const jsonText = extractJsonObject(rawText);
  if (jsonText) {
    try {
      return normalizeStructuredAnswer(JSON.parse(jsonText));
    } catch (error) {
      logger.warn('planning_assistant_gemini_json_invalid_fallback_text', { error });
    }
  }

  const sectionParsed = parseStructuredTextFallback(rawText);
  const hasSectionContent =
    sectionParsed.conclusao ||
    sectionParsed.gravidade ||
    sectionParsed.classificacao_geografica ||
    sectionParsed.confianca ||
    sectionParsed.capilaridade ||
    sectionParsed.distancia_operacional ||
    sectionParsed.distancia_cruzamento ||
    sectionParsed.angulo_vias ||
    toCleanString(sectionParsed?.decisao_operacional) !== '' ||
    toCleanString(sectionParsed?.justificativa_decisao) !== '' ||
    toCleanString(sectionParsed?.acao_prioritaria) !== '' ||
    sectionParsed.score_operacional != null ||
    toCleanString(sectionParsed?.justificativa_score) !== '' ||
    sectionParsed.ruas_identificadas.length > 0 ||
    sectionParsed.atendimento_prioritario.length > 0 ||
    sectionParsed.fatores.length > 0 ||
    sectionParsed.evidencias.length > 0 ||
    sectionParsed.inferencias.length > 0 ||
    sectionParsed.riscos.length > 0 ||
    sectionParsed.lacunas.length > 0 ||
    sectionParsed.recomendacao;

  if (hasSectionContent) {
    return normalizeStructuredAnswer(sectionParsed);
  }

  return normalizeStructuredAnswer(buildLooseStructuredAnswer(rawText));
}

function buildDeterministicConclusion(context) {
  const splitter = context?.splitter;
  if (!splitter?.found) {
    return 'O sistema não encontrou o splitter informado para montar a análise.';
  }

  const title = toCleanString(splitter?.title) || toCleanString(splitter?.code);
  const city = toCleanString(splitter?.city);
  const street = toCleanString(splitter?.street);
  const outPorts = Number(splitter?.outPorts ?? 0);
  const busyCount = Number(splitter?.busyCount ?? 0);
  const usagePercent = outPorts > 0 ? Math.round((busyCount / outPorts) * 100) : 0;
  const relief = context?.reliefEvaluation;
  const reliefTarget = describeReliefTargetForUser(context);

  const locationText = [street, city].filter(Boolean).join(' em ');
  const reliefText = relief?.hasReliefWithinRoute
    ? reliefTarget
      ? `Foi identificado alívio de rede em direção a ${reliefTarget}, o que abre alternativa operacional antes da expansão física.`
      : 'Foi identificado alívio de rede dentro da regra atual, o que abre uma alternativa técnica antes de pensar em expansão.'
    : 'Não foi identificado alívio de rede dentro da regra atual, então este caso merece mais atenção do planejamento.';

  return `${title}${locationText ? `, localizado em ${locationText},` : ''} está com ${usagePercent}% de ocupação (${busyCount} de ${outPorts} portas ocupadas). ${reliefText}`;
}

function buildDeterministicFactors(context) {
  const factors = [];
  const splitter = context?.splitter;
  const trend = context?.trendSummary;
  const relief = context?.reliefEvaluation;
  const stats = context?.massivaSummary?.stats;
  const history = Array.isArray(context?.recentMassivaHistory) ? context.recentMassivaHistory : [];
  const priority = context?.operationalPriority;

  if (splitter?.found) {
    const outPorts = Number(splitter?.outPorts ?? 0);
    const busyCount = Number(splitter?.busyCount ?? 0);
    factors.push(
      `O splitter possui ${outPorts} portas no total e ${busyCount} estão ocupadas neste momento.`,
    );
  }

  if (relief) {
    const maxRoute = Number(context?.reliefRule?.maxRouteMeters ?? 0);
    if (relief.hasReliefWithinRoute) {
      const who = describeReliefTargetForUser(context);
      if (who) {
        factors.push(
          `A análise encontrou possibilidade de alívio de rede em direção a ${who}, respeitando o limite atual de ${maxRoute} metros por rota (regra do sistema).`,
        );
      } else {
        factors.push(
          `A análise encontrou possibilidade de alívio de rede dentro do limite atual de ${maxRoute} metros por rota; o candidato não foi identificado automaticamente nesta resposta — use vizinhosAmostra e metricas_decisao_sistema no contexto.`,
        );
      }
    } else {
      factors.push(
        `A análise não encontrou outro splitter com capacidade livre dentro da regra atual de alívio de rede.`,
      );
    }
  }

  if (trend) {
    factors.push(
      `A tendência registrada está como "${toCleanString(trend?.label) || 'Sem histórico'}", com variação de ${Number(trend?.delta7d ?? 0)} pontos nos últimos 7 dias e ${Number(trend?.delta30d ?? 0)} pontos nos últimos 30 dias.`,
    );
  }

  if (stats) {
    factors.push(
      `O histórico local registra ${Number(stats?.totalTickets ?? 0)} massiva(s) ligada(s) a este splitter, sendo ${Number(stats?.openTickets ?? 0)} aberta(s) no momento.`,
    );
  }

  if (history.length > 0) {
    const latest = history[0];
    factors.push(
      `O evento mais recente associado a este splitter foi "${toCleanString(latest?.title) || 'Sem título'}", com status ${toCleanString(latest?.status) || 'desconhecido'}.`,
    );
  }

  if (priority?.label) {
    factors.push(
      `A prioridade operacional atual ficou em "${toCleanString(priority.label)}", com pontuação ${Number(priority?.score ?? 0)}.`,
    );
  }

  return factors;
}

function buildDeterministicLacunas(context) {
  const lacunas = [];
  const history = Array.isArray(context?.recentMassivaHistory) ? context.recentMassivaHistory : [];
  const snapshots = Array.isArray(context?.recentSnapshots) ? context.recentSnapshots : [];

  if (history.length === 0) {
    lacunas.push(
      'Não há eventos recentes de massiva registrados no contexto local deste splitter.',
    );
  }

  if (snapshots.length === 0) {
    lacunas.push(
      'Não há histórico de snapshots suficiente para confirmar a evolução recente da ocupação.',
    );
  }

  lacunas.push(
    'O contexto atual não trouxe um indicador direto de manutenção programada ou em andamento para este splitter.',
  );
  return lacunas;
}

function buildDeterministicRecommendation(context) {
  const splitter = context?.splitter;
  const relief = context?.reliefEvaluation;
  const busyCount = Number(splitter?.busyCount ?? 0);
  const outPorts = Number(splitter?.outPorts ?? 0);

  if (outPorts > 0 && busyCount >= outPorts && !relief?.hasReliefWithinRoute) {
    return '⚠️ Trate este caso como candidato à ação de planejamento, porque o splitter está lotado e não há alívio de rede disponível dentro da regra atual.';
  }

  if (outPorts > 0 && busyCount >= outPorts && relief?.hasReliefWithinRoute) {
    const who = describeReliefTargetForUser(context);
    if (who) {
      return `💡 Avalie primeiro o remanejamento para o alívio em direção a ${who} antes de considerar expansão física.`;
    }
    return '💡 Avalie primeiro o remanejamento para o alívio de rede encontrado antes de considerar expansão física.';
  }

  return '📌 Mantenha o acompanhamento deste splitter e valide a evolução da ocupação antes de abrir uma ação estrutural.';
}

function enrichStructuredAnswer(structured, context) {
  const weakConclusion =
    !toCleanString(structured?.conclusao) ||
    /[,;:]$/.test(toCleanString(structured?.conclusao)) ||
    toCleanString(structured?.conclusao).length < 80;
  const genericFactors = hasGenericFallbackFactors(structured?.fatores);
  const genericRecommendation = hasGenericFallbackRecommendation(structured?.recomendacao);
  const hasLacunas = Array.isArray(structured?.lacunas) && structured.lacunas.length > 0;

  return {
    conclusao: weakConclusion
      ? buildDeterministicConclusion(context)
      : structured.conclusao,
    gravidade: normalizeGravidade(structured?.gravidade),
    classificacao_geografica: normalizeClassificacaoGeografica(structured?.classificacao_geografica),
    confianca: toCleanString(structured?.confianca),
    capilaridade: normalizeCapilaridadeIsa(structured?.capilaridade),
    distancia_operacional: toCleanString(structured?.distancia_operacional),
    distancia_cruzamento: toCleanString(structured?.distancia_cruzamento),
    angulo_vias: toCleanString(structured?.angulo_vias),
    decisao_operacional: normalizeDecisaoOperacional(structured?.decisao_operacional),
    viabilidade_remanejo: normalizeCapilaridadeIsa(structured?.viabilidade_remanejo),
    viabilidade_expansao: normalizeCapilaridadeIsa(structured?.viabilidade_expansao),
    justificativa_decisao: toCleanString(structured?.justificativa_decisao),
    acao_prioritaria: toCleanString(structured?.acao_prioritaria),
    ruas_identificadas: Array.isArray(structured?.ruas_identificadas) ? structured.ruas_identificadas : [],
    atendimento_prioritario: Array.isArray(structured?.atendimento_prioritario)
      ? structured.atendimento_prioritario
      : [],
    score_operacional: normalizeScoreOperacional(structured?.score_operacional),
    justificativa_score: toCleanString(structured?.justificativa_score),
    ctos_vizinhas_analisadas: normalizeCtrosVizinhasAnalisadas(structured?.ctos_vizinhas_analisadas),
    fatores: genericFactors ? buildDeterministicFactors(context) : structured.fatores,
    evidencias: Array.isArray(structured?.evidencias) ? structured.evidencias : [],
    inferencias: Array.isArray(structured?.inferencias) ? structured.inferencias : [],
    riscos: Array.isArray(structured?.riscos) ? structured.riscos : [],
    lacunas: hasLacunas ? structured.lacunas : buildDeterministicLacunas(context),
    recomendacao: genericRecommendation
      ? buildDeterministicRecommendation(context)
      : structured.recomendacao,
  };
}

function formatIsoDate(value) {
  const raw = toCleanString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString().slice(0, 10);
}

function summarizeRecentSnapshots(snapshots) {
  const items = Array.isArray(snapshots) ? snapshots : [];
  if (items.length === 0) return [];
  return items.slice(0, 4).map((snapshot) => ({
    data: formatIsoDate(snapshot?.capturedAt || snapshot?.capturedDay),
    ocupacaoPercentual: Number(snapshot?.usagePercent ?? 0),
    portasOcupadas: Number(snapshot?.busyCount ?? 0),
    portasTotais: Number(snapshot?.outPorts ?? 0),
    massivasAbertas: Number(snapshot?.massivaOpenCount ?? 0),
  }));
}

function summarizeRecentHistory(history) {
  const items = Array.isArray(history) ? history : [];
  if (items.length === 0) return [];
  return items.slice(0, 5).map((entry) => ({
    protocolo: entry?.protocol ?? null,
    titulo: toCleanString(entry?.title),
    status: toCleanString(entry?.status),
    clientesAfetados: Number(entry?.affectedClients ?? 0),
    abertura: formatIsoDate(entry?.openedAt),
    encerramento: formatIsoDate(entry?.closedAt),
  }));
}

/**
 * Indicadores deterministicos para a ISA raciocinar sobre remanejamento vs expansao,
 * sem novo I/O (usa apenas neighborsSample + relief ja calculados no contexto).
 */
function buildOperationalDecisionContext(context) {
  const splitter = context?.splitter ?? null;
  const relief = context?.reliefEvaluation ?? null;
  const neighbors = Array.isArray(context?.neighborsSample) ? context.neighborsSample : [];

  if (!splitter?.found) {
    return {
      equipamentoReferenciaLotado: false,
      alivioPelasRegrasDoSistema: false,
      alivioPorCondominio: false,
      osrmOkParaAvaliarVizinhos: false,
      quantidadeVizinhosNaAmostra: 0,
      vizinhosComPortaLivreNaAmostra: 0,
      somaPortasLivresVizinhosNaAmostra: 0,
      melhorCandidatoRemanejamento: null,
      candidatosRemanejamentoOrdenados: [],
      nota: 'Splitter nao encontrado no contexto; demais campos nao aplicaveis.',
    };
  }

  const outPorts = Number(splitter.outPorts ?? 0);
  const busy = Number(splitter.busyCount ?? 0);
  const equipamentoReferenciaLotado = outPorts > 0 && busy >= outPorts;

  const candidatos = neighbors
    .filter((n) => !Boolean(n?.isCondominium))
    .map((n) => {
      const op = Number(n?.outPorts ?? 0);
      const bc = Number(n?.busyCount ?? 0);
      const livres = Math.max(0, op - bc);
      const rm =
        n?.routeMeters == null || !Number.isFinite(Number(n.routeMeters))
          ? null
          : Math.round(Number(n.routeMeters));
      const linha = Number(n?.straightMeters ?? 0);
      return {
        codigo: toCleanString(n?.code),
        titulo: toCleanString(n?.title),
        rua: toCleanString(n?.street),
        portasLivres: livres,
        portasTotais: op,
        portasOcupadas: bc,
        distanciaRotaMetros: rm,
        distanciaLinhaRetaMetros: Number.isFinite(linha) && linha > 0 ? Math.round(linha) : null,
        mesmaRua: Boolean(n?.sameStreet),
      };
    })
    .filter((n) => n.portasLivres > 0 && n.codigo !== '');

  candidatos.sort((a, b) => {
    if (a.mesmaRua !== b.mesmaRua) return a.mesmaRua ? -1 : 1;
    const ra = a.distanciaRotaMetros;
    const rb = b.distanciaRotaMetros;
    if (ra != null && rb != null && ra !== rb) return ra - rb;
    if (ra == null && rb != null) return 1;
    if (ra != null && rb == null) return -1;
    const la = a.distanciaLinhaRetaMetros ?? 1e9;
    const lb = b.distanciaLinhaRetaMetros ?? 1e9;
    return la - lb;
  });

  const ordenados = candidatos.slice(0, 5).map((row) => {
    const { distanciaLinhaRetaMetros, ...pub } = row;
    return {
      ...pub,
      ...(distanciaLinhaRetaMetros != null ? { distanciaLinhaRetaMetros } : {}),
    };
  });

  const somaLivres = candidatos.reduce((acc, n) => acc + n.portasLivres, 0);

  return {
    equipamentoReferenciaLotado: equipamentoReferenciaLotado,
    alivioPelasRegrasDoSistema: Boolean(relief?.hasReliefWithinRoute),
    alivioPorCondominio: Boolean(relief?.condominiumRelief),
    osrmOkParaAvaliarVizinhos: Boolean(relief?.routingOk),
    quantidadeVizinhosNaAmostra: neighbors.length,
    vizinhosComPortaLivreNaAmostra: candidatos.length,
    somaPortasLivresVizinhosNaAmostra: somaLivres,
    melhorCandidatoRemanejamento: ordenados[0] ?? null,
    candidatosRemanejamentoOrdenados: ordenados,
    nota:
      'Calculado no servidor a partir da amostra de vizinhos (ate 8) e das mesmas rotas OSRM usadas em alivio; nao inclui Homes Passed, largura de via nem clientes fora da amostra.',
  };
}

/**
 * Identificação legível do splitter que o servidor usou como alívio por rota (OSRM),
 * ou fallback pela amostra de vizinhos; string vazia se não aplicável.
 */
function describeReliefTargetForUser(context) {
  const relief = context?.reliefEvaluation ?? null;
  if (!relief?.hasReliefWithinRoute) return '';

  if (relief.condominiumRelief) {
    return 'outro equipamento no mesmo condomínio com porta livre (regra intra-condomínio)';
  }

  const code = toCleanString(relief.reliefNeighborCode);
  const title = toCleanString(relief.reliefNeighborTitle);
  const rm = relief.reliefNeighborRouteMeters;
  if (code || title) {
    const main = title && code ? `${title} (${code})` : title || code;
    const routePart =
      rm != null && Number.isFinite(Number(rm))
        ? ` — rota a pé estimada em cerca de ${Math.round(Number(rm))} m`
        : '';
    return `${main}${routePart}`;
  }

  const metrics = buildOperationalDecisionContext(context);
  const best = metrics?.melhorCandidatoRemanejamento;
  if (best?.codigo) {
    const label = toCleanString(best.titulo) ? `${toCleanString(best.titulo)} (${best.codigo})` : best.codigo;
    const rm2 = best.distanciaRotaMetros;
    const route2 =
      rm2 != null && Number.isFinite(Number(rm2)) ? ` — rota cerca de ${Math.round(Number(rm2))} m` : '';
    const sm = best.mesmaRua ? 'mesma rua no cadastro' : 'outra rua no cadastro';
    return `${label}${route2} (${sm}; referência: amostra de vizinhos da consulta, não a varredura completa de alívio).`;
  }

  return '';
}

function buildCompactPlanningContext(context) {
  const splitter = context?.splitter ?? null;
  const network = context?.networkContext ?? null;
  const trend = context?.trendSummary ?? null;
  const relief = context?.reliefEvaluation ?? null;
  const priority = context?.operationalPriority ?? null;
  const massivaStats = context?.massivaSummary?.stats ?? null;
  const rollup = context?.massivaSummary?.rollup ?? null;

  return {
    geradoEm: toCleanString(context?.generatedAt),
    splitter: splitter
      ? {
          encontrado: Boolean(splitter?.found),
          codigo: toCleanString(splitter?.code),
          titulo: toCleanString(splitter?.title),
          rua: toCleanString(splitter?.street),
          bairro: toCleanString(splitter?.neighborhood),
          cidade: toCleanString(splitter?.city),
          tipoLocal: toCleanString(splitter?.tipoLocal),
          condominio: toCleanString(splitter?.nomeCondominio),
          portasTotais: Number(splitter?.outPorts ?? 0),
          portasOcupadas: Number(splitter?.busyCount ?? 0),
          portasLivres: Math.max(
            0,
            Number(splitter?.outPorts ?? 0) - Number(splitter?.busyCount ?? 0),
          ),
          possuiCorporativo: Boolean(splitter?.hasCorporateClients),
          eCondominio: Boolean(splitter?.isCondominium),
        }
      : null,
    rede: network
      ? {
          splitterPrimario: toCleanString(network?.primarySplitterTitle),
          portaPrimario: Number(network?.primarySplitterPort ?? 0),
          pontoAcesso: toCleanString(network?.accessPointTitle),
          codigoPontoAcesso: toCleanString(network?.accessPointCode),
          concentrador: toCleanString(network?.concentratorTitle),
          slot: Number(network?.slot ?? 0),
          portaPon: Number(network?.ponPort ?? 0),
        }
      : null,
    alivio: relief
      ? {
          encontrouAlivio: Boolean(relief?.hasReliefWithinRoute),
          osrmDisponivel: Boolean(relief?.routingOk),
          vizinhosNoRaioReto: Number(relief?.straightNeighborsCount ?? 0),
          alivioPorCondominio: Boolean(relief?.condominiumRelief),
          vizinhoAlivioPrincipal:
            toCleanString(relief?.reliefNeighborCode) || toCleanString(relief?.reliefNeighborTitle)
              ? {
                  codigo: toCleanString(relief?.reliefNeighborCode),
                  titulo: toCleanString(relief?.reliefNeighborTitle),
                  rotaMetros:
                    relief?.reliefNeighborRouteMeters == null ||
                    !Number.isFinite(Number(relief.reliefNeighborRouteMeters))
                      ? null
                      : Math.round(Number(relief.reliefNeighborRouteMeters)),
                }
              : null,
          regra: {
            raioLinhaRetaMetros: Number(context?.reliefRule?.straightRadiusMeters ?? 0),
            limiteMesmoLogradouroMetros: Number(context?.reliefRule?.maxRouteMeters ?? 0),
            limiteRuaDiferenteMetros: Number(
              context?.reliefRule?.crossStreetMaxRouteMeters ?? 0,
            ),
          },
        }
      : null,
    tendencia: trend
      ? {
          rotulo: toCleanString(trend?.label),
          ocupacaoAtualPercentual: Number(trend?.currentUsagePercent ?? 0),
          variacao7Dias: Number(trend?.delta7d ?? 0),
          variacao30Dias: Number(trend?.delta30d ?? 0),
          ultimaCaptura: formatIsoDate(trend?.capturedAt),
        }
      : null,
    massivas: {
      estatisticas: massivaStats
        ? {
            totalHistorico: Number(massivaStats?.totalTickets ?? 0),
            abertasAgora: Number(massivaStats?.openTickets ?? 0),
            encerradas: Number(massivaStats?.closedTickets ?? 0),
            clientesAfetadosAcumulados: Number(massivaStats?.affectedClientsTotal ?? 0),
            ultimaAbertura: formatIsoDate(massivaStats?.latestOpenedAt),
          }
        : null,
      periodo: rollup
        ? {
            massivasDistintas: Number(rollup?.distinctMassivaCount ?? 0),
            abertasNoPeriodo: Number(rollup?.openMassivasCount ?? 0),
            encerradasNoPeriodo: Number(rollup?.closedMassivasCount ?? 0),
            somaClientesAfetados: Number(rollup?.affectedClientsDistinctSum ?? 0),
          }
        : null,
      eventosRecentes: summarizeRecentHistory(context?.recentMassivaHistory),
    },
    snapshotsRecentes: summarizeRecentSnapshots(context?.recentSnapshots),
    prioridadeOperacional: priority
      ? {
          faixa: toCleanString(priority?.label),
          pontuacao: Number(priority?.score ?? 0),
          razoes: Array.isArray(priority?.reasons)
            ? priority.reasons.map((item) => toCleanString(item)).filter(Boolean)
            : [],
        }
      : null,
    vizinhosAmostra: Array.isArray(context?.neighborsSample)
      ? context.neighborsSample.slice(0, 5).map((neighbor) => ({
          codigo: toCleanString(neighbor?.code),
          titulo: toCleanString(neighbor?.title),
          rua: toCleanString(neighbor?.street),
          portasTotais: Number(neighbor?.outPorts ?? 0),
          portasOcupadas: Number(neighbor?.busyCount ?? 0),
          distanciaRotaMetros: Number(neighbor?.routeMeters ?? 0),
          mesmaRua: Boolean(neighbor?.sameStreet),
        }))
      : [],
    metricas_decisao_sistema: buildOperationalDecisionContext(context),
  };
}

function buildUserPrompt({ question, context, responseMode = 'json' }) {
  const compactContext = buildCompactPlanningContext(context);
  const contextJson = JSON.stringify(compactContext, null, 2);
  const basePrompt = ISA_PLANNING_TEAM_INSTRUCTIONS.trim().split('\n');

  const formatPrompt =
    responseMode === 'text'
      ? [
          '',
          'Responda em texto simples, sem markdown e sem JSON, usando exatamente estes blocos nesta ordem:',
          'Conclusao:',
          'Gravidade: (uma linha: baixa, media, alta ou critica)',
          'ClassificacaoGeografica: (uma linha: um dos valores ESQUINA, ESQUINA_DIAGONAL, MEIO_DE_QUADRA, BIFURCACAO, ROTATORIA, CRUZAMENTO_COMPLEXO, PONTA_DE_RUA, VIA_PRINCIPAL, VIA_SECUNDARIA ou vazio)',
          'Confianca: (ex.: 0% a 100%)',
          'Capilaridade: (uma linha: baixa, media ou alta)',
          'DistanciaOperacional:',
          'DistanciaCruzamento:',
          'AnguloVias:',
          'DecisaoOperacional: (uma linha: EXPANSAO, REMANEJO, ALIVIO, NOVA_CTO, REBALANCEAMENTO ou SEM_VIABILIDADE)',
          'ViabilidadeRemanejo: (baixa, media ou alta)',
          'ViabilidadeExpansao: (baixa, media ou alta)',
          'JustificativaDecisao:',
          'AcaoPrioritaria:',
          'ScoreOperacional: (um número inteiro estimado, ou a palavra null se não for possível calcular)',
          'JustificativaScore:',
          'RuasIdentificadas:',
          'AtendimentoPrioritario:',
          'CtosVizinhasAnalisadas: (uma linha por CTO: código; distância; ocupação; livre; classificação geo; viabilidade)',
          'Fatores:',
          'Evidencias:',
          'Inferencias:',
          'Riscos:',
          'Lacunas:',
          'Recomendacao:',
          '',
          'Em cada bloco de lista, use linhas curtas com marcadores (- ou *).',
        ]
      : [
          '',
          'Ao preencher strings com base no contexto JSON abaixo, descreva os dados em português natural.',
          'Nas frases, não repita nomes de campos internos do contexto (ex.: busyCount, trendSummary, score, hasReliefWithinRoute) como rótulos técnicos.',
          '',
          'Você deve responder SOMENTE em JSON válido.',
          'Nunca utilize markdown.',
          'Nunca escreva texto fora do JSON.',
          '',
          'Use exatamente esta estrutura (chaves e tipos obrigatórios):',
          '{',
          '  "conclusao": "Resumo técnico curto e objetivo.",',
          '  "gravidade": "baixa | media | alta | critica",',
          '  "classificacao_geografica": "ESQUINA | ESQUINA_DIAGONAL | MEIO_DE_QUADRA | BIFURCACAO | ROTATORIA | CRUZAMENTO_COMPLEXO | PONTA_DE_RUA | VIA_PRINCIPAL | VIA_SECUNDARIA",',
          '  "confianca": "0% a 100%",',
          '  "capilaridade": "baixa | media | alta",',
          '  "distancia_operacional": "Distância operacional estimada.",',
          '  "distancia_cruzamento": "Distância estimada até o cruzamento.",',
          '  "angulo_vias": "Ângulo estimado entre vias.",',
          '  "decisao_operacional": "EXPANSAO | REMANEJO | ALIVIO | NOVA_CTO | REBALANCEAMENTO | SEM_VIABILIDADE",',
          '  "viabilidade_remanejo": "baixa | media | alta",',
          '  "viabilidade_expansao": "baixa | media | alta",',
          '  "justificativa_decisao": "Motivo técnico principal da decisão.",',
          '  "acao_prioritaria": "Ação operacional recomendada.",',
          '  "score_operacional": null,',
          '  "justificativa_score": "Resumo dos termos somados ou penalizados conforme a seção SCORE OPERACIONAL do prompt; use string vazia se não calculou.",',
          '  "ruas_identificadas": [',
          '    "Rua identificada"',
          '  ],',
          '  "atendimento_prioritario": [',
          '    "Rua prioritária"',
          '  ],',
          '  "ctos_vizinhas_analisadas": [',
          '    {',
          '      "cto": "Código operacional (ex.: SLE-C-...) ou título da CTO vizinha, sem ID numérico interno.",',
          '      "distancia_operacional": "Distância operacional estimada pela rota.",',
          '      "ocupacao": "Portas ocupadas (texto).",',
          '      "capacidade_livre": "Portas livres (texto).",',
          '      "classificacao_geografica": "ESQUINA | ESQUINA_DIAGONAL | MEIO_DE_QUADRA | BIFURCACAO | ROTATORIA | CRUZAMENTO_COMPLEXO | PONTA_DE_RUA | VIA_PRINCIPAL | VIA_SECUNDARIA | OUTROS",',
          '      "viabilidade": "alta | media | baixa"',
          '    }',
          '  ],',
          '  "fatores": [',
          '    "Fator relevante."',
          '  ],',
          '  "evidencias": [',
          '    "Fato confirmado."',
          '  ],',
          '  "inferencias": [',
          '    "Hipótese baseada nos indícios."',
          '  ],',
          '  "riscos": [',
          '    "Possível impacto operacional."',
          '  ],',
          '  "lacunas": [',
          '    "Informação ausente importante."',
          '  ],',
          '  "recomendacao": "Ação prática recomendada."',
          '}',
          '',
          'O campo conclusao deve ter no maximo ~750 caracteres, preferir um unico paragrafo curto, e terminar obrigatoriamente com ponto final interrogacao ou exclamacao; nao deixe parenteses abertos nem codigos cortados.',
          'Nao cite identificadores numericos internos do cadastro (ID do equipamento); use codigo operacional (ex.: SLE-C-...) e titulo quando identificar equipamentos.',
          '',
          'O objeto metricas_decisao_sistema no contexto JSON foi calculado pelo sistema (não confundir com o campo decisao_operacional da sua resposta). Use melhorCandidatoRemanejamento, somaPortasLivresVizinhosNaAmostra, vizinhosComPortaLivreNaAmostra e alivioPelasRegrasDoSistema como fatos nas evidencias quando forem relevantes.',
          'Nao contradiga alivioPelasRegrasDoSistema nem os numeros de metricas_decisao_sistema sem explicar em lacunas (ex.: dados fora da amostra, cadastro incompleto, regra de negocio adicional).',
          'Preencha ctos_vizinhas_analisadas com base em vizinhosAmostra e na pergunta; se a amostra for insuficiente, declare em lacunas e ainda assim preencha decisao_operacional quando houver indicios.',
          'Quando alivio.encontrouAlivio for true, cite obrigatoriamente nas evidencias (e na recomendacao quando fizer sentido) o codigo e o titulo do splitter de destino: use alivio.vizinhoAlivioPrincipal se existir; senao use metricas_decisao_sistema.melhorCandidatoRemanejamento; nunca deixe o alívio sem nome de equipamento quando o contexto trouxer um.',
          'decisao_operacional na resposta deve ser exatamente um dos valores listados (sem espacos extras).',
          'Preencha cada array com frases completas em português do Brasil; use arrays vazios [] apenas quando não houver conteúdo adequado.',
          'No campo fatores: use 5 a 9 itens curtos (cada um com no máximo ~240 caracteres), um argumento por item, cada frase terminada em ponto, interrogação ou exclamação. Evite um único item longo que misture vários argumentos.',
          'score_operacional deve ser um número inteiro (soma aproximada dos pesos e penalidades) ou null se os dados forem insuficientes.',
          'Use string vazia "" apenas quando um campo de texto não se aplicar; para classificacao_geografica e capilaridade use o valor mais adequado ou indique incerteza em lacunas.',
        ];

  return [
    ...basePrompt,
    ...formatPrompt,
    'Contexto estruturado do sistema:',
    contextJson,
    '',
    `Pergunta do analista: ${question}`,
  ].join('\n');
}

/** Heurística para JSON válido mas com strings cortadas no limite de tokens. */
function naturalSummaryLooksTruncated(value, minLen) {
  const t = toCleanString(value);
  if (t.length < minLen) return false;
  if (/\([^)]*$/.test(t)) return true;
  if (!/[.!?…]\s*$/.test(t) && t.length >= 160) return true;
  return stringFieldLooksTruncated(value, 100);
}

function stringFieldLooksTruncated(value, minLen) {
  const t = toCleanString(value);
  if (t.length < minLen) return false;
  if (
    /\s+(pois|porque|enquanto|portanto|porém|porem|contudo|todavia|assim|logo)\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (t.length >= 360 && !/[.!?…]["')\]]?\s*$/.test(t)) return true;
  return false;
}

function looksLikeTruncatedAnswer(structured, rawText, finishReason) {
  const conclusao = toCleanString(structured?.conclusao);
  const fatores = Array.isArray(structured?.fatores) ? structured.fatores : [];
  const recomendacao = toCleanString(structured?.recomendacao);
  const normalizedRaw = toCleanString(rawText);
  const fr = toCleanString(finishReason).toUpperCase();

  if (fr.includes('MAX') && fr.includes('TOKEN')) return true;

  const truncatedFactor = fatores.some(
    (f) => typeof f === 'string' && stringFieldLooksTruncated(f, 100),
  );
  if (truncatedFactor) return true;

  if (naturalSummaryLooksTruncated(structured?.conclusao, 120)) return true;
  if (naturalSummaryLooksTruncated(structured?.recomendacao, 100)) return true;

  const hasOddQuotes = (normalizedRaw.match(/"/g) || []).length % 2 === 1;
  const conclusionHasOpenQuoteOnly =
    conclusao.startsWith('"') && !conclusao.endsWith('"');
  const seemsAbrupt =
    conclusao.length > 0 &&
    !/[.!?"]$/.test(conclusao) &&
    recomendacao ===
      'Use a resposta como apoio inicial e complemente a análise com o contexto operacional disponível.' &&
    fatores.length === 1 &&
    fatores[0] === 'Não foram destacados fatores separados na resposta recebida.';

  return hasOddQuotes || conclusionHasOpenQuoteOnly || seemsAbrupt;
}

async function requestGeminiAnswer({ apiKey, model, question, context, responseMode = 'json' }) {
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt({ question, context, responseMode }) }],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      topP: 0.9,
      maxOutputTokens: 8192,
      ...(responseMode === 'json' ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    logger.error('planning_assistant_gemini_error', {
      status: response.status,
      model,
      responseMode,
      payload,
    });
    const errorMessage = payload?.error?.message || `Gemini HTTP ${response.status}`;
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    throw error;
  }

  const { rawText, finishReason } = flattenGeminiCandidate(payload);
  if (!rawText) {
    const error = new Error('Gemini respondeu sem texto utilizavel.');
    error.statusCode = 502;
    throw error;
  }

  return { rawText, finishReason };
}

export async function askPlanningAssistant({ question, context }) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) {
    const error = new Error('Assistente ISA nao configurado no servidor (GEMINI_API_KEY ausente).');
    error.statusCode = 503;
    throw error;
  }

  const startedAt = Date.now();

  try {
    const { rawText: rawJsonText, finishReason: finishJson } = await requestGeminiAnswer({
      apiKey,
      model,
      question,
      context,
      responseMode: 'json',
    });
    let structured = parseGeminiStructuredAnswer(rawJsonText);
    let responseMode = 'json';

    if (
      looksLikeTruncatedAnswer(structured, rawJsonText, finishJson) ||
      geminiFinishIndicatesOutputTruncated(finishJson)
    ) {
      logger.warn('planning_assistant_gemini_retry_text_mode', {
        model,
        finishReason: finishJson,
      });
      const { rawText: rawTextMode, finishReason: finishText } = await requestGeminiAnswer({
        apiKey,
        model,
        question,
        context,
        responseMode: 'text',
      });
      structured = parseGeminiStructuredAnswer(rawTextMode);
      responseMode = 'text';
      if (/MAX_TOKEN/i.test(toCleanString(finishText))) {
        logger.warn('planning_assistant_gemini_text_mode_still_max_tokens', { model });
      }
    }

    structured = enrichStructuredAnswer(structured, context);
    structured = repairStructuredPlanningAnswer(structured, context);

    logger.info('planning_assistant_gemini_ok', {
      model,
      responseMode,
      durationMs: Date.now() - startedAt,
    });

    return { structured, model };
  } catch (error) {
    logger.error('planning_assistant_gemini_parse_error', {
      model,
      error,
    });
    const wrapped = new Error('Gemini respondeu fora do formato esperado.');
    wrapped.statusCode = 502;
    throw wrapped;
  }
}
