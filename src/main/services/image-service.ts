import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { app } from 'electron'
import sharp from 'sharp'
import type {
  CropRequest,
  CropResultSet,
  EnhanceResult,
  ImportedImage,
  SelectionRegion,
  SplitQuestion,
  SplitResult,
} from '@shared/types'
import { ApiError, cropEnhance, aiErase, splitQuestions, paperProcess } from './api-client'

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
const registered = new Map<string, ImportedImage>()
const resultSets = new Map<string, StoredCrop[]>()
const MAX_ENHANCE_BYTES = 7 * 1024 * 1024

function importCacheDir(): string {
  return join(app.getPath('userData'), 'import-cache')
}

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
  const image: ImportedImage = {
    id,
    name: basename(path),
    width: orientedWidth,
    height: orientedHeight,
    previewDataUrl: toDataUrl(preview, 'image/jpeg'),
  }
  registered.set(id, image)
  return image
}

export async function enhanceImage(id: string): Promise<EnhanceResult> {
  const source = sources.get(id)
  const original = registered.get(id)
  if (!source || !original) throw new Error('原始图片已失效，请重新导入。')
  let buffer: Buffer
  try {
    buffer = await readFile(source.path)
  } catch {
    throw new Error('原始图片已失效，请重新导入。')
  }
  if (buffer.length > MAX_ENHANCE_BYTES) {
    return { image: original, enhanced: false, message: '图片超过 7MB，跳过切边增强。' }
  }
  try {
    const result = await cropEnhance({
      imageBase64: buffer.toString('base64'),
      enhanceType: 2,
      adjustOrientation: true,
    })
    if (!result.imageBase64 || !result.width || !result.height) {
      return { image: original, enhanced: false, message: '图像优化未返回结果，已保留原图。' }
    }
    const enhanced = Buffer.from(result.imageBase64, 'base64')
    const cacheDir = importCacheDir()
    await mkdir(cacheDir, { recursive: true })
    const file = join(cacheDir, `${id}.jpg`)
    await writeFile(file, enhanced)
    sources.set(id, { path: file, width: result.width, height: result.height })
    const preview = await sharp(enhanced, { failOn: 'none' })
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
    const image: ImportedImage = {
      ...original,
      width: result.width,
      height: result.height,
      previewDataUrl: toDataUrl(preview, 'image/jpeg'),
    }
    registered.set(id, image)
    return { image, enhanced: true, message: null }
  } catch (error) {
    return { image: original, enhanced: false, message: enhanceFallbackMessage(error) }
  }
}

function enhanceFallbackMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if ([4010, 401, 4011].includes(error.code)) return '未登录，跳过切边增强，已保留原图。'
    if (error.code === 403) return '当前账号未开通 AI 权限，跳过切边增强，已保留原图。'
    if (error.code === 503) return '后台未配置 AI 服务，跳过切边增强，已保留原图。'
    return `图像优化失败（${error.code}），已保留原图。`
  }
  return '图像优化失败，已保留原图。'
}

export async function registerImageDataUrl(dataUrl: string): Promise<ImportedImage> {
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('高拍仪图像数据无效。')
  const dir = importCacheDir()
  await mkdir(dir, { recursive: true })
  const file = join(dir, `高拍仪_${Date.now()}.jpg`)
  await writeFile(file, buffer)
  return registerImage(file)
}

export async function clearImportCache(): Promise<void> {
  await rm(importCacheDir(), { recursive: true, force: true })
}

