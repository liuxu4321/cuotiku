import { describe, expect, it } from 'vitest'
import { ipcChannels } from '@shared/ipc'
import { appConfigSchema, externalUrlSchema, themePreferenceSchema } from '@shared/schemas'

describe('IPC contracts and schemas', () => {
  it('keeps IPC channel strings centralized', () => {
    expect(new Set(Object.values(ipcChannels)).size).toBe(Object.values(ipcChannels).length)
    expect(ipcChannels.updaterCheck).toBe('updater:check')
    expect(ipcChannels.appNavigate).toBe('app:navigate')
  })

  it('accepts only supported theme values', () => {
    expect(themePreferenceSchema.parse('dark')).toBe('dark')
    expect(() => themePreferenceSchema.parse('blue')).toThrow()
  })

  it('applies safe config defaults', () => {
    expect(appConfigSchema.parse({})).toEqual({
      theme: 'system',
      uiTheme: 'default',
      releaseChannel: 'stable',
      layout: {
        paper: 'A4',
        mode: 'auto',
        gapMm: 8,
        marginMm: 10,
        printMode: 'normal',
        thermalSize: '80x60',
      },
      processing: { enhance: true, enhanceStrength: 55 },
      grade: 1,
      term: 1,
      subject: '语文',
      bookDir: '',
      thermalPrinter: '',
      templateId: 'cuotiben-2up',
    })
  })

  it('allows only approved external protocols', () => {
    expect(externalUrlSchema.parse('https://example.com')).toBe('https://example.com')
    expect(externalUrlSchema.parse('mailto:support@example.com')).toBe('mailto:support@example.com')
    expect(() => externalUrlSchema.parse('file:///etc/passwd')).toThrow()
    expect(() => externalUrlSchema.parse('javascript:alert(1)')).toThrow()
  })
})
