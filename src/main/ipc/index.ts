import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import log from 'electron-log/main'
import { ipcChannels, type IpcChannel, type IpcInvokeMap } from '@shared/ipc'
import {
  analogyDocumentSchema,
  analogyGenerateRequestSchema,
  appConfigSchema,
  bookAddRequestSchema,
  bookEntryIdSchema,
  bookPageRequestSchema,
  cropRequestSchema,
  handwritingEraseRequestSchema,
  pagePreviewRequestSchema,
} from '@shared/schemas'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'
import { getConfig, setConfig } from '@main/services/config'
import { assertAllowedExternalUrl } from '@main/services/url'
import { processCrops, registerImage } from '@main/services/image-service'
import { eraseHandwriting } from '@main/services/tencent-erase'
import { addEntries, listEntries, removeEntry } from '@main/services/collection-service'
import { generateAnalogy, printAnalogy } from '@main/services/analogy-service'
import {
  buildBookPages,
  buildPage,
  printBuffers,
  printPage,
  savePage,
} from '@main/services/output-service'
import type { UpdateService } from '@main/updater'

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
    eraseHandwriting(handwritingEraseRequestSchema.parse(value)),
  )
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
  handle(ipcChannels.bookRemove, (id) => removeEntry(bookEntryIdSchema.parse(id)))
  handle(ipcChannels.analogyGenerate, (value) =>
    generateAnalogy(analogyGenerateRequestSchema.parse(value).entryIds),
  )
  ipcMain.handle(ipcChannels.analogyPrint, async (event, value) =>
    printAnalogy(BrowserWindow.fromWebContents(event.sender), analogyDocumentSchema.parse(value)),
  )
  handle(ipcChannels.bookBuildPreview, async (value) => {
    const request = bookPageRequestSchema.parse(value)
    const layout = { ...getConfig().layout, paper: request.paper }
    return (await buildBookPages(request.entryIds, layout)).preview
  })
  ipcMain.handle(ipcChannels.bookPrint, async (event, value) => {
    const request = bookPageRequestSchema.parse(value)
    const layout = { ...getConfig().layout, paper: request.paper }
    const { buffers } = await buildBookPages(request.entryIds, layout)
    return printBuffers(BrowserWindow.fromWebContents(event.sender), buffers, request.paper)
  })
  handle(ipcChannels.configGet, () => getConfig())
  handle(ipcChannels.configSet, (value) => setConfig(appConfigSchema.parse(value)))
  handle(ipcChannels.updaterGetState, () => updateService.getState())
  handle(ipcChannels.updaterCheck, () => updateService.checkForUpdates())
  handle(ipcChannels.updaterInstall, () => updateService.quitAndInstall())
}