export async function eraseRegisteredImage(id: string): Promise<EnhanceResult> {
  const source = sources.get(id)
  const original = registered.get(id)
  if (!source || !original) throw new Error('原始图片已失效，请重新导入。')
  let buffer: Buffer
  try {
    buffer = await readFile(source.path)
  } catch {
    throw new Error('原始图片已失效，请重新导入。')
  }
  if (buffer.length > MAX_ENHANCE_BYTES) {
    return { image: original, enhanced: false, message: '图片超过 7MB，跳过去手写。' }
  }
  try {
    const encoded = await encodeForApi(buffer)
    const result = await aiErase(encoded)
    const erased = Buffer.from(
      result.imageBase64.includes(',')
        ? result.imageBase64.slice(result.imageBase64.indexOf(',') + 1)
        : result.imageBase64,
      'base64',
    )
    const meta = await sharp(erased, { failOn: 'none' }).metadata()
    if (!meta.width || !meta.height) {
      return { image: original, enhanced: false, message: '去手写未返回结果，已保留原图。' }
    }
    const cacheDir = importCacheDir()
    await mkdir(cacheDir, { recursive: true })
    const file = join(cacheDir, `${id}-erased.jpg`)
    await writeFile(file, erased)
    sources.set(id, { path: file, width: meta.width, height: meta.height })
    const preview = await sharp(erased, { failOn: 'none' })
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer()
    const image: ImportedImage = {
      ...original,
      width: meta.width,
      height: meta.height,
      previewDataUrl: toDataUrl(preview, 'image/jpeg'),
    }
    registered.set(id, image)
    return { image, enhanced: true, message: null }
  } catch (error) {
    return { image: original, enhanced: false, message: eraseFallbackMessage(error) }
  }
}

function eraseFallbackMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if ([4010, 401, 4011].includes(error.code)) return '未登录，跳过去手写，已保留原图。'
    if (error.code === 403) return '当前账号未开通 AI 权限，跳过去手写，已保留原图。'
    if (error.code === 503) return '后台未配置 AI 服务，跳过去手写，已保留原图。'
    return `去手写失败（${error.code}），已保留原图。`
  }
  return '去手写失败，已保留原图。'
}

export async function splitQuestionsFor(id: string): Promise<SplitResult> {
  const source = sources.get(id)
  if (!source) throw new Error('原始图片已失效，请重新导入。')
  const buffer = await readFile(source.path)
  const encoded = await encodeForApi(buffer)
  return splitQuestions(encoded)
}

export async function processPaper(
  id: string,
): Promise<{ image: ImportedImage; imageKind: string; questions: SplitQuestion[] }> {
  const source = sources.get(id)
  const original = registered.get(id)
  if (!source || !original) throw new Error('原始图片已失效，请重新导入。')
  const buffer = await readFile(source.path)
  const encoded = await encodeForApi(buffer)
  const result = await paperProcess(encoded)
  const processed = Buffer.from(result.imageBase64, 'base64')
  const cacheDir = importCacheDir()
  await mkdir(cacheDir, { recursive: true })
  const file = join(cacheDir, `${id}-paper.jpg`)
  await writeFile(file, processed)
  sources.set(id, { path: file, width: result.width, height: result.height })
  const preview = await sharp(processed, { failOn: 'none' })
    .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer()
  const image: ImportedImage = {
    ...original,
    width: result.width,
    height: result.height,
    previewDataUrl: toDataUrl(preview, 'image/jpeg'),
  }
  registered.set(id, image)
  return { image, imageKind: result.imageKind, questions: result.questions }
}

async function encodeForApi(input: Buffer): Promise<string> {
  const limit = 9 * 1024 * 1024
  let work = sharp(input)
  let scale = 1
  for (let pass = 0; pass < 6; pass += 1) {
    for (const quality of [92, 85, 75, 65]) {
      const buffer = await work.jpeg({ quality }).toBuffer()
      const encoded = buffer.toString('base64')
      if (encoded.length <= limit) return encoded
    }
    scale *= 0.72
    const meta = await sharp(input).metadata()
    work = sharp(input).resize({ width: Math.max(320, Math.round((meta.width ?? 1000) * scale)) })
  }
  throw new Error('图片压缩后仍超过接口限制，请更换图片后重试。')
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

export async function getSourceBuffer(id: string): Promise<Buffer> {
  const source = sources.get(id)
  if (!source) throw new Error('原始图片已失效，请重新导入。')
  return readFile(source.path)
}

export function normalizedExtract(
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

export function normalizedTurns(value: number): number {
  return ((value % 4) + 4) % 4
}
export function toDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`
}
