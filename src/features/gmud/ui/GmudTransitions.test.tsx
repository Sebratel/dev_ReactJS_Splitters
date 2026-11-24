import { lazy } from 'react'
import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { GmudBusy, GmudPageSkeleton, GmudRoute } from '@/features/gmud/ui/GmudTransitions'

describe('GmudBusy', () => {
  it('ocupado: mantém o conteúdo na tela, esmaecido, com aria-busy e aviso para leitor de tela', () => {
    const { container, rerender } = render(
      <GmudBusy busy>
        <p>Conteúdo anterior</p>
      </GmudBusy>,
    )
    const raiz = container.firstElementChild as HTMLElement
    expect(raiz).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Conteúdo anterior')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo anterior').parentElement).toHaveClass('opacity-60')
    expect(screen.getByRole('status')).toHaveTextContent('Atualizando…')

    rerender(
      <GmudBusy busy={false}>
        <p>Conteúdo novo</p>
      </GmudBusy>,
    )
    expect(raiz).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByText('Conteúdo novo').parentElement).toHaveClass('opacity-100')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('o fade de entrada é opcional e fica no bloco de fora', () => {
    const { container, rerender } = render(<GmudBusy busy={false}>x</GmudBusy>)
    expect(container.firstElementChild).not.toHaveClass('gmud-fade')
    rerender(
      <GmudBusy busy={false} enter>
        x
      </GmudBusy>,
    )
    expect(container.firstElementChild).toHaveClass('gmud-fade')
  })
})

describe('GmudRoute', () => {
  it('enquanto a tela carrega mostra o esqueleto; depois, a tela com a transição de página', async () => {
    let liberar: (m: { default: () => React.JSX.Element }) => void = () => {}
    const Tela = lazy(
      () =>
        new Promise<{ default: () => React.JSX.Element }>((resolve) => {
          liberar = resolve
        }),
    )
    render(
      <GmudRoute>
        <Tela />
      </GmudRoute>,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveClass('gmud-skeleton')

    await act(async () => {
      liberar({ default: () => <p>Tela de GMUD</p> })
    })
    expect(await screen.findByText('Tela de GMUD')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Tela de GMUD').parentElement).toHaveClass('gmud-page-enter')
  })

  it('animate={false} não envolve a tela (para a que já tem a própria entrada)', () => {
    render(
      <GmudRoute animate={false}>
        <p>Nova GMUD</p>
      </GmudRoute>,
    )
    expect(screen.getByText('Nova GMUD').parentElement).not.toHaveClass('gmud-page-enter')
  })

  it('esqueleto da página pública', () => {
    render(<GmudPageSkeleton variant="publica" />)
    expect(screen.getByRole('status')).toHaveClass('min-h-dvh')
  })
})
