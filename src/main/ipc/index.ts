import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import log from 'electron-log/main'
import { ipcChannels, type IpcChannel, type IpcInvokeMap } from '@shared/ipc'
import {
  appConfigSchema,
  bookAddRequestSchema,
  bookEntryIdSchema,
  bookPageRequestSchema,
  cropRequestSchema,
  loginRequestSchema,
  pagePreviewRequestSchema,
} from '@shared/schemas'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'
import { getConfig, setConfig } from '@main/services/config'
import { assertAllowedExternalUrl } from '@main/services/url'
import { processCrops, registerImage } from '@main/services/image-service'
import { eraseHandwriting } from '@main/services/erase-service'
import { getCaptcha, login, logout, me, onTokenCleared } from '@main/services/api-client'
import { getRuntimeConfig } from '@main/services/runtime-config'
import {
  addEntries,
  bumpPracticeCount,
  getEntryBuffers,
  listEntries,
  removeEntry,
} from '@main/services/book-service'
import {
  applyBookNote,
  BOOK_NOTES,
  buildPage,
  composePages,
  printBuffers,
  printPage,
  savePage,
} from '@main/services/output-service'
import type { UpdateService } from '@main/updater'
import type { AuthSession } from '@shared/types'

type HandlerResult<C extends keyof IpcInvokeMap> =
  Promise<IpcInvokeMap[C]['result']> | IpcInvokeMap[C]['result']
function handle<C extends keyof IpcInvokeMap>(
  channel: C,
  listener: (...args: IpcInvokeMap[C]['args']) => HandlerResult<C>,
): void {
  ipcMain.handle(channel as IpcChannel, (_event, ...args: IpcInvokeMap[C]['args']) =>
    listener(...args),
  )
}

export function registerIpcHandlers(updateService: UpdateService): void {
  onTokenCleared(() => broadcastAuth(null))
  handle(ipcChannels.appGetVersion, () => app.getVersion())
  handle(ipcChannels.appGetPlatformInfo, () => ({
    platform: process.platform,
    name: getPlatformName(process.platform),
    arch: process.arch,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    canAutoUpdate: canUseBuiltInAutoUpdate(process.platform),
  }))
  handle(ipcChannels.appOpenExternal, async (url) =>
    shell.openExternal(assertAllowedExternalUrl(url)).then(() => undefined),
  )
  handle(ipcChannels.appGetRuntimeConfig, () => getRuntimeConfig())
  ipcMain.handle(ipcChannels.imagesSelect, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp'] }],
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(registerImage))
  })
  handle(ipcChannels.imagesProcessCrops, (value) => processCrops(cropRequestSchema.parse(value)))
  handle(ipcChannels.imagesEraseHandwriting, (value) =>
    eraseHandwriting(cropRequestSchema.parse(value)),
  )
  handle(ipcChannels.authCaptcha, () => getCaptcha())
  handle(ipcChannels.authLogin, async (value) => {
    const session = await login(loginRequestSchema.parse(value))
    broadcastAuth(session)
    return session
  })
  handle(ipcChannels.authLogout, async () => {
    await logout()
    broadcastAuth(null)
  })
  handle(ipcChannels.authMe, () => me())
  handle(ipcChannels.pageBuildPreview, async (value) => {
    const request = pagePreviewRequestSchema.parse(value)
    return (await buildPage(request.resultSetId, request.layout)).preview
  })
  ipcMain.handle(ipcChannels.pageSave, async (event, value) => {
    const request = pagePreviewRequestSchema.parse(value)
    return savePage(
      BrowserWindow.fromWebContents(event.sender),
      request.resultSetId,
      request.layout,
    )
  })
  ipcMain.handle(ipcChannels.pagePrint, async (event, value) => {
    const request = pagePreviewRequestSchema.parse(value)
    return printPage(
      BrowserWindow.fromWebContents(event.sender),
      request.resultSetId,
      request.layout,
    )
  })
  handle(ipcChannels.appOpenLogDirectory, async () => {
    await shell.openPath(log.transports.file.getFile().path.replace(/[/\\][^/\\]+$/, ''))
  })
  ipcMain.handle(ipcChannels.dialogSelectDirectory, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  handle(ipcChannels.bookAdd, (value) => addEntries(bookAddRequestSchema.parse(value)))
  handle(ipcChannels.bookList, () => listEntries())
  handle(ipcChannels.bookRemove, async (id) => {
    await removeEntry(bookEntryIdSchema.parse(id))
  })
  handle(ipcChannels.bookBuildPreview, async (value) => {
    const request = bookPageRequestSchema.parse(value)
    const layout = { ...getConfig().layout, paper: request.paper }
    const noted = await notedCrops(request.entryIds)
    return (await composePages(noted, layout)).preview
  })
  ipcMain.handle(ipcChannels.bookPrint, async (event, value) => {
    const request = bookPageRequestSchema.parse(value)
    const layout = { ...getConfig().layout, paper: request.paper }
    const noted = await notedCrops(request.entryIds)
    const { buffers } = await composePages(noted, layout)
    const success = await printBuffers(
      BrowserWindow.fromWebContents(event.sender),
      buffers,
      request.paper,
    )
    if (success) await bumpPracticeCount(request.entryIds)
    return success
  })
  handle(ipcChannels.configGet, () => getConfig())
  handle(ipcChannels.configSet, (value) => setConfig(appConfigSchema.parse(value)))
  handle(ipcChannels.updaterGetState, () => updateService.getState())
  handle(ipcChannels.updaterCheck, () => updateService.checkForUpdates())
  handle(ipcChannels.updaterDownload, () => updateService.downloadUpdate())
  handle(ipcChannels.updaterInstall, () => updateService.quitAndInstall())
}

function broadcastAuth(session: AuthSession | null): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.authStateChanged, session)
  }
}

async function notedCrops(entryIds: string[]) {
  const crops = await getEntryBuffers(entryIds)
  if (!crops.length) throw new Error('请先在错题集中勾选要组卷的错题。')
  return Promise.all(crops.map((crop) => applyBookNote(crop, BOOK_NOTES[crop.errorType])))
}
