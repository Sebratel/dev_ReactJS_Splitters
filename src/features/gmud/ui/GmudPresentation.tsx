import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, GitFork, Image as ImageIcon, Maximize, Minimize, Minus, Moon, Plus, RotateCcw, Sun, X,
  type LucideIcon,
} from 'lucide-react'
import { fetchGmudAttachments, gmudAttachmentFileUrl, type GmudAttachment } from '@/features/gmud/api/gmudAttachments'
import type { GmudFlowchart } from '@/features/gmud/api/gmudFlowchart'
import {
  resumoDaCapa,
  rotuloDoSlide,
  slidesDaApresentacao,
  tamanhoLegivel,
  tipoDoAnexo,
  zoomParaCaber,
  type GmudSlide,
} from '@/features/gmud/lib/gmudApresentacao'
import { renderMermaid } from '@/features/gmud/lib/gmudMermaid'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { formatBrazilDateTimeShortDisplay } from '@/shared/lib/formatBrazilDisplayDate'
import { cn } from '@/shared/lib/utils'

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white'
const BOTAO = cn(
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 dark:ring-white/25',
  FOCO,
)
const ICONE = cn('inline-flex size-10 items-center justify-center rounded-lg text-on-surface ring-1 ring-neutral-300 transition-colors hover:bg-surface-container-low dark:ring-white/25', FOCO)
const PRIMARIO = cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-neutral-900 transition-colors hover:bg-primary/90', FOCO)
const PALCO = 'flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-surface-container-lowest dark:border-white/20'
const ZOOM_PASSO = 0.2
const ZOOM_MIN = 0.1
const ZOOM_MAX = 6

