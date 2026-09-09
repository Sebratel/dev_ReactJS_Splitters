import {
  USAGE_MODULE_LABEL,
  type UsageModuleKey,
} from '@/features/analytics/lib/resolveModuleFromPath'
import type { UsageSummary } from '@/features/analytics/model/usageSummary'

const SEP = ';'

function csvCell(value: string | number): string {
  const s = String(value ?? '')
  if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(SEP)
}

function moduleLabel(key: string): string {
  return USAGE_MODULE_LABEL[key as UsageModuleKey] ?? key
}

/** Gera o CSV do radar (usuário × módulo) a partir do sumário. Separador `;` (Excel pt-BR). */
export function buildUsageCsv(summary: UsageSummary): string {
  const lines: string[] = []
  lines.push(csvRow(['Usuário', 'E-mail', 'Módulo', 'Acessos']))
  const byUserSorted = [...summary.byUserModule].sort(
    (a, b) => a.email.localeCompare(b.email) || b.events - a.events,
  )
  for (const r of byUserSorted) {
    lines.push(csvRow([r.name || r.email, r.email, moduleLabel(r.module), r.events]))
  }
  return '﻿' + lines.join('\r\n')
}

/** Dispara o download do CSV no navegador (app real — Blob + âncora). */
export function downloadUsageCsv(summary: UsageSummary, options: { days: number; userEmail?: string | null }): void {
  const csv = buildUsageCsv(summary)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const who = options.userEmail && options.userEmail.trim() !== '' ? options.userEmail.split('@')[0] : 'todos'
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `radar-uso_${who}_${options.days}d_${date}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
