import sharp from 'sharp'
import log from 'electron-log/main'
import type { CropRequest, CropResultSet } from '@shared/types'
import { aiErase } from './api-client'
import { processCrops, getResultSet, storeResultSet, type StoredCrop } from './image-service'

const MAX_BASE64_SIZE = 9 * 1024 * 1024
interface Placement {
  left: number
  top: number
  width: number
  height: number
}

export async function eraseHandwriting(request: CropRequest): Promise<CropResultSet> {
  const rawSet = await processCrops({
    revision: request.revision,
    images: request.images,
    processing: { enhance: false, enhanceStrength: 0 },
  })
  const crops = getResultSet(rawSet.resultSetId)
  if (!crops.length) throw new Error('没有可用于去手写的错题。')
  const { buffer, placements, width, height } = await compose(crops)
  const encoded = await encodeForApi(buffer)
  const result = await aiErase(encoded)
  log.info('AI erase succeeded', { requestId: result.requestId, traceId: result.traceId })
  const image = result.imageBase64
  const erasedBuffer = Buffer.from(
    image.includes(',') ? image.slice(image.indexOf(',') + 1) : image,
    'base64',
  )
  const meta = await sharp(erasedBuffer).metadata()
  if (!meta.width || !meta.height) throw new Error('无法解析服务器返回的图片。')
  const sx = meta.width / width
  const sy = meta.height / height
  if (Math.abs(sx - sy) > Math.max(sx, sy) * 0.03)
    throw new Error('接口返回图片比例发生变化，无法安全拆分。')
  const results: StoredCrop[] = []
  for (let index = 0; index < placements.length; index += 1) {
    const p = placements[index]
    const source = crops[index]
    if (!p || !source) continue
    const left = Math.max(0, Math.round(p.left * sx))
    const top = Math.max(0, Math.round(p.top * sy))
    const cropWidth = Math.min(meta.width - left, Math.max(1, Math.round(p.width * sx)))
    const cropHeight = Math.min(meta.height - top, Math.max(1, Math.round(p.height * sy)))
    let pipeline = sharp(erasedBuffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize(source.width, source.height)
    if (request.processing.enhance)
      pipeline = pipeline.sharpen({
        sigma: 0.35 + (request.processing.enhanceStrength / 100) * 0.85,
      })
    const output = await pipeline.png().toBuffer()
    results.push({ ...source, buffer: output })
  }
  return storeResultSet(request.revision, results, true)
}

async function compose(
  crops: StoredCrop[],
): Promise<{ buffer: Buffer; placements: Placement[]; width: number; height: number }> {
  const gap = 32
  const maxWidth = Math.max(...crops.map((crop) => crop.width))
  const area = crops.reduce((sum, crop) => sum + (crop.width + gap) * (crop.height + gap), 0)
  const targetWidth = Math.max(maxWidth + gap * 2, Math.floor(Math.sqrt(area * 1.35)))
  const placements: Placement[] = []
  let x = gap
  let y = gap
  let rowHeight = 0
  let usedWidth = 1
  for (const crop of crops) {
    if (x > gap && x + crop.width + gap > targetWidth) {
      x = gap
      y += rowHeight + gap
      rowHeight = 0
    }
    placements.push({ left: x, top: y, width: crop.width, height: crop.height })
    x += crop.width + gap
    rowHeight = Math.max(rowHeight, crop.height)
    usedWidth = Math.max(usedWidth, x)
  }
  const height = Math.max(1, y + rowHeight + gap)
  const buffer = await sharp({
    create: { width: usedWidth, height, channels: 3, background: '#ffffff' },
  })
    .composite(
      crops.map((crop, i) => ({
        input: crop.buffer,
        left: placements[i]?.left ?? 0,
        top: placements[i]?.top ?? 0,
      })),
    )
    .jpeg({ quality: 92 })
    .toBuffer()
  return { buffer, placements, width: usedWidth, height }
}

async function encodeForApi(input: Buffer): Promise<string> {
  let work = sharp(input)
  let scale = 1
  for (let pass = 0; pass < 6; pass += 1) {
    for (const quality of [92, 85, 75, 65]) {
      const buffer = await work.jpeg({ quality }).toBuffer()
      const encoded = buffer.toString('base64')
      if (encoded.length <= MAX_BASE64_SIZE) return encoded
    }
    scale *= 0.72
    const meta = await sharp(input).metadata()
    work = sharp(input).resize({ width: Math.max(320, Math.round((meta.width ?? 1000) * scale)) })
  }
  throw new Error('合并图片压缩后仍超过接口限制，请减少本次错题数量。')
}
