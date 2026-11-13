/**
 * Clientes corporativos que não estão em splitter (ponto a ponto e fibra apagada), escolhidos à mão na GMUD de
 * Rede Externa. São identificados pelo contrato do Elleven (o gateway avisa pelo contrato); o PPPoE é opcional
 * (fibra apagada não tem conexão). Persistido em `categoria_data.clientesSemSplitter` (sem coluna nova).
 * Espelha `server/lib/gmudClientesSemSplitter.js`.
 */
export type GmudClienteSemSplitterTipo = 'ponto_a_ponto' | 'fibra_apagada'

export type GmudClienteSemSplitter = {
  contractId: number
  nome: string
  pppoe: string
  tipo: GmudClienteSemSplitterTipo
}

export const GMUD_CLIENTE_SEM_SPLITTER_TIPOS: { value: GmudClienteSemSplitterTipo; label: string }[] = [
  { value: 'ponto_a_ponto', label: 'Ponto a ponto' },
  { value: 'fibra_apagada', label: 'Fibra apagada' },
]

/** Limite de clientes escolhidos por GMUD (evita lista gigante no protocolo do Elleven). */
export const GMUD_CLIENTES_SEM_SPLITTER_MAX = 50

export function tipoClienteLabel(tipo: GmudClienteSemSplitterTipo): string {
  return tipo === 'fibra_apagada' ? 'fibra apagada' : 'ponto a ponto'
}

/** Lista limpa para gravar: contrato válido, sem repetir, no máximo `GMUD_CLIENTES_SEM_SPLITTER_MAX`. */
export function normalizeClientesSemSplitter(lista: readonly GmudClienteSemSplitter[] | null | undefined): GmudClienteSemSplitter[] {
  const seen = new Set<number>()
  const out: GmudClienteSemSplitter[] = []
  for (const c of lista ?? []) {
    const contractId = Number(c?.contractId)
    if (!Number.isFinite(contractId) || contractId <= 0 || seen.has(contractId)) continue
    seen.add(contractId)
    out.push({
      contractId,
      nome: (c.nome ?? '').trim().slice(0, 200),
      pppoe: (c.pppoe ?? '').trim().slice(0, 100),
      tipo: c.tipo === 'fibra_apagada' ? 'fibra_apagada' : 'ponto_a_ponto',
    })
    if (out.length >= GMUD_CLIENTES_SEM_SPLITTER_MAX) break
  }
  return out
}

/** "Nome (contrato 123, fibra apagada)". */
export function formatClienteSemSplitter(c: GmudClienteSemSplitter): string {
  return `${c.nome || 'Cliente'} (contrato ${c.contractId}, ${tipoClienteLabel(c.tipo)})`
}

/** Texto único para a máscara do Elleven: os clientes escolhidos e, depois, a observação (uma frase por linha). */
export function composeClientesTexto(lista: readonly GmudClienteSemSplitter[] | null | undefined, observacao: string | null | undefined): string {
  const linhas = [
    ...normalizeClientesSemSplitter(lista).map(formatClienteSemSplitter),
    ...(observacao ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== ''),
  ]
  return linhas.join('; ')
}
