import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, dialog, type WebContents } from 'electron'
import sharp, { type OverlayOptions } from 'sharp'
import type { ErrorType, LayoutSettings, PagePreview, PaperSize } from '@shared/types'
import { THERMAL_SIZES } from '@shared/types'
import { getResultSet, toDataUrl } from './image-service'

const PX_PER_MM = 300 / 25.4
export const PAPER_SIZES: Record<PaperSize, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  B5: { widthMm: 182, heightMm: 257 },
}

interface PlacedItem {
  index: number
  width: number
  height: number
  top: number
}
interface PageColumn {
  used: number
  items: PlacedItem[]
}

export interface LayoutCrop {
  width: number
  height: number
  buffer: Buffer
}

export async function composePages(
  crops: LayoutCrop[],
  layout: LayoutSettings,
): Promise<{ buffers: Buffer[]; preview: PagePreview }> {
  const paper = PAPER_SIZES[layout.paper]
  const pageWidth = Math.round(paper.widthMm * PX_PER_MM)
  const pageHeight = Math.round(paper.heightMm * PX_PER_MM)
  const columns = chooseColumns(
    crops.map(({ width, height }) => ({ width, height })),
    layout.mode,
  )
  const margin = Math.round(layout.marginMm * PX_PER_MM)
  const gap = Math.round(layout.gapMm * PX_PER_MM)
  const columnWidth = (pageWidth - margin * 2 - (columns - 1) * gap) / columns
  const contentHeight = pageHeight - margin * 2

  const sizes = crops.map((crop) => {
    const scale = Math.min(0.6, columnWidth / crop.width, contentHeight / crop.height)
    return {
      width: Math.max(1, Math.round(crop.width * scale)),
      height: Math.max(1, Math.round(crop.height * scale)),
      scale,
    }
  })
  const scalePercent = Math.round(Math.min(...sizes.map((size) => size.scale)) * 100)

  const pages: PageColumn[][] = [createPage(columns)]
  sizes.forEach((size, index) => {
    let page = pages[pages.length - 1]!
    let column = columnOrder(page).find((candidate) =>
      fits(page[candidate]!, size.height, gap, contentHeight),
    )
    if (column === undefined) {
      page = createPage(columns)
      pages.push(page)
      column = 0
    }
    const state = page[column]!
    const offset = state.items.length ? gap : 0
    state.items.push({
      index,
      width: size.width,
      height: size.height,
      top: margin + state.used + offset,
    })
    state.used += offset + size.height
  })

  const buffers: Buffer[] = []
  const thumbs: string[] = []
  for (const page of pages) {
    const overlays: OverlayOptions[] = []
    for (let column = 0; column < columns; column += 1) {
      for (const item of page[column]!.items) {
        const left = Math.round(margin + column * (columnWidth + gap))
        const resized = await sharp(crops[item.index]!.buffer)
          .resize(item.width, item.height)
          .png()
          .toBuffer()
        overlays.push({ input: resized, left, top: Math.round(item.top) })
      }
    }
    const buffer = await sharp({
      create: { width: pageWidth, height: pageHeight, channels: 3, background: '#ffffff' },
    })
      .composite(overlays)
      .png({ compressionLevel: 8 })
      .withMetadata({ density: 300 })
      .toBuffer()
    buffers.push(buffer)
    const thumb = await sharp(buffer)
      .resize({ height: 1000, withoutEnlargement: true })
      .jpeg({ quality: 84 })
      .toBuffer()
    thumbs.push(toDataUrl(thumb, 'image/jpeg'))
  }
  return {
    buffers,
    preview: { pages: thumbs, columns, scalePercent },
  }
}

export async function buildPage(
  resultSetId: string,
  layout: LayoutSettings,
): Promise<{ buffers: Buffer[]; preview: PagePreview }> {
  const crops = getResultSet(resultSetId)
  if (!crops.length) throw new Error('请先至少框选一道错题。')
  return composePages(crops, layout)
}

export const BOOK_NOTES: Record<ErrorType, string> = {
  马虎: '上次马虎做错，这次要仔细哦！',
  不会: '上次是不会，这次一定要做对哦！',
  概念不清: '上次概念没理清，这次先想清楚再下笔哦！',
  其他: '上次这道题没做好，这次认真再战哦！',
}

