import type { PaperSize } from '@shared/types'

export interface TemplateItem {
  imageDataUrl: string
  width: number
  height: number
  dateText: string
  sourceText: string
}
export interface TemplateDefinition {
  id: string
  name: string
  description: string
  paper: PaperSize
  cardsPerPage: number
  buildPages(items: TemplateItem[]): string[]
}

interface TemplateOptions {
  cardsPerPage: number
  paper: PaperSize
  ruled?: boolean
}

const PAGE_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 2480, height: 3508 },
  B5: { width: 2150, height: 3035 },
}
const STARS = '☆☆☆☆☆'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cardSvg(
  item: TemplateItem,
  x: number,
  y: number,
  w: number,
  h: number,
  ruled: boolean,
): string {
  const row1 = Math.max(48, Math.min(70, Math.round(h * 0.085)))
  const row2 = row1
  const row3 = Math.max(44, Math.min(64, Math.round(h * 0.08)))
  const mainH = h - row1 - row2 - row3
  const leftW = Math.round(w * 0.55)
  const halfW = Math.round(w / 2)
  const fs = Math.max(22, Math.min(34, Math.round(h * 0.042)))
  const stroke = '#8a8f98'
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="2"/>`,
    `<line x1="${x}" y1="${y + row1}" x2="${x + w}" y2="${y + row1}" stroke="${stroke}" stroke-width="2"/>`,
    `<line x1="${x}" y1="${y + row1 + row2}" x2="${x + w}" y2="${y + row1 + row2}" stroke="${stroke}" stroke-width="2"/>`,
    `<line x1="${x}" y1="${y + h - row3}" x2="${x + w}" y2="${y + h - row3}" stroke="${stroke}" stroke-width="2"/>`,
    `<line x1="${x + leftW}" y1="${y}" x2="${x + leftW}" y2="${y + row1 + row2}" stroke="${stroke}" stroke-width="2"/>`,
    `<line x1="${x + halfW}" y1="${y + row1 + row2}" x2="${x + halfW}" y2="${y + h - row3}" stroke="${stroke}" stroke-width="2"/>`,
    `<text x="${x + 16}" y="${y + Math.round(row1 * 0.68)}" font-size="${fs}" font-family="sans-serif" fill="#111">日期: ${escapeXml(item.dateText)}　来源: ${escapeXml(item.sourceText)}</text>`,
    `<text x="${x + leftW + 16}" y="${y + Math.round(row1 * 0.68)}" font-size="${fs}" font-family="sans-serif" fill="#111">知识点:</text>`,
    `<text x="${x + 16}" y="${y + row1 + Math.round(row2 * 0.68)}" font-size="${fs}" font-family="sans-serif" fill="#111">重要程度: ${STARS}</text>`,
    `<text x="${x + 16}" y="${y + row1 + row2 + fs + 14}" font-size="${fs}" font-weight="600" font-family="sans-serif" fill="#111">题目&amp;错解</text>`,
    `<text x="${x + halfW + 16}" y="${y + row1 + row2 + fs + 14}" font-size="${fs}" font-weight="600" font-family="sans-serif" fill="#111">正解&amp;解析</text>`,
    `<text x="${x + 16}" y="${y + h - Math.round(row3 * 0.32)}" font-size="${Math.round(fs * 0.9)}" font-family="sans-serif" fill="#111">第一次复习: ${STARS}</text>`,
    `<text x="${x + Math.round(w * 0.38)}" y="${y + h - Math.round(row3 * 0.32)}" font-size="${Math.round(fs * 0.9)}" font-family="sans-serif" fill="#111">第二次复习: ${STARS}</text>`,
    `<text x="${x + Math.round(w * 0.7)}" y="${y + h - Math.round(row3 * 0.32)}" font-size="${Math.round(fs * 0.9)}" font-family="sans-serif" fill="#111">第三次复习: ${STARS}</text>`,
  ]
  if (ruled) {
    const lineTop = y + row1 + row2 + fs + 30
    const lineBottom = y + h - row3 - 16
    const step = 64
    for (let ly = lineTop + step; ly < lineBottom; ly += step) {
      parts.push(
        `<line x1="${x + halfW + 16}" y1="${ly}" x2="${x + w - 16}" y2="${ly}" stroke="#c8ccd2" stroke-width="1.5"/>`,
      )
    }
  }
  if (item.imageDataUrl && item.width > 0 && item.height > 0) {
    const cellX = x + 16
    const cellY = y + row1 + row2 + fs + 30
    const cellW = halfW - 32
    const cellH = mainH - fs - 46
    const scale = Math.min(cellW / item.width, cellH / item.height)
    const iw = Math.round(item.width * scale)
    const ih = Math.round(item.height * scale)
    parts.push(
      `<image x="${cellX}" y="${cellY}" width="${iw}" height="${ih}" href="${item.imageDataUrl}"/>`,
    )
  }
  return parts.join('')
}

function buildTemplate(options: TemplateOptions) {
  return (items: TemplateItem[]): string[] => {
    const base = PAGE_SIZES[options.paper]
    const cols = 1
    const rows = options.cardsPerPage
    const width = base.width
    const height = base.height
    const margin = 142
    const gap = 70
    const cardW = Math.round((width - margin * 2 - gap * (cols - 1)) / cols)
    const cardH = Math.round((height - margin * 2 - gap * (rows - 1)) / rows)
    const result: string[] = []
    const total = Math.max(items.length, 1)
    for (let page = 0; page < Math.ceil(total / options.cardsPerPage); page += 1) {
      const cards: string[] = []
      for (let slot = 0; slot < options.cardsPerPage; slot += 1) {
        const item = items[page * options.cardsPerPage + slot]
        const col = slot % cols
        const row = Math.floor(slot / cols)
        const x = margin + col * (cardW + gap)
        const y = margin + row * (cardH + gap)
        cards.push(cardSvg(item ?? emptyItem(), x, y, cardW, cardH, options.ruled ?? false))
      }
      result.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
          `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
          cards.join('') +
          `</svg>`,
      )
    }
    return result
  }
}

