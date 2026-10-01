// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createDesktopAPI } from '../src/shared/desktop-api'
import type { DesktopAPI } from '../src/shared/types'

function createFallbackAPI(): DesktopAPI {
  return {
    async getVersion() {
      return 'fallback'
    },
    async getPlatformInfo() {
      return {
        platform: 'browser',
        name: 'macos',
        arch: 'preview',
        versions: { electron: 'n/a', chrome: 'n/a', node: 'n/a' },
        canAutoUpdate: false,
      }
    },
    async getRuntimeConfig() {
      return { serverUrl: 'http://127.0.0.1:8080', planetUrl: '', configPath: 'test' }
    },
    onNavigate: vi.fn(() => () => undefined),
    async openExternal() {},
    selectImages: vi.fn(async () => []),
    registerScannerImage: vi.fn(async () => ({
      id: 'scanner',
      name: 'scanner.jpg',
      width: 1,
      height: 1,
      previewDataUrl: '',
    })),
    enhanceImage: vi.fn(async (id: string) => ({
      image: { id, name: 'a.png', width: 1, height: 1, previewDataUrl: '' },
      enhanced: false,
      message: null,
    })),
    processCrops: vi.fn(async () => ({
      resultSetId: 'result',
      revision: 1,
      crops: [],
      erased: false,
    })),
    eraseImage: vi.fn(async (id: string) => ({
      image: { id, name: 'a.png', width: 1, height: 1, previewDataUrl: '' },
      enhanced: true,
      message: null,
    })),
    getCaptcha: vi.fn(async () => ({ captchaId: 'c', imageBase64: '', expiresInSeconds: 300 })),
    login: vi.fn(async () => ({
      phone: '13800000000',
      memberNo: null,
      role: 'USER' as const,
      aiEnabled: true,
      tokenExpiresAt: null,
    })),
    logout: vi.fn(async () => undefined),
    getAuthSession: vi.fn(async () => null),
    onAuthStateChanged: vi.fn(() => () => undefined),
    buildPagePreview: vi.fn(async () => ({ pages: [], columns: 1, scalePercent: 100 })),
    savePage: vi.fn(async () => null),
    printPage: vi.fn(async () => true),
    listBookEntries: vi.fn(async () => []),
    addBookEntries: vi.fn(async () => 0),
    removeBookEntry: vi.fn(async () => undefined),
    buildBookPreview: vi.fn(async () => ({ pages: [], columns: 1, scalePercent: 100 })),
    printBook: vi.fn(async () => true),
    printSvgPages: vi.fn(async () => true),
    saveSvgPages: vi.fn(async () => null),
    bumpBookPractice: vi.fn(async () => undefined),
    randomBookEntries: vi.fn(async () => ({ items: [], requested: 0, selected: 0, byType: {} })),
    async openLogDirectory() {},
    async selectDirectory() {
      return null
    },
    async listPrinters() {
      return []
    },
    getAbility: vi.fn(async () => ({
      overall: { subject: null, sampleSize: 0, overall: null, dimensions: [] },
      subjects: [],
    })),
    async getConfig() {
      return {
        theme: 'system',
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
    },
    async setConfig(config) {
      return config
    },
    async getUpdateState() {
      return { status: 'not-available', channel: 'stable', message: 'Unavailable' }
    },
    async checkForUpdates() {
      return { status: 'not-available', channel: 'stable', message: 'Unavailable' }
    },
    async downloadUpdate() {
      return { status: 'not-available', channel: 'stable', message: 'Unavailable' }
    },
    async installUpdate() {},
    onUpdateStateChanged() {
      return () => undefined
    },
  }
}

describe('desktop API adapter', () => {
  it('falls back per method when a partial preload bridge is present', async () => {
    const fallback = createFallbackAPI()
    const bridgeGetVersion = vi.fn(async () => 'desktop')
    const api = createDesktopAPI({ getVersion: bridgeGetVersion }, fallback)

    await expect(api.getVersion()).resolves.toBe('desktop')
    await expect(api.selectImages()).resolves.toEqual([])
    expect(bridgeGetVersion).toHaveBeenCalledOnce()
    expect(fallback.selectImages).toHaveBeenCalledOnce()
  })
})
