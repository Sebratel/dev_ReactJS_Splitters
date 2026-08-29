/**
 * Exportação de redistribuição de condomínio — PDF e CSV.
 *
 * PDF: jsPDF + jspdf-autotable.
 * Design: espelha o sistema de cores da plataforma Operação Sebratel.
 *   primary      #ffb000  (âmbar dourado)
 *   surface      #f4f1e8  (creme)
 *   on-surface   #1a1a1a
 *   inverse      #262626
 *
 * CSV: separador ";", BOM UTF-8 (compatível com Excel).
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  CondoRedistributionOpportunity,
  PendingFloorInfoItem,
} from '@/features/splitters/api/fetchCondoRedistributionFromLocalDb'

// ── Helpers ──────────────────────────────────────────────────────────────────

function floorLabel(floor: number | null): string {
  if (floor === null) return '-'
  if (floor === 0) return 'Terreo'
  return `${floor}o andar`
}

function splitterLabel(title: string): string {
  const match = title.match(/^(.+?)\s*-\s*(?:COND|ED|RES)\./i)
  return match ? match[1].trim() : title
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')
}

// ── Sistema de cores da plataforma ───────────────────────────────────────────

/** RGB puro, sem alfa — conforme os tokens CSS do projeto. */
const T = {
  primary:         [255, 176,   0] as [number, number, number], // #ffb000
  primaryDark:     [180, 120,   0] as [number, number, number], // amber escuro p/ contraste
  primaryBg:       [255, 243, 196] as [number, number, number], // âmbar muito claro
  surface:         [244, 241, 232] as [number, number, number], // #f4f1e8
  surfaceLow:      [235, 231, 219] as [number, number, number], // #ebe7db
  white:           [255, 255, 255] as [number, number, number],
  ink:             [ 26,  26,  26] as [number, number, number], // #1a1a1a
  inkMid:          [ 60,  60,  60] as [number, number, number],
  muted:           [ 93,  93,  93] as [number, number, number], // #5d5d5d
  inverse:         [ 38,  38,  38] as [number, number, number], // #262626
  border:          [210, 206, 196] as [number, number, number], // ~neutral-300 aquecido
  // Auxiliares semânticos (pendências)
  orange:          [194,  65,  12] as [number, number, number],
  orangeBg:        [255, 237, 213] as [number, number, number],
  sky:             [  3, 105, 161] as [number, number, number],
  skyBg:           [224, 242, 254] as [number, number, number],
  emerald:         [  4, 120,  87] as [number, number, number],
  emeraldBg:       [209, 250, 229] as [number, number, number],
}

// ── Cabeçalho padronizado ────────────────────────────────────────────────────

function drawHeader(
  doc: jsPDF,
  opts: { title: string; subtitle: string; tag: string; date: string; accent?: [number, number, number] },
) {
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  const accent = opts.accent ?? T.primary

  // Fundo creme (surface) — clean, sem escuro
  doc.setFillColor(...T.surface)
  doc.rect(0, 0, W, 28, 'F')

  // Barra de acento na borda esquerda (4 mm) — espelha border-l-4 da UI
  doc.setFillColor(...accent)
  doc.rect(0, 0, 4, 28, 'F')

  // Linha divisória inferior sutil
  doc.setDrawColor(...T.border)
  doc.setLineWidth(0.35)
  doc.line(0, 28, W, 28)

  // Tag (tipo do relatório) — acima do título, bem pequena
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...T.muted)
  doc.text(opts.tag, M + 4, 7)

  // Título principal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...T.ink)
  doc.text(opts.title, M + 4, 15)

  // Subtítulo (nome do condomínio) — na cor de acento (âmbar escuro p/ contraste no creme)
  const subtitleColor: [number, number, number] = accent === T.primary ? T.primaryDark : accent
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...subtitleColor)
  doc.text(opts.subtitle, M + 4, 22.5)

  // Data — canto direito, alinhada ao subtítulo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...T.muted)
  doc.text(opts.date, W - M, 22.5, { align: 'right' })
}

// ── Cards de estatísticas (estilo plataforma) ─────────────────────────────────

