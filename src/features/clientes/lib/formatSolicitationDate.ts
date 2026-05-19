import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'

/**
 * Paridade com `_formatDate` em `cliente_detail_screen.dart` (dd/MM/yyyy HH:mm).
 */
export function formatSolicitationDateDisplay(date: Date | null): string {
  return formatBrazilDateTimeShortDisplay(date)
}
