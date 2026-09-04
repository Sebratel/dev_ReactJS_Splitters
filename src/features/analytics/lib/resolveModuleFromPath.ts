/** Chaves de módulo — espelham KNOWN_MODULES no server/usageAnalyticsStore.js. */
export type UsageModuleKey =
  | 'dashboard'
  | 'splitters'
  | 'splitter-detail'
  | 'cliente-detail'
  | 'massiva'
  | 'massiva-dashboard'
  | 'massiva-monitor'
  | 'intelligence'
  | 'redistribuicao'
  | 'sugestoes'
  | 'usuarios'
  | 'isa-config'
  | 'radar-uso'
  | 'outros'

/** Rótulos amigáveis (pt-BR) para exibição no radar — alinhados à Sidebar. */
export const USAGE_MODULE_LABEL: Record<UsageModuleKey, string> = {
  dashboard: 'Dashboard',
  splitters: 'Splitters',
  'splitter-detail': 'Detalhe do splitter',
  'cliente-detail': 'Detalhe do cliente',
  massiva: 'Massivas',
  'massiva-dashboard': 'Massivas · dashboard',
  'massiva-monitor': 'Painel de parede',
  intelligence: 'Painel da rede',
  redistribuicao: 'Redistribuição',
  sugestoes: 'Sugestões',
  usuarios: 'Usuários',
  'isa-config': 'Config. ISA',
  'radar-uso': 'Radar de uso',
  outros: 'Outros',
}

/** Deriva a chave de módulo a partir do pathname da rota (SPA). */
export function resolveModuleFromPath(pathname: string): UsageModuleKey {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  if (path === '/') return 'dashboard'
  if (path === '/splitters') return 'splitters'
  if (path.startsWith('/splitters/')) return 'splitter-detail'
  if (path.startsWith('/clientes/')) return 'cliente-detail'
  if (path === '/massiva') return 'massiva'
  if (path.startsWith('/massiva/dashboard')) return 'massiva-dashboard'
  if (path.startsWith('/massiva/monitor')) return 'massiva-monitor'
  if (path.startsWith('/massiva')) return 'massiva'
  if (path.startsWith('/intelligence')) return 'intelligence'
  if (path.startsWith('/redistribuicao')) return 'redistribuicao'
  if (path.startsWith('/sugestoes')) return 'sugestoes'
  if (path.startsWith('/usuarios')) return 'usuarios'
  if (path.startsWith('/isa-config')) return 'isa-config'
  if (path.startsWith('/radar-uso')) return 'radar-uso'
  return 'outros'
}