function drawStatCards(
  doc: jsPDF,
  startY: number,
  cards: Array<{ label: string; value: string; accent?: [number, number, number] }>,
): number {
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  const gap = 5
  const n = cards.length
  const cardW = (W - M * 2 - gap * (n - 1)) / n
  const cardH = 20

  cards.forEach(({ label, value, accent = T.primary }, i) => {
    const x = M + i * (cardW + gap)
    const y = startY

    // Fundo branco (surface-lowest)
    doc.setFillColor(...T.white)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')

    // Borda sutil (surface-low)
    doc.setDrawColor(...T.border)
    doc.setLineWidth(0.35)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S')

    // Borda esquerda colorida — espelha border-l-4 dos cards da UI
    doc.setFillColor(...accent)
    doc.rect(x, y + 2, 3.5, cardH - 4, 'F') // inset p/ respeitar o rounded
    // Cobrir a borda do roundedRect no lado esquerdo
    doc.setFillColor(...accent)
    doc.rect(x, y, 3.5, cardH, 'F')
    // Micro-arredondado apenas nas pontas
    doc.setFillColor(...T.white)
    doc.circle(x + 0.5, y + 0.5, 1.5, 'F')
    doc.circle(x + 0.5, y + cardH - 0.5, 1.5, 'F')

    // Valor numérico grande
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...T.ink)
    doc.text(value, x + cardW / 2 + 1.5, y + 12, { align: 'center' })

    // Label pequeno
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...T.muted)
    doc.text(label, x + cardW / 2 + 1.5, y + 18, { align: 'center' })
  })

  return startY + cardH + 7
}

// ── Rodapé ───────────────────────────────────────────────────────────────────

function addFooterHook(doc: jsPDF, pageLabel: string) {
  return () => {
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const M = 14
    const total = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()

    // Linha divisória
    doc.setDrawColor(...T.surfaceLow)
    doc.setLineWidth(0.4)
    doc.line(M, H - 10, W - M, H - 10)

    // Barra de acento no rodapé (espelha topo)
    doc.setFillColor(...T.primary)
    doc.rect(0, H - 1.5, W, 1.5, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...T.muted)
    doc.text(`${pageLabel}  •  Sebratel Telecom`, M, H - 5.5)
    doc.text(
      `Pag. ${(doc.internal as unknown as { getCurrentPageInfo: () => { pageNumber: number } }).getCurrentPageInfo().pageNumber} / ${total}`,
      W - M, H - 5.5, { align: 'right' },
    )
  }
}

// ── PDF: Oportunidades ────────────────────────────────────────────────────────

export function exportOpportunitiesToPDF(
  condoName: string,
  opportunities: CondoRedistributionOpportunity[],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const now = new Date()
  const M = 14

  drawHeader(doc, {
    title: 'Redistribuicao de Condominio',
    subtitle: condoName,
    tag: 'OPORTUNIDADES DE REDISTRIBUICAO',
    date: formatDate(now),
  })

  const splitterSet = new Set([
    ...opportunities.map((o) => o.currentSplitter.code),
    ...opportunities.map((o) => o.suggestedSplitter.code),
  ])
  const maxGain = Math.max(...opportunities.map((o) => o.floorDifference.improvement))

  const tableY = drawStatCards(doc, 34, [
    { label: 'Clientes para redistribuir', value: String(opportunities.length), accent: T.primary },
    { label: 'Splitters envolvidos',       value: String(splitterSet.size),     accent: T.sky   },
    { label: 'Maior ganho (andares)',       value: `+${maxGain}`,               accent: T.emerald },
  ])

  autoTable(doc, {
    startY: tableY,
    margin: { left: M, right: M },
    tableLineColor: T.border,
    tableLineWidth: 0.3,
    head: [[
      'Cliente', 'Usuario PPPoE', 'Complemento', 'Andar',
      'Splitter Atual', 'And. Atual', 'Splitter Sugerido', 'And. Sug.', 'Ganho',
    ]],
    body: opportunities.map((o) => [
      o.client.name,
      o.client.pppoeUser,
      o.client.complement || '-',
      floorLabel(o.client.floor),
      splitterLabel(o.currentSplitter.title),
      floorLabel(o.currentSplitter.floor),
      splitterLabel(o.suggestedSplitter.title),
      floorLabel(o.suggestedSplitter.floor),
      `+${o.floorDifference.improvement}`,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: T.inkMid,
      lineColor: T.border,
      lineWidth: 0.25,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: T.inverse,
      textColor: T.white,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: T.surface },
    columnStyles: {
      0: { cellWidth: 36, fontStyle: 'bold', textColor: T.ink },
      1: { cellWidth: 30, textColor: T.muted, fontSize: 7 },
      2: { cellWidth: 26, fontSize: 7 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 36 },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 36 },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const v = opportunities[data.row.index]?.floorDifference.improvement ?? 0
        if (v >= 5) {
          data.cell.styles.textColor = T.emerald
          data.cell.styles.fillColor = T.emeraldBg
        } else if (v >= 3) {
          data.cell.styles.textColor = T.primaryDark
          data.cell.styles.fillColor = T.primaryBg
        } else {
          data.cell.styles.textColor = T.sky
          data.cell.styles.fillColor = T.skyBg
        }
      }
    },
    didDrawPage: addFooterHook(doc, 'Redistribuicao — ' + condoName),
  })

  doc.save(`redistribuicao_${sanitize(condoName)}_${now.toISOString().slice(0, 10)}.pdf`)
}

