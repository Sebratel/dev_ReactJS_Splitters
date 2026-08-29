/**
 * Opções dos selects de classificação operacional do incidente.
 * Compartilhadas pelo modal de encerramento e pelo modal de manutenção
 * (edição pós-encerramento) — mesma fonte, sem duplicar listas.
 */

export type MassivaClassificationDraft = {
  tipoIncidente: string
  impacto: string
  area: string
  tecnologia: string
  classificacao: string
  cnl: string
}

export const MASSIVA_CLASSIFICATION_RESET: MassivaClassificationDraft = {
  tipoIncidente: '',
  impacto: '',
  area: '',
  tecnologia: '',
  classificacao: '',
  cnl: '',
}

export const MASSIVA_TIPO_OPTIONS = ['Externa', 'Interna', 'Parceira'] as const

export const MASSIVA_IMPACTO_OPTIONS = ['Indisponibilidade', 'Degradação'] as const

export const MASSIVA_TECNOLOGIA_OPTIONS = ['Fibra', 'Rádio', 'Ambos'] as const

export const MASSIVA_CNL_OPTIONS = [
  'SLE', 'CAN', 'SPS', 'NHO', 'TNF', 'EIO', 'NSR', 'PAE', 'BCR', 'CHN',
  'CBM', 'BREEQ', 'POA', 'SRT', 'NSRCA', 'GTI', 'BRE', 'Geral',
] as const

export const MASSIVA_AREA_OPTIONS = [
  'Acesso', 'Backbone', 'Infra', 'IP', 'Telefonia', 'TI / Servidores',
] as const

export const MASSIVA_CLASSIFICACAO_OPTIONS = [
  'Atenuação', 'Carga Alta', 'Capilar quebrado', 'Conector', 'CTO Indisponível',
  'DDoS', 'Equip. Hardware', 'Erro Humano', 'Erro de Abertura', 'Evento climático',
  'Falha de configuração', 'Falha em operadora', 'Fogo em poste', 'Formigas',
  'Infra-energia site', 'Link Loss / Led Loss', 'Migração', 'Migração de CTO',
  'OLT/SITE Indisponível', 'Poda de árvore', 'Queda de poste', 'Readequação',
  'Readequação CTO', 'Reiniciado ONU/Roteador', 'Rompimento',
  'Sinal Elevado CTO/Splitter/Cabo', 'Troca de Antena', 'Troca de Conector',
  'Troca de Equipamento', 'Troca de fonte/baterias', 'Troca de porta',
  'Troca de poste', 'Troca de splitter', 'Vandalismo', 'Outros',
] as const
