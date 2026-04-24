import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '@/shared/ui/states/LoadingState'

vi.mock('@/shared/ui/LottieAnimation', () => ({
  LottieAnimation: () => <div data-testid="lottie-mock" />,
}))

vi.mock('@/shared/assets/animations/loading3.json', () => ({ default: {} }))

describe('LoadingState', () => {
  it('renderiza animação e label opcional', () => {
    render(<LoadingState label="Carregando" />)
    expect(screen.getByTestId('lottie-mock')).toBeInTheDocument()
    expect(screen.getByText('Carregando')).toBeInTheDocument()
  })
})
