import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorState } from '@/shared/ui/states/ErrorState'

describe('ErrorState', () => {
  it('título padrão, mensagem e retry', async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="M" onRetry={onRetry} />)
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
