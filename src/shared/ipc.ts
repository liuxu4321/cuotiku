import type {
  AnalogyDocument,
  AnalogyGenerateRequest,
  AppConfig,
  BookAddRequest,
  BookPageRequest,
  CollectionEntry,
  CropRequest,
  CropResultSet,
  HandwritingEraseRequest,
  ImportedImage,
  PagePreview,
  PagePreviewRequest,
  PlatformInfo,
  UpdateState,
} from './types'

export const ipcChannels = {
  appGetVersion: 'app:get-version',
  appGetPlatformInfo: 'app:get-platform-info',
  appOpenExternal: 'app:open-external',
  imagesSelect: 'images:select',
  imagesProcessCrops: 'images:process-crops',
  imagesEraseHandwriting: 'images:erase-handwriting',
  pageBuildPreview: 'page:build-preview',
  pageSave: 'page:save',
  pagePrint: 'page:print',
  bookAdd: 'book:add',
  bookList: 'book:list',
  bookRemove: 'book:remove',
  analogyGenerate: 'analogy:generate',
  analogyPrint: 'analogy:print',
  bookBuildPreview: 'book:build-preview',
  bookPrint: 'book:print',
  appOpenLogDirectory: 'app:open-log-directory',
  dialogSelectDirectory: 'dialog:select-directory',
  configGet: 'config:get',
  configSet: 'config:set',
  updaterGetState: 'updater:get-state',
  updaterCheck: 'updater:check',
  updaterInstall: 'updater:install',
  updaterStateChanged: 'updater:state-changed',
} as const
export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
export interface IpcInvokeMap {
  [ipcChannels.appGetVersion]: { args: []; result: string }
  [ipcChannels.appGetPlatformInfo]: { args: []; result: PlatformInfo }
  [ipcChannels.appOpenExternal]: { args: [url: string]; result: void }
  [ipcChannels.imagesSelect]: { args: []; result: ImportedImage[] }
  [ipcChannels.imagesProcessCrops]: { args: [request: CropRequest]; result: CropResultSet }
  [ipcChannels.imagesEraseHandwriting]: {
    args: [request: HandwritingEraseRequest]
    result: CropResultSet
  }
  [ipcChannels.pageBuildPreview]: { args: [request: PagePreviewRequest]; result: PagePreview }
  [ipcChannels.pageSave]: { args: [request: PagePreviewRequest]; result: string | null }
  [ipcChannels.pagePrint]: { args: [request: PagePreviewRequest]; result: boolean }
  [ipcChannels.bookAdd]: { args: [request: BookAddRequest]; result: CollectionEntry[] }
  [ipcChannels.bookList]: { args: []; result: CollectionEntry[] }
  [ipcChannels.bookRemove]: { args: [id: string]; result: CollectionEntry[] }
  [ipcChannels.analogyGenerate]: {
    args: [request: AnalogyGenerateRequest]
    result: AnalogyDocument
  }
  [ipcChannels.analogyPrint]: { args: [document: AnalogyDocument]; result: boolean }
  [ipcChannels.bookBuildPreview]: { args: [request: BookPageRequest]; result: PagePreview }
  [ipcChannels.bookPrint]: { args: [request: BookPageRequest]; result: boolean }
  [ipcChannels.appOpenLogDirectory]: { args: []; result: void }
  [ipcChannels.dialogSelectDirectory]: { args: []; result: string | null }
  [ipcChannels.configGet]: { args: []; result: AppConfig }
  [ipcChannels.configSet]: { args: [config: AppConfig]; result: AppConfig }
  [ipcChannels.updaterGetState]: { args: []; result: UpdateState }
  [ipcChannels.updaterCheck]: { args: []; result: UpdateState }
  [ipcChannels.updaterInstall]: { args: []; result: void }
}