// ── PDF: Pendências ───────────────────────────────────────────────────────────

export function exportPendingToPDF(
  condoName: string,
  items: PendingFloorInfoItem[],
) {
  // Paisagem para ter largura suficiente na coluna "Pendencia" (igual ao de oportunidades)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const now = new Date()
  const M = 14
  // Área útil em paisagem A4: 297 - 14*2 = 269 mm

  drawHeader(doc, {
    title: 'Pendencias de Informacao de Andar',
    subtitle: condoName,
    tag: 'PENDENCIAS SEM CADASTRO DE ANDAR',
    date: formatDate(now),
    accent: T.orange,
  })

  const nSplitter = items.filter((i) => i.pendingReason === 'splitter_sem_andar').length
  const nClient   = items.filter((i) => i.pendingReason === 'cliente_sem_complemento').length

  const tableY = drawStatCards(doc, 34, [
    { label: 'Total de pendencias',     value: String(items.length), accent: T.orange },
    { label: 'Splitter sem andar',      value: String(nSplitter),    accent: T.primary },
    { label: 'Sem complemento',         value: String(nClient),      accent: T.sky },
  ])

  autoTable(doc, {
    startY: tableY,
    margin: { left: M, right: M },
    tableLineColor: T.border,
    tableLineWidth: 0.3,
    head: [['Cliente', 'Usuario PPPoE', 'Splitter Atual', 'Complemento', 'Pendencia']],
    body: items.map((p) => [
      p.client.name,
      p.client.pppoeUser,
      splitterLabel(p.currentSplitter.title),
      p.client.complement || '-',
      p.pendingReason === 'splitter_sem_andar' ? 'Splitter sem andar' : 'Sem complemento',
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: T.inkMid,
      lineColor: T.border,
      lineWidth: 0.25,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: T.inverse,
      textColor: T.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: T.surface },
    // 68 + 50 + 62 + 50 + 39 = 269 mm (área útil em paisagem)
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold', textColor: T.ink },
      1: { cellWidth: 50, textColor: T.muted, fontSize: 7.5 },
      2: { cellWidth: 62 },
      3: { cellWidth: 50 },
      4: { cellWidth: 39, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const r = items[data.row.index]?.pendingReason
        if (r === 'splitter_sem_andar') {
          data.cell.styles.textColor  = T.orange
          data.cell.styles.fillColor  = T.orangeBg
        } else {
          data.cell.styles.textColor  = T.sky
          data.cell.styles.fillColor  = T.skyBg
        }
      }
    },
    didDrawPage: addFooterHook(doc, 'Pendencias — ' + condoName),
  })

  doc.save(`pendencias_${sanitize(condoName)}_${now.toISOString().slice(0, 10)}.pdf`)
}

// ── CSV: Oportunidades ────────────────────────────────────────────────────────

