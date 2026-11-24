export type MassivaSubjectTipo = 'rede' | 'sistema'

export type MassivaSubjectId =
  | 'registro-massivas'
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
