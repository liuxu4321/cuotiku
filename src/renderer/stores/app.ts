import { defineStore } from 'pinia'
import { desktopAPI } from '@renderer/services/desktop-api'
import { templates } from '@renderer/templates'
import type { AppConfig, PlatformInfo, RuntimeConfig, UpdateState } from '@shared/types'

const defaultConfig: AppConfig = {
  theme: 'system',
  uiTheme: 'default',
  releaseChannel: 'stable',
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
  bookDir: '',
  thermalPrinter: '',
  templateId: 'cuotiben-2up',
}
export const useAppStore = defineStore('app', {
  state: () => ({
    version: '',
    platformInfo: null as PlatformInfo | null,
    config: structuredClone(defaultConfig),
    runtimeConfig: null as RuntimeConfig | null,
    updateState: { status: 'idle', channel: 'stable', message: '可以检查更新。' } as UpdateState,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async initialize() {
      this.loading = true
      try {
        const [version, platformInfo, config, updateState, runtimeConfig] = await Promise.all([
          desktopAPI.getVersion(),
          desktopAPI.getPlatformInfo(),
          desktopAPI.getConfig(),
          desktopAPI.getUpdateState(),
          desktopAPI.getRuntimeConfig(),
        ])
        this.version = version
        this.platformInfo = platformInfo
        this.config = config
        if (!templates.some((tpl) => tpl.id === config.templateId)) {
          await this.saveConfig({ ...config, templateId: 'cuotiben-2up' })
        }
        this.updateState = updateState
        this.runtimeConfig = runtimeConfig
        this.applyTheme(config.theme)
        this.applyUiTheme(config.uiTheme)
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
      this.applyUiTheme(this.config.uiTheme)
    },
    async setGrade(grade: number) {
      if (grade === this.config.grade) return
      await this.saveConfig({ ...this.config, grade })
    },
    async setTerm(term: AppConfig['term']) {
      if (term === this.config.term) return
      await this.saveConfig({ ...this.config, term })
    },
    async checkForUpdates() {
      this.updateState = await desktopAPI.checkForUpdates()
    },
    async downloadUpdate() {
      this.updateState = await desktopAPI.downloadUpdate()
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
    applyUiTheme(uiTheme: AppConfig['uiTheme']) {
      document.documentElement.dataset.uitheme = uiTheme
    },
  },
})
export function friendlyError(error: unknown): string {
  console.error(error)
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '') || '操作失败，请重试。'
}
