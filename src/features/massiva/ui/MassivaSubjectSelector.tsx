import { CheckCircle2, Monitor, Network } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import {
  MASSIVA_SUBJECTS,
  MASSIVA_SUBJECT_GROUPS,
  type MassivaSubject,
  type MassivaSubjectId,
} from '@/features/massiva/model/massivaSubject'

type MassivaSubjectSelectorProps = {
  value: MassivaSubjectId | null
  onChange: (id: MassivaSubjectId) => void
}

function SubjectGroupIcon({ tipo }: { tipo: MassivaSubject['tipo'] }) {
  if (tipo === 'sistema') {
    return <Monitor size={14} className="shrink-0" aria-hidden />
  }
  return <Network size={14} className="shrink-0" aria-hidden />
}

export function MassivaSubjectSelector({ value, onChange }: MassivaSubjectSelectorProps) {
  const redeSubjects = MASSIVA_SUBJECTS.filter((s) => s.tipo === 'rede')
  const sistemaSubjects = MASSIVA_SUBJECTS.filter((s) => s.tipo === 'sistema')

  return (
    <div className="space-y-3">
      <SubjectGroup
        label={MASSIVA_SUBJECT_GROUPS.rede}
        icon={<Network size={11} className="opacity-60" aria-hidden />}
        subjects={redeSubjects}
        value={value}
        onChange={onChange}
      />
      <SubjectGroup
        label={MASSIVA_SUBJECT_GROUPS.sistema}
        icon={<Monitor size={11} className="opacity-60" aria-hidden />}
        subjects={sistemaSubjects}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

function SubjectGroup({
  label,
  icon,
  subjects,
  value,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  subjects: MassivaSubject[]
  value: MassivaSubjectId | null
  onChange: (id: MassivaSubjectId) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          {label}
        </span>
        <div className="h-px flex-1 bg-neutral-200/70 dark:bg-white/10" aria-hidden />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 min-[1700px]:grid-cols-5">
        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            selected={value === subject.id}
            onClick={() => onChange(subject.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SubjectCard({
  subject,
  selected,
  onClick,
}: {
  subject: MassivaSubject
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2',
        selected
          ? subject.tipo === 'rede'
            ? 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100 focus-visible:ring-sky-300/50'
            : 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 focus-visible:ring-violet-300/50'
          : 'border-neutral-200 bg-surface-container-lowest hover:border-neutral-300 hover:bg-surface-container-low text-on-surface dark:border-white/10 dark:hover:border-white/20 focus-visible:ring-neutral-300/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          selected
            ? subject.tipo === 'rede'
              ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-300'
              : 'bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-300'
            : 'bg-neutral-100 text-on-surface-variant dark:bg-white/10',
        )}
      >
        <SubjectGroupIcon tipo={subject.tipo} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug">{subject.label}</span>
        <span className="mt-0.5 block text-xs leading-snug opacity-70">{subject.description}</span>
      </span>

      {selected && (
        <CheckCircle2
          size={14}
          className={cn(
            'absolute right-2 top-2 shrink-0',
            subject.tipo === 'rede' ? 'text-sky-500' : 'text-violet-500',
          )}
          aria-hidden
        />
      )}
    </button>
  )
}
