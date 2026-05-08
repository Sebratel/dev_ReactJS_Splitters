import { Buffer } from 'node:buffer';

import logger from './logger.js';

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

function flattenGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
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

function repairStructuredPlanningAnswer(structured) {
  const fatores = toStringList(structured?.fatores).map((item) => repairUtf8Mojibake(item));
  const lacunas = toStringList(structured?.lacunas).map((item) => repairUtf8Mojibake(item));

  return {
    conclusao: repairUtf8Mojibake(toCleanString(structured?.conclusao)),
    fatores,
    lacunas,
    recomendacao: repairUtf8Mojibake(toCleanString(structured?.recomendacao)),
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
  if (key === 'fatores' || key === 'lacunas') {
    target[key].push(cleaned);
    return;
  }
  target[key].push(cleaned);
}

function parseStructuredTextFallback(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const sections = {
    conclusao: [],
    fatores: [],
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
    if (/fatores?/.test(normalized)) {
      currentKey = 'fatores';
      const trailing = line.replace(/^.*?:\s*/, '');
      if (trailing !== line) pushSectionLine(sections, currentKey, trailing);
      continue;
    }
    if (/lacunas?|riscos?/.test(normalized)) {
      currentKey = 'lacunas';
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

  return {
    conclusao: sections.conclusao.join(' ').trim(),
    fatores: sections.fatores,
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
    fatores:
      fatores.length > 0
        ? fatores
        : ['O modelo respondeu de forma livre, sem detalhar fatores em blocos separados.'],
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
  const fatores = toStringList(parsed?.fatores);
  const lacunas = toStringList(parsed?.lacunas);
  const recomendacao = toCleanString(parsed?.recomendacao);

  return {
    conclusao:
      conclusao ||
      'A ISA respondeu, mas não trouxe uma conclusão objetiva no formato esperado.',
    fatores:
      fatores.length > 0
        ? fatores
        : ['Não foram destacados fatores separados na resposta recebida.'],
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
    sectionParsed.fatores.length > 0 ||
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

  const locationText = [street, city].filter(Boolean).join(' em ');
  const reliefText = relief?.hasReliefWithinRoute
    ? 'Foi identificado alívio de rede dentro da regra atual, o que abre uma alternativa técnica antes de pensar em expansão.'
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
    factors.push(
      relief.hasReliefWithinRoute
        ? `A análise encontrou possibilidade de alívio de rede dentro do limite atual de ${Number(context?.reliefRule?.maxRouteMeters ?? 0)} metros por rota.`
        : `A análise não encontrou outro splitter com capacidade livre dentro da regra atual de alívio de rede.`,
    );
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
    fatores: genericFactors ? buildDeterministicFactors(context) : structured.fatores,
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
          titulo: toCleanString(neighbor?.title),
          rua: toCleanString(neighbor?.street),
          portasTotais: Number(neighbor?.outPorts ?? 0),
          portasOcupadas: Number(neighbor?.busyCount ?? 0),
          distanciaRotaMetros: Number(neighbor?.routeMeters ?? 0),
          mesmaRua: Boolean(neighbor?.sameStreet),
        }))
      : [],
  };
}

function buildUserPrompt({ question, context, responseMode = 'json' }) {
  const compactContext = buildCompactPlanningContext(context);
  const contextJson = JSON.stringify(compactContext, null, 2);
  const basePrompt = [
    'Você é a ISA, assistente técnico do time de planejamento de redes da Sebratel.',
    'Seu papel é apoiar análise complexa de rede com base apenas no contexto fornecido pelo sistema.',
    'Fale em português do Brasil, com tom claro, amigável e profissional.',
    'Prefira linguagem que um usuário final consiga entender sem perder precisão técnica.',
    'Pode usar um toque leve de humor e no máximo 1 ou 2 emojis sutis quando isso melhorar a leitura, sem perder o tom profissional.',
    'Regras obrigatórias:',
    '- Não invente dados ausentes.',
    '- Não execute ações; apenas análise e recomende.',
    '- Se faltar informação, diga explicitamente.',
    '- Priorize objetividade técnica e linguagem operacional.',
    '- Diferencie fato do sistema de inferência sua.',
    '- Considere as regras atuais de alívio já aplicadas no contexto recebido.',
    '- Evite expor nomes de campos internos, nomes de variáveis, chaves JSON ou termos crus em inglês.',
    '- Quando um termo técnico for inevitável, explique em linguagem simples logo na mesma frase.',
    '- Troque expressões como busyCount, hasReliefWithinRoute, currentUsagePercent, trendSummary e score por descrições naturais em português.',
    '- Não responda como documentação técnica ou log de sistema; responda como assistente de análise para pessoas.',
    '- Sempre que a pergunta permitir, cubra explicitamente: ocupação do splitter, tendência recente, eventos ou massivas recentes, manutenção ou ausência dela, e alívio de rede.',
    '- Se algum desses pontos não existir no contexto, diga claramente que o sistema não trouxe esse dado.',
    '- Em "fatores", entregue frases completas e específicas; não deixe esse bloco vazio ou genérico.',
  ];

  const formatPrompt =
    responseMode === 'text'
      ? [
          '',
          'Responda em texto simples, sem markdown e sem JSON, usando exatamente estes blocos nesta ordem:',
          'Conclusao:',
          'Fatores:',
          'Lacunas:',
          'Recomendação:',
          '',
          'Em cada bloco, escreva frases completas e objetivas.',
        ]
      : [
          '',
          'Você deve responder SOMENTE em JSON válido, sem markdown e sem texto antes ou depois.',
          'Use exatamente este formato:',
          '{',
          '  "conclusao": "texto curto, claro e objetivo",',
          '  "fatores": ["frase clara em português", "frase clara em português"],',
          '  "lacunas": ["lacuna explicada em linguagem simples", "lacuna explicada em linguagem simples"],',
          '  "recomendacao": "ação prática recomendada em linguagem acessível"',
          '}',
          '',
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

function looksLikeTruncatedAnswer(structured, rawText) {
  const conclusao = toCleanString(structured?.conclusao);
  const fatores = Array.isArray(structured?.fatores) ? structured.fatores : [];
  const recomendacao = toCleanString(structured?.recomendacao);
  const normalizedRaw = toCleanString(rawText);

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
      maxOutputTokens: 1200,
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

  const rawText = flattenGeminiText(payload);
  if (!rawText) {
    const error = new Error('Gemini respondeu sem texto utilizavel.');
    error.statusCode = 502;
    throw error;
  }

  return rawText;
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
    const rawJsonText = await requestGeminiAnswer({
      apiKey,
      model,
      question,
      context,
      responseMode: 'json',
    });
    let structured = parseGeminiStructuredAnswer(rawJsonText);
    let responseMode = 'json';

    if (looksLikeTruncatedAnswer(structured, rawJsonText)) {
      logger.warn('planning_assistant_gemini_retry_text_mode', {
        model,
      });
      const rawTextMode = await requestGeminiAnswer({
        apiKey,
        model,
        question,
        context,
        responseMode: 'text',
      });
      structured = parseGeminiStructuredAnswer(rawTextMode);
      responseMode = 'text';
    }

    structured = enrichStructuredAnswer(structured, context);
    structured = repairStructuredPlanningAnswer(structured);

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
