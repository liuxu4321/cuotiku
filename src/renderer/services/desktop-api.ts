import type { AppConfig, DesktopAPI, ImportedImage, PlatformInfo, UpdateState } from '@shared/types'
import { createDesktopAPI } from '@shared/desktop-api'

let previewConfig: AppConfig = {
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
const previewPlatform: PlatformInfo = {
  platform: 'browser',
  name: 'macos',
  arch: 'preview',
  versions: { electron: 'not available', chrome: navigator.userAgent, node: 'not available' },
  canAutoUpdate: false,
}
const previewUpdateState: UpdateState = {
  status: 'not-available',
  channel: 'stable',
  message: '更新仅在桌面应用中可用。',
}
const desktopOnly = async (): Promise<never> => {
  throw new Error('此功能需要在桌面应用中使用。')
}
const previewAPI: DesktopAPI = {
  getVersion: async () => 'browser-preview',
  getPlatformInfo: async () => previewPlatform,
  getRuntimeConfig: async () => ({
    serverUrl: 'http://127.0.0.1:8080',
    planetUrl: '',
    configPath: 'yycuotiku.config.json',
  }),
  onNavigate: () => () => undefined,
  openExternal: async (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  selectImages: selectBrowserImages,
  registerScannerImage: async (dataUrl) => {
    const blob = await (await fetch(dataUrl)).blob()
    const bitmap = await createImageBitmap(blob)
    const image: ImportedImage = {
      id: crypto.randomUUID(),
      name: `高拍仪_${Date.now()}.jpg`,
      width: bitmap.width,
      height: bitmap.height,
      previewDataUrl: dataUrl,
    }
    browserImages.set(image.id, image)
    return image
  },
  enhanceImage: async (id) => {
    const image = browserImages.get(id)
    if (!image) throw new Error('原始图片已失效，请重新导入。')
    return { image, enhanced: false, message: null }
  },
  processCrops: desktopOnly,
  eraseImage: async (id) => {
    const image = browserImages.get(id)
    if (!image) throw new Error('原始图片已失效，请重新导入。')
    return { image, enhanced: false, message: null }
  },
  splitQuestions: desktopOnly,
  agentExplain: desktopOnly,
  agentAnalogy: desktopOnly,
  paperProcess: desktopOnly,
  getCaptcha: desktopOnly,
  login: desktopOnly,
  logout: desktopOnly,
  changePassword: desktopOnly,
  getAuthSession: async () => null,
  onAuthStateChanged: () => () => undefined,
  buildPagePreview: desktopOnly,
  savePage: desktopOnly,
  printPage: desktopOnly,
  printSvgPages: desktopOnly,
  saveSvgPages: desktopOnly,
  listBookEntries: desktopOnly,
  addBookEntries: desktopOnly,
  removeBookEntry: desktopOnly,
  buildBookPreview: desktopOnly,
  printBook: desktopOnly,
  bumpBookPractice: desktopOnly,
  randomBookEntries: desktopOnly,
  openLogDirectory: async () => undefined,
  selectDirectory: async () => null,
  listPrinters: async () => [],
  getAbility: desktopOnly,
  getConfig: async () => ({ ...previewConfig }),
  setConfig: async (config) => {
    previewConfig = structuredClone(config)
    return structuredClone(previewConfig)
  },
  getUpdateState: async () => previewUpdateState,
  checkForUpdates: async () => previewUpdateState,
  downloadUpdate: async () => previewUpdateState,
  installUpdate: async () => undefined,
  onUpdateStateChanged: () => () => undefined,
}

export const desktopAPI = createDesktopAPI(
  window.desktopAPI as Partial<DesktopAPI> | undefined,
  previewAPI,
)
export const isBrowserPreview = window.desktopAPI === undefined

function selectBrowserImages(): Promise<ImportedImage[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.addEventListener(
      'change',
      async () => {
        const images = await Promise.all(Array.from(input.files ?? []).map(fileToImage))
        input.remove()
        images.forEach((image) => browserImages.set(image.id, image))
        resolve(images)
      },
      { once: true },
    )
    document.body.append(input)
    input.click()
  })
}
const browserImages = new Map<string, ImportedImage>()
async function fileToImage(file: File): Promise<ImportedImage> {
  const previewDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const bitmap = await createImageBitmap(file)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    width: bitmap.width,
    height: bitmap.height,
    previewDataUrl,
  }
}
