import type { MassivaInfraProtocolCode } from '@/features/massiva/model/massivaInfraProtocol'

/** Uma CTO/AP da massiva com a topologia necessária para a máscara. */
export type InfraMaskRoute = {
  apCode: string
  /** Nome de exibição da OLT (ex.: "OLT 02 - CANMV"). */
  apDisplayTitle: string
  /** Nomenclatura do(s) splitter(s) da rota (ss.title). Usado como "Número da CTO". */
  splitterLabel: string
  /** Placa. */
  slot: number
  /** Porta PON. */
  port: number
  /** Clientes afetados nesta CTO. */
  affected: number
}

export type BuildInfraDescriptionInput = {
  type: MassivaInfraProtocolCode
  /** Protocolo da massiva referenciado no cabeçalho (o principal). */
  massivaProtocol: number | null
  routes: InfraMaskRoute[]
  totalAffected: number
  /** Sinal aferido (dBm) — tipo CTO Sinal Alto. */
  signalDbm?: string
  /** Tipo de avaria — tipo CTO Avariada. */
  avaria?: string
  /** Responsável pela identificação (nome do operador) — tipo Backbone. */
  responsavel?: string
  /** Início do evento já formatado — tipo Backbone. */
  eventStartDisplay?: string
  /** Identificação do evento já formatada — tipo Backbone. */
  eventIdentifiedDisplay?: string
}

const SEP_MAJOR = '═══════════════════════════════════════'
const SEP_MINOR = '───────────────────────────────────────'

function header(massivaProtocol: number | null): string {
  const ref = massivaProtocol != null && massivaProtocol > 0 ? `nº ${massivaProtocol}` : '(sem número)'
  return `🔧 INFRAESTRUTURA — Massiva ${ref}`
}

function ctoLine(route: InfraMaskRoute, extra?: string): string {
  const olt = route.apDisplayTitle.trim() !== '' ? route.apDisplayTitle.trim() : '—'
  const base = `📍 ${route.apCode} · 📡 ${olt} / Placa ${route.slot} / Porta ${route.port} · 👥 ${route.affected}`
  return extra != null && extra !== '' ? `${base} · ${extra}` : base
}

/**
 * Monta o descritivo (máscara) do protocolo de infraestrutura, agregando todas as CTOs/APs
 * da massiva num único texto. Formato "Opção B" (compacto, com emoji) definido com o time.
 */
export function buildInfraSolicitationDescription(input: BuildInfraDescriptionInput): string {
  const { type, routes, totalAffected } = input
  const lines: string[] = [header(input.massivaProtocol), SEP_MAJOR]

  if (type === 'backbone') {
    lines.push('📡 OLT / Placa(s) / PON(s) afetadas:')
    for (const route of routes) {
      const olt = route.apDisplayTitle.trim() !== '' ? route.apDisplayTitle.trim() : '—'
      lines.push(`   • ${olt} / Placa ${route.slot} / PON ${route.port}`)
    }
    lines.push(SEP_MINOR)
    lines.push(`👥 Clientes afetados: ${totalAffected}`)
    if (input.responsavel?.trim()) {
      lines.push(`🙋 Responsável pela identificação: ${input.responsavel.trim()}`)
    }
    if (input.eventStartDisplay?.trim()) {
      lines.push(`🕐 Início do evento: ${input.eventStartDisplay.trim()}`)
    }
    if (input.eventIdentifiedDisplay?.trim()) {
      lines.push(`🔎 Identificado às: ${input.eventIdentifiedDisplay.trim()}`)
    }
    return lines.join('\n')
  }

  // Tipos de CTO (cto_lo, cto_sinal_alto, cto_avariada)
  const signalExtra =
    type === 'cto_sinal_alto' && input.signalDbm?.trim()
      ? `📶 ${input.signalDbm.trim()} dBm`
      : undefined

  routes.forEach((route, index) => {
    if (index > 0) lines.push(SEP_MINOR) // divisória entre pontos de acesso
    lines.push(ctoLine(route, signalExtra))
    if (route.splitterLabel.trim()) {
      lines.push(`   🧷 Splitter: ${route.splitterLabel.trim()}`)
    }
    if (type === 'cto_avariada' && input.avaria?.trim()) {
      lines.push(`   🔨 Avaria: ${input.avaria.trim()}`)
    }
  })

  lines.push(SEP_MINOR)
  lines.push(`📊 Total: ${routes.length} CTO(s) · ${totalAffected} clientes afetados`)
  return lines.join('\n')
}
