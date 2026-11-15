import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GmudAttachment } from '@/features/gmud/api/gmudAttachments'
import type { GmudFlowchart } from '@/features/gmud/api/gmudFlowchart'
import { podeApresentar, resumoDaCapa, slidesDaApresentacao, tamanhoLegivel, tipoDoAnexo, zoomParaCaber } from '@/features/gmud/lib/gmudApresentacao'

const renderMermaid = vi.fn<(source: string, container: HTMLElement) => Promise<void>>()
const fetchGmudAttachments = vi.fn<(protocol: number) => Promise<GmudAttachment[]>>()
const fetchWithSessionAuth = vi.fn<(url: string) => Promise<Response>>()

vi.mock('@/features/gmud/lib/gmudMermaid', () => ({
  renderMermaid: (source: string, container: HTMLElement) => renderMermaid(source, container),
}))
vi.mock('@/features/gmud/api/gmudAttachments', () => ({
  fetchGmudAttachments: (protocol: number) => fetchGmudAttachments(protocol),
  gmudAttachmentFileUrl: (id: number) => `/arquivo/${id}`,
}))
vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (url: string) => fetchWithSessionAuth(url),
}))

const { GmudPresentationModal } = await import('@/features/gmud/ui/GmudPresentation')

const FLUXO = { mermaidSource: 'flowchart TD\n  A --> B', origin: 'manual' } as unknown as GmudFlowchart
const anexo = (id: number, filenameOriginal: string, mimetype: string, over: Partial<GmudAttachment> = {}): GmudAttachment => ({
  id,
  voalleProtocol: 1871928,
  filenameOriginal,
  filenameStored: `${id}.bin`,
  mimetype,
  sizeBytes: 345_000,
  description: null,
  uploadedBy: 'Ana Souza',
  createdAt: '2026-11-10T13:30:00.000Z',
  ...over,
})
const FOTO = anexo(1, 'topologia.png', 'image/png')
const PDF = anexo(2, 'plano-de-rollback.pdf', 'application/pdf')
const PLANILHA = anexo(3, 'inventario.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { uploadedBy: null })

/** Faz o Mermaid "desenhar" um SVG simples no contêiner. */
const desenhar = async (_source: string, container: HTMLElement) => {
  container.innerHTML = '<svg viewBox="0 0 400 200"><text>A</text></svg>'
}

function abrir({ flowchart = FLUXO as GmudFlowchart | null, anexos = [] as GmudAttachment[], titulo = 'Segredos no HashiCorp Vault' } = {}) {
  fetchGmudAttachments.mockResolvedValue(anexos)
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={qc}>
      <button type="button">Apresentar</button>
      <GmudPresentationModal protocol={1871928} flowchart={flowchart} gmudTitle={titulo} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { onClose, ...view }
}
const dialogo = () => screen.getByRole('dialog')
const indice = () => within(screen.getByRole('navigation', { name: 'Slides' }))
const posicao = () => screen.getByText(/^Slide \d+ de \d+/).textContent

beforeEach(() => {
  renderMermaid.mockReset().mockImplementation(desenhar)
  fetchGmudAttachments.mockReset()
  fetchWithSessionAuth.mockReset().mockImplementation(async () => new Response(new Blob(['x']), { status: 200 }))
  URL.createObjectURL = vi.fn(() => 'blob:teste')
  URL.revokeObjectURL = vi.fn()
  document.documentElement.classList.remove('dark')
})

describe('funções da apresentação', () => {
  it('slides: capa sempre; fluxograma e anexos só se existirem', () => {
    expect(slidesDaApresentacao('flowchart TD', [FOTO, PDF]).map((s) => s.kind)).toEqual(['cover', 'flowchart', 'attachment', 'attachment'])
    expect(slidesDaApresentacao('   ', [FOTO]).map((s) => s.kind)).toEqual(['cover', 'attachment'])
    expect(slidesDaApresentacao(null, []).map((s) => s.kind)).toEqual(['cover'])
  })
  it('linha da capa: singular, plural e sem citar o que não existe', () => {
    expect(resumoDaCapa(true, 2)).toBe('Fluxograma e 2 anexos')
    expect(resumoDaCapa(true, 1)).toBe('Fluxograma e 1 anexo')
    expect(resumoDaCapa(true, 0)).toBe('Fluxograma')
    expect(resumoDaCapa(false, 3)).toBe('3 anexos')
    expect(resumoDaCapa(false, 0)).toBe('')
  })
  it('só dá para apresentar com fluxograma ou anexo', () => {
    expect(podeApresentar('flowchart TD', 0)).toBe(true)
    expect(podeApresentar(null, 1)).toBe(true)
    expect(podeApresentar('  ', 0)).toBe(false)
    expect(podeApresentar(undefined, 0)).toBe(false)
  })
  it('tipo do anexo, tamanho e zoom para caber', () => {
    expect(tipoDoAnexo('image/png')).toBe('imagem')
    expect(tipoDoAnexo('application/pdf')).toBe('pdf')
    expect(tipoDoAnexo('application/msword')).toBe('outro')
    expect(tipoDoAnexo(null)).toBe('outro')
    expect(tamanhoLegivel(345_000)).toBe('337 KB')
    expect(tamanhoLegivel(2_500_000)).toBe('2,4 MB')
    expect(tamanhoLegivel(0)).toBe('')
    expect(zoomParaCaber({ w: 2000, h: 500 }, { w: 1000, h: 800 })).toBe(0.5) // limitado pela largura
    expect(zoomParaCaber({ w: 500, h: 2000 }, { w: 1000, h: 800 })).toBe(0.4) // limitado pela altura
    expect(zoomParaCaber({ w: 100, h: 100 }, { w: 1000, h: 800 })).toBe(2) // não amplia além do máximo
    expect(zoomParaCaber({ w: 100, h: 100 }, { w: 0, h: 0 })).toBe(1)
  })
})

describe('capa', () => {
  it('mostra protocolo, título e "Fluxograma e N anexos", sem imagem', async () => {
    const { container } = abrir({ anexos: [FOTO, PDF] })
    expect(screen.getByText('Comitê de Mudanças · Protocolo 1871928')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Segredos no HashiCorp Vault' })).toBeInTheDocument()
    expect(await screen.findByText('Fluxograma e 2 anexos')).toBeInTheDocument()
    expect(dialogo().querySelector('img')).toBeNull()
    expect(container.ownerDocument.body.innerHTML).not.toContain('sebratel-presentation-cover')
  })

  it('singular, e sem "0 anexos" quando não há anexo', async () => {
    const um = abrir({ anexos: [FOTO] })
    expect(await screen.findByText('Fluxograma e 1 anexo')).toBeInTheDocument()
    um.unmount()
    abrir({ anexos: [] })
    // Na capa, a linha diz só "Fluxograma".
    expect(screen.getByText('Fluxograma', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText(/0 anexo/)).toBeNull()
  })

  it('sem título informado usa "GMUD N"', () => {
    abrir({ titulo: '  ' })
    expect(screen.getByRole('heading', { level: 1, name: 'GMUD 1871928' })).toBeInTheDocument()
  })
})

describe('navegação', () => {
  it('índice lateral lista Capa, Fluxograma e os anexos, e pula direto', async () => {
    abrir({ anexos: [FOTO, PDF] })
    await waitFor(() => expect(indice().getAllByRole('button')).toHaveLength(4))
    expect(indice().getAllByRole('button').map((b) => b.textContent)).toEqual(['1Capa', '2Fluxograma', '3topologia.png', '4plano-de-rollback.pdf'])
    expect(indice().getByRole('button', { name: /Capa/ })).toHaveAttribute('aria-current', 'true')
    await userEvent.click(indice().getByRole('button', { name: /plano-de-rollback/ }))
    expect(posicao()).toBe('Slide 4 de 4: plano-de-rollback.pdf')
    expect(indice().getByRole('button', { name: /plano-de-rollback/ })).toHaveAttribute('aria-current', 'true')
    expect(indice().getByRole('button', { name: /Capa/ })).not.toHaveAttribute('aria-current')
  })

  it('teclado: setas, Home e End, respeitando os limites', async () => {
    abrir({ anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 3: Capa'))
    await userEvent.keyboard('{ArrowLeft}')
    expect(posicao()).toBe('Slide 1 de 3: Capa') // já está no primeiro
    await userEvent.keyboard('{ArrowRight}')
    expect(posicao()).toBe('Slide 2 de 3: Fluxograma')
    await userEvent.keyboard('{End}')
    expect(posicao()).toBe('Slide 3 de 3: topologia.png')
    await userEvent.keyboard('{ArrowRight}')
    expect(posicao()).toBe('Slide 3 de 3: topologia.png') // já está no último
    await userEvent.keyboard('{Home}')
    expect(posicao()).toBe('Slide 1 de 3: Capa')
  })

  it('Anterior e Próximo ficam desabilitados nas pontas; a barra de progresso acompanha', async () => {
    abrir()
    const anterior = screen.getByRole('button', { name: 'Anterior' })
    const proximo = screen.getByRole('button', { name: 'Próximo' })
    expect(anterior).toBeDisabled()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    await userEvent.click(proximo)
    expect(posicao()).toBe('Slide 2 de 2: Fluxograma')
    expect(proximo).toBeDisabled()
    expect(anterior).toBeEnabled()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '2')
  })

  it('Esc e o botão de fechar chamam onClose', async () => {
    const { onClose } = abrir()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar apresentação' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('o ouvinte de teclado é registrado uma vez só, mesmo navegando', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    abrir({ anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 3: Capa'))
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}')
    expect(add.mock.calls.filter(([tipo]) => tipo === 'keydown')).toHaveLength(1)
    add.mockRestore()
  })
})

describe('fluxograma', () => {
  it('desenha o diagrama, ajustado, com os controles de zoom e a orientação', async () => {
    abrir()
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument())
    expect(renderMermaid).toHaveBeenCalledWith('flowchart TD\n  A --> B', expect.any(HTMLElement))
    expect(screen.getByTestId('area-do-fluxograma').querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Ajustar à tela/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ampliar zoom' }))
    expect(screen.getByText('120%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Ajustar à tela/ }))
    expect(screen.getByText('100%')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Horizontal' }))
    await waitFor(() => expect(renderMermaid).toHaveBeenLastCalledWith('flowchart LR\n  A --> B', expect.any(HTMLElement)))
  })

  it('se o renderizador falha: mensagem clara e "Tentar de novo" (nunca área vazia)', async () => {
    renderMermaid.mockRejectedValueOnce(new Error('Falha ao carregar o renderizador de fluxogramas. Verifique sua conexão.'))
    abrir({ anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 3: Capa'))
    await userEvent.keyboard('{ArrowRight}')
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Não foi possível mostrar o fluxograma')
    expect(aviso).toHaveTextContent('Verifique sua conexão')
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull()

    await userEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(renderMermaid).toHaveBeenCalledTimes(2)
  })

  it('"Continuar sem o diagrama" segue para o próximo slide', async () => {
    renderMermaid.mockRejectedValue(new Error('diagrama inválido'))
    abrir({ anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 3: Capa'))
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar sem o diagrama' }))
    expect(posicao()).toBe('Slide 3 de 3: topologia.png')
  })

  it('enquanto carrega mostra o esqueleto com o aviso', async () => {
    renderMermaid.mockImplementation(() => new Promise(() => {}))
    abrir()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o fluxograma…')
  })
})

describe('anexos', () => {
  it('imagem: aparece na tela, com nome, quem enviou e quando, zoom e Baixar', async () => {
    abrir({ anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 3: Capa'))
    await userEvent.keyboard('{End}')
    const img = await screen.findByRole('img', { name: 'topologia.png' })
    expect(img).toHaveAttribute('src', 'blob:teste')
    expect(fetchWithSessionAuth).toHaveBeenCalledWith('/arquivo/1')
    expect(screen.getByText(/Enviado por Ana Souza em .* · 337 KB/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Baixar' })).toHaveAttribute('download', 'topologia.png')
  })

  it('PDF: página inteira em um iframe', async () => {
    abrir({ flowchart: null, anexos: [PDF] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 2: Capa'))
    await userEvent.keyboard('{ArrowRight}')
    await waitFor(() => expect(dialogo().querySelector('iframe')).not.toBeNull())
    const pagina = dialogo().querySelector('iframe') as HTMLIFrameElement
    expect(pagina).toHaveAttribute('title', 'plano-de-rollback.pdf')
    expect(pagina).toHaveAttribute('src', 'blob:teste')
    expect(pagina).toHaveClass('h-full', 'w-full')
    expect(screen.queryByRole('group', { name: 'Zoom' })).toBeNull()
  })

  it('formato que não abre na tela vira cartão com Baixar; sem remetente, não inventa', async () => {
    abrir({ flowchart: null, anexos: [PLANILHA] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 2: Capa'))
    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Este tipo de arquivo não abre na tela. Baixe para ver.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Baixar' })).toHaveAttribute('download', 'inventario.xlsx')
    expect(screen.queryByText(/Enviado por/)).toBeNull()
    expect(screen.getByText(/^Enviado em .* · 337 KB$/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('falha ao carregar: mensagem e "Tentar de novo"', async () => {
    fetchWithSessionAuth.mockImplementationOnce(async () => new Response('', { status: 500 }))
    abrir({ flowchart: null, anexos: [FOTO] })
    await waitFor(() => expect(posicao()).toBe('Slide 1 de 2: Capa'))
    await userEvent.keyboard('{ArrowRight}')
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Não foi possível abrir este anexo')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('img', { name: 'topologia.png' })).toBeInTheDocument()
    expect(fetchWithSessionAuth).toHaveBeenCalledTimes(2)
  })
})

describe('abrir sem fluxograma', () => {
  it('só com anexos: capa e anexos, sem slide de fluxograma', async () => {
    abrir({ flowchart: null, anexos: [FOTO, PDF] })
    await waitFor(() => expect(indice().getAllByRole('button')).toHaveLength(3))
    expect(indice().getAllByRole('button').map((b) => b.textContent)).toEqual(['1Capa', '2topologia.png', '3plano-de-rollback.pdf'])
    expect(screen.getByText('2 anexos')).toBeInTheDocument()
    expect(screen.queryByText(/Fluxograma e/)).toBeNull()
    expect(renderMermaid).not.toHaveBeenCalled()
  })
})

describe('acessibilidade, tema e foco', () => {
  it('é um diálogo modal com nome; os botões têm rótulo e type="button"', () => {
    abrir()
    expect(dialogo()).toHaveAttribute('aria-modal', 'true')
    expect(dialogo()).toHaveAccessibleName('Apresentação ao Comitê: Segredos no HashiCorp Vault')
    expect(screen.getByRole('button', { name: 'Fechar apresentação' })).toBeInTheDocument()
    for (const botao of within(dialogo()).getAllByRole('button')) expect(botao).toHaveAttribute('type', 'button')
    expect(screen.getByText(/^Slide 1 de 2/)).toHaveAttribute('aria-live', 'polite')
  })

  it('o foco entra na apresentação ao abrir e volta para onde estava ao fechar', () => {
    const origem = document.createElement('button')
    document.body.appendChild(origem)
    origem.focus()
    const { unmount } = abrir()
    expect(dialogo()).toHaveFocus()
    unmount()
    expect(origem).toHaveFocus()
    origem.remove()
  })

  it('tema: começa no tema do app, alterna só durante a apresentação e devolve ao fechar', async () => {
    const { unmount } = abrir()
    const tema = screen.getByRole('button', { name: 'Tema escuro' })
    expect(tema).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(tema)
    expect(tema).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveClass('dark')
    unmount()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('app no tema escuro: a apresentação abre escura', () => {
    document.documentElement.classList.add('dark')
    const { unmount } = abrir()
    expect(screen.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'true')
    unmount()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('tela cheia: sem suporte no navegador o botão não aparece; com suporte, pede a tela cheia', async () => {
    const semSuporte = abrir()
    expect(screen.queryByRole('button', { name: 'Tela cheia' })).toBeNull()
    semSuporte.unmount()

    const pedir = vi.fn(() => Promise.resolve())
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: pedir })
    try {
      abrir()
      await userEvent.click(screen.getByRole('button', { name: 'Tela cheia' }))
      expect(pedir).toHaveBeenCalledTimes(1)
    } finally {
      delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen
    }
  })
})
