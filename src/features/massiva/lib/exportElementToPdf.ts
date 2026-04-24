import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

function sanitizeFileNameBase(name: string): string {
  return name.replace(/[^\w\u00C0-\u024F-]+/g, '_').replace(/^_+|_+$/g, '') || 'export'
}

/**
 * Largura **visível** (não `scrollWidth`): `scrollWidth` pode ser muito maior que a caixa
 * (overflow), e o html2canvas nesse caso gera um raster largo; ao escalar para a largura
 * da folha, o conteúdo fica pequeno num canto.
 */
function measureVisibleExportBox(el: HTMLElement): { w: number; h: number } {
  const r = el.getBoundingClientRect()
  const fromClient = el.clientWidth > 0 ? el.clientWidth : 0
  const fromRect = r.width > 0 ? r.width : 0
  const w = Math.max(1, Math.ceil(fromClient > 0 ? fromClient : fromRect > 0 ? fromRect : 1))
  const h = Math.max(
    1,
    Math.ceil(
      el.scrollHeight > 0
        ? el.scrollHeight
        : el.offsetHeight > 0
          ? el.offsetHeight
          : r.height > 0
            ? r.height
            : 1,
    ),
  )
  return { w, h }
}

/**
 * html2canvas não trata `oklab`/`oklch` (Tailwind v4). No clone, remove estilos e
 * classes que arrastam essas funções, e aplica cores só em `rgb()`.
 */

/**
 * Com as folhas de estilo removidas, o layout do clone fica sem margens/entrelinhas; o html2canvas
 * pode compor o texto de forma sobreposta. Isto reimpõe tipografia básica e mantém fundos
 * discretos em blocos marcados.
 */
function injectPdfCloneLayoutFix(doc: Document): void {
  const s = doc.createElement('style')
  s.setAttribute('data-massiva-pdf-layout-fix', '1')
  s.textContent = `
    html, body {
      overflow: visible !important;
      height: auto !important;
      min-height: 0 !important;
    }
    *, *::before, *::after { box-sizing: border-box !important; }
    body, p, li, h1, h2, h3, h4, span, div {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }
    /* Line-height apertado + html2canvas = descendentes/emoji cortados abaixo da linha. */
    p {
      display: block !important;
      margin: 0 0 0.55em 0 !important;
      line-height: 1.75 !important;
      padding: 0 0 0.2em 0 !important;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      overflow-wrap: anywhere !important;
    }
    p:last-child { margin-bottom: 0.15em !important; }
    h1, h2, h3, h4 {
      display: block !important;
      line-height: 1.4 !important;
      padding: 0 0 0.1em 0 !important;
      margin: 0 0 0.45em 0 !important;
      font-weight: 600 !important;
    }
    [data-massiva-pdf-amber] {
      display: block !important;
      border: 1px solid rgb(253 230 138) !important;
      background-color: rgb(255 250 235) !important;
      border-radius: 0.5rem !important;
      padding: 0.75rem 0.9rem 0.85rem 0.9rem !important;
    }
    [data-massiva-pdf-amber] p {
      line-height: 1.55 !important;
    }
    [data-massiva-pdf-amber] p:last-of-type { margin-bottom: 0.1em !important; }
    [data-massiva-pdf-capture] {
      overflow: visible !important;
      padding-bottom: 8px !important;
    }
  `
  if (doc.head !== null) {
    doc.head.appendChild(s)
  } else {
    doc.documentElement?.prepend(s)
  }
}

