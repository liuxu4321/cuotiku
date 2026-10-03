import sharp from 'sharp'
import type {
  BookAddRequest,
  BookEntryDto,
  BookPracticeRecord,
  BookPracticeRecordRequest,
  BookUpdateRequest,
  BookRandomRequest,
  BookRandomResult,
  CollectionEntry,
  ErrorType,
} from '@shared/types'
import * as api from './api-client'
import { getResultSet, toDataUrl } from './image-service'

const thumbCache = new Map<string, string>()
const metaCache = new Map<string, BookEntryDto>()

export async function addEntries(request: BookAddRequest): Promise<number> {
  const crops = getResultSet(request.resultSetId)
  if (!crops.length) throw new Error('没有可加入错题集的内容。')
  let added = 0
  for (let index = 0; index < crops.length; index += 1) {
    const crop = crops[index]
    if (!crop) continue
    await api.bookAddEntry({
      grade: request.grade,
      term: request.term,
      subject: request.subject,
      errorType: request.items[index]?.errorType ?? '其他',
      imageBase64: crop.buffer.toString('base64'),
    })
    added += 1
  }
  return added
}

export async function listEntries(): Promise<CollectionEntry[]> {
  const items: BookEntryDto[] = []
  for (let page = 0; page < 50; page += 1) {
    const batch = await api.bookList(page, 200)
    items.push(...batch.items)
    if (items.length >= batch.total || batch.items.length < 200) break
  }
  const entries: CollectionEntry[] = []
  for (const item of items) {
    metaCache.set(item.id, item)
    entries.push({
      id: item.id,
      grade: item.grade,
      term: item.term ?? null,
      subject: item.subject,
      errorType: item.errorType,
      createdAt: item.createdAt,
      width: item.width,
      height: item.height,
      practiceCount: item.practiceCount,
      thumbDataUrl: await thumbFor(item),
      remark: item.remark ?? null,
      answer: item.answer ?? null,
      recordCount: item.recordCount ?? 0,
      correctCount: item.correctCount ?? 0,
      accuracy: item.accuracy ?? null,
      lastPracticedAt: item.lastPracticedAt ?? null,
    })
  }
  return entries
}

export async function updateEntry(id: string, body: BookUpdateRequest): Promise<void> {
  await api.bookUpdate(id, body)
}

export async function addPractice(
  id: string,
  body: BookPracticeRecordRequest,
): Promise<BookPracticeRecord> {
  return api.bookAddPractice(id, body)
}

export async function removeEntry(id: string): Promise<void> {
  await api.bookDelete(id)
  thumbCache.delete(id)
  metaCache.delete(id)
}

export async function getEntryBuffers(
  ids: string[],
): Promise<
  Array<{ id: string; width: number; height: number; buffer: Buffer; errorType: ErrorType }>
> {
  const result: Array<{
    id: string
    width: number
    height: number
    buffer: Buffer
    errorType: ErrorType
  }> = []
  for (let start = 0; start < ids.length; start += 50) {
    const chunk = ids.slice(start, start + 50)
    const batch = await api.bookImagesBatch(chunk, 'original')
    for (const item of batch) {
      const buffer = Buffer.from(item.imageBase64, 'base64')
      const meta = await sharp(buffer).metadata()
      if (!meta.width || !meta.height) continue
      result.push({
        id: item.id,
        width: meta.width,
        height: meta.height,
        buffer,
        errorType: metaCache.get(item.id)?.errorType ?? '其他',
      })
    }
  }
  return result
}

export async function randomPaper(request: BookRandomRequest): Promise<BookRandomResult> {
  const counts: Record<string, number> = {}
  for (const [type, value] of Object.entries(request.counts)) {
    if (typeof value === 'number' && value > 0) counts[type] = value
  }
  if (!Object.keys(counts).length) throw new Error('抽取数量需大于0。')
  return api.bookRandom({
    grade: request.grade ?? null,
    term: request.term ?? null,
    subject: request.subject ?? null,
    counts,
  })
}

export async function bumpPracticeCount(ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 200) {
    await api.bookPractice(ids.slice(start, start + 200))
  }
}

async function thumbFor(item: BookEntryDto): Promise<string> {
  const cached = thumbCache.get(item.id)
  if (cached) return cached
  try {
    const buffer = await api.bookEntryImage(item.id, 'thumb')
    const dataUrl = toDataUrl(buffer, 'image/jpeg')
    thumbCache.set(item.id, dataUrl)
    return dataUrl
  } catch {
    return ''
  }
}
