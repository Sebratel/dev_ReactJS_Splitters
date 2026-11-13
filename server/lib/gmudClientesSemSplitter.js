/**
 * Clientes corporativos que não estão em splitter (ponto a ponto e fibra apagada) escolhidos à mão na GMUD.
 * Ficam em `categoria_data.clientesSemSplitter` (lista), identificados pelo contrato do Elleven: o gateway
 * avisa pelo contrato, então o PPPoE é opcional (fibra apagada não tem conexão).
 * Espelha `src/features/gmud/model/gmudClientesSemSplitter.ts`.
 */

export const CLIENTE_SEM_SPLITTER_TIPOS = ['ponto_a_ponto', 'fibra_apagada'];
export const CLIENTE_SEM_SPLITTER_LABEL = { ponto_a_ponto: 'ponto a ponto', fibra_apagada: 'fibra apagada' };

const text = (value) => String(value ?? '').trim();

/** @returns {{contractId:number, nome:string, pppoe:string, tipo:'ponto_a_ponto'|'fibra_apagada'}[]} */
export function normalizeClientesSemSplitter(categoriaData) {
  const lista = categoriaData && typeof categoriaData === 'object' ? categoriaData.clientesSemSplitter : null;
  if (!Array.isArray(lista)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of lista) {
    const contractId = Number.parseInt(String(raw?.contractId ?? ''), 10);
    if (!Number.isFinite(contractId) || contractId <= 0 || seen.has(contractId)) continue;
    seen.add(contractId);
    out.push({
      contractId,
      nome: text(raw?.nome).slice(0, 200),
      pppoe: text(raw?.pppoe).slice(0, 100),
      tipo: CLIENTE_SEM_SPLITTER_TIPOS.includes(raw?.tipo) ? raw.tipo : 'ponto_a_ponto',
    });
  }
  return out;
}

/** Uma linha por cliente: "Nome (contrato 123, fibra apagada)". */
export function formatClientesSemSplitter(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((c) => `${c.nome || 'Cliente'} (contrato ${c.contractId}, ${CLIENTE_SEM_SPLITTER_LABEL[c.tipo] ?? c.tipo})`)
    .join('\n');
}

/** Texto único para e-mail/aprovação: os clientes escolhidos e, depois, as observações digitadas. */
export function composeClientesTexto(categoriaData) {
  const estruturados = formatClientesSemSplitter(normalizeClientesSemSplitter(categoriaData));
  const livre = text(categoriaData?.clientesManuais);
  return [estruturados, livre].filter((t) => t !== '').join('\n').slice(0, 2000);
}
