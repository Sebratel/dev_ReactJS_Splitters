import { ChevronDown } from 'lucide-react'
import {
  MASSIVA_AREA_OPTIONS,
  MASSIVA_CLASSIFICACAO_OPTIONS,
  MASSIVA_CNL_OPTIONS,
  MASSIVA_IMPACTO_OPTIONS,
  MASSIVA_TECNOLOGIA_OPTIONS,
  MASSIVA_TIPO_OPTIONS,
  type MassivaClassificationDraft,
} from '@/features/massiva/model/massivaClassificationOptions'

type MassivaClassificationFieldsProps = {
  value: MassivaClassificationDraft
  onChange: (next: MassivaClassificationDraft) => void
  /** Prefixo dos ids/labels (evita colisão quando dois modais coexistem, ex.: "close" | "maint"). */
  idPrefix: string
  disabled?: boolean
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  disabled?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full cursor-pointer appearance-none rounded-md border border-neutral-300 bg-surface-container-lowest py-1.5 pl-2.5 pr-7 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">— selecione —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-on-surface-variant/60" aria-hidden />
      </div>
    </div>
  )
}

/**
 * Grade dos 6 selects de classificação operacional — usada no modal de encerramento
 * e no modal de manutenção (edição pós-encerramento). Mesma fonte de opções.
 */
export function MassivaClassificationFields({
  value,
  onChange,
  idPrefix,
  disabled,
}: MassivaClassificationFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <SelectField
        id={`${idPrefix}-tipo`}
        label="Tipo"
        value={value.tipoIncidente}
        onChange={(v) => onChange({ ...value, tipoIncidente: v })}
        options={MASSIVA_TIPO_OPTIONS}
        disabled={disabled}
      />
      <SelectField
        id={`${idPrefix}-impacto`}
        label="Impacto"
        value={value.impacto}
        onChange={(v) => onChange({ ...value, impacto: v })}
        options={MASSIVA_IMPACTO_OPTIONS}
        disabled={disabled}
      />
      <SelectField
        id={`${idPrefix}-tecnologia`}
        label="Tecnologia"
        value={value.tecnologia}
        onChange={(v) => onChange({ ...value, tecnologia: v })}
        options={MASSIVA_TECNOLOGIA_OPTIONS}
        disabled={disabled}
      />
      <SelectField
        id={`${idPrefix}-cnl`}
        label="CNL"
        value={value.cnl}
        onChange={(v) => onChange({ ...value, cnl: v })}
        options={MASSIVA_CNL_OPTIONS}
        disabled={disabled}
      />
      <SelectField
        id={`${idPrefix}-area`}
        label="Área"
        value={value.area}
        onChange={(v) => onChange({ ...value, area: v })}
        options={MASSIVA_AREA_OPTIONS}
        disabled={disabled}
      />
      <div className="col-span-2 sm:col-span-3">
        <SelectField
          id={`${idPrefix}-classificacao`}
          label="Classificação"
          value={value.classificacao}
          onChange={(v) => onChange({ ...value, classificacao: v })}
          options={MASSIVA_CLASSIFICACAO_OPTIONS}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
