import { Check, Lock, Minus, Pause, X, type LucideIcon } from 'lucide-react'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Cor da bolacha (círculo preenchido) por status real do contrato (v_status). */
export function contractStatusCircleClass(status: string): string {
  const key = status.trim().toLowerCase()
  if (key === 'normal' || key === 'ativo') return 'bg-emerald-500'
  if (key === 'suspenso') return 'bg-amber-500'
  if (key === 'bloqueado' || key === 'cancelado') return 'bg-rose-500'
  return 'bg-slate-400'
}

/** Glifo branco dentro do círculo — check p/ contrato ok (como antes), demais conforme o estado. */
export function contractStatusGlyph(status: string): LucideIcon {
  const key = status.trim().toLowerCase()
  if (key === 'normal' || key === 'ativo') return Check
  if (key === 'suspenso') return Pause
  if (key === 'bloqueado') return Lock
  if (key === 'cancelado') return X
  return Minus
}

/** Texto do status do contrato a exibir; `null` quando não há descrição confiável. */
export function contractStatusLabel(cliente: SplitterCliente): string | null {
  const desc = cliente.contract?.statusDescription?.trim()
  return desc && desc !== '' ? desc : null
}
