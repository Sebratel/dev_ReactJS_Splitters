export function formatOperationalRelativeDate(date: Date | null): string {
  if (date === null) return 'Sem registro'

  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Há 1 dia'
  if (diffDays < 30) return `Há ${diffDays} dias`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return 'Há 1 mês'
  if (diffMonths < 12) return `Há ${diffMonths} meses`

  const diffYears = Math.floor(diffMonths / 12)
  if (diffYears === 1) return 'Há 1 ano'
  return `Há ${diffYears} anos`
}