function emptyItem(): TemplateItem {
  return { imageDataUrl: '', width: 0, height: 0, dateText: '　　/　　/　　', sourceText: '' }
}

export const templates: TemplateDefinition[] = [
  {
    id: 'cuotiben-1up',
    name: 'A4 单卡',
    description: 'A4 竖版整页一卡，书写空间最大。',
    paper: 'A4',
    cardsPerPage: 1,
    buildPages: buildTemplate({ cardsPerPage: 1, paper: 'A4', ruled: true }),
  },
  {
    id: 'cuotiben-2up',
    name: 'A4 双卡',
    description: 'A4 竖版两卡，左图右解析，经典版式。',
    paper: 'A4',
    cardsPerPage: 2,
    buildPages: buildTemplate({ cardsPerPage: 2, paper: 'A4' }),
  },
  {
    id: 'cuotiben-3up',
    name: 'A4 三卡',
    description: 'A4 竖版三卡，省纸紧凑版式。',
    paper: 'A4',
    cardsPerPage: 3,
    buildPages: buildTemplate({ cardsPerPage: 3, paper: 'A4' }),
  },
  {
    id: 'cuotiben-4up',
    name: 'A4 四卡',
    description: 'A4 竖版四卡，适合小尺寸错题速览。',
    paper: 'A4',
    cardsPerPage: 4,
    buildPages: buildTemplate({ cardsPerPage: 4, paper: 'A4' }),
  },
  {
    id: 'cuotiben-b5-1up',
    name: 'B5 单卡',
    description: 'B5 竖版整页一卡，书写空间最大。',
    paper: 'B5',
    cardsPerPage: 1,
    buildPages: buildTemplate({ cardsPerPage: 1, paper: 'B5', ruled: true }),
  },
  {
    id: 'cuotiben-b5-2up',
    name: 'B5 双卡',
    description: 'B5 竖版两卡，左图右解析，经典版式。',
    paper: 'B5',
    cardsPerPage: 2,
    buildPages: buildTemplate({ cardsPerPage: 2, paper: 'B5' }),
  },
  {
    id: 'cuotiben-b5-3up',
    name: 'B5 三卡',
    description: 'B5 竖版三卡，省纸紧凑版式。',
    paper: 'B5',
    cardsPerPage: 3,
    buildPages: buildTemplate({ cardsPerPage: 3, paper: 'B5' }),
  },
  {
    id: 'cuotiben-b5-4up',
    name: 'B5 四卡',
    description: 'B5 竖版四卡，适合小尺寸错题速览。',
    paper: 'B5',
    cardsPerPage: 4,
    buildPages: buildTemplate({ cardsPerPage: 4, paper: 'B5' }),
  },
]