export function exportOpportunitiesToCSV(
  condoName: string,
  opportunities: CondoRedistributionOpportunity[],
) {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const now = new Date()

  const header = [
    'Cliente', 'Usuario PPPoE', 'Complemento', 'Andar Cliente',
    'Splitter Atual', 'Andar Atual', 'Splitter Sugerido', 'Andar Sugerido',
    'Portas Livres', 'Ganho (andares)',
  ]

  const rows = opportunities.map((o) => [
    q(o.client.name),
    q(o.client.pppoeUser),
    q(o.client.complement || ''),
    q(floorLabel(o.client.floor)),
    q(splitterLabel(o.currentSplitter.title)),
    q(floorLabel(o.currentSplitter.floor)),
    q(splitterLabel(o.suggestedSplitter.title)),
    q(floorLabel(o.suggestedSplitter.floor)),
    String(o.suggestedSplitter.availablePorts),
    String(o.floorDifference.improvement),
  ])

  const meta = [
    `# Redistribuicao de Condominio - ${condoName}`,
    `# Gerado em: ${formatDate(now)}`,
    `# Total de clientes: ${opportunities.length}`,
    '',
  ]

  const csv = '﻿' + meta.join('\r\n') + header.join(';') + '\r\n' + rows.map((r) => r.join(';')).join('\r\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `redistribuicao_${sanitize(condoName)}_${now.toISOString().slice(0, 10)}.csv`)
}

// ── CSV: Pendências ───────────────────────────────────────────────────────────

export function exportPendingToCSV(
  condoName: string,
  items: PendingFloorInfoItem[],
) {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const now = new Date()

  const REASON: Record<string, string> = {
    splitter_sem_andar:       'Splitter sem andar cadastrado',
    cliente_sem_complemento:  'Cliente sem complemento de endereco',
  }

  const header = ['Cliente', 'Usuario PPPoE', 'Splitter Atual', 'Complemento', 'Motivo da Pendencia']

  const rows = items.map((p) => [
    q(p.client.name),
    q(p.client.pppoeUser),
    q(splitterLabel(p.currentSplitter.title)),
    q(p.client.complement || ''),
    q(REASON[p.pendingReason] ?? p.pendingReason),
  ])

  const meta = [
    `# Pendencias de Andar - ${condoName}`,
    `# Gerado em: ${formatDate(now)}`,
    `# Total de pendencias: ${items.length}`,
    '',
  ]

  const csv = '﻿' + meta.join('\r\n') + header.join(';') + '\r\n' + rows.map((r) => r.join(';')).join('\r\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `pendencias_${sanitize(condoName)}_${now.toISOString().slice(0, 10)}.csv`)
}

// ── EXPORTAÇÃO GLOBAL (todos os condomínios) ──────────────────────────────────

/** Agrupa oportunidades por condomínio mantendo a ordem original. */
function groupByCondoName(opportunities: CondoRedistributionOpportunity[]) {
  const map = new Map<string, CondoRedistributionOpportunity[]>()
  for (const o of opportunities) {
    if (!map.has(o.condoName)) map.set(o.condoName, [])
    map.get(o.condoName)!.push(o)
  }
  return [...map.entries()]
}

// ── PDF: Todas as oportunidades ───────────────────────────────────────────────

export function exportAllOpportunitiesToPDF(
  opportunities: CondoRedistributionOpportunity[],
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const now = new Date()
  const M = 14
  const W = doc.internal.pageSize.getWidth()

  const groups = groupByCondoName(opportunities)
  const splitterSet = new Set([
    ...opportunities.map((o) => o.currentSplitter.code),
    ...opportunities.map((o) => o.suggestedSplitter.code),
  ])
  const maxGain = Math.max(...opportunities.map((o) => o.floorDifference.improvement))

  // ── Capa / sumário ──────────────────────────────────────────────────────────
  drawHeader(doc, {
    title: 'Redistribuicao de Condominio',
    subtitle: `Relatorio completo — ${groups.length} condominio${groups.length !== 1 ? 's' : ''}`,
    tag: 'EXPORTACAO COMPLETA — TODAS AS OPORTUNIDADES',
    date: formatDate(now),
  })

  // Stats globais
  let nextY = drawStatCards(doc, 34, [
    { label: 'Total de clientes',      value: String(opportunities.length), accent: T.primary },
    { label: 'Condominios',            value: String(groups.length),        accent: T.sky     },
    { label: 'Splitters envolvidos',   value: String(splitterSet.size),     accent: T.muted   },
    { label: 'Maior ganho (andares)',  value: `+${maxGain}`,                accent: T.emerald },
  ])

  // Índice de condomínios
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...T.ink)
  doc.text('CONDOMINIOS INCLUIDOS NESTE RELATORIO', M, nextY + 2)
  nextY += 7

  const colW = (W - M * 2 - 6) / 2
  groups.forEach(([name, opps], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + col * (colW + 6)
    const y = nextY + row * 6

    // Nova página se necessário
    if (y > doc.internal.pageSize.getHeight() - 20) return

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...T.inkMid)
    doc.text(`${i + 1}. ${name}  (${opps.length} cliente${opps.length !== 1 ? 's' : ''})`, x, y)
  })

  // ── Uma seção por condomínio ────────────────────────────────────────────────
  groups.forEach(([condoName, opps]) => {
    doc.addPage()

    drawHeader(doc, {
      title: 'Redistribuicao de Condominio',
      subtitle: condoName,
      tag: 'OPORTUNIDADES DE REDISTRIBUICAO',
      date: formatDate(now),
    })

    const tableY = drawStatCards(doc, 34, [
      { label: 'Clientes',           value: String(opps.length), accent: T.primary },
      { label: 'Splitters',          value: String(new Set([...opps.map(o => o.currentSplitter.code), ...opps.map(o => o.suggestedSplitter.code)]).size), accent: T.sky },
      { label: 'Maior ganho',        value: `+${Math.max(...opps.map(o => o.floorDifference.improvement))}`, accent: T.emerald },
    ])

    autoTable(doc, {
      startY: tableY,
      margin: { left: M, right: M },
      tableLineColor: T.border,
      tableLineWidth: 0.3,
      head: [['Cliente', 'Usuario PPPoE', 'Complemento', 'Andar', 'Splitter Atual', 'And. Atual', 'Splitter Sugerido', 'And. Sug.', 'Ganho']],
      body: opps.map((o) => [
        o.client.name,
        o.client.pppoeUser,
        o.client.complement || '-',
        floorLabel(o.client.floor),
        splitterLabel(o.currentSplitter.title),
        floorLabel(o.currentSplitter.floor),
        splitterLabel(o.suggestedSplitter.title),
        floorLabel(o.suggestedSplitter.floor),
        `+${o.floorDifference.improvement}`,
      ]),
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: T.inkMid, lineColor: T.border, lineWidth: 0.25, overflow: 'linebreak' },
      headStyles: { fillColor: T.inverse, textColor: T.white, fontStyle: 'bold', fontSize: 7, cellPadding: { top: 4, bottom: 4, left: 3, right: 3 } },
      alternateRowStyles: { fillColor: T.surface },
      columnStyles: {
        0: { cellWidth: 36, fontStyle: 'bold', textColor: T.ink },
        1: { cellWidth: 30, textColor: T.muted, fontSize: 7 },
        2: { cellWidth: 26, fontSize: 7 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 36 },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 36 },
        7: { cellWidth: 15, halign: 'center' },
        8: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          const v = opps[data.row.index]?.floorDifference.improvement ?? 0
          if (v >= 5)      { data.cell.styles.textColor = T.emerald;    data.cell.styles.fillColor = T.emeraldBg  }
          else if (v >= 3) { data.cell.styles.textColor = T.primaryDark; data.cell.styles.fillColor = T.primaryBg }
          else             { data.cell.styles.textColor = T.sky;         data.cell.styles.fillColor = T.skyBg     }
        }
      },
      didDrawPage: addFooterHook(doc, condoName),
    })
  })

  doc.save(`redistribuicao_completo_${now.toISOString().slice(0, 10)}.pdf`)
}

