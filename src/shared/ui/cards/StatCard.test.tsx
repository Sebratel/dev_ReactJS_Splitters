import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Activity } from 'lucide-react'
import { StatCard } from '@/shared/ui/cards/StatCard'

describe('StatCard', () => {
  it('renderiza label, valor e ícone', () => {
    render(
      <StatCard label="Ativos" value={42} icon={Activity} description="d" />,
    )
    expect(screen.getByText('Ativos')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('d')).toBeInTheDocument()
  })
})
