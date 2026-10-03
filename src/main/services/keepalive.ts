import { release } from 'node:os'
import { app } from 'electron'
import log from 'electron-log/main'
import { getPlatformName } from '@shared/platform'
import { getOrCreateClientId, getAuthToken } from './config'
import { getRuntimeConfig } from './runtime-config'

export type ClientState = 'idle' | 'busy' | 'printing' | 'erasing'

let currentState: ClientState = 'idle'
let timer: NodeJS.Timeout | null = null

export function setKeepaliveState(state: ClientState): void {
  if (state === currentState) return
  currentState = state
  void report()
}

export function startKeepalive(): void {
  void report()
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    void report()
  }, 60_000)
}

export function stopKeepalive(): void {
  if (timer) clearInterval(timer)
  timer = null
}

async function report(): Promise<void> {
  const url = serverUrl()
  if (!url) return
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' }
    if (token) headers.Authorization = `Bearer ${token}`
    await fetch(`${url}/api/client/keepalive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clientId: getOrCreateClientId(),
        appVersion: app.getVersion(),
        platform: getPlatformName(process.platform),
        osVersion: release(),
        state: currentState,
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (error) {
    log.warn('Keepalive report failed', error)
  }
}

function serverUrl(): string {
  const url = getRuntimeConfig().serverUrl.trim()
  if (!url || !/^https?:\/\//i.test(url)) return ''
  return url.replace(/\/+$/, '')
}
