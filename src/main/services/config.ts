import { safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Store from 'electron-store'
import log from 'electron-log/main'
import { appConfigSchema, releaseChannelSchema, windowBoundsSchema } from '@shared/schemas'
import type { AppConfig, WindowBounds } from '@shared/types'

interface PersistedConfig extends AppConfig {
  encryptedAuthToken?: string
  encryptedRefreshToken?: string
}
interface StoreShape {
  config: PersistedConfig
  windowBounds: WindowBounds
  clientId: string
}

const defaultConfig: AppConfig = {
  theme: 'system',
  uiTheme: 'default',
  releaseChannel: releaseChannelSchema.catch('stable').parse(process.env.UPDATE_CHANNEL),
  layout: {
    paper: 'A4',
    mode: 'auto',
    gapMm: 8,
    marginMm: 10,
    printMode: 'normal',
    thermalSize: '80x60',
  },
  processing: { enhance: true, enhanceStrength: 55 },
  grade: 1,
  term: 1,
  subject: '语文',
  bookDir: join(homedir(), '.cuotiku'),
  thermalPrinter: '',
  templateId: 'cuotiben-2up',
}
const defaultWindowBounds: WindowBounds = { width: 1380, height: 840 }
const store = new Store<StoreShape>({
  name: 'settings',
  clearInvalidConfig: true,
  defaults: {
    config: { ...defaultConfig } as unknown as PersistedConfig,
    windowBounds: defaultWindowBounds,
    clientId: '',
  },
})

function decryptSecret(value?: string): string {
  if (!value || !safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return ''
  }
}

export function getConfig(): AppConfig {
  const persisted = store.get('config')
  const parsed = appConfigSchema.safeParse(persisted)
  if (parsed.success) return parsed.data
  log.warn('Invalid app config detected; falling back to defaults')
  return defaultConfig
}

export function setConfig(config: AppConfig): AppConfig {
  const parsed = appConfigSchema.parse(config)
  const persisted = store.get('config')
  store.set('config', {
    ...parsed,
    encryptedAuthToken: persisted.encryptedAuthToken,
    encryptedRefreshToken: persisted.encryptedRefreshToken,
  })
  return parsed
}

export function getAuthToken(): string {
  const encrypted = store.get('config').encryptedAuthToken
  return encrypted ? decryptSecret(encrypted) : ''
}

export function getRefreshToken(): string {
  const encrypted = store.get('config').encryptedRefreshToken
  return encrypted ? decryptSecret(encrypted) : ''
}

export function setAuthTokens(token: string, refreshToken: string): void {
  const persisted = store.get('config')
  const canEncrypt = safeStorage.isEncryptionAvailable()
  store.set('config', {
    ...persisted,
    encryptedAuthToken:
      token && canEncrypt ? safeStorage.encryptString(token).toString('base64') : undefined,
    encryptedRefreshToken:
      refreshToken && canEncrypt
        ? safeStorage.encryptString(refreshToken).toString('base64')
        : undefined,
  })
}

export function clearAuthTokens(): void {
  const persisted = store.get('config')
  if (!persisted.encryptedAuthToken && !persisted.encryptedRefreshToken) return
  store.set('config', {
    ...persisted,
    encryptedAuthToken: undefined,
    encryptedRefreshToken: undefined,
  })
}

export function getOrCreateClientId(): string {
  const existing = store.get('clientId')
  if (existing) return existing
  const id = randomUUID()
  store.set('clientId', id)
  return id
}

export function getSavedWindowBounds(): WindowBounds {
  const parsed = windowBoundsSchema.safeParse(store.get('windowBounds'))
  if (!parsed.success) return defaultWindowBounds
  return parsed.data.x === undefined || parsed.data.y === undefined
    ? { width: parsed.data.width, height: parsed.data.height }
    : { x: parsed.data.x, y: parsed.data.y, width: parsed.data.width, height: parsed.data.height }
}
export function saveWindowBounds(bounds: WindowBounds): void {
  const parsed = windowBoundsSchema.safeParse(bounds)
  if (parsed.success) store.set('windowBounds', parsed.data)
}
