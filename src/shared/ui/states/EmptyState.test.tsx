import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/shared/ui/states/EmptyState'

describe('EmptyState', () => {
  it('renderiza título e descrição opcional', () => {
    render(<EmptyState title="T" description="D" />)
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})