// ── CSV: Todas as oportunidades ───────────────────────────────────────────────

export function exportAllOpportunitiesToCSV(
  opportunities: CondoRedistributionOpportunity[],
) {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const now = new Date()

  const header = [
    'Condominio', 'Cliente', 'Usuario PPPoE', 'Complemento', 'Andar Cliente',
    'Splitter Atual', 'Andar Atual', 'Splitter Sugerido', 'Andar Sugerido',
    'Portas Livres', 'Ganho (andares)',
  ]

  const rows = opportunities.map((o) => [
    q(o.condoName),
    q(o.client.name),
    q(o.client.pppoeUser),
    q(o.client.complement || ''),
    q(floorLabel(o.client.floor)),
    q(splitterLabel(o.currentSplitter.title)),
    q(floorLabel(o.currentSplitter.floor)),
    q(splitterLabel(o.suggestedSplitter.title)),
    q(floorLabel(o.suggestedSplitter.floor)),
    String(o.suggestedSplitter.availablePorts),
    String(o.floorDifference.improvement),
  ])

  const meta = [
    `# Redistribuicao de Condominio — Exportacao Completa`,
    `# Gerado em: ${formatDate(now)}`,
    `# Total de clientes: ${opportunities.length}`,
    '',
  ]

  const csv = '﻿' + meta.join('\r\n') + header.join(';') + '\r\n' + rows.map((r) => r.join(';')).join('\r\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `redistribuicao_completo_${now.toISOString().slice(0, 10)}.csv`)
}

// ── PDF: Todas as pendências ──────────────────────────────────────────────────

export function exportAllPendingToPDF(items: PendingFloorInfoItem[]) {
  // Paisagem: 297mm - 28mm margens = 269mm úteis para 6 colunas
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const now = new Date()
  const M = 14

  const nSplitter = items.filter((i) => i.pendingReason === 'splitter_sem_andar').length
  const nClient   = items.filter((i) => i.pendingReason === 'cliente_sem_complemento').length
  const condos    = new Set(items.map((i) => i.condoName)).size

  drawHeader(doc, {
    title: 'Pendencias de Informacao de Andar',
    subtitle: `Relatorio completo — ${condos} condominio${condos !== 1 ? 's' : ''}`,
    tag: 'EXPORTACAO COMPLETA — TODAS AS PENDENCIAS',
    date: formatDate(now),
    accent: T.orange,
  })

  const tableY = drawStatCards(doc, 34, [
    { label: 'Total de pendencias',    value: String(items.length), accent: T.orange  },
    { label: 'Splitter sem andar',     value: String(nSplitter),    accent: T.primary },
    { label: 'Sem complemento',        value: String(nClient),      accent: T.sky     },
  ])

  autoTable(doc, {
    startY: tableY,
    margin: { left: M, right: M },
    tableLineColor: T.border,
    tableLineWidth: 0.3,
    head: [['Condominio', 'Cliente', 'Usuario PPPoE', 'Splitter Atual', 'Complemento', 'Pendencia']],
    body: items.map((p) => [
      p.condoName,
      p.client.name,
      p.client.pppoeUser,
      splitterLabel(p.currentSplitter.title),
      p.client.complement || '-',
      p.pendingReason === 'splitter_sem_andar' ? 'Splitter sem andar' : 'Sem complemento',
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: T.inkMid,
      lineColor: T.border,
      lineWidth: 0.25,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: T.inverse,
      textColor: T.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: T.surface },
    // 48 + 58 + 44 + 56 + 38 + 25 = 269 mm (área útil em paisagem)
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', textColor: T.ink, fontSize: 7 },
      1: { cellWidth: 58 },
      2: { cellWidth: 44, textColor: T.muted, fontSize: 7 },
      3: { cellWidth: 56 },
      4: { cellWidth: 38 },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const r = items[data.row.index]?.pendingReason
        if (r === 'splitter_sem_andar') { data.cell.styles.textColor = T.orange; data.cell.styles.fillColor = T.orangeBg }
        else                            { data.cell.styles.textColor = T.sky;    data.cell.styles.fillColor = T.skyBg    }
      }
    },
    didDrawPage: addFooterHook(doc, 'Pendencias — Relatorio Completo'),
  })

  doc.save(`pendencias_completo_${now.toISOString().slice(0, 10)}.pdf`)
}

// ── CSV: Todas as pendências ──────────────────────────────────────────────────

export function exportAllPendingToCSV(items: PendingFloorInfoItem[]) {
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const now = new Date()

  const REASON: Record<string, string> = {
    splitter_sem_andar:      'Splitter sem andar cadastrado',
    cliente_sem_complemento: 'Cliente sem complemento de endereco',
  }

  const header = ['Condominio', 'Cliente', 'Usuario PPPoE', 'Splitter Atual', 'Complemento', 'Motivo da Pendencia']

  const rows = items.map((p) => [
    q(p.condoName),
    q(p.client.name),
    q(p.client.pppoeUser),
    q(splitterLabel(p.currentSplitter.title)),
    q(p.client.complement || ''),
    q(REASON[p.pendingReason] ?? p.pendingReason),
  ])

  const meta = [
    `# Pendencias de Andar — Exportacao Completa`,
    `# Gerado em: ${formatDate(now)}`,
    `# Total de pendencias: ${items.length}`,
    '',
  ]

  const csv = '﻿' + meta.join('\r\n') + header.join(';') + '\r\n' + rows.map((r) => r.join(';')).join('\r\n')
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `pendencias_completo_${now.toISOString().slice(0, 10)}.csv`)
}
