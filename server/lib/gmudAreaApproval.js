import crypto from 'node:crypto';

/**
 * Regras puras da aprovação por área (sem banco, sem rede) — testáveis isoladamente.
 *
 * Fluxo: ao abrir a GMUD, cada área envolvida recebe um pedido de aprovação; basta UMA pessoa
 * da área decidir. Todas as áreas aprovando, a GMUD segue para o Comitê; uma área negando,
 * a GMUD fica negada.
 */

export const AREA_STATUS = Object.freeze({
  PENDENTE: 'pendente',
  APROVADA: 'aprovada',
  NEGADA: 'negada',
  NAO_APLICAVEL: 'nao_aplicavel',
});

const asList = (value) => (Array.isArray(value) ? value : []);
const cleanLabels = (list) => [
  ...new Set(list.map((a) => String(a ?? '').trim()).filter((a) => a !== '')),
];

/**
 * Áreas que precisam aprovar a GMUD.
 * - Emergencial: nenhuma (vai direto ao Comitê).
 * - Sistemas internos: "Áreas impactadas". Sistemas externos: "Áreas afetadas".
 * - Rede externa: áreas da matriz "Recursos administrativos" com papel Executor ou Validador.
 */
export function deriveApprovalAreas({ tipo, categoria, categoriaData, recursosAdministrativos } = {}) {
  if (String(tipo ?? '').trim() === 'Emergencial') return [];
  const data = categoriaData && typeof categoriaData === 'object' ? categoriaData : {};
  if (categoria === 'sistemas_internos') return cleanLabels(asList(data.areasImpactadas));
  if (categoria === 'sistemas_externos') return cleanLabels(asList(data.areasAfetadas));
  if (recursosAdministrativos && typeof recursosAdministrativos === 'object') {
    return cleanLabels(
      Object.entries(recursosAdministrativos)
        .filter(([, papel]) => papel === 'executor' || papel === 'validador')
        .map(([area]) => area),
    );
  }
  return [];
}

/** Situação geral das áreas de uma GMUD a partir do status de cada uma. */
export function computeAreasStatus(statuses) {
  const list = asList(statuses);
  if (list.length === 0) return AREA_STATUS.NAO_APLICAVEL;
  if (list.includes(AREA_STATUS.NEGADA)) return AREA_STATUS.NEGADA;
  if (list.every((s) => s === AREA_STATUS.APROVADA)) return AREA_STATUS.APROVADA;
  return AREA_STATUS.PENDENTE;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Código de uso no link: 256 bits aleatórios. Só o hash é guardado no banco. */
export function generateApprovalToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashApprovalToken(token) };
}

export function isValidApprovalTokenShape(token) {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export function hashApprovalToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Link enviado por e-mail. O código vai no fragmento (#), que o navegador não envia ao servidor,
 * então não aparece em logs de acesso do nginx nem do BFF.
 */
export function buildApprovalUrl(baseUrl, token) {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '') || 'http://localhost:5173';
  return `${base}/gmud/aprovar-area#t=${token}`;
}

/** Limitador simples em memória (por chave, janela deslizante) para os endpoints públicos. */
export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map();
  return function allow(key) {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
      }
    }
    return true;
  };
}
