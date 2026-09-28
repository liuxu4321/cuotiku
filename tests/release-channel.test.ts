import { describe, expect, it } from 'vitest'
import { resolveReleaseChannel, toUpdateManifestChannel } from '@shared/release-channel'

describe('release channel resolution', () => {
  it('prefers the configured channel', () => {
    expect(resolveReleaseChannel('1.0.0', 'beta')).toBe('beta')
    expect(resolveReleaseChannel('1.0.0-beta.1', 'stable')).toBe('stable')
  })

  it('derives the channel from the version prerelease tag', () => {
    expect(resolveReleaseChannel('1.2.3')).toBe('stable')
    expect(resolveReleaseChannel('1.2.3-beta.4')).toBe('beta')
  })

  it('maps stable to the latest update manifest channel', () => {
    expect(toUpdateManifestChannel('stable')).toBe('latest')
    expect(toUpdateManifestChannel('beta')).toBe('beta')
  })
})
