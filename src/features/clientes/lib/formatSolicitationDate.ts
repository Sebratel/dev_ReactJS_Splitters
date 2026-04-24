/**
 * Paridade com `_formatDate` em `cliente_detail_screen.dart` (dd/MM/yyyy HH:mm).
 */
export function formatSolicitationDateDisplay(date: Date | null): string {
  if (date === null || Number.isNaN(date.getTime())) return '—'
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${d}/${m}/${y} ${h}:${min}`
}
