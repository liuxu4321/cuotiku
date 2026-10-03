import type {
  AbilityRequest,
  AbilityResponse,
  AgentAnalogyResult,
  AgentExplainResult,
  AgentRequest,
  AppConfig,
  AuthSession,
  BookAddRequest,
  BookPageRequest,
  BookRandomRequest,
  BookPracticeRecord,
  BookPracticeRecordRequest,
  BookUpdateRequest,
  BookRandomResult,
  CaptchaInfo,
  ChangePasswordRequest,
  CollectionEntry,
  CropRequest,
  CropResultSet,
  EnhanceResult,
  ImportedImage,
  LoginRequest,
  PagePreview,
  PagePreviewRequest,
  PaperProcessResult,
  PdfFilePayload,
  PlatformInfo,
  PrinterInfo,
  RuntimeConfig,
  SplitResult,
  SvgPagesRequest,
  UpdateState,
} from './types'

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  appGetPlatformInfo: 'app:get-platform-info',
  appGetRuntimeConfig: 'app:get-runtime-config',
  appNavigate: 'app:navigate',
  appOpenExternal: 'app:open-external',
  imagesSelect: 'images:select',
  pdfSelect: 'pdf:select',
  imagesEnhance: 'images:enhance',
  imagesErase: 'images:erase',
  imagesSplit: 'images:split',
  imagesPaperProcess: 'images:paper-process',
  agentExplain: 'agent:explain',
  agentAnalogy: 'agent:analogy',
  imagesRegisterScanner: 'images:register-scanner',
  imagesProcessCrops: 'images:process-crops',
  authCaptcha: 'auth:captcha',
  authLogin: 'auth:login',
  authLogout: 'auth:logout',
  authChangePassword: 'auth:change-password',
  authMe: 'auth:me',
  authStateChanged: 'auth:state-changed',
  pageBuildPreview: 'page:build-preview',
  pageSave: 'page:save',
  pagePrint: 'page:print',
  printSvgPages: 'print:svg-pages',
  saveSvgPages: 'print:save-svg-pages',
  bookAdd: 'book:add',
  bookList: 'book:list',
  bookRemove: 'book:remove',
  bookUpdate: 'book:update',
  bookAddPractice: 'book:add-practice',
  bookBuildPreview: 'book:build-preview',
  bookPrint: 'book:print',
  bookPractice: 'book:practice',
  bookRandom: 'book:random',
  appOpenLogDirectory: 'app:open-log-directory',
  dialogSelectDirectory: 'dialog:select-directory',
  printersList: 'printers:list',
  userAbility: 'user:ability',
  configGet: 'config:get',
  configSet: 'config:set',
  updaterGetState: 'updater:get-state',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStateChanged: 'updater:state-changed',
} as const
export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
export interface IpcInvokeMap {
  [ipcChannels.appGetVersion]: { args: []; result: string }
  [ipcChannels.appGetPlatformInfo]: { args: []; result: PlatformInfo }
  [ipcChannels.appGetRuntimeConfig]: { args: []; result: RuntimeConfig }
  [ipcChannels.appOpenExternal]: { args: [url: string]; result: void }
  [ipcChannels.imagesSelect]: { args: []; result: ImportedImage[] }
  [ipcChannels.pdfSelect]: { args: []; result: PdfFilePayload | null }
  [ipcChannels.imagesEnhance]: { args: [id: string]; result: EnhanceResult }
  [ipcChannels.imagesErase]: { args: [id: string]; result: EnhanceResult }
  [ipcChannels.imagesSplit]: { args: [id: string]; result: SplitResult }
  [ipcChannels.imagesPaperProcess]: { args: [id: string]; result: PaperProcessResult }
  [ipcChannels.agentExplain]: { args: [request: AgentRequest]; result: AgentExplainResult }
  [ipcChannels.agentAnalogy]: { args: [request: AgentRequest]; result: AgentAnalogyResult }
  [ipcChannels.imagesRegisterScanner]: {
    args: [dataUrl: string, name?: string]
    result: ImportedImage
  }
  [ipcChannels.imagesProcessCrops]: { args: [request: CropRequest]; result: CropResultSet }
  [ipcChannels.authCaptcha]: { args: []; result: CaptchaInfo }
  [ipcChannels.authLogin]: { args: [request: LoginRequest]; result: AuthSession }
  [ipcChannels.authLogout]: { args: []; result: void }
  [ipcChannels.authChangePassword]: { args: [request: ChangePasswordRequest]; result: void }
  [ipcChannels.authMe]: { args: []; result: AuthSession | null }
  [ipcChannels.pageBuildPreview]: { args: [request: PagePreviewRequest]; result: PagePreview }
  [ipcChannels.pageSave]: { args: [request: PagePreviewRequest]; result: string | null }
  [ipcChannels.pagePrint]: { args: [request: PagePreviewRequest]; result: boolean }
  [ipcChannels.printSvgPages]: { args: [request: SvgPagesRequest]; result: boolean }
  [ipcChannels.saveSvgPages]: { args: [request: SvgPagesRequest]; result: string | null }
  [ipcChannels.bookAdd]: { args: [request: BookAddRequest]; result: number }
  [ipcChannels.bookList]: { args: []; result: CollectionEntry[] }
  [ipcChannels.bookRemove]: { args: [id: string]; result: void }
  [ipcChannels.bookUpdate]: { args: [id: string, request: BookUpdateRequest]; result: void }
  [ipcChannels.bookAddPractice]: {
    args: [id: string, request: BookPracticeRecordRequest]
    result: BookPracticeRecord
  }
  [ipcChannels.bookBuildPreview]: { args: [request: BookPageRequest]; result: PagePreview }
  [ipcChannels.bookPrint]: { args: [request: BookPageRequest]; result: boolean }
  [ipcChannels.bookPractice]: { args: [ids: string[]]; result: void }
  [ipcChannels.bookRandom]: { args: [request: BookRandomRequest]; result: BookRandomResult }
  [ipcChannels.appOpenLogDirectory]: { args: []; result: void }
  [ipcChannels.dialogSelectDirectory]: { args: []; result: string | null }
  [ipcChannels.printersList]: { args: []; result: PrinterInfo[] }
  [ipcChannels.userAbility]: { args: [request: AbilityRequest]; result: AbilityResponse }
  [ipcChannels.configGet]: { args: []; result: AppConfig }
  [ipcChannels.configSet]: { args: [config: AppConfig]; result: AppConfig }
  [ipcChannels.updaterGetState]: { args: []; result: UpdateState }
  [ipcChannels.updaterCheck]: { args: []; result: UpdateState }
  [ipcChannels.updaterDownload]: { args: []; result: UpdateState }
  [ipcChannels.updaterInstall]: { args: []; result: void }
}
