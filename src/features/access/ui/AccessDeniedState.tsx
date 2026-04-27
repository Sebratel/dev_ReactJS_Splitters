import { ShieldX } from 'lucide-react'

type AccessDeniedStateProps = {
  title?: string
  description: string
}

export function AccessDeniedState({
  title = 'Acesso negado',
  description,
}: AccessDeniedStateProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200/70 bg-rose-50/70 p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
        <ShieldX size={24} aria-hidden />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-rose-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-rose-800">{description}</p>
    </div>
  )
}
