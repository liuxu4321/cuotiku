import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import type { AppConfig, PlatformInfo, UpdateState } from '@shared/types'

const defaultConfig: AppConfig = {
  theme: 'system',
  releaseChannel: 'stable',
  layout: { paper: 'A4', mode: 'auto', gapMm: 8, marginMm: 10 },
  processing: { enhance: true, enhanceStrength: 55 },
  tencentSecretId: '',
  rememberTencentSecretKey: false,
  tencentSecretKey: '',
  grade: 1,
  subject: '语文',
  bookDir: '',
}
export const useAppStore = defineStore('app', {
  state: () => ({
    version: '',
    platformInfo: null as PlatformInfo | null,
    config: structuredClone(defaultConfig),
    updateState: { status: 'idle', channel: 'stable', message: '可以检查更新。' } as UpdateState,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async initialize() {
      this.loading = true
      try {
        const [version, platformInfo, config, updateState] = await Promise.all([
          desktopAPI.getVersion(),
          desktopAPI.getPlatformInfo(),
          desktopAPI.getConfig(),
          desktopAPI.getUpdateState(),
        ])
        this.version = version
        this.platformInfo = platformInfo
        this.config = config
        this.updateState = updateState
        this.applyTheme(config.theme)
        desktopAPI.onUpdateStateChanged((state) => {
          this.updateState = state
        })
      } catch (error) {
        this.error = friendlyError(error)
      } finally {
        this.loading = false
      }
    },
    async saveConfig(config: AppConfig) {
      const plain = JSON.parse(JSON.stringify(config)) as AppConfig
      this.config = await desktopAPI.setConfig(plain)
      this.applyTheme(this.config.theme)
    },
    async checkForUpdates() {
      this.updateState = await desktopAPI.checkForUpdates()
    },
    async installUpdate() {
      await desktopAPI.installUpdate()
    },
    clearError() {
      this.error = null
    },
    applyTheme(theme: AppConfig['theme']) {
      document.documentElement.dataset.theme = theme
    },
  },
})
export function friendlyError(error: unknown): string {
  console.error(error)
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '') || '操作失败，请重试。'
}
