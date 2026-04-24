type EmptyStateProps = {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-3xl bg-surface-container-low px-8 py-12 text-center">
      <p className="text-lg font-bold tracking-tight text-on-surface">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-sm text-on-surface-variant/80">
          {description}
        </p>
      )}
    </div>
  )
}
