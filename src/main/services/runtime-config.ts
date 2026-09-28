import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

export interface RuntimeConfig {
  serverUrl: string
  planetUrl: string
  configPath: string
}

const FILE_NAME = 'yycuotiku.config.json'
let cache: RuntimeConfig | null = null

function candidatePaths(): string[] {
  const paths: string[] = []
  try {
    paths.push(join(dirname(app.getPath('exe')), FILE_NAME))
  } catch {
    paths.push(join(process.cwd(), FILE_NAME))
  }
  try {
    paths.push(join(app.getPath('userData'), FILE_NAME))
  } catch {
    paths.push(join(process.cwd(), FILE_NAME))
  }
  try {
    paths.push(join(process.resourcesPath, FILE_NAME))
  } catch {
    paths.push(join(process.cwd(), FILE_NAME))
  }
  paths.push(join(process.cwd(), FILE_NAME))
  return paths
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cache) return cache
  for (const path of candidatePaths()) {
    try {
      if (!existsSync(path)) continue
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<{
        serverUrl: string
        planetUrl: string
      }>
      cache = {
        serverUrl: (parsed.serverUrl ?? '').trim(),
        planetUrl: (parsed.planetUrl ?? '').trim(),
        configPath: path,
      }
      return cache
    } catch {
      continue
    }
  }
  const [first] = candidatePaths()
  cache = { serverUrl: '', planetUrl: '', configPath: first ?? FILE_NAME }
  return cache
}
