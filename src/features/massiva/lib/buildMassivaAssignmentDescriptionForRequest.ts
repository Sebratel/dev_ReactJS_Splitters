import { formatSplitterLabelsTwoColumns } from '@/features/massiva/lib/buildMassivaOpeningTechnicalDescription'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

type PlanRequest = MassivaOpenFinalContext['plan']['requests'][number]

function normalizeAp(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function clienteMatchesAp(cliente: SplitterCliente, apCode: string): boolean {
  const accessPoint = cliente.accessPoint
  if (accessPoint == null) return false
  const expected = normalizeAp(apCode)
  if (expected === '') return false

  const code = normalizeAp(accessPoint.code)
  const title = normalizeAp(accessPoint.title)
  return code === expected || title === expected
}

function buildTopologyLineForAp(
  context: MassivaOpenFinalContext,
  apCode: string,
): string {
  const target = apCode.trim()
  const routes = context.basis.topology.routes.filter(
    (route) => route.apCode.trim() === target,
  )
  if (routes.length === 0) return 'Nenhuma rota completa selecionada'

  return routes
    .map((route) => {
      const splitterCount = route.effectiveSplitterDisplay.length
      return `PA ${route.apCode} (${route.apDisplayTitle}) / slot ${route.slot} / porta ${route.port} / ${splitterCount} splitter(s)`
    })
    .join(' ; ')
}

function buildCtosLineForAp(
  context: MassivaOpenFinalContext,
  apCode: string,
): string {
  const target = apCode.trim()
  const routes = context.basis.topology.routes.filter(
    (route) => route.apCode.trim() === target,
  )
  const byCode = new Map<string, { code: string; label: string }>()
  for (const route of routes) {
    for (const entry of route.effectiveSplitterDisplay) {
      if (!byCode.has(entry.code)) byCode.set(entry.code, entry)
    }
  }
  const entries = [...byCode.values()]
  if (entries.length === 0) return 'aguardando definicao da topologia afetada'
  return formatSplitterLabelsTwoColumns(entries)
}

function replaceSection(
  source: string,
  pattern: RegExp,
  replacement: string,
): string {
  return source.replace(pattern, replacement)
}

/**
 * O template de `buildMassivaOpeningTechnicalDescription` usa \u00edcones por se\u00e7\u00e3o.
 * O replace antigo n\u00e3o casava (faltavam emojis), ent\u00e3o o texto n\u00e3o era
 * reescrito por AP e todo protocolo exibia a descri\u00e7\u00e3o completa.
 */
function replaceCtosBlockForAp(description: string, ctosLine: string): string {
  const withEmoji = replaceSection(
    description,
    /🧩 CTOs afetadas:\n[\s\S]*?\n\n🗺️ Topologia:/u,
    `🧩 CTOs afetadas:\n${ctosLine}\n\n🗺️ Topologia:`,
  )
  if (withEmoji !== description) return withEmoji
  return replaceSection(
    description,
    /CTOs afetadas:\n[\s\S]*?\n\nTopologia:/,
    `CTOs afetadas:\n${ctosLine}\n\nTopologia:`,
  )
}

function replaceTopologyBlockForAp(description: string, topologyLine: string): string {
  const withEmoji = replaceSection(
    description,
    /🗺️ Topologia:\n[\s\S]*?\n\n👥 Clientes afetados:/u,
    `🗺️ Topologia:\n${topologyLine}\n\n👥 Clientes afetados:`,
  )
  if (withEmoji !== description) return withEmoji
  return replaceSection(
    description,
    /Topologia:\n[\s\S]*?\n\nClientes afetados:/,
    `Topologia:\n${topologyLine}\n\nClientes afetados:`,
  )
}

function replaceAffectedClientsCount(description: string, affectedCount: number): string {
  const withEmoji = replaceSection(
    description,
    /👥 Clientes afetados:\s*[^\n]*/u,
    `👥 Clientes afetados: ${affectedCount}`,
  )
  if (withEmoji !== description) return withEmoji
  return replaceSection(
    description,
    /Clientes afetados:\s*[^\n]*/,
    `Clientes afetados: ${affectedCount}`,
  )
}

export function buildMassivaAssignmentDescriptionForRequest(
  context: MassivaOpenFinalContext,
  request: PlanRequest,
): string {
  if (!context.descriptionAutoSyncEnabled) {
    return context.assignmentDescription
  }

  const apCode = request.authenticationAccessPointCode
  const topologyLine = buildTopologyLineForAp(context, apCode)
  const ctosLine = buildCtosLineForAp(context, apCode)
  const affectedCount = context.basis.collectedClientes.filter((cliente) =>
    clienteMatchesAp(cliente, apCode),
  ).length

  let description = context.assignmentDescription
  description = replaceCtosBlockForAp(description, ctosLine)
  description = replaceTopologyBlockForAp(description, topologyLine)
  description = replaceAffectedClientsCount(description, affectedCount)
  return description
}

