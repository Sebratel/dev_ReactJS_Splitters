/**
 * Criticidade de cada tipo de GMUD, para destacar o cartão do tipo no formulário.
 * A cor nunca é a única pista: cada nível tem um rótulo em texto e um ícone próprio.
 */
export type GmudTipoCriticidade = {
  /** Rótulo curto do nível (aparece no selo). */
  label: string
  /** Qual ícone o cartão usa (o componente mapeia o nome para o ícone). */
  icon: 'calendar' | 'alert' | 'repeat'
  /** Classes de cor do quadrado do ícone e do selo (mesmos tons nos dois). */
  tone: string
}

export const GMUD_TIPO_CRITICIDADE: Record<string, GmudTipoCriticidade> = {
  Programada: {
    label: 'Planejada',
    icon: 'calendar',
    tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  },
  Emergencial: {
    label: 'Urgente',
    icon: 'alert',
    tone: 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200',
  },
  'Pré-aprovada': {
    label: 'Rotina',
    icon: 'repeat',
    tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
}