function sanitizeHtml2CanvasClone(doc: Document): void {
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((n) => n.remove())
  doc.querySelectorAll('style').forEach((n) => n.remove())

  doc.querySelectorAll<HTMLElement>('[class]').forEach((el) => {
    el.removeAttribute('class')
  })

  const skip = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'META', 'TITLE', 'HEAD'])
  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (skip.has(el.tagName)) return
    const isAmber = el.hasAttribute('data-massiva-pdf-amber')
    const inAmber = el.closest('[data-massiva-pdf-amber]') !== null && !isAmber
    // Tailwind v4: estilos inline com `oklab()`; html2canvas falha. Limpar tudo e reaplicar só `rgb()`.
    el.removeAttribute('style')
    el.style.setProperty('color', 'rgb(38, 38, 38)', 'important')
    if (isAmber) {
      // fundo: `injectPdfCloneLayoutFix` no wrapper
    } else if (inAmber) {
      el.style.setProperty('background-color', 'transparent', 'important')
    } else {
      el.style.setProperty('background-color', 'rgb(255, 255, 255)', 'important')
    }
    el.style.setProperty('background-image', 'none', 'important')
    el.style.setProperty('box-shadow', 'none', 'important')
    el.style.setProperty('text-shadow', 'none', 'important')

    if (isAmber) {
      // borda: CSS injetado
    } else {
      el.style.setProperty('border-color', 'rgb(229, 231, 235)', 'important')
      el.style.setProperty('border-style', 'none', 'important')
      el.style.setProperty('border-width', '0', 'important')
    }
  })

  doc.querySelectorAll('svg, svg *').forEach((node) => {
    if (node instanceof Element) {
      node.setAttribute('fill', 'rgb(100, 100, 100)')
      node.setAttribute('stroke', 'rgb(120, 120, 120)')
    }
  })

  injectPdfCloneLayoutFix(doc)
}

function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 2000)
}

/**
 * Gera um PDF a partir de um nó HTML (A4, com margem), paginado por recorte do canvas.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileNameBase: string,
): Promise<void> {
  const { w: capW, h: capH } = measureVisibleExportBox(element)
  if (capW < 2 || capH < 2) {
    throw new Error('Área de exportação muito pequena. Tente de novo após o modal abrir por completo.')
  }

  await new Promise<void>((r) => {
    requestAnimationFrame(() => r())
  })

  const commonOpts = {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff' as const,
    onclone: (cloned: Document) => {
      sanitizeHtml2CanvasClone(cloned)
    },
  }

  // Só largura: `height` no clone difere muito do medido no DOM (Tailwind removido no onclone).
  // Forçar `height` + `windowHeight` faz o motor encaixar o conteúdo nessa caixa e distorce/corta.
  const captureOpts: Parameters<typeof html2canvas>[1] = {
    ...commonOpts,
    width: capW,
    windowWidth: capW,
    x: 0,
    y: 0,
  }

  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(element, captureOpts)
  } catch {
    try {
      canvas = await html2canvas(element, {
        ...commonOpts,
        width: capW,
        windowWidth: capW,
        x: 0,
        y: 0,
      })
    } catch {
      canvas = await html2canvas(element, { ...captureOpts, scale: 1 })
    }
  }

  const marginMm = 10
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageW = pdf.internal.pageSize.getWidth() - 2 * marginMm
  const pageH = pdf.internal.pageSize.getHeight() - 2 * marginMm
  const w = canvas.width
  const h = canvas.height
  if (w <= 0 || h <= 0) {
    throw new Error('Nada a exportar: área vazia.')
  }

  const fullImgHeightMm = (h / w) * pageW
  const pageSourceHeightPx = (h * pageH) / fullImgHeightMm
  let yOffsetPx = 0
  const safeName = sanitizeFileNameBase(fileNameBase)

  while (yOffsetPx < h) {
    if (yOffsetPx > 0) {
      pdf.addPage()
    }
    const remaining = h - yOffsetPx
    if (remaining < 0.5) break
    const sliceH = Math.min(pageSourceHeightPx, remaining)
    const readH = Math.max(1, Math.min(Math.floor(sliceH + 0.5), h - yOffsetPx))
    const readY = yOffsetPx
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = w
    sliceCanvas.height = readH
    const ctx = sliceCanvas.getContext('2d')
    if (ctx === null) {
      throw new Error('Não foi possível gerar a imagem do PDF.')
    }
    ctx.drawImage(canvas, 0, readY, w, readH, 0, 0, w, readH)
    const sliceHeightMm = (readH / w) * pageW
    const dataUrl = sliceCanvas.toDataURL('image/png', 0.92)
    pdf.addImage(dataUrl, 'PNG', marginMm, marginMm, pageW, sliceHeightMm)
    yOffsetPx += readH
  }

  const blob = pdf.output('blob')
  downloadPdfBlob(blob, `${safeName}.pdf`)
}
