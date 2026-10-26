export type MassivaSubjectTipo = 'rede' | 'sistema'

export type MassivaSubjectId =
  | 'registro-massivas'
  | 'manutencao-programada'
  | 'atualizacao-firmware'
  | 'troca-equipamento'
  | 'expansao-rede'
  | 'sistemas-internos'
  | 'sistemas-externos'

export type MassivaSubject = {
  id: MassivaSubjectId
  label: string
  description: string
  tipo: MassivaSubjectTipo
  group: string
}

export const MASSIVA_SUBJECT_GROUPS = {
  rede: 'Incidentes e manutenção de rede',
  sistema: 'Sistemas e softwares',
} as const

export const MASSIVA_SUBJECTS: MassivaSubject[] = [
  {
    id: 'registro-massivas',
    label: 'Registro Massivas',
    description: 'Fibra cortada, CTO, splitter, queda de rede',
    tipo: 'rede',
    group: MASSIVA_SUBJECT_GROUPS.rede,
  },
  {
    id: 'manutencao-programada',
    label: 'Manutenção Programada',
    description: 'Janela de manutenção agendada na infraestrutura',
    tipo: 'rede',
    group: MASSIVA_SUBJECT_GROUPS.rede,
  },
  {
    id: 'atualizacao-firmware',
    label: 'Atualização de Firmware',
    description: 'Upgrade de equipamentos na rede (OLT, ONU)',
    tipo: 'rede',
    group: MASSIVA_SUBJECT_GROUPS.rede,
  },
  {
    id: 'troca-equipamento',
    label: 'Troca de Equipamento',
    description: 'Substituição física de hardware em campo',
    tipo: 'rede',
    group: MASSIVA_SUBJECT_GROUPS.rede,
  },
  {
    id: 'expansao-rede',
    label: 'Expansão de Rede',
    description: 'Obras de expansão e novos pontos de rede',
    tipo: 'rede',
    group: MASSIVA_SUBJECT_GROUPS.rede,
  },
  {
    id: 'sistemas-internos',
    label: 'Sistemas Internos',
    description: 'Falha em sistema próprio da empresa',
    tipo: 'sistema',
    group: MASSIVA_SUBJECT_GROUPS.sistema,
  },
  {
    id: 'sistemas-externos',
    label: 'Sistemas de Terceiros',
    description: 'Falha em fornecedor externo ou parceiro',
    tipo: 'sistema',
    group: MASSIVA_SUBJECT_GROUPS.sistema,
  },
]

export const MASSIVA_SUBJECT_IDS = new Set<string>(MASSIVA_SUBJECTS.map((s) => s.id))

export function findMassivaSubject(id: string): MassivaSubject | undefined {
  return MASSIVA_SUBJECTS.find((s) => s.id === id)
}

export function isMassivaSubjectId(value: unknown): value is MassivaSubjectId {
  return typeof value === 'string' && MASSIVA_SUBJECT_IDS.has(value)
}
