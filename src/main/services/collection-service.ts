import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import sharp from 'sharp'
import type { BookAddRequest, CollectionEntry, ErrorType } from '@shared/types'
import { getConfig } from './config'
import { getResultSet, toDataUrl } from './image-service'

interface StoredEntry {
  id: string
  grade: number
  subject: BookAddRequest['subject']
  errorType: ErrorType
  createdAt: number
  width: number
  height: number
  file: string
}
interface EntryRow {
  id: string
  grade: number
  subject: string
  error_type: string
  created_at: number
  width: number
  height: number
  file: string
}

let db: DatabaseSync | null = null
let dbDir = ''

function directory(): string {
  const configured = getConfig().bookDir.trim()
  return configured || join(homedir(), '.cuotiku')
}
function database(): DatabaseSync {
  const dir = directory()
  if (db && dbDir === dir) return db
  if (db) db.close()
  mkdirSync(dir, { recursive: true })
  const instance = new DatabaseSync(join(dir, 'cuotiku.db'))
  instance.exec(
    `CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      grade INTEGER NOT NULL,
      subject TEXT NOT NULL,
      error_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      file TEXT NOT NULL
    )`,
  )
  migrateLegacyJson(instance, dir)
  db = instance
  dbDir = dir
  return instance
}

function migrateLegacyJson(instance: DatabaseSync, dir: string): void {
  const legacyPath = join(dir, 'index.json')
  let raw: string
  try {
    raw = readFileSync(legacyPath, 'utf8')
  } catch {
    return
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    const insert = instance.prepare(
      `INSERT OR IGNORE INTO entries
        (id, grade, subject, error_type, created_at, width, height, file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const item of parsed as Partial<StoredEntry>[]) {
      if (!item?.id || !item.file) continue
      insert.run(
        item.id,
        item.grade ?? 1,
        item.subject ?? '语文',
        item.errorType ?? '其他',
        item.createdAt ?? Date.now(),
        item.width ?? 0,
        item.height ?? 0,
        item.file,
      )
    }
    renameSync(legacyPath, `${legacyPath}.migrated`)
  } catch {
    return
  }
}

function toStoredEntry(row: EntryRow): StoredEntry {
  return {
    id: row.id,
    grade: row.grade,
    subject: row.subject as StoredEntry['subject'],
    errorType: row.error_type as ErrorType,
    createdAt: row.created_at,
    width: row.width,
    height: row.height,
    file: row.file,
  }
}
function selectAll(): StoredEntry[] {
  const rows = database()
    .prepare('SELECT * FROM entries ORDER BY created_at DESC, id ASC')
    .all() as unknown as EntryRow[]
  return rows.map(toStoredEntry)
}

export async function addEntries(request: BookAddRequest): Promise<CollectionEntry[]> {
  const crops = getResultSet(request.resultSetId)
  if (!crops.length) throw new Error('没有可加入错题集的内容。')
  const dir = directory()
  await mkdir(dir, { recursive: true })
  const instance = database()
  const insert = instance.prepare(
    `INSERT INTO entries
      (id, grade, subject, error_type, created_at, width, height, file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  instance.exec('BEGIN')
  try {
    for (let index = 0; index < crops.length; index += 1) {
      const crop = crops[index]
      if (!crop) continue
      const id = randomUUID()
      const file = `${id}.png`
      await writeFile(join(dir, file), crop.buffer)
      insert.run(
        id,
        request.grade,
        request.subject,
        request.items[index]?.errorType ?? '其他',
        Date.now(),
        crop.width,
        crop.height,
        file,
      )
    }
    instance.exec('COMMIT')
  } catch (error) {
    instance.exec('ROLLBACK')
    throw error
  }
  return render(selectAll())
}

export async function listEntries(): Promise<CollectionEntry[]> {
  return render(selectAll())
}

export async function removeEntry(id: string): Promise<CollectionEntry[]> {
  const instance = database()
  const rows = instance
    .prepare('SELECT * FROM entries WHERE id = ?')
    .all(id) as unknown as EntryRow[]
  instance.prepare('DELETE FROM entries WHERE id = ?').run(id)
  for (const row of rows) {
    await rm(join(directory(), row.file), { force: true })
  }
  return render(selectAll())
}

export async function getEntryBuffers(
  ids: string[],
): Promise<
  Array<{ id: string; width: number; height: number; buffer: Buffer; errorType: ErrorType }>
> {
  const instance = database()
  const statement = instance.prepare('SELECT * FROM entries WHERE id = ?')
  const result: Array<{
    id: string
    width: number
    height: number
    buffer: Buffer
    errorType: ErrorType
  }> = []
  for (const id of ids) {
    const row = statement.all(id)[0] as unknown as EntryRow | undefined
    if (!row) continue
    try {
      const buffer = await readFile(join(directory(), row.file))
      result.push({
        id: row.id,
        width: row.width,
        height: row.height,
        buffer,
        errorType: row.error_type as ErrorType,
      })
    } catch {
      continue
    }
  }
  return result
}

async function render(entries: StoredEntry[]): Promise<CollectionEntry[]> {
  const result: CollectionEntry[] = []
  for (const entry of entries) {
    let thumbDataUrl = ''
    try {
      const thumb = await sharp(join(directory(), entry.file))
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
      thumbDataUrl = toDataUrl(thumb, 'image/jpeg')
    } catch {
      thumbDataUrl = ''
    }
    result.push({
      id: entry.id,
      grade: entry.grade,
      subject: entry.subject,
      errorType: entry.errorType ?? '其他',
      createdAt: entry.createdAt,
      width: entry.width,
      height: entry.height,
      thumbDataUrl,
    })
  }
  return result
}
