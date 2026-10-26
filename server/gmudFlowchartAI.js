/**
 * gmudFlowchartAI.js
 *
 * Geração de fluxogramas técnicos para GMUDs via Gemini.
 * Reutiliza callGeminiRaw de planningAssistant.js — não duplica a integração.
 *
 * Saída: string Mermaid (flowchart TD).
 */

import { callGeminiRaw, isPlanningAssistantConfigured } from './planningAssistant.js';
import logger from './logger.js';

export { isPlanningAssistantConfigured };

const MAX_DESCRIPTION_CHARS = 8000;

function sanitizeInput(text) {
  return String(text ?? '').trim().slice(0, MAX_DESCRIPTION_CHARS);
}

/**
 * Extrai o bloco Mermaid do texto retornado pelo Gemini.
 * Aceita: ```mermaid ... ```, ``` ... ```, ou texto puro começando com "flowchart" / "graph".
 */
function extractMermaid(text) {
  if (typeof text !== 'string') return null;

  // Fenced code block com ou sem rótulo "mermaid"
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    if (/^(flowchart|graph)\s/i.test(inner)) return inner;
  }

  // Texto puro que começa com diretiva Mermaid
  const trimmed = text.trim();
  if (/^(flowchart|graph)\s/i.test(trimmed)) return trimmed;

  return null;
}

/**
 * Valida que a string Mermaid tem estrutura mínima utilizável.
 */
function validateMermaid(source) {
  if (!source || source.length < 20) return false;
  return /^(flowchart|graph)\s+(TD|LR|RL|BT|TB)/i.test(source);
}

function buildFlowchartPrompt(description, gmudContext) {
  const ctx = gmudContext ? `\n\nContexto adicional da GMUD:\n${gmudContext}` : '';
  return `Você é um engenheiro técnico de redes e TI especializado em procedimentos de mudança (GMUD/Change Management).

TAREFA:
Gere um fluxograma Mermaid do procedimento técnico descrito abaixo.

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com o código Mermaid, sem explicações, sem texto extra, sem delimitadores markdown.
2. Use "flowchart TD" como diretiva inicial.
3. Identifique claramente: início, etapas de execução, pontos de decisão (Sim/Não), caminhos de falha, etapa de rollback (se mencionada), e fim.
4. Use IDs curtos: A, B, C... ou A1, A2... para os nós.
5. Use shapes corretos:
   - Início/Fim: ([Texto]) — stadium shape
   - Etapa de execução: [Texto] — retângulo
   - Decisão: {Texto?} — losango
   - Validação/Check: [[Texto]] — subroutine shape
6. Se o rollback não estiver descrito, NÃO invente um — adicione apenas um nó indicando "Acionar equipe responsável".
7. Quando faltarem informações para detalhar uma etapa, use nós genéricos como [Validar resultado] em vez de inventar procedimentos.
8. Limite a 30 nós no máximo.
9. NUNCA inclua informações de segurança, credenciais ou dados sensíveis nos nós.

DESCRIÇÃO DO PROCEDIMENTO:
${description}${ctx}

Responda somente com o código Mermaid:`;
}

function buildAssistantPrompt(type, description, gmudContext) {
  const ctx = gmudContext ? `\n\nContexto da GMUD:\n${gmudContext}` : '';
  const prompts = {
    checklist: `Gere um checklist técnico de execução para o procedimento abaixo. Responda em JSON: { "checklist": [{ "item": string, "categoria": "pre"|"execucao"|"pos"|"rollback" }] }. Máximo 20 itens. Somente JSON.`,
    risks: `Identifique os riscos potenciais do procedimento abaixo. Responda em JSON: { "risks": [{ "risco": string, "probabilidade": "alta"|"media"|"baixa", "impacto": "alto"|"medio"|"baixo", "mitigacao": string }] }. Máximo 10 riscos. Somente JSON.`,
    summary: `Gere um resumo técnico conciso (máximo 250 palavras) para apresentação ao Comitê de Mudanças. Responda em JSON: { "resumo": string, "principais_riscos": string[], "validacoes": string[] }. Somente JSON.`,
  };
  const instruction = prompts[type] ?? prompts.summary;
  return `Você é um especialista em gerenciamento de mudanças técnicas.\n\n${instruction}\n\nDescrição do procedimento:\n${description}${ctx}`;
}

