import type { UpdateState } from './types'

export function canStartUpdateCheck(state: UpdateState): boolean {
  return ['idle', 'not-available', 'error'].includes(state.status)
}

export type UpdateMenuAction = 'check' | 'download' | 'install'

export interface UpdateMenuState {
  label: string
  enabled: boolean
  action: UpdateMenuAction
}

export function getUpdateMenuState(state: UpdateState, canAutoUpdate: boolean): UpdateMenuState {
  if (!canAutoUpdate) {
    return { label: '当前平台不支持应用内更新', enabled: false, action: 'check' }
  }

  switch (state.status) {
    case 'checking':
      return { label: '正在检查更新…', enabled: false, action: 'check' }
    case 'available':
      return {
        label: state.version ? `下载更新 v${state.version}…` : '下载更新…',
        enabled: true,
        action: 'download',
      }
    case 'downloading':
      return {
        label: state.progress
          ? `正在下载更新… ${Math.round(state.progress.percent)}%`
          : '正在下载更新…',
        enabled: false,
        action: 'download',
      }
    case 'downloaded':
      return {
        label: state.version ? `重启并安装 v${state.version}…` : '重启并安装更新…',
        enabled: true,
        action: 'install',
      }
    case 'error':
      return { label: '重新检查更新…', enabled: true, action: 'check' }
    case 'not-available':
      return { label: '再次检查更新…', enabled: true, action: 'check' }
    case 'idle':
      return { label: '检查更新…', enabled: true, action: 'check' }
  }
}

export function createIdleUpdateState(
  channel: UpdateState['channel'],
  canAutoUpdate: boolean,
): UpdateState {
  return {
    status: 'idle',
    channel,
    message: canAutoUpdate ? '可以检查更新。' : 'Linux 版本请通过应用商店或系统包管理器更新。',
  }
}
