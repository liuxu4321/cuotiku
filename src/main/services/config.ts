import { safeStorage } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Store from 'electron-store'
import log from 'electron-log/main'
import { appConfigSchema, releaseChannelSchema, windowBoundsSchema } from '@shared/schemas'
import type { AppConfig, WindowBounds } from '@shared/types'

interface PersistedConfig extends Omit<AppConfig, 'tencentSecretKey'> {
  encryptedTencentSecretKey?: string
}
interface StoreShape {
  config: PersistedConfig
  windowBounds: WindowBounds
}

const defaultConfig: AppConfig = {
  theme: 'system',
  releaseChannel: releaseChannelSchema.catch('stable').parse(process.env.UPDATE_CHANNEL),
  layout: { paper: 'A4', mode: 'auto', gapMm: 8, marginMm: 10 },
  processing: { enhance: true, enhanceStrength: 55 },
  tencentSecretId: '',
  rememberTencentSecretKey: false,
  tencentSecretKey: '',
  grade: 1,
  subject: '语文',
  bookDir: join(homedir(), '.cuotiku'),
}
const defaultWindowBounds: WindowBounds = { width: 1380, height: 840 }
const store = new Store<StoreShape>({
  name: 'settings',
  clearInvalidConfig: true,
  defaults: {
    config: { ...defaultConfig, tencentSecretKey: undefined } as unknown as PersistedConfig,
    windowBounds: defaultWindowBounds,
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
  const candidate = {
    ...persisted,
    tencentSecretKey: persisted.rememberTencentSecretKey
      ? decryptSecret(persisted.encryptedTencentSecretKey)
      : '',
  }
  const parsed = appConfigSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  log.warn('Invalid app config detected; falling back to defaults')
  return defaultConfig
}

export function setConfig(config: AppConfig): AppConfig {
  const parsed = appConfigSchema.parse(config)
  const { tencentSecretKey, ...plain } = parsed
  let encryptedTencentSecretKey: string | undefined
  if (parsed.rememberTencentSecretKey && tencentSecretKey && safeStorage.isEncryptionAvailable()) {
    encryptedTencentSecretKey = safeStorage.encryptString(tencentSecretKey).toString('base64')
  }
  store.set('config', { ...plain, encryptedTencentSecretKey })
  return parsed
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
