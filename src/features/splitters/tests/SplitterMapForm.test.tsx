import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSplitterMapData } from '../hooks/useSplitterMapData'
import { SplitterMapForm } from '../ui/SplitterMapForm'

vi.mock('../hooks/useSplitterMapData', () => ({
  useSplitterMapData: vi.fn(),
}))

describe('SplitterMapForm', () => {
  const mockedUseSplitterMapData = vi.mocked(useSplitterMapData)
  const mockRefetch = vi.fn()
  const defaultHookState = {
    state: {
      type: 'success' as const,
      payload: {
        center: { lat: 0, lng: 0 },
        currentSplitterCode: 'SPL001',
        currentSplitterTitle: 'Splitter Teste',
        neighbors: [],
        oltPoint: null,
        clientPoints: [],
      },
    },
    refetch: mockRefetch,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseSplitterMapData.mockReturnValue(defaultHookState)
  })

  it('deve renderizar o formulario corretamente', () => {
    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    expect(screen.getByTestId('splitter-map.form')).toBeInTheDocument()
    expect(screen.getByTestId('splitter-map.input.name')).toBeInTheDocument()
    expect(screen.getByTestId('splitter-map.button.submit')).toBeInTheDocument()
    expect(screen.getByText('Nome do Mapa')).toBeInTheDocument()
    expect(screen.getByText('Criar Mapa')).toBeInTheDocument()
  })

  it('deve exibir mensagem de erro de validacao para campo obrigatorio', async () => {
    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    const submitButton = screen.getByTestId('splitter-map.button.submit')
    await userEvent.click(submitButton)

    const nameError = screen.getByTestId('splitter-map.input.name-error')
    expect(nameError).toBeInTheDocument()
    expect(nameError).toHaveTextContent(/O nome do mapa deve ter no m.nimo 3 caracteres\./i)
    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('deve exibir mensagem de erro de validacao para nome muito curto', async () => {
    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    const nameInput = screen.getByTestId('splitter-map.input.name')
    await userEvent.type(nameInput, 'ab')

    const submitButton = screen.getByTestId('splitter-map.button.submit')
    await userEvent.click(submitButton)

    const nameError = screen.getByTestId('splitter-map.input.name-error')
    expect(nameError).toBeInTheDocument()
    expect(nameError).toHaveTextContent(/O nome do mapa deve ter no m.nimo 3 caracteres\./i)
  })

  it('deve simular o preenchimento e envio do formulario com sucesso', async () => {
    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    const nameInput = screen.getByTestId('splitter-map.input.name')
    await userEvent.type(nameInput, 'Novo Mapa Teste')

    const submitButton = screen.getByTestId('splitter-map.button.submit')
    await userEvent.click(submitButton)

    await waitFor(
      () => {
        expect(screen.getByTestId('splitter-map.form.success-message')).toBeInTheDocument()
      },
      { timeout: 2500 },
    )

    expect(screen.getByText('Mapa "Novo Mapa Teste" criado com sucesso!')).toBeInTheDocument()
    expect(submitButton).not.toBeDisabled()
    expect(submitButton).toHaveTextContent('Criar Mapa')
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('deve exibir feedback visual de erro global do hook useSplitterMapData', async () => {
    mockedUseSplitterMapData.mockReturnValue({
      state: { type: 'error', error: new Error('Erro ao carregar dados do mapa') },
      refetch: mockRefetch,
    })

    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    const errorMessageContainer = await screen.findByTestId('splitter-map.form.error-message')
    expect(errorMessageContainer).toBeInTheDocument()
    expect(errorMessageContainer).toHaveTextContent(/Erro: Error: Erro ao carregar dados do mapa/i)
  })

  it('nao deve exibir mensagem de sucesso apos erro de validacao', async () => {
    render(
      <SplitterMapForm
        initialSplitterCode="CODE123"
        initialSplitterTitle="Title ABC"
        initialLatitude="10.0"
        initialLongitude="20.0"
      />,
    )

    const nameInput = screen.getByTestId('splitter-map.input.name')
    await userEvent.type(nameInput, 'ab')

    const submitButton = screen.getByTestId('splitter-map.button.submit')
    await userEvent.click(submitButton)

    const nameError = screen.getByTestId('splitter-map.input.name-error')
    expect(nameError).toBeInTheDocument()
    expect(nameError).toHaveTextContent(/O nome do mapa deve ter no m.nimo 3 caracteres\./i)
    expect(screen.queryByTestId('splitter-map.form.success-message')).not.toBeInTheDocument()
  })
})
