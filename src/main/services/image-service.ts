import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import sharp from 'sharp'
import type { CropRequest, CropResultSet, ImportedImage, SelectionRegion } from '@shared/types'

interface SourceImage {
  path: string
  width: number
  height: number
}
export interface StoredCrop {
  id: string
  width: number
  height: number
  buffer: Buffer
}

const sources = new Map<string, SourceImage>()
const resultSets = new Map<string, StoredCrop[]>()

export async function registerImage(path: string): Promise<ImportedImage> {
  const metadata = await sharp(path, { failOn: 'none' }).rotate().metadata()
  if (!metadata.width || !metadata.height) throw new Error(`无法读取图片：${basename(path)}`)
  const swapsAxes =
    metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8
  const orientedWidth = swapsAxes ? metadata.height : metadata.width
  const orientedHeight = swapsAxes ? metadata.width : metadata.height
  const id = randomUUID()
  sources.set(id, { path, width: metadata.width, height: metadata.height })
  const preview = await sharp(path, { failOn: 'none' })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
  return {
    id,
    name: basename(path),
    width: orientedWidth,
    height: orientedHeight,
    previewDataUrl: toDataUrl(preview, 'image/jpeg'),
  }
}

export async function processCrops(request: CropRequest, erased = false): Promise<CropResultSet> {
  const crops: StoredCrop[] = []
  for (const spec of request.images) {
    const source = sources.get(spec.imageId)
    if (!source) throw new Error('原始图片已失效，请重新导入。')
    const angle = normalizedTurns(spec.quarterTurns) * 90 + spec.fineAngle
    const oriented = await sharp(source.path, { failOn: 'none' }).rotate().png().toBuffer()
    const transformed = await sharp(oriented)
      .rotate(angle, { background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer({ resolveWithObject: true })
    for (const selection of spec.selections) {
      const area = normalizedExtract(selection, transformed.info.width, transformed.info.height)
      let pipeline = sharp(transformed.data).extract(area).flatten({ background: '#ffffff' })
      if (request.processing.enhance) {
        const factor = request.processing.enhanceStrength / 100
        pipeline = pipeline
          .modulate({ brightness: 1 + factor * 0.04, saturation: 1 - factor * 0.08 })
          .sharpen({ sigma: 0.35 + factor * 0.85 })
      }
      const result = await pipeline
        .png({ compressionLevel: 7 })
        .toBuffer({ resolveWithObject: true })
      crops.push({
        id: selection.id,
        width: result.info.width,
        height: result.info.height,
        buffer: result.data,
      })
    }
  }
  return storeResultSet(request.revision, crops, erased)
}

export function storeResultSet(
  revision: number,
  crops: StoredCrop[],
  erased: boolean,
): CropResultSet {
  const resultSetId = randomUUID()
  resultSets.set(resultSetId, crops)
  while (resultSets.size > 8) resultSets.delete(resultSets.keys().next().value as string)
  return {
    resultSetId,
    revision,
    erased,
    crops: crops.map((crop) => ({
      id: crop.id,
      width: crop.width,
      height: crop.height,
      dataUrl: toDataUrl(crop.buffer, 'image/png'),
    })),
  }
}

export function getResultSet(id: string): StoredCrop[] {
  const crops = resultSets.get(id)
  if (!crops) throw new Error('预览结果已过期，请稍候重新生成。')
  return crops
}

function normalizedExtract(
  region: SelectionRegion,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(width - 1, Math.round(region.x * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(region.y * height)))
  const cropWidth = Math.max(1, Math.min(width - left, Math.round(region.width * width)))
  const cropHeight = Math.max(1, Math.min(height - top, Math.round(region.height * height)))
  return { left, top, width: cropWidth, height: cropHeight }
}

function normalizedTurns(value: number): number {
  return ((value % 4) + 4) % 4
}
export function toDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`
}
