import type { GmudConfigItem } from '@/features/gmud/api/gmudConfigLists'
import { GmudDropdownMultiSelect } from '@/features/gmud/ui/GmudDropdownMultiSelect'

type Props = {
  options: GmudConfigItem[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  /** Mostra skeleton de loading quando os dados ainda estão chegando. */
  loading?: boolean
  /** Nome acessível do campo. */
  label?: string
}

/** Seleção múltipla das listas configuráveis (áreas etc.), numa linha só com a lista abrindo sobre a tela. */
export function GmudMultiSelect({ options, value, onChange, placeholder, loading, label }: Props) {
  const toggle = (item: string) =>
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item])

  if (loading) {
    return <div className="mt-1 h-10 w-full animate-pulse rounded-lg bg-neutral-200/70 dark:bg-white/10" />
  }

  if (options.length === 0) {
    return (
      <p className="mt-1 text-xs italic text-on-surface-variant/60">
        {placeholder ?? 'Nenhuma opção disponível.'}
      </p>
    )
  }

  return (
    <GmudDropdownMultiSelect
      options={options.map((o) => ({ value: o.label, label: o.label }))}
      selected={value}
      onToggle={toggle}
      placeholder="Selecionar áreas…"
      ariaLabel={label ?? 'Selecionar'}
    />
  )
}
