import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getConfig, setGlobalConfig, setLocalConfig } from '../src/configManager.js'

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from 'child_process'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getConfig', () => {
  it('returns the value from git config', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'my-api-key\n' })
    expect(getConfig('tracker.apiKey', { global: true })).toBe('my-api-key')
  })

  it('returns null when the key is not set', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '' })
    expect(getConfig('tracker.apiKey', { global: true })).toBeNull()
  })

  it('reads local config only when local is true', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'proj-123\n' })
    expect(getConfig('tracker.projectId', { local: true })).toBe('proj-123')
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['config', '--local', 'tracker.projectId'],
      expect.anything()
    )
  })
})

describe('setGlobalConfig', () => {
  it('writes to global git config', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stderr: '' })
    setGlobalConfig('tracker.apiKey', 'secret')
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['config', '--global', 'tracker.apiKey', 'secret'],
      expect.objectContaining({ encoding: 'utf8' })
    )
  })

  it('throws when git config fails', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stderr: 'error: could not lock config file' })
    expect(() => setGlobalConfig('tracker.apiKey', 'x')).toThrow('could not lock config file')
  })
})

describe('setLocalConfig', () => {
  it('writes to local git config', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stderr: '' })
    setLocalConfig('tracker.projectId', 'proj-999')
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['config', 'tracker.projectId', 'proj-999'],
      expect.objectContaining({ encoding: 'utf8' })
    )
  })

  it('throws when git config fails', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stderr: 'error: could not write config' })
    expect(() => setLocalConfig('tracker.projectId', 'x')).toThrow('could not write config')
  })
})