/** Aviso de falha no meio do slide: mensagem clara e as saídas (tentar de novo, seguir sem o conteúdo). */
function Falha({ titulo, detalhe, onTentar, onSeguir, seguirRotulo }: { titulo: string; detalhe?: string; onTentar: () => void; onSeguir?: () => void; seguirRotulo?: string }) {
  return (
    <div role="alert" className="m-auto flex max-w-xl flex-col items-center gap-3 p-6 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
        <AlertTriangle size={28} />
      </span>
      <p className="text-xl font-bold text-on-surface">{titulo}</p>
      {detalhe ? <p className="text-base text-on-surface-variant">{detalhe}</p> : null}
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onTentar} className={PRIMARIO}>
          <RotateCcw size={16} aria-hidden /> Tentar de novo
        </button>
        {onSeguir ? (
          <button type="button" onClick={onSeguir} className={BOTAO}>
            {seguirRotulo ?? 'Continuar'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Esqueleto de carregamento: blocos neutros no lugar do conteúdo, com o aviso para leitor de tela. */
function Carregando({ texto }: { texto: string }) {
  return (
    <div role="status" className="m-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6">
      <div aria-hidden className="grid w-full grid-cols-3 gap-4">
        <div className="col-start-2 h-12 rounded-xl bg-surface-container-low" />
        <div className="col-span-3 mx-auto h-1.5 w-1/2 rounded-full bg-surface-container-low" />
        <div className="h-12 rounded-xl bg-surface-container-low" />
        <div className="h-12 rounded-xl bg-surface-container-low" />
        <div className="h-12 rounded-xl bg-surface-container-low" />
      </div>
      <p className="text-base text-on-surface-variant">{texto}</p>
    </div>
  )
}

/** Controles de zoom (−, porcentagem, +, ajustar). */
function Zoom({ zoom, onMudar, onAjustar, rotuloAjustar }: { zoom: number; onMudar: (delta: number) => void; onAjustar: () => void; rotuloAjustar: string }) {
  return (
    <div role="group" aria-label="Zoom" className="flex items-center gap-1">
      <button type="button" onClick={() => onMudar(-ZOOM_PASSO)} aria-label="Reduzir zoom" title="Reduzir zoom" className={ICONE}>
        <Minus size={16} aria-hidden />
      </button>
      <span className="min-w-14 text-center text-sm font-semibold tabular-nums text-on-surface" aria-live="off">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={() => onMudar(ZOOM_PASSO)} aria-label="Ampliar zoom" title="Ampliar zoom" className={ICONE}>
        <Plus size={16} aria-hidden />
      </button>
      <button type="button" onClick={onAjustar} className={BOTAO}>
        <RotateCcw size={15} aria-hidden /> {rotuloAjustar}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Capa
// ---------------------------------------------------------------------------

/** Capa: centralizada, sem imagem — fundo com um pontilhado sutil e o amarelo da marca como acento. */
function SlideCapa({ protocol, titulo, temFluxograma, anexos }: { protocol: number; titulo: string; temFluxograma: boolean; anexos: number }) {
  const resumo = resumoDaCapa(temFluxograma, anexos)
  return (
    <div className={cn(PALCO, 'relative items-center justify-center text-on-surface')}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-on-surface-variant opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1.6px)', backgroundSize: '24px 24px' }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-primary" />
      <div className="relative flex max-w-5xl flex-col items-center gap-5 px-6 py-10 text-center sm:px-12">
        <p className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold uppercase tracking-[0.14em] text-neutral-900">Comitê de Mudanças · Protocolo {protocol}</p>
        <h1 className="break-words text-4xl font-black leading-tight text-on-surface sm:text-5xl xl:text-6xl">{titulo}</h1>
        {resumo !== '' ? <p className="text-xl font-semibold text-on-surface-variant">{resumo}</p> : null}
        <p className="mt-2 text-sm text-on-surface-variant">
          Use as setas <span className="font-bold text-on-surface">← →</span> para navegar e <span className="font-bold text-on-surface">Esc</span> para fechar.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fluxograma
// ---------------------------------------------------------------------------

/**
 * Fluxograma ajustado à tela: abre inteiro, sem rolagem; dá para ampliar, reduzir, voltar ao ajuste e arrastar.
 * Se o renderizador (Mermaid, via CDN) não carregar ou o diagrama for inválido, mostra o motivo e "Tentar de novo".
 */
function SlideFluxograma({ source, direction, onSeguir }: { source: string; direction: 'TD' | 'LR'; onSeguir?: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const natural = useRef<{ w: number; h: number } | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const arraste = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  // Reescreve só a diretiva de direção — não altera o fluxograma salvo.
  const displaySource = source.replace(/^(flowchart|graph)\s+\S+/im, `flowchart ${direction}`)

  const aplicar = (z: number) => {
    const svg = svgWrapRef.current?.querySelector('svg')
    if (!svg || !natural.current) return
    svg.style.width = `${natural.current.w * z}px`
    svg.style.height = `${natural.current.h * z}px`
  }
  const zoomDeAjuste = () => {
    const area = areaRef.current
    if (!area || !natural.current) return 1
    // 48 px de respiro em volta do diagrama.
    return zoomParaCaber(natural.current, { w: area.clientWidth - 48, h: area.clientHeight - 48 })
  }
  const definirZoom = (z: number) => {
    const limitado = Math.min(Math.max(+z.toFixed(2), ZOOM_MIN), ZOOM_MAX)
    setZoom(limitado)
    aplicar(limitado)
  }
  const ajustar = () => {
    setPos({ x: 0, y: 0 })
    definirZoom(zoomDeAjuste())
  }

  useEffect(() => {
    const wrap = svgWrapRef.current
    if (!wrap) return
    let cancelado = false
    setEstado('carregando')
    setErro('')
    natural.current = null
    renderMermaid(displaySource, wrap)
      .then(() => {
        if (cancelado) return
        const svg = wrap.querySelector('svg')
        if (!svg) throw new Error('O diagrama não gerou nenhuma imagem.')
        const partes = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/)
        let w = Number.parseFloat(partes[2] ?? '')
        let h = Number.parseFloat(partes[3] ?? '')
        if (!(w > 0) || !(h > 0)) {
          w = Number.parseFloat(svg.getAttribute('width') ?? '') || svg.getBoundingClientRect().width
          h = Number.parseFloat(svg.getAttribute('height') ?? '') || svg.getBoundingClientRect().height
          if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
        }
        svg.removeAttribute('width')
        svg.removeAttribute('height')
        svg.style.display = 'block'
        svg.style.maxWidth = 'none'
        if (w > 0 && h > 0) natural.current = { w, h }
        setPos({ x: 0, y: 0 })
        const area = areaRef.current
        const z = natural.current && area ? zoomParaCaber(natural.current, { w: area.clientWidth - 48, h: area.clientHeight - 48 }) : 1
        setZoom(z)
        if (natural.current) {
          svg.style.width = `${natural.current.w * z}px`
          svg.style.height = `${natural.current.h * z}px`
        }
        setEstado('pronto')
      })
      .catch((e: unknown) => {
        if (cancelado) return
        wrap.innerHTML = ''
        setErro(e instanceof Error && e.message ? e.message : 'O diagrama não pôde ser desenhado.')
        setEstado('erro')
      })
    return () => {
      cancelado = true
    }
  }, [displaySource, tentativa])

  return (
    <div className={PALCO}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-white/15">
        <p className="flex items-center gap-2 text-base font-bold text-on-surface">
          <GitFork size={18} aria-hidden /> Fluxograma de execução
        </p>
        {estado === 'pronto' ? <Zoom zoom={zoom} onMudar={(d) => definirZoom(zoom + d)} onAjustar={ajustar} rotuloAjustar="Ajustar à tela" /> : null}
      </div>
      {/* O diagrama fica sempre sobre fundo branco (como no papel), nos dois temas. */}
      <div
        ref={areaRef}
        data-testid="area-do-fluxograma"
        className={cn('relative flex min-h-0 flex-1 overflow-hidden bg-white', estado === 'pronto' ? 'cursor-grab touch-none active:cursor-grabbing' : '')}
        onWheel={(e) => {
          if (!e.ctrlKey || estado !== 'pronto') return
          e.preventDefault()
          definirZoom(zoom + (e.deltaY < 0 ? ZOOM_PASSO : -ZOOM_PASSO))
        }}
        onPointerDown={(e) => {
          if (estado !== 'pronto') return
          arraste.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
          e.currentTarget.setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const a = arraste.current
          if (a) setPos({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y })
        }}
        onPointerUp={() => {
          arraste.current = null
        }}
        onPointerCancel={() => {
          arraste.current = null
        }}
      >
        {estado === 'carregando' ? <Carregando texto="Carregando o fluxograma…" /> : null}
        {estado === 'erro' ? (
          <Falha
            titulo="Não foi possível mostrar o fluxograma"
            detalhe={erro}
            onTentar={() => setTentativa((t) => t + 1)}
            onSeguir={onSeguir}
            seguirRotulo="Continuar sem o diagrama"
          />
        ) : null}
        <div
          ref={svgWrapRef}
          className={cn('absolute left-1/2 top-1/2 select-none', estado === 'pronto' ? '' : 'hidden')}
          style={{ transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
        />
      </div>
      {estado === 'pronto' ? <p className="shrink-0 border-t border-neutral-200 px-3 py-1.5 text-sm text-on-surface-variant dark:border-white/15">Arraste para mover. Ctrl + rolagem amplia e reduz.</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anexo
// ---------------------------------------------------------------------------

/** Quem enviou e quando, só com o que existe: "Enviado por Ana em 14/11/2026 10:30". */
function origemDoAnexo(item: GmudAttachment): string {
  const quando = item.createdAt ? formatBrazilDateTimeShortDisplay(item.createdAt, '') : ''
  const quem = (item.uploadedBy ?? '').trim()
  if (quem === '' && quando === '') return ''
  return `Enviado${quem !== '' ? ` por ${quem}` : ''}${quando !== '' ? ` em ${quando}` : ''}`
}

/** Anexo: imagem ajustada à tela (com zoom), PDF em página inteira ou, se não abre na tela, cartão para baixar. */
function SlideAnexo({ item, onSeguir }: { item: GmudAttachment; onSeguir?: () => void }) {
  const tipo = tipoDoAnexo(item.mimetype)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const [tentativa, setTentativa] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    let url: string | null = null
    let cancelado = false
    setEstado('carregando')
    setBlobUrl(null)
    setZoom(1)
    fetchWithSessionAuth(gmudAttachmentFileUrl(item.id))
      .then((r) => {
        if (!r.ok) throw new Error('arquivo indisponível')
        return r.blob()
      })
      .then((blob) => {
        if (cancelado) return
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setEstado('pronto')
      })
      .catch(() => {
        if (!cancelado) setEstado('erro')
      })
    return () => {
      cancelado = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [item.id, tentativa])

  const origem = origemDoAnexo(item)
  const tamanho = tamanhoLegivel(item.sizeBytes)
  const Icone: LucideIcon = tipo === 'imagem' ? ImageIcon : FileText
  const baixar =
    estado === 'pronto' && blobUrl ? (
      <a href={blobUrl} download={item.filenameOriginal} className={tipo === 'outro' ? PRIMARIO : BOTAO}>
        <Download size={16} aria-hidden /> Baixar
      </a>
    ) : null

  return (
    <div className={PALCO}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 px-3 py-2 dark:border-white/15">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 text-base font-bold text-on-surface">
            <Icone size={18} aria-hidden className="shrink-0" />
            <span className="truncate" title={item.filenameOriginal}>
              {item.filenameOriginal}
            </span>
          </p>
          {origem !== '' || tamanho !== '' ? <p className="text-sm text-on-surface-variant">{[origem, tamanho].filter((x) => x !== '').join(' · ')}</p> : null}
          {item.description?.trim() ? <p className="text-sm text-on-surface">{item.description.trim()}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tipo === 'imagem' && estado === 'pronto' ? (
            <Zoom zoom={zoom} onMudar={(d) => setZoom((z) => Math.min(Math.max(+(z + d).toFixed(2), 0.2), ZOOM_MAX))} onAjustar={() => setZoom(1)} rotuloAjustar="Ajustar à tela" />
          ) : null}
          {tipo !== 'outro' ? baixar : null}
        </div>
      </div>
      <div className={cn('flex min-h-0 flex-1 bg-surface-container-low', tipo === 'imagem' && zoom > 1 ? 'overflow-auto' : 'overflow-hidden')}>
        {estado === 'carregando' ? <Carregando texto="Carregando o anexo…" /> : null}
        {estado === 'erro' ? (
          <Falha
            titulo="Não foi possível abrir este anexo"
            detalhe="O arquivo não carregou. Confira a conexão e tente de novo."
            onTentar={() => setTentativa((t) => t + 1)}
            onSeguir={onSeguir}
            seguirRotulo="Ir para o próximo"
          />
        ) : null}
        {estado === 'pronto' && blobUrl && tipo === 'imagem' ? (
          <img
            src={blobUrl}
            alt={item.description?.trim() || item.filenameOriginal}
            draggable={false}
            onError={() => setEstado('erro')}
            className={cn('m-auto block object-contain', zoom === 1 ? 'max-h-full max-w-full' : 'max-w-none')}
            style={zoom === 1 ? undefined : { width: `${zoom * 100}%` }}
          />
        ) : null}
        {estado === 'pronto' && blobUrl && tipo === 'pdf' ? <iframe src={blobUrl} title={item.filenameOriginal} className="h-full w-full bg-white" /> : null}
        {estado === 'pronto' && tipo === 'outro' ? (
          <div className="m-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-neutral-300 bg-surface-container-lowest p-8 text-center dark:border-white/20">
            <span aria-hidden className="flex size-16 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
              <FileText size={32} />
            </span>
            <p className="break-words text-xl font-bold text-on-surface">{item.filenameOriginal}</p>
            <p className="text-base text-on-surface-variant">Este tipo de arquivo não abre na tela. Baixe para ver.</p>
            {baixar}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Visualizador
// ---------------------------------------------------------------------------

const FOCAVEIS = 'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])'

/**
 * Apresentação ao Comitê: visualizador em tela cheia do fluxograma e dos anexos da GMUD, com capa.
 * Navegação por índice lateral (barra de baixo em tela estreita), setas, Home/End e Esc. Usa o tema do app,
 * com um botão para alternar claro/escuro só enquanto a apresentação está aberta.
 */
export function GmudPresentationModal({
  protocol,
  flowchart,
  gmudTitle,
  onClose,
}: {
  protocol: number
  /** Sem fluxograma, a apresentação mostra só a capa e os anexos. */
  flowchart: GmudFlowchart | null
  gmudTitle?: string
  onClose: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState<'TD' | 'LR'>('TD')
  const [telaCheia, setTelaCheia] = useState(false)
  const [escuro, setEscuro] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  const raizRef = useRef<HTMLDivElement>(null)

  const { data: attachments = [] } = useQuery({
    queryKey: ['gmud', 'attachments', protocol],
    queryFn: () => fetchGmudAttachments(protocol),
    staleTime: 60_000,
  })

  const slides = slidesDaApresentacao(flowchart?.mermaidSource, attachments)
  const total = slides.length
  const atual = Math.min(current, total - 1)
  const slide = slides[atual] as GmudSlide
  const titulo = gmudTitle?.trim() || `GMUD ${protocol}`
  const irPara = (i: number) => setCurrent(Math.min(Math.max(i, 0), total - 1))

  // Ouvinte de teclado estável: registrado uma vez; lê o total e o onClose mais recentes por refs.
  const totalRef = useRef(total)
  const fecharRef = useRef(onClose)
  useEffect(() => {
    totalRef.current = total
    fecharRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return
      const ultimo = totalRef.current - 1
      if (e.key === 'Escape') fecharRef.current()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') setCurrent((c) => Math.min(c + 1, ultimo))
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setCurrent((c) => Math.max(Math.min(c, ultimo) - 1, 0))
      else if (e.key === 'Home') setCurrent(0)
      else if (e.key === 'End') setCurrent(ultimo)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Foco: entra na apresentação ao abrir e volta para onde estava ao fechar.
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null
    raizRef.current?.focus()
    return () => anterior?.focus()
  }, [])

  // Tema só da apresentação: troca a classe do app enquanto está aberta e devolve como estava ao fechar.
  useEffect(() => {
    const raiz = document.documentElement
    const original = raiz.classList.contains('dark')
    raiz.classList.toggle('dark', escuro)
    return () => {
      raiz.classList.toggle('dark', original)
    }
  }, [escuro])

  // Tela cheia (quando o navegador permite): acompanha também a saída pelo Esc do próprio navegador.
  const podeTelaCheia = typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'
  useEffect(() => {
    const onChange = () => setTelaCheia(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    }
  }, [])
  const alternarTelaCheia = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
      else void raizRef.current?.requestFullscreen?.().catch(() => {})
    } catch {
      // Navegador sem suporte ou bloqueado: a apresentação já ocupa a janela inteira.
    }
  }

  const proximo = atual < total - 1 ? () => irPara(atual + 1) : undefined

  return createPortal(
    <div
      ref={raizRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Apresentação ao Comitê: ${titulo}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        // Foco preso: o Tab circula só entre os controles da apresentação.
        if (e.key !== 'Tab') return
        const itens = Array.from(raizRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []).filter((el) => el.offsetParent !== null || el === document.activeElement)
        if (itens.length === 0) return
        const i = itens.indexOf(document.activeElement as HTMLElement)
        if (e.shiftKey && i <= 0) {
          e.preventDefault()
          itens[itens.length - 1]?.focus()
        } else if (!e.shiftKey && i === itens.length - 1) {
          e.preventDefault()
          itens[0]?.focus()
        }
      }}
      className="gmud-fade fixed inset-0 z-50 flex flex-col bg-surface text-on-surface outline-none"
    >
      {/* Topo */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-300 bg-surface-container-lowest px-3 py-2 dark:border-white/20 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-on-surface" title={titulo}>
            {titulo}
          </p>
          <p className="text-sm text-on-surface-variant" aria-live="polite">
            Slide {atual + 1} de {total}: {rotuloDoSlide(slide)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {slide.kind === 'flowchart' ? (
            <div role="group" aria-label="Orientação do fluxograma" className="flex items-center gap-1">
              {(['TD', 'LR'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className={cn('min-h-10 rounded-lg px-3 text-sm font-semibold ring-1 transition-colors', FOCO, direction === d ? 'bg-primary text-neutral-900 ring-neutral-900/40' : 'text-on-surface ring-neutral-300 hover:bg-surface-container-low dark:ring-white/25')}
                >
                  {d === 'TD' ? 'Vertical' : 'Horizontal'}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => setEscuro((v) => !v)} aria-pressed={escuro} aria-label="Tema escuro" title={escuro ? 'Usar tema claro' : 'Usar tema escuro'} className={ICONE}>
            {escuro ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
          </button>
          {podeTelaCheia ? (
            <button type="button" onClick={alternarTelaCheia} aria-pressed={telaCheia} aria-label="Tela cheia" title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'} className={ICONE}>
              {telaCheia ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Fechar apresentação" title="Fechar (Esc)" className={ICONE}>
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      {/* Progresso */}
      <div role="progressbar" aria-label="Progresso da apresentação" aria-valuemin={1} aria-valuemax={total} aria-valuenow={atual + 1} className="h-1.5 shrink-0 bg-surface-container-low">
        <div className="h-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${((atual + 1) / total) * 100}%` }} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Índice lateral (telas largas) */}
        <nav aria-label="Slides" className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-300 bg-surface-container-lowest p-2 dark:border-white/20 md:block">
          <ol className="space-y-1">
            {slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={i === atual ? 'true' : undefined}
                  onClick={() => irPara(i)}
                  title={rotuloDoSlide(s)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors',
                    FOCO,
                    i === atual ? 'bg-primary text-neutral-900' : 'text-on-surface hover:bg-surface-container-low',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums', i === atual ? 'bg-neutral-900 text-white' : 'bg-surface-container-low text-on-surface ring-1 ring-neutral-300 dark:ring-white/25')}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate">{rotuloDoSlide(s)}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Slide */}
        <div key={slide.id} className="gmud-fade flex min-h-0 min-w-0 flex-1 p-3 sm:p-5">
          {slide.kind === 'cover' ? <SlideCapa protocol={protocol} titulo={titulo} temFluxograma={slides.some((s) => s.kind === 'flowchart')} anexos={attachments.length} /> : null}
          {slide.kind === 'flowchart' ? <SlideFluxograma source={slide.source} direction={direction} onSeguir={proximo} /> : null}
          {slide.kind === 'attachment' ? <SlideAnexo item={slide.item} onSeguir={proximo} /> : null}
        </div>
      </div>

      {/* Rodapé: anterior/próximo e, em tela estreita, o índice em faixa */}
      <div className="flex shrink-0 items-center gap-2 border-t border-neutral-300 bg-surface-container-lowest px-3 py-2 dark:border-white/20 sm:px-5">
        <button type="button" onClick={() => irPara(atual - 1)} disabled={atual === 0} className={BOTAO}>
          <ChevronLeft size={18} aria-hidden /> <span className="sr-only sm:not-sr-only">Anterior</span>
        </button>
        <nav aria-label="Slides (faixa)" className="flex min-w-0 flex-1 justify-center gap-1.5 overflow-x-auto py-1 md:hidden">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-current={i === atual ? 'true' : undefined}
              aria-label={`Slide ${i + 1}: ${rotuloDoSlide(s)}`}
              onClick={() => irPara(i)}
              className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ring-1 transition-colors', FOCO, i === atual ? 'bg-primary text-neutral-900 ring-neutral-900/40' : 'text-on-surface ring-neutral-300 dark:ring-white/25')}
            >
              {i + 1}
            </button>
          ))}
        </nav>
        <p className="hidden flex-1 text-center text-sm text-on-surface-variant md:block">← → navegam · Home e End vão ao início e ao fim · Esc fecha</p>
        <button type="button" onClick={() => irPara(atual + 1)} disabled={atual >= total - 1} className={BOTAO}>
          <span className="sr-only sm:not-sr-only">Próximo</span> <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  )
}
