export type PlatformName = 'windows' | 'macos' | 'linux'
export type RuntimePlatform = string
export type ThemePreference = 'light' | 'dark' | 'system'
export type ReleaseChannel = 'stable' | 'beta'
export type LayoutMode = 'auto' | 'single' | 'double'
export type PaperSize = 'A4' | 'B5'
export type Subject = '语文' | '数学' | '英语'
export type ErrorType = '马虎' | '不会' | '概念不清' | '其他'

export interface PlatformInfo {
  platform: RuntimePlatform
  name: PlatformName
  arch: string
  versions: { electron: string; chrome: string; node: string }
  canAutoUpdate: boolean
}

export interface ImportedImage {
  id: string
  name: string
  width: number
  height: number
  previewDataUrl: string
}

export interface SelectionRegion {
  id: string
  imageId: string
  x: number
  y: number
  width: number
  height: number
}

export interface ImageEditSpec {
  imageId: string
  quarterTurns: number
  fineAngle: number
  selections: SelectionRegion[]
}

export interface ImageProcessingSettings {
  enhance: boolean
  enhanceStrength: number
}
export interface CropRequest {
  revision: number
  images: ImageEditSpec[]
  processing: ImageProcessingSettings
}
export interface CropPreview {
  id: string
  width: number
  height: number
  dataUrl: string
}
export interface CropResultSet {
  resultSetId: string
  revision: number
  crops: CropPreview[]
  erased: boolean
}
export interface LayoutSettings {
  paper: PaperSize
  mode: LayoutMode
  gapMm: number
  marginMm: number
}
export interface PagePreviewRequest {
  resultSetId: string
  layout: LayoutSettings
}
export interface PagePreview {
  pages: string[]
  columns: number
  scalePercent: number
}

export interface CollectionEntry {
  id: string
  grade: number
  subject: Subject
  errorType: ErrorType
  createdAt: number
  width: number
  height: number
  practiceCount: number
  thumbDataUrl: string
}
export interface BookAddItem {
  errorType: ErrorType
}
export interface BookEntryDto {
  id: string
  grade: number
  subject: Subject
  errorType: ErrorType
  createdAt: number
  createdAtText: string
  width: number
  height: number
  practiceCount: number
  imageUrl: string
  thumbUrl: string
}
export interface BookAddRequest {
  resultSetId: string
  grade: number
  subject: Subject
  items: BookAddItem[]
}
export interface BookPageRequest {
  entryIds: string[]
  paper: PaperSize
}
export interface CaptchaInfo {
  captchaId: string
  imageBase64: string
  expiresInSeconds: number
}
export interface LoginRequest {
  phone: string
  password: string
  captchaId: string
  captchaCode: string
  clientLabel?: string | undefined
}
export interface AuthSession {
  phone: string
  memberNo: string | null
  role: 'USER' | 'ADMIN'
  aiEnabled: boolean
  tokenExpiresAt: string | null
}
export interface RuntimeConfig {
  serverUrl: string
  planetUrl: string
  configPath: string
}
export interface AppConfig {
  theme: ThemePreference
  releaseChannel: ReleaseChannel
  layout: LayoutSettings
  processing: ImageProcessingSettings
  grade: number
  subject: Subject
  bookDir: string
}

export interface DesktopAPI {
  getVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  getRuntimeConfig(): Promise<RuntimeConfig>
  openExternal(url: string): Promise<void>
  selectImages(): Promise<ImportedImage[]>
  processCrops(request: CropRequest): Promise<CropResultSet>
  eraseHandwriting(request: CropRequest): Promise<CropResultSet>
  getCaptcha(): Promise<CaptchaInfo>
  login(request: LoginRequest): Promise<AuthSession>
  logout(): Promise<void>
  getAuthSession(): Promise<AuthSession | null>
  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void
  buildPagePreview(request: PagePreviewRequest): Promise<PagePreview>
  savePage(request: PagePreviewRequest): Promise<string | null>
  printPage(request: PagePreviewRequest): Promise<boolean>
  listBookEntries(): Promise<CollectionEntry[]>
  addBookEntries(request: BookAddRequest): Promise<number>
  removeBookEntry(id: string): Promise<void>
  buildBookPreview(request: BookPageRequest): Promise<PagePreview>
  printBook(request: BookPageRequest): Promise<boolean>
  openLogDirectory(): Promise<void>
  selectDirectory(): Promise<string | null>
  getConfig(): Promise<AppConfig>
  setConfig(config: AppConfig): Promise<AppConfig>
  getUpdateState(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  installUpdate(): Promise<void>
  onUpdateStateChanged(callback: (state: UpdateState) => void): () => void
}

export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}
export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}
export interface UpdateState {
  status: UpdateStatus
  channel: ReleaseChannel
  message: string
  version?: string
  progress?: UpdateProgress
  error?: string
}
