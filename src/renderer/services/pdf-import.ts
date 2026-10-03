import * as pdfjs from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'

export const PDF_PAGE_LIMIT = 60
const TARGET_LONG_EDGE = 2480

let workerStarted = false
function ensureWorker(): void {
  if (workerStarted) return
  pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
  workerStarted = true
}

export function pdfErrorMessage(error: unknown): string | null {
  const name = (error as { name?: string })?.name ?? ''
  if (name === 'PasswordException') return 'PDF 已加密，暂不支持导入。'
  if (name === 'InvalidPDFException') return 'PDF 文件损坏或格式无效。'
  return null
}

export async function renderPdfPages(
  bytes: Uint8Array,
  onProgress: (index: number, total: number) => void,
): Promise<{ dataUrls: string[]; truncated: boolean }> {
  ensureWorker()
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const doc = await task.promise
  try {
    const total = doc.numPages
    const limit = Math.min(total, PDF_PAGE_LIMIT)
    const dataUrls: string[] = []
    for (let index = 1; index <= limit; index += 1) {
      onProgress(index, total)
      const page = await doc.getPage(index)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.max(1, Math.min(4, TARGET_LONG_EDGE / Math.max(base.width, base.height)))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建画布。')
      await page.render({ canvas, canvasContext: context, viewport }).promise
      dataUrls.push(canvas.toDataURL('image/jpeg', 0.9))
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
    }
    return { dataUrls, truncated: total > limit }
  } finally {
    doc.cleanup()
    await task.destroy()
  }
}
