import { app, BrowserWindow, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { UpdateService } from '@main/updater'
import { ipcChannels } from '@shared/ipc'
import { canUseBuiltInAutoUpdate } from '@shared/platform'
import { getUpdateMenuState } from '@shared/update-state'
import type { AppRoute } from '@shared/types'

const updateMenuItemId = 'application-update'

export function installApplicationMenu(updateService: UpdateService): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: `关于${app.name}`, click: () => navigateTo('/about') },
              { type: 'separator' as const },
              {
                label: '设置…',
                accelerator: 'CmdOrCtrl+,',
                click: () => navigateTo('/settings'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: '文件',
      submenu: [
        ...(!isMac
          ? [
              {
                label: '设置…',
                accelerator: 'CmdOrCtrl+,',
                click: () => navigateTo('/settings'),
              },
              { type: 'separator' as const },
            ]
          : []),
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: '语音',
                submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
              },
            ]
          : [{ role: 'delete' as const }, { role: 'selectAll' as const }]),
      ],
    },
    {
      label: '视图',
      submenu: [
        ...(app.isPackaged
          ? []
          : [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const },
            ]),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      label: '帮助',
      role: 'help',
      submenu: [
        {
          id: updateMenuItemId,
          label: '检查更新…',
          click: () => {
            void runUpdateAction(updateService)
          },
        },
        { type: 'separator' },
        ...(!isMac ? [{ label: `关于${app.name}`, click: () => navigateTo('/about') }] : []),
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  const syncUpdateItem = (): void => {
    const item = menu.getMenuItemById(updateMenuItemId)
    if (!item) return
    const view = getUpdateMenuState(
      updateService.getState(),
      canUseBuiltInAutoUpdate(process.platform),
    )
    item.label = view.label
    item.enabled = view.enabled
  }

  syncUpdateItem()
  updateService.onStateChanged(syncUpdateItem)
}

async function runUpdateAction(updateService: UpdateService): Promise<void> {
  const view = getUpdateMenuState(
    updateService.getState(),
    canUseBuiltInAutoUpdate(process.platform),
  )
  if (!view.enabled) return
  if (view.action === 'download') {
    await updateService.downloadUpdate()
    return
  }
  if (view.action === 'install') {
    updateService.quitAndInstall()
    return
  }
  await updateService.checkForUpdates()
}

function navigateTo(route: AppRoute): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  window.webContents.send(ipcChannels.appNavigate, route)
}