export async function applyBookNote(crop: LayoutCrop, note?: string): Promise<LayoutCrop> {
  if (!note) return crop
  const fontSize = Math.max(24, Math.min(72, Math.round(crop.width * 0.035)))
  const pad = Math.round(fontSize * 0.5)
  const stripHeight = fontSize + pad * 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.width}" height="${stripHeight}">` +
    `<text x="${pad}" y="${pad + fontSize}" font-family="sans-serif" font-size="${fontSize}" fill="#c2410c">${escapeXml(note)}</text></svg>`
  const strip = await sharp(Buffer.from(svg)).png().toBuffer()
  const buffer = await sharp({
    create: {
      width: crop.width,
      height: crop.height + stripHeight,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([
      { input: crop.buffer, top: 0, left: 0 },
      { input: strip, top: crop.height, left: 0 },
    ])
    .png()
    .toBuffer()
  return { width: crop.width, height: crop.height + stripHeight, buffer }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function composeThermalPages(
  crops: LayoutCrop[],
  size: { widthMm: number; heightMm: number },
  marginMm = 2,
): Promise<{ buffers: Buffer[]; preview: PagePreview }> {
  const pageWidth = Math.round(size.widthMm * PX_PER_MM)
  const pageHeight = Math.round(size.heightMm * PX_PER_MM)
  const margin = Math.round(marginMm * PX_PER_MM)
  const availWidth = pageWidth - margin * 2
  const availHeight = pageHeight - margin * 2
  const buffers: Buffer[] = []
  const thumbs: string[] = []
  let minScale = 1
  for (const crop of crops) {
    const scale = Math.min(1, availWidth / crop.width, availHeight / crop.height)
    minScale = Math.min(minScale, scale)
    const width = Math.max(1, Math.round(crop.width * scale))
    const height = Math.max(1, Math.round(crop.height * scale))
    const resized = await sharp(crop.buffer).resize(width, height).png().toBuffer()
    const buffer = await sharp({
      create: { width: pageWidth, height: pageHeight, channels: 3, background: '#ffffff' },
    })
      .composite([
        {
          input: resized,
          left: margin,
          top: margin,
        },
      ])
      .png({ compressionLevel: 8 })
      .withMetadata({ density: 300 })
      .toBuffer()
    buffers.push(buffer)
    const thumb = await sharp(buffer)
      .resize({ height: 1000, withoutEnlargement: true })
      .jpeg({ quality: 84 })
      .toBuffer()
    thumbs.push(toDataUrl(thumb, 'image/jpeg'))
  }
  return {
    buffers,
    preview: { pages: thumbs, columns: 1, scalePercent: Math.round(minScale * 100) },
  }
}

export function thermalSizeById(id: string): { widthMm: number; heightMm: number } {
  return THERMAL_SIZES.find((size) => size.id === id) ?? THERMAL_SIZES[2]!
}

export async function printBuffers(
  parent: BrowserWindow | null,
  buffers: Buffer[],
  size: { widthMm: number; heightMm: number },
  deviceName?: string,
): Promise<boolean> {
  const pageSizeCss = `${size.widthMm}mm ${size.heightMm}mm`
  const dir = await mkdtemp(join(tmpdir(), 'wrong-question-print-'))
  const sources: string[] = []
  for (let index = 0; index < buffers.length; index += 1) {
    const file = join(dir, `page-${index + 1}.png`)
    await writeFile(file, buffers[index]!)
    sources.push(pathToFileURL(file).href)
  }
  const images = sources.map((src) => `<img src="${src}">`).join('')
  const html =
    `<title>错题打印</title>` +
    `<style>@page{size:${pageSizeCss};margin:0}html,body{margin:0}img{width:${size.widthMm}mm;height:${size.heightMm}mm;display:block;page-break-after:always}img:last-of-type{page-break-after:auto}</style>${images}`
  const pageSize = { width: size.widthMm * 1000, height: size.heightMm * 1000 }
  return printHtml(parent, html, dir, pageSize, deviceName)
}

const THERMAL_PRINTER_PATTERN =
  /thermal|热敏|pos|58\s?mm|80\s?mm|xp-|xprinter|hprt|zijiang|gainscha|corex|rp-\d|gp-\d/i
export function resolveThermalPrinter(
  printers: Array<{ name: string; displayName: string }>,
  configured: string,
): string | undefined {
  if (configured) {
    const match = printers.find(
      (printer) => printer.name === configured || printer.displayName === configured,
    )
    if (match) return match.name
  }
  return printers.find((printer) =>
    THERMAL_PRINTER_PATTERN.test(`${printer.name} ${printer.displayName}`),
  )?.name
}

export async function savePage(
  parent: BrowserWindow | null,
  resultSetId: string,
  layout: LayoutSettings,
): Promise<string | null> {
  const { buffers } = await buildPage(resultSetId, layout)
  return saveBuffers(parent, buffers, layout.paper)
}

export async function saveBuffers(
  parent: BrowserWindow | null,
  buffers: Buffer[],
  label: string,
): Promise<string | null> {
  const options = {
    title: `保存 ${label} 错题图片`,
    defaultPath: `错题打印_${label}.png`,
    filters: [
      { name: 'PNG 图片', extensions: ['png'] },
      { name: 'JPEG 图片', extensions: ['jpg', 'jpeg'] },
    ],
  }
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  const filePath = result.filePath
  const isJpeg = /\.jpe?g$/i.test(filePath)
  const write = async (target: string, source: Buffer): Promise<void> => {
    const output = isJpeg
      ? await sharp(source).jpeg({ quality: 95 }).withMetadata({ density: 300 }).toBuffer()
      : source
    const { writeFile } = await import('node:fs/promises')
    await writeFile(target, output)
  }
  if (buffers.length === 1) {
    await write(filePath, buffers[0]!)
    return filePath
  }
  const dot = filePath.lastIndexOf('.')
  const stem = dot > 0 ? filePath.slice(0, dot) : filePath
  const extension = dot > 0 ? filePath.slice(dot) : '.png'
  for (let index = 0; index < buffers.length; index += 1) {
    await write(`${stem}-${index + 1}${extension}`, buffers[index]!)
  }
  return `${stem}-1${extension}`
}

export async function printPage(
  parent: BrowserWindow | null,
  resultSetId: string,
  layout: LayoutSettings,
): Promise<boolean> {
  const { buffers } = await buildPage(resultSetId, layout)
  return printBuffers(parent, buffers, PAPER_SIZES[layout.paper])
}

export async function printHtml(
  parent: BrowserWindow | null,
  html: string,
  existingDir?: string,
  pageSize: NonNullable<Parameters<WebContents['print']>[0]>['pageSize'] = 'A4',
  deviceName?: string,
): Promise<boolean> {
  const window = new BrowserWindow({
    ...(parent ? { parent } : {}),
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  const dir = existingDir ?? (await mkdtemp(join(tmpdir(), 'wrong-question-print-')))
  const cleanup = (): Promise<void> => rm(dir, { recursive: true, force: true })
  try {
    await writeFile(join(dir, 'print.html'), html, 'utf8')
    await window.loadFile(join(dir, 'print.html'))
    await waitForImages(window)
  } catch (error) {
    window.destroy()
    await cleanup()
    throw error
  }
  return new Promise((resolve) => {
    window.webContents.print(
      {
        silent: Boolean(deviceName),
        ...(deviceName ? { deviceName } : {}),
        printBackground: true,
        pageSize,
        margins: { marginType: 'none' },
      },
      (success) => {
        window.destroy()
        void cleanup()
        resolve(success)
      },
    )
  })
}

function waitForImages(window: BrowserWindow): Promise<unknown> {
  return window.webContents.executeJavaScript(
    `new Promise((resolve) => {
      const images = Array.from(document.images)
      let pending = images.length
      if (!pending) return resolve(true)
      const done = () => {
        pending -= 1
        if (pending <= 0) resolve(true)
      }
      for (const image of images) {
        if (image.complete) done()
        else {
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
        }
      }
    })`,
  )
}

function createPage(columns: number): PageColumn[] {
  return Array.from({ length: columns }, () => ({ used: 0, items: [] }))
}
function columnOrder(page: PageColumn[]): number[] {
  if (page.length === 1) return [0]
  return page[0]!.used <= page[1]!.used ? [0, 1] : [1, 0]
}
function fits(column: PageColumn, height: number, gap: number, contentHeight: number): boolean {
  return column.used + (column.items.length ? gap : 0) + height <= contentHeight
}
function chooseColumns(
  crops: Array<{ width: number; height: number }>,
  mode: LayoutSettings['mode'],
): number {
  if (mode === 'single') return 1
  if (mode === 'double') return 2
  const ratios = crops.map((crop) => crop.width / Math.max(1, crop.height)).sort((a, b) => a - b)
  return crops.length >= 4 && (ratios[Math.floor(ratios.length / 2)] ?? 2) < 1.35 ? 2 : 1
}
