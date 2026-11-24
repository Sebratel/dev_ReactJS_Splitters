import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GmudRevisaoStatus } from '@/features/gmud/ui/GmudRevisaoStatus'

describe('GmudRevisaoStatus', () => {
  it('sem pendências: "Tudo preenchido", em uma região de status', () => {
    render(<GmudRevisaoStatus pendencias={0} />)
    const faixa = screen.getByRole('status')
    expect(faixa).toHaveAttribute('aria-live', 'polite')
    expect(faixa).toHaveAttribute('data-estado', 'ok')
    expect(faixa).toHaveTextContent('Tudo preenchido')
    expect(faixa).toHaveTextContent('Confira e abra a GMUD quando quiser.')
    expect(faixa).toHaveClass('bg-emerald-50')
  })

  it('com pendências: contagem no singular e no plural, com a orientação', () => {
    const { rerender } = render(<GmudRevisaoStatus pendencias={1} />)
    const faixa = screen.getByRole('status')
    expect(faixa).toHaveAttribute('data-estado', 'pendencia')
    expect(faixa).toHaveTextContent('1 pendência antes de abrir')
    expect(faixa).not.toHaveTextContent('pendências')
    expect(faixa).toHaveTextContent('Use Editar nas etapas marcadas para completar.')
    expect(faixa).toHaveClass('bg-amber-50')

    rerender(<GmudRevisaoStatus pendencias={3} />)
    expect(screen.getByRole('status')).toHaveTextContent('3 pendências antes de abrir')
    expect(screen.getByRole('status')).not.toHaveTextContent('Tudo preenchido')
  })

  it('o ícone é decorativo (aria-hidden) e muda com o estado', () => {
    const { container, rerender } = render(<GmudRevisaoStatus pendencias={0} />)
    const svgOk = container.querySelector('svg') as SVGElement
    expect(svgOk).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.gmud-rv-check')).not.toBeNull()
    expect(container.querySelectorAll('.gmud-rv-particle')).toHaveLength(6)
    expect(container.querySelector('.gmud-rv-wiggle')).toBeNull()

    rerender(<GmudRevisaoStatus pendencias={2} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.gmud-rv-wiggle')).not.toBeNull()
    expect(container.querySelector('.gmud-rv-check')).toBeNull()
    expect(container.querySelectorAll('.gmud-rv-particle')).toHaveLength(0)
  })

  it('não refaz o ícone em um re-render com a mesma contagem; refaz quando a contagem muda', () => {
    const { container, rerender } = render(<GmudRevisaoStatus pendencias={2} />)
    const antes = container.querySelector('svg')
    rerender(<GmudRevisaoStatus pendencias={2} />)
    expect(container.querySelector('svg')).toBe(antes)
    rerender(<GmudRevisaoStatus pendencias={1} />)
    expect(container.querySelector('svg')).not.toBe(antes)
  })
})
