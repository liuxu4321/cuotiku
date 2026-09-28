import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@shared/ipc'
import type { DesktopAPI } from './api'
import type { UpdateState } from '@shared/types'

const api: DesktopAPI = {
  getVersion: () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  getPlatformInfo: () => ipcRenderer.invoke(ipcChannels.appGetPlatformInfo),
  openExternal: (url) => ipcRenderer.invoke(ipcChannels.appOpenExternal, url),
  selectImages: () => ipcRenderer.invoke(ipcChannels.imagesSelect),
  processCrops: (request) => ipcRenderer.invoke(ipcChannels.imagesProcessCrops, request),
  eraseHandwriting: (request) => ipcRenderer.invoke(ipcChannels.imagesEraseHandwriting, request),
  buildPagePreview: (request) => ipcRenderer.invoke(ipcChannels.pageBuildPreview, request),
  savePage: (request) => ipcRenderer.invoke(ipcChannels.pageSave, request),
  printPage: (request) => ipcRenderer.invoke(ipcChannels.pagePrint, request),
  listBookEntries: () => ipcRenderer.invoke(ipcChannels.bookList),
  addBookEntries: (request) => ipcRenderer.invoke(ipcChannels.bookAdd, request),
  removeBookEntry: (id) => ipcRenderer.invoke(ipcChannels.bookRemove, id),
  generateAnalogy: (request) => ipcRenderer.invoke(ipcChannels.analogyGenerate, request),
  printAnalogy: (document) => ipcRenderer.invoke(ipcChannels.analogyPrint, document),
  buildBookPreview: (request) => ipcRenderer.invoke(ipcChannels.bookBuildPreview, request),
  printBook: (request) => ipcRenderer.invoke(ipcChannels.bookPrint, request),
  openLogDirectory: () => ipcRenderer.invoke(ipcChannels.appOpenLogDirectory),
  selectDirectory: () => ipcRenderer.invoke(ipcChannels.dialogSelectDirectory),
  getConfig: () => ipcRenderer.invoke(ipcChannels.configGet),
  setConfig: (config) => ipcRenderer.invoke(ipcChannels.configSet, config),
  getUpdateState: () => ipcRenderer.invoke(ipcChannels.updaterGetState),
  checkForUpdates: () => ipcRenderer.invoke(ipcChannels.updaterCheck),
  installUpdate: () => ipcRenderer.invoke(ipcChannels.updaterInstall),
  onUpdateStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState): void => {
      callback(state)
    }
    ipcRenderer.on(ipcChannels.updaterStateChanged, listener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.updaterStateChanged, listener)
    }
  },
}

contextBridge.exposeInMainWorld('desktopAPI', api)
