import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import sharp from 'sharp'
import log from 'electron-log/main'
import { ipcChannels, type IpcChannel, type IpcInvokeMap } from '@shared/ipc'
import {
  abilityRequestSchema,
  agentRequestSchema,
  appConfigSchema,
  bookAddRequestSchema,
  bookEntryIdSchema,
  bookPageRequestSchema,
  bookPracticeSchema,
  changePasswordRequestSchema,
  svgPagesRequestSchema,
  bookRandomRequestSchema,
  cropRequestSchema,
  dataUrlSchema,
  imageIdSchema,
  loginRequestSchema,
  pagePreviewRequestSchema,
} from '@shared/schemas'
import { canUseBuiltInAutoUpdate, getPlatformName } from '@shared/platform'
import { getConfig, setConfig } from '@main/services/config'
import { assertAllowedExternalUrl } from '@main/services/url'
import {
  processCrops,
  registerImage,
  enhanceImage,
  eraseRegisteredImage,
  registerImageDataUrl,
  getResultSet,
  splitQuestionsFor,
  processPaper,
} from '@main/services/image-service'
import {
  getCaptcha,
  login,
  logout,
  changePassword,
  me,
  onTokenCleared,
  getAbility,
} from '@main/services/api-client'
import { runAgentAnalogy, runAgentExplain } from '@main/services/agent-service'
import { getRuntimeConfig } from '@main/services/runtime-config'
import {
  addEntries,
  bumpPracticeCount,
  getEntryBuffers,
  listEntries,
  randomPaper,
  removeEntry,
} from '@main/services/book-service'
import {
  applyBookNote,
  BOOK_NOTES,
  buildPage,
  composePages,
  composeThermalPages,
  PAPER_SIZES,
  printBuffers,
  printPage,
  resolveThermalPrinter,
  saveBuffers,
  savePage,
  thermalSizeById,
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
  handle(ipcChannels.imagesEnhance, (id) => enhanceImage(imageIdSchema.parse(id)))
  handle(ipcChannels.imagesErase, (id) => eraseRegisteredImage(imageIdSchema.parse(id)))
  handle(ipcChannels.imagesSplit, (id) => splitQuestionsFor(imageIdSchema.parse(id)))
  handle(ipcChannels.imagesPaperProcess, (id) => processPaper(imageIdSchema.parse(id)))
  handle(ipcChannels.agentExplain, (value) => runAgentExplain(agentRequestSchema.parse(value)))
  handle(ipcChannels.agentAnalogy, (value) => runAgentAnalogy(agentRequestSchema.parse(value)))
  handle(ipcChannels.imagesRegisterScanner, (dataUrl) =>
    registerImageDataUrl(dataUrlSchema.parse(dataUrl)),
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
  handle(ipcChannels.authChangePassword, (value) =>
    changePassword(changePasswordRequestSchema.parse(value)),
  )
  handle(ipcChannels.authMe, () => me())
  handle(ipcChannels.pageBuildPreview, async (value) => {
    const request = pagePreviewRequestSchema.parse(value)
    if (request.layout.printMode === 'thermal') {
      const crops = getResultSet(request.resultSetId)
      if (!crops.length) throw new Error('请先至少框选一道错题。')
      return (await composeThermalPages(crops, thermalSizeById(request.layout.thermalSize))).preview
    }
    return (await buildPage(request.resultSetId, request.layout)).preview
  })
  ipcMain.handle(ipcChannels.pageSave, async (event, value) => {
    const request = pagePreviewRequestSchema.parse(value)
    if (request.layout.printMode === 'thermal') {
      const size = thermalSizeById(request.layout.thermalSize)
      const crops = getResultSet(request.resultSetId)
      if (!crops.length) throw new Error('请先至少框选一道错题。')
      const composed = await composeThermalPages(crops, size)
      return saveBuffers(
        BrowserWindow.fromWebContents(event.sender),
        composed.buffers,
        `热敏${size.widthMm}x${size.heightMm}`,
      )
    }
    return savePage(
      BrowserWindow.fromWebContents(event.sender),
      request.resultSetId,
      request.layout,
    )
  })
  ipcMain.handle(ipcChannels.pagePrint, async (event, value) => {
    const request = pagePreviewRequestSchema.parse(value)
    if (request.layout.printMode === 'thermal') {
      const size = thermalSizeById(request.layout.thermalSize)
      const crops = getResultSet(request.resultSetId)
      if (!crops.length) throw new Error('请先至少框选一道错题。')
      const composed = await composeThermalPages(crops, size)
      const printers = await event.sender.getPrintersAsync()
      const deviceName = resolveThermalPrinter(printers, getConfig().thermalPrinter)
      return printBuffers(
        BrowserWindow.fromWebContents(event.sender),
        composed.buffers,
        size,
        deviceName,
      )
    }
    return printPage(
      BrowserWindow.fromWebContents(event.sender),
      request.resultSetId,
      request.layout,
    )
  })
  ipcMain.handle(ipcChannels.printSvgPages, async (event, value) => {
    const request = svgPagesRequestSchema.parse(value)
    const buffers = await rasterizeSvgs(request.svgs)
    return printBuffers(
      BrowserWindow.fromWebContents(event.sender),
      buffers,
      PAPER_SIZES[request.paper],
    )
  })
  ipcMain.handle(ipcChannels.saveSvgPages, async (event, value) => {
    const request = svgPagesRequestSchema.parse(value)
    const buffers = await rasterizeSvgs(request.svgs)
    return saveBuffers(BrowserWindow.fromWebContents(event.sender), buffers, `模板${request.paper}`)
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
  ipcMain.handle(ipcChannels.printersList, async (event) => {
    const printers = await event.sender.getPrintersAsync()
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      isDefault: (printer as { isDefault?: boolean }).isDefault ?? false,
    }))
  })
  handle(ipcChannels.userAbility, (value) => getAbility(abilityRequestSchema.parse(value)))
  handle(ipcChannels.bookAdd, (value) => addEntries(bookAddRequestSchema.parse(value)))
  handle(ipcChannels.bookList, () => listEntries())
  handle(ipcChannels.bookRemove, async (id) => {
    await removeEntry(bookEntryIdSchema.parse(id))
  })
  handle(ipcChannels.bookBuildPreview, async (value) => {
    const request = bookPageRequestSchema.parse(value)
    const crops = await notedCrops(request.entryIds)
    if (request.mode === 'thermal') {
      return (await composeThermalPages(crops, thermalSizeById(request.thermalSize))).preview
    }
    const layout = { ...getConfig().layout, paper: request.paper }
    return (await composePages(crops, layout)).preview
  })
  ipcMain.handle(ipcChannels.bookPrint, async (event, value) => {
    const request = bookPageRequestSchema.parse(value)
    const crops = await notedCrops(request.entryIds)
    const size =
      request.mode === 'thermal' ? thermalSizeById(request.thermalSize) : PAPER_SIZES[request.paper]
    const composed =
      request.mode === 'thermal'
        ? await composeThermalPages(crops, size)
        : await composePages(crops, { ...getConfig().layout, paper: request.paper })
    return printBuffers(BrowserWindow.fromWebContents(event.sender), composed.buffers, size)
  })
  handle(ipcChannels.bookPractice, async (value) => {
    await bumpPracticeCount(bookPracticeSchema.parse(value))
  })
  handle(ipcChannels.bookRandom, (value) => randomPaper(bookRandomRequestSchema.parse(value)))
  handle(ipcChannels.configGet, () => getConfig())
  handle(ipcChannels.configSet, (value) => {
    const next = appConfigSchema.parse(value)
    if (next.releaseChannel !== getConfig().releaseChannel && !updateService.canChangeChannel()) {
      throw new Error('请先完成当前更新流程，再切换更新通道。')
    }
    const config = setConfig(next)
    updateService.setChannel(config.releaseChannel)
    return config
  })
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

async function rasterizeSvgs(svgs: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  for (const svg of svgs) {
    buffers.push(await sharp(Buffer.from(svg)).png().toBuffer())
  }
  return buffers
}

async function notedCrops(entryIds: string[]) {
  const crops = await getEntryBuffers(entryIds)
  if (!crops.length) throw new Error('请先在错题集中勾选要组卷的错题。')
  return Promise.all(crops.map((crop) => applyBookNote(crop, BOOK_NOTES[crop.errorType])))
}
