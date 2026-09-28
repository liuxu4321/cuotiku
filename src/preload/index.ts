import { contextBridge, ipcRenderer } from 'electron'
import { ipcChannels } from '@shared/ipc'
import type { DesktopAPI } from './api'
import type { AppRoute, AuthSession, UpdateState } from '@shared/types'

const api: DesktopAPI = {
  getVersion: () => ipcRenderer.invoke(ipcChannels.appGetVersion),
  getPlatformInfo: () => ipcRenderer.invoke(ipcChannels.appGetPlatformInfo),
  getRuntimeConfig: () => ipcRenderer.invoke(ipcChannels.appGetRuntimeConfig),
  onNavigate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, route: AppRoute): void => {
      callback(route)
    }
    ipcRenderer.on(ipcChannels.appNavigate, listener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.appNavigate, listener)
    }
  },
  openExternal: (url) => ipcRenderer.invoke(ipcChannels.appOpenExternal, url),
  selectImages: () => ipcRenderer.invoke(ipcChannels.imagesSelect),
  processCrops: (request) => ipcRenderer.invoke(ipcChannels.imagesProcessCrops, request),
  eraseHandwriting: (request) => ipcRenderer.invoke(ipcChannels.imagesEraseHandwriting, request),
  getCaptcha: () => ipcRenderer.invoke(ipcChannels.authCaptcha),
  login: (request) => ipcRenderer.invoke(ipcChannels.authLogin, request),
  logout: () => ipcRenderer.invoke(ipcChannels.authLogout),
  getAuthSession: () => ipcRenderer.invoke(ipcChannels.authMe),
  onAuthStateChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, session: AuthSession | null): void => {
      callback(session)
    }
    ipcRenderer.on(ipcChannels.authStateChanged, listener)
    return () => {
      ipcRenderer.removeListener(ipcChannels.authStateChanged, listener)
    }
  },
  buildPagePreview: (request) => ipcRenderer.invoke(ipcChannels.pageBuildPreview, request),
  savePage: (request) => ipcRenderer.invoke(ipcChannels.pageSave, request),
  printPage: (request) => ipcRenderer.invoke(ipcChannels.pagePrint, request),
  listBookEntries: () => ipcRenderer.invoke(ipcChannels.bookList),
  addBookEntries: (request) => ipcRenderer.invoke(ipcChannels.bookAdd, request),
  removeBookEntry: (id) => ipcRenderer.invoke(ipcChannels.bookRemove, id),
  buildBookPreview: (request) => ipcRenderer.invoke(ipcChannels.bookBuildPreview, request),
  printBook: (request) => ipcRenderer.invoke(ipcChannels.bookPrint, request),
  bumpBookPractice: (ids) => ipcRenderer.invoke(ipcChannels.bookPractice, ids),
  randomBookEntries: (request) => ipcRenderer.invoke(ipcChannels.bookRandom, request),
  openLogDirectory: () => ipcRenderer.invoke(ipcChannels.appOpenLogDirectory),
  selectDirectory: () => ipcRenderer.invoke(ipcChannels.dialogSelectDirectory),
  getConfig: () => ipcRenderer.invoke(ipcChannels.configGet),
  setConfig: (config) => ipcRenderer.invoke(ipcChannels.configSet, config),
  getUpdateState: () => ipcRenderer.invoke(ipcChannels.updaterGetState),
  checkForUpdates: () => ipcRenderer.invoke(ipcChannels.updaterCheck),
  downloadUpdate: () => ipcRenderer.invoke(ipcChannels.updaterDownload),
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
