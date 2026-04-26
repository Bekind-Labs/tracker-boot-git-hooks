import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}))

import { spawnSync } from 'child_process'
import { getCommitsInRange } from '../src/gitClient.js'

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('getCommitsInRange', () => {
  it('returns parsed commits for the SHA range', () => {
    spawnSync.mockReturnValueOnce({
      status: 0,
      stdout:
        'abc1234\x00fix login\x00Extra body\n\x00\n' +
        'def5678\x00add test\x00\x00\n',
    })
    const commits = getCommitsInRange('old', 'new')
    expect(commits).toEqual([
      { sha: 'abc1234', subject: 'fix login', body: 'Extra body' },
      { sha: 'def5678', subject: 'add test', body: '' },
    ])
  })

  it('returns empty array when git log produces nothing', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '' })
    expect(getCommitsInRange('old', 'new')).toEqual([])
  })

  it('throws when git log fails', () => {
    spawnSync.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'fatal: bad object abc' })
    expect(() => getCommitsInRange('bad', 'sha')).toThrow('fatal: bad object abc')
  })

  it('preserves newlines inside a commit body', () => {
    spawnSync.mockReturnValueOnce({
      status: 0,
      stdout: 'abc1234\x00fix login\x00Line 1\nLine 2\x00\n',
    })
    const [commit] = getCommitsInRange('old', 'new')
    expect(commit.body).toBe('Line 1\nLine 2')
  })
})
