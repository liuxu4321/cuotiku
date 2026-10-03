export type PlatformName = 'windows' | 'macos' | 'linux'
export type RuntimePlatform = string
export type ThemePreference = 'light' | 'dark' | 'system'
export type UiTheme = 'default' | 'boy' | 'girl'
export type ReleaseChannel = 'stable' | 'beta'
export type AppRoute = '/' | '/book' | '/settings' | '/about'
export type LayoutMode = 'auto' | 'single' | 'double'
export type PaperSize = 'A4' | 'B5'
export type Subject = '语文' | '数学' | '英语' | '物理' | '化学' | '生物'
export type ErrorType = '马虎' | '不会' | '概念不清' | '其他'
export type Term = 1 | 2

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

export interface SplitQuestion {
  index: number
  x: number
  y: number
  width: number
  height: number
  nx: number
  ny: number
  nWidth: number
  nHeight: number
}
export interface SplitResult {
  width: number
  height: number
  questions: SplitQuestion[]
  requestId?: string | undefined
  traceId?: string | undefined
}
export interface PaperProcessResult {
  image: ImportedImage
  imageKind: string
  questions: SplitQuestion[]
  traceId?: string | undefined
}
export interface EnhanceResult {
  image: ImportedImage
  enhanced: boolean
  message: string | null
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
  printMode: PrintMode
  thermalSize: ThermalSizeId
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
  term: Term | null
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
  term: Term | null
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
  term: Term
  subject: Subject
  items: BookAddItem[]
}
export interface BookRandomRequest {
  grade?: number | null | undefined
  term?: Term | null | undefined
  subject?: Subject | null | undefined
  counts: Partial<Record<ErrorType, number | undefined>>
}
export interface BookRandomTypeStat {
  requested: number
  selected: number
  poolSize: number
}
export interface BookRandomResult {
  items: BookEntryDto[]
  requested: number
  selected: number
  byType: Record<string, BookRandomTypeStat>
}
export type PrintMode = 'normal' | 'thermal' | 'template'
export const THERMAL_SIZES = [
  { id: '57x30', label: '57×30mm', widthMm: 57, heightMm: 30 },
  { id: '57x50', label: '57×50mm', widthMm: 57, heightMm: 50 },
  { id: '80x40', label: '80×40mm', widthMm: 80, heightMm: 40 },
  { id: '80x50', label: '80×50mm', widthMm: 80, heightMm: 50 },
  { id: '80x60', label: '80×60mm', widthMm: 80, heightMm: 60 },
  { id: '80x80', label: '80×80mm', widthMm: 80, heightMm: 80 },
  { id: '80x100', label: '80×100mm', widthMm: 80, heightMm: 100 },
  { id: '80x120', label: '80×120mm', widthMm: 80, heightMm: 120 },
] as const
export type ThermalSizeId = (typeof THERMAL_SIZES)[number]['id']
export interface BookPageRequest {
  entryIds: string[]
  paper: PaperSize
  mode: PrintMode
  thermalSize: ThermalSizeId
}
export interface AbilityDimension {
  key: string
  label: string
  score: number | null
  totalCount: number
  practiceCount: number
  weightedCount: number
}
export interface AbilityModel {
  subject: string | null
  sampleSize: number
  overall: number | null
  dimensions: AbilityDimension[]
}
export interface AbilityRequest {
  grade?: number | undefined
  term?: number | undefined
  subject?: Subject | undefined
  start?: string | undefined
  end?: string | undefined
}
export interface AbilityResponse {
  overall: AbilityModel
  subjects: AbilityModel[]
}
export interface SvgPagesRequest {
  svgs: string[]
  paper: PaperSize
}
export interface AgentRequest {
  entryId?: string | undefined
  imageBase64?: string | undefined
  subject?: string | undefined
  grade?: number | undefined
  term?: number | undefined
  errorType?: string | undefined
  count?: number | undefined
}
export interface AgentExplainStep {
  title: string
  content: string
}
export interface AgentExplainResult {
  traceId: string
  model: string
  analysis: string
  steps: AgentExplainStep[]
  knowledgePoints: string[]
  commonMistakes: string[]
  summary: string
}
export interface AgentAnalogyItem {
  stem: string
  options: string[]
  answer: string
  analysis: string
  difficulty: number
}
export interface AgentAnalogyResult {
  traceId: string
  model: string
  items: AgentAnalogyItem[]
}
export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
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
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
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
  uiTheme: UiTheme
  releaseChannel: ReleaseChannel
  layout: LayoutSettings
  processing: ImageProcessingSettings
  grade: number
  term: Term
  subject: Subject
  bookDir: string
  thermalPrinter: string
  templateId: string
}

export interface DesktopAPI {
  getVersion(): Promise<string>
  getPlatformInfo(): Promise<PlatformInfo>
  getRuntimeConfig(): Promise<RuntimeConfig>
  onNavigate(callback: (route: AppRoute) => void): () => void
  openExternal(url: string): Promise<void>
  selectImages(): Promise<ImportedImage[]>
  registerScannerImage(dataUrl: string): Promise<ImportedImage>
  enhanceImage(id: string): Promise<EnhanceResult>
  processCrops(request: CropRequest): Promise<CropResultSet>
  eraseImage(id: string): Promise<EnhanceResult>
  splitQuestions(id: string): Promise<SplitResult>
  agentExplain(request: AgentRequest): Promise<AgentExplainResult>
  agentAnalogy(request: AgentRequest): Promise<AgentAnalogyResult>
  paperProcess(id: string): Promise<PaperProcessResult>
  getCaptcha(): Promise<CaptchaInfo>
  login(request: LoginRequest): Promise<AuthSession>
  logout(): Promise<void>
  changePassword(request: ChangePasswordRequest): Promise<void>
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
  printSvgPages(request: SvgPagesRequest): Promise<boolean>
  saveSvgPages(request: SvgPagesRequest): Promise<string | null>
  bumpBookPractice(ids: string[]): Promise<void>
  randomBookEntries(request: BookRandomRequest): Promise<BookRandomResult>
  openLogDirectory(): Promise<void>
  selectDirectory(): Promise<string | null>
  listPrinters(): Promise<PrinterInfo[]>
  getAbility(request: AbilityRequest): Promise<AbilityResponse>
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
