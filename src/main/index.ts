import { app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { configureLogging, log } from '@main/logging'
import { registerIpcHandlers } from '@main/ipc'
import { installApplicationMenu } from '@main/menu'
import { getConfig } from '@main/services/config'
import { createMainWindow } from '@main/window'
import { UpdateService } from '@main/updater'

configureLogging()

app.setName('盈盈错题库')

const singleInstanceLock = app.requestSingleInstanceLock()
const updateService = new UpdateService()

if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.yycuotiku.app')

    if (process.platform === 'darwin' && !app.isPackaged) {
      const image = nativeImage.createFromPath(join(app.getAppPath(), 'build/icon.png'))
      if (!image.isEmpty()) app.dock?.setIcon(image)
    }

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception', error)
    })

    process.on('unhandledRejection', (reason) => {
      log.error('Unhandled rejection', reason)
    })

    updateService.setChannel(getConfig().releaseChannel)
    updateService.initialize()
    registerIpcHandlers(updateService)

    const mainWindow = createMainWindow()
    updateService.attachWindow(mainWindow)
    installApplicationMenu(updateService)
    updateService.scheduleStartupCheck()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const window = createMainWindow()
        updateService.attachWindow(window)
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
