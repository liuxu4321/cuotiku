import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import log from 'electron-log/main'
import { ipcChannels } from '@shared/ipc'
import { canUseBuiltInAutoUpdate } from '@shared/platform'
import { canStartUpdateCheck, createIdleUpdateState } from '@shared/update-state'
import type { ReleaseChannel, UpdateState } from '@shared/types'

const defaultUpdateChannel = (
  process.env.UPDATE_CHANNEL === 'beta' ? 'beta' : 'stable'
) satisfies ReleaseChannel
const { autoUpdater } = electronUpdater
type UpdateStateListener = (state: UpdateState) => void

export class UpdateService {
  private state: UpdateState

  private window: BrowserWindow | null = null
  private checkInProgress = false
  private channel: ReleaseChannel
  private readonly listeners = new Set<UpdateStateListener>()

  constructor(channel: ReleaseChannel = defaultUpdateChannel) {
    this.channel = channel
    this.state = createIdleUpdateState(channel, canUseBuiltInAutoUpdate(process.platform))
    autoUpdater.logger = log
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    this.configureChannel(channel)
  }

  attachWindow(window: BrowserWindow): void {
    this.window = window
  }

  initialize(): void {
    autoUpdater.on('checking-for-update', () => {
      this.setState({ status: 'checking', message: '正在检测新版本…' })
    })

    autoUpdater.on('update-available', (info) => {
      this.checkInProgress = false
      this.setState({
        status: 'available',
        message: `发现新版本 ${info.version}，可下载更新。`,
        version: info.version,
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.checkInProgress = false
      this.setState({ status: 'not-available', message: '当前已是最新版本。' })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        status: 'downloading',
        message: `正在下载更新… ${Math.round(progress.percent)}%`,
        ...(this.state.version ? { version: this.state.version } : {}),
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.checkInProgress = false
      this.setState({
        status: 'downloaded',
        message: '更新已下载完成，可重启安装。',
        version: info.version,
      })
    })

    autoUpdater.on('error', (error) => {
      this.handleError(error, '更新失败，请检查网络后重试。')
    })
  }

  scheduleStartupCheck(): void {
    setTimeout(() => {
      void this.checkForUpdates()
    }, 15_000)
    setInterval(
      () => {
        void this.checkForUpdates()
      },
      4 * 60 * 60 * 1000,
    )
  }

  getState(): UpdateState {
    return this.state
  }

  onStateChanged(listener: UpdateStateListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  canChangeChannel(): boolean {
    return !['checking', 'downloading', 'downloaded'].includes(this.state.status)
  }

  setChannel(channel: ReleaseChannel): UpdateState {
    if (channel === this.channel) return this.state
    this.channel = channel
    this.configureChannel(channel)
    if (!['downloading', 'downloaded'].includes(this.state.status)) {
      this.checkInProgress = false
      this.setState(createIdleUpdateState(channel, canUseBuiltInAutoUpdate(process.platform)))
    } else {
      this.setState({
        status: this.state.status,
        message: this.state.message,
        ...(this.state.version ? { version: this.state.version } : {}),
        ...(this.state.progress ? { progress: this.state.progress } : {}),
      })
    }
    return this.state
  }

  async checkForUpdates(): Promise<UpdateState> {
    if (!canUseBuiltInAutoUpdate(process.platform)) {
      this.setState({
        status: 'not-available',
        message: 'Linux 版本请通过应用商店或系统包管理器更新。',
      })
      return this.state
    }

    if (!app.isPackaged) {
      this.setState({
        status: 'not-available',
        message: '开发模式不支持应用内更新，请安装打包版本后验证。',
      })
      return this.state
    }

    if (this.checkInProgress || !canStartUpdateCheck(this.state)) {
      return this.state
    }

    this.checkInProgress = true
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      if (this.state.status !== 'error') {
        this.handleError(error, '检查更新失败，请检查网络后重试。')
      }
    }
    return this.state
  }

  quitAndInstall(): void {
    if (this.state.status !== 'downloaded' || !app.isPackaged) return
    autoUpdater.quitAndInstall(false, true)
  }

  async downloadUpdate(): Promise<UpdateState> {
    if (!app.isPackaged) return this.state
    if (this.state.status !== 'available' || this.checkInProgress) return this.state
    this.checkInProgress = true
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      if (this.getState().status !== 'error') {
        this.handleError(error, '下载更新失败，请检查网络后重试。')
      }
    }
    return this.state
  }

  private configureChannel(channel: ReleaseChannel): void {
    autoUpdater.channel = channel
    autoUpdater.allowPrerelease = channel === 'beta'
  }

  private handleError(error: unknown, message: string): void {
    this.checkInProgress = false
    const detail = error instanceof Error ? error.message : String(error)
    this.setState({ status: 'error', message, error: detail })
    log.warn('Update error', error)
  }

  private setState(next: Omit<UpdateState, 'channel'> | UpdateState): void {
    this.state = {
      ...next,
      channel: this.channel,
    }
    log.info('Update state changed', { status: this.state.status, channel: this.state.channel })
    this.window?.webContents.send(ipcChannels.updaterStateChanged, this.state)
    for (const listener of this.listeners) listener(this.state)
  }
}
