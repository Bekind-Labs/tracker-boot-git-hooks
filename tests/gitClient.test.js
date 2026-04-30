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

  it('uses --not --remotes=<remote> when remoteSha is null and remote is known', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: 'abc1234\x00fix\x00\x00\n' })
    getCommitsInRange(null, 'def5678', { remote: 'origin' })
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['log', 'def5678', '--not', '--remotes=origin', '--format=%H%x00%s%x00%b%x00'],
      expect.anything()
    )
  })

  it('uses --not --remotes when remoteSha is null and no remote name is available', () => {
    spawnSync.mockReturnValueOnce({ status: 0, stdout: '' })
    getCommitsInRange(null, 'def5678')
    expect(spawnSync).toHaveBeenCalledWith(
      'git',
      ['log', 'def5678', '--not', '--remotes', '--format=%H%x00%s%x00%b%x00'],
      expect.anything()
    )
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
