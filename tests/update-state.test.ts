import { describe, expect, it } from 'vitest'
import {
  canStartUpdateCheck,
  createIdleUpdateState,
  getUpdateMenuState,
} from '@shared/update-state'

describe('update state helpers', () => {
  it('creates platform-aware idle messages', () => {
    expect(createIdleUpdateState('stable', true).message).toContain('检查更新')
    expect(createIdleUpdateState('beta', false).message).toContain('包管理器')
  })

  it('prevents duplicate checks while busy', () => {
    expect(canStartUpdateCheck({ status: 'idle', channel: 'stable', message: 'ready' })).toBe(true)
    expect(canStartUpdateCheck({ status: 'checking', channel: 'stable', message: 'busy' })).toBe(
      false,
    )
    expect(canStartUpdateCheck({ status: 'downloading', channel: 'stable', message: 'busy' })).toBe(
      false,
    )
    expect(
      canStartUpdateCheck({ status: 'available', channel: 'stable', message: 'available' }),
    ).toBe(false)
    expect(
      canStartUpdateCheck({ status: 'downloaded', channel: 'stable', message: 'downloaded' }),
    ).toBe(false)
  })

  it('maps update states to the native menu action', () => {
    expect(
      getUpdateMenuState(
        { status: 'available', channel: 'stable', message: 'available', version: '1.2.0' },
        true,
      ),
    ).toEqual({ label: '下载更新 v1.2.0…', enabled: true, action: 'download' })
    expect(
      getUpdateMenuState(
        { status: 'downloaded', channel: 'stable', message: 'downloaded', version: '1.2.0' },
        true,
      ).action,
    ).toBe('install')
    expect(
      getUpdateMenuState({ status: 'idle', channel: 'stable', message: 'ready' }, false).enabled,
    ).toBe(false)
  })
})