/**
 * Gera um fluxograma Mermaid para o procedimento técnico descrito.
 * @param {string} description - Descrição do procedimento técnico
 * @param {string|null} gmudContext - Contexto adicional da GMUD (tipo, assunto, ambiente)
 * @returns {Promise<{ mermaidSource: string; model: string; warnings: string[] }>}
 */
export async function generateGmudFlowchart(description, gmudContext = null) {
  const cleanDesc = sanitizeInput(description);
  if (cleanDesc.length < 20) {
    const error = new Error('Descrição muito curta para gerar fluxograma (mínimo 20 caracteres).');
    error.statusCode = 400;
    throw error;
  }

  const prompt = buildFlowchartPrompt(cleanDesc, gmudContext ? sanitizeInput(gmudContext) : null);
  const warnings = [];

  const { text, model } = await callGeminiRaw(prompt, { responseMode: 'text', tag: 'gmud_flowchart_gen' });

  let mermaidSource = extractMermaid(text);

  if (!mermaidSource) {
    logger.warn('gmud_flowchart_extract_failed', { textLength: text.length });
    // Tentativa de recuperação: retorna o texto como está se parecer Mermaid
    if (/flowchart|graph/i.test(text)) {
      mermaidSource = text.trim();
      warnings.push('O Gemini retornou texto sem delimitadores — extraído diretamente.');
    } else {
      const error = new Error('O Gemini não retornou um fluxograma Mermaid válido. Tente refinar a descrição.');
      error.statusCode = 502;
      throw error;
    }
  }

  if (!validateMermaid(mermaidSource)) {
    warnings.push('Fluxograma gerado pode conter erros de sintaxe Mermaid — revise antes de salvar.');
  }

  // Limita tamanho
  if (mermaidSource.length > 20000) {
    mermaidSource = mermaidSource.slice(0, 20000);
    warnings.push('Fluxograma truncado para o limite de 20.000 caracteres.');
  }

  logger.info('gmud_flowchart_generated', { model, sourceLength: mermaidSource.length, warnings: warnings.length });

  return { mermaidSource, model, warnings };
}

/**
 * Funções de assistência técnica (Phase 4): checklist, riscos, resumo.
 * @param {'checklist'|'risks'|'summary'} type
 * @param {string} description
 * @param {string|null} gmudContext
 * @returns {Promise<{ result: object; model: string }>}
 */
export async function assistGmudFlowchart(type, description, gmudContext = null) {
  const VALID_TYPES = new Set(['checklist', 'risks', 'summary']);
  if (!VALID_TYPES.has(type)) {
    const error = new Error(`Tipo de assistência inválido: ${type}`);
    error.statusCode = 400;
    throw error;
  }

  const cleanDesc = sanitizeInput(description);
  if (cleanDesc.length < 10) {
    const error = new Error('Descrição insuficiente para assistência técnica.');
    error.statusCode = 400;
    throw error;
  }

  const prompt = buildAssistantPrompt(type, cleanDesc, gmudContext ? sanitizeInput(gmudContext) : null);
  const { text, model } = await callGeminiRaw(prompt, { responseMode: 'json', tag: `gmud_assist_${type}` });

  // Parse JSON da resposta
  let result;
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      result = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } else {
      result = JSON.parse(text);
    }
  } catch {
    logger.warn(`gmud_assist_${type}_parse_failed`, { textLength: text.length });
    const error = new Error('Resposta do Gemini não pôde ser interpretada. Tente novamente.');
    error.statusCode = 502;
    throw error;
  }

  logger.info(`gmud_assist_${type}_ok`, { model });
  return { result, model };
}
