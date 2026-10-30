import { fallbackSqlOltSlotPort, resolveOltSlotPortFromSplitterRow } from '../splitterTitleOltDerivation.js';

/**
 * Afunilamento da GMUD de Rede Externa dentro do POP/Site (ponto de acesso → slot → PON → splitter).
 * Fica em `categoria_data.escopoRede`; sem ponto de acesso, vale para o site inteiro.
 * Espelha `src/features/gmud/model/gmudEscopoRede.ts`.
 */

const text = (value) => String(value ?? '').trim();

// Mesma normalização do filtro de splitters da massiva (caixa/acentos/pontuação).
function canonicalToken(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** @returns {{apCode:string, apTitle:string, slot:number|null, ports:number[], splitters:{code:string,title:string}[]} | null} */
export function normalizeEscopoRede(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const apCode = text(raw.apCode);
  if (apCode === '') return null;
  const slotN = Number.parseInt(String(raw.slot ?? ''), 10);
  const slot = raw.slot === null || raw.slot === undefined || !Number.isFinite(slotN) ? null : slotN;
  const ports =
    slot === null || !Array.isArray(raw.ports)
      ? []
      : [...new Set(raw.ports.map((p) => Number.parseInt(String(p), 10)).filter(Number.isFinite))].sort((a, b) => a - b);
  const seen = new Set();
  const splitters = (Array.isArray(raw.splitters) ? raw.splitters : [])
    .map((s) => ({ code: text(s?.code), title: text(s?.title) }))
    .filter((s) => s.code !== '' && !seen.has(s.code) && seen.add(s.code));
  return { apCode, apTitle: text(raw.apTitle) || apCode, slot, ports, splitters };
}

/** Ex.: "OLT-01 · Slot 2 · PON 4, 5 · Splitters: A, B". Vazio quando não há afunilamento. */
export function formatEscopoRede(raw) {
  const e = normalizeEscopoRede(raw);
  if (!e) return '';
  const parts = [e.apTitle];
  if (e.slot !== null) parts.push(`Slot ${e.slot}`);
  if (e.ports.length > 0) parts.push(`${e.ports.length > 1 ? 'PONs' : 'PON'} ${e.ports.join(', ')}`);
  if (e.splitters.length > 0) {
    parts.push(`${e.splitters.length > 1 ? 'Splitters' : 'Splitter'}: ${e.splitters.map((s) => s.title || s.code).join(', ')}`);
  }
  return parts.join(' · ');
}

/**
 * A linha de SPLITTERS_BASE_QUERY está dentro do afunilamento? Todos os níveis informados têm de bater
 * (AND); nível vazio não restringe. Slot/PON seguem a mesma regra da massiva (título do splitter,
 * com fallback nas colunas do SQL).
 */
export function rowMatchesEscopoRede(row, escopo) {
  const apCode = text(row['PONTO DE ACESSO CODE']) || text(row['PONTO DE ACESSO']);
  if (apCode !== escopo.apCode) return false;

  if (escopo.slot !== null) {
    const parsed = resolveOltSlotPortFromSplitterRow(row);
    const { slot, port } = parsed.slot != null && parsed.port != null ? parsed : fallbackSqlOltSlotPort(row);
    if (slot !== escopo.slot) return false;
    if (escopo.ports.length > 0 && !escopo.ports.includes(port)) return false;
  }

  if (escopo.splitters.length > 0) {
    const wanted = new Set(escopo.splitters.map((s) => canonicalToken(s.code)));
    const code = canonicalToken(row['CÓDIGO[SPLT.SECUNDARIO]']);
    const title = canonicalToken(row['SPLT.SECUNDARIO']);
    if (!(code !== '' && wanted.has(code)) && !(title !== '' && wanted.has(title))) return false;
  }
  return true;
}