export function templateById(id: string): TemplateDefinition {
  return templates.find((template) => template.id === id) ?? templates[1]!
}

export interface AnalogyQuestion {
  stem: string
  options: string[]
  answer: string
  analysis: string
  difficulty: number
}

interface AnalogyLine {
  text: string
  bold?: boolean
}

function wrapAnalogyText(text: string, chars: number): string[] {
  const lines: string[] = []
  for (const paragraph of String(text ?? '').split('\n')) {
    let rest = paragraph
    while (rest.length > chars) {
      lines.push(rest.slice(0, chars))
      rest = rest.slice(chars)
    }
    lines.push(rest)
  }
  return lines
}

function analogyBlockSvg(
  q: AnalogyQuestion,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const pad = 44
  const headH = 110
  const bodyFs = 40
  const lh = 62
  const chars = Math.max(10, Math.floor((w - pad * 2) / bodyFs))
  const difficulty = Math.min(3, Math.max(1, Math.round(q.difficulty || 1)))
  const stars = '★'.repeat(difficulty) + '☆'.repeat(3 - difficulty)
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="#8a8f98" stroke-width="2"/>`,
    `<text x="${x + pad}" y="${y + 72}" font-size="46" font-weight="700" font-family="sans-serif" fill="#111">同类练习${index + 1}</text>`,
    `<text x="${x + w - pad}" y="${y + 72}" font-size="40" text-anchor="end" font-family="sans-serif" fill="#666">难度 ${stars}</text>`,
    `<line x1="${x + pad}" y1="${y + headH}" x2="${x + w - pad}" y2="${y + headH}" stroke="#c8ccd2" stroke-width="2"/>`,
  ]
  const lines: AnalogyLine[] = []
  wrapAnalogyText(q.stem, chars).forEach((text) => lines.push({ text }))
  ;(q.options ?? []).forEach((option, i) => {
    wrapAnalogyText(`${String.fromCharCode(65 + i)}. ${option}`, chars).forEach((text) =>
      lines.push({ text }),
    )
  })
  if (q.answer) {
    lines.push({ text: '' })
    wrapAnalogyText(`答案：${q.answer}`, chars).forEach((text, i) =>
      lines.push({ text, bold: i === 0 }),
    )
  }
  if (q.analysis) {
    lines.push({ text: '' })
    wrapAnalogyText(`解析：${q.analysis}`, chars).forEach((text, i) =>
      lines.push({ text, bold: i === 0 }),
    )
  }
  let cy = y + headH + 24 + bodyFs
  const maxCy = y + h - pad
  for (const line of lines) {
    if (cy > maxCy) break
    if (line.text) {
      parts.push(
        `<text x="${x + pad}" y="${cy}" font-size="${bodyFs}"${line.bold ? ' font-weight="700"' : ''} font-family="sans-serif" fill="#111">${escapeXml(line.text)}</text>`,
      )
    }
    cy += lh
  }
  return parts.join('')
}

export function buildAnalogyPages(questions: AnalogyQuestion[]): string[] {
  const base = PAGE_SIZES.B5
  const margin = 110
  const gap = 56
  const perPage = 2
  const blockW = base.width - margin * 2
  const blockH = Math.round((base.height - margin * 2 - gap * (perPage - 1)) / perPage)
  const pages: string[] = []
  const total = Math.max(questions.length, 1)
  for (let page = 0; page < Math.ceil(total / perPage); page += 1) {
    const blocks: string[] = []
    for (let slot = 0; slot < perPage; slot += 1) {
      const index = page * perPage + slot
      const question = questions[index]
      if (!question) continue
      blocks.push(
        analogyBlockSvg(question, index, margin, margin + slot * (blockH + gap), blockW, blockH),
      )
    }
    pages.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${base.width}" height="${base.height}" viewBox="0 0 ${base.width} ${base.height}">` +
        `<rect width="${base.width}" height="${base.height}" fill="#ffffff"/>` +
        blocks.join('') +
        `</svg>`,
    )
  }
  return pages
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
