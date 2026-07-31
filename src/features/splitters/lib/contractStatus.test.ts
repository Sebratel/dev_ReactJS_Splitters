import { describe, expect, it } from 'vitest'
import { Check, Lock, Minus, Pause, X } from 'lucide-react'
import {
  contractStatusCircleClass,
  contractStatusGlyph,
  contractStatusLabel,
} from './contractStatus'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function buildCliente(statusDescription: string | undefined): SplitterCliente {
  return {
    contract: statusDescription === undefined ? undefined : { statusDescription },
  } as SplitterCliente
}

describe('contractStatusCircleClass', () => {
  it('retorna verde para "normal"', () => {
    expect(contractStatusCircleClass('Normal')).toBe('bg-emerald-500')
  })

  it('retorna verde para "ativo"', () => {
    expect(contractStatusCircleClass('ATIVO')).toBe('bg-emerald-500')
  })

  it('retorna amber para "suspenso"', () => {
    expect(contractStatusCircleClass('Suspenso')).toBe('bg-amber-500')
  })

  it('retorna rose para "bloqueado"', () => {
    expect(contractStatusCircleClass('Bloqueado')).toBe('bg-rose-500')
  })

  it('retorna rose para "cancelado"', () => {
    expect(contractStatusCircleClass('Cancelado')).toBe('bg-rose-500')
  })

  it('retorna cinza para status desconhecido', () => {
    expect(contractStatusCircleClass('Outro Status Qualquer')).toBe('bg-slate-400')
  })
})

describe('contractStatusGlyph', () => {
  it('retorna Check para "normal"/"ativo"', () => {
    expect(contractStatusGlyph('normal')).toBe(Check)
    expect(contractStatusGlyph('ativo')).toBe(Check)
  })

  it('retorna Pause para "suspenso"', () => {
    expect(contractStatusGlyph('suspenso')).toBe(Pause)
  })

  it('retorna Lock para "bloqueado"', () => {
    expect(contractStatusGlyph('bloqueado')).toBe(Lock)
  })

  it('retorna X para "cancelado"', () => {
    expect(contractStatusGlyph('cancelado')).toBe(X)
  })

  it('retorna Minus para status desconhecido', () => {
    expect(contractStatusGlyph('estado inexistente')).toBe(Minus)
  })
})

describe('contractStatusLabel', () => {
  it('retorna a descricao do status quando presente', () => {
    expect(contractStatusLabel(buildCliente('Suspenso'))).toBe('Suspenso')
  })

  it('retorna null quando a descricao esta vazia', () => {
    expect(contractStatusLabel(buildCliente('   '))).toBeNull()
  })

  it('retorna null quando nao ha contrato', () => {
    expect(contractStatusLabel(buildCliente(undefined))).toBeNull()
  })
})
