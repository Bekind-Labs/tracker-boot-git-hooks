import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectHusky, install } from '../src/installer.js'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    chmodSync: vi.fn(),
  },
}))

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}))

import fs from 'fs'
import { spawnSync } from 'child_process'

function mockGitDefaults() {
  spawnSync.mockImplementation((cmd, args) => {
    if (args.includes('--git-common-dir')) return { status: 0, stdout: '.git\n' }
    return { status: 1, stdout: '' }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  fs.existsSync.mockReturnValue(false)
  mockGitDefaults()
})

describe('detectHusky', () => {
  it('returns false when .husky/ does not exist', () => {
    fs.existsSync.mockReturnValue(false)
    expect(detectHusky('/repo')).toBe(false)
  })

  it('returns true when .husky/ exists', () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('/.husky'))
    expect(detectHusky('/repo')).toBe(true)
  })
})

describe('install', () => {
  it('throws HOOK_EXISTS when a foreign hook already exists at the target path', () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('/pre-push'))
    fs.readFileSync.mockReturnValue('#!/bin/sh\nsome other tool')
    expect(() => install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' }))
      .toThrow(expect.objectContaining({ code: 'HOOK_EXISTS' }))
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('overwrites silently when our marker is present (upgrade case)', () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('/pre-push'))
    fs.readFileSync.mockReturnValue('#!/bin/sh\n# tracker-boot-git-hooks pre-push hook')
    const result = install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' })
    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(result.method).toBe('direct')
  })

  it('writes to .git/hooks/pre-push and sets executable in a normal repo', () => {
    const result = install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' })
    expect(fs.writeFileSync).toHaveBeenCalledWith('/repo/.git/hooks/pre-push', '#!/bin/sh\necho hi')
    expect(fs.chmodSync).toHaveBeenCalledWith('/repo/.git/hooks/pre-push', '755')
    expect(result.method).toBe('direct')
  })

  it('writes to the shared git dir in a linked worktree', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args.includes('--git-common-dir')) return { status: 0, stdout: '/main/.git\n' }
      return { status: 1, stdout: '' }
    })
    const result = install({ repoRoot: '/worktree', hookScript: '#!/bin/sh\necho hi' })
    expect(fs.writeFileSync).toHaveBeenCalledWith('/main/.git/hooks/pre-push', '#!/bin/sh\necho hi')
    expect(result.method).toBe('direct')
  })

  it('installs to core.hooksPath when configured', () => {
    spawnSync.mockImplementation((cmd, args) => {
      if (args.includes('core.hooksPath')) return { status: 0, stdout: '.githooks\n' }
      if (args.includes('--git-common-dir')) return { status: 0, stdout: '.git\n' }
      return { status: 1, stdout: '' }
    })
    const result = install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' })
    expect(fs.writeFileSync).toHaveBeenCalledWith('/repo/.githooks/pre-push', '#!/bin/sh\necho hi')
    expect(result.method).toBe('direct')
  })

  it('writes .husky/pre-push when husky is present', () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('/.husky'))
    const result = install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' })
    expect(fs.writeFileSync).toHaveBeenCalledWith('/repo/.husky/pre-push', '#!/bin/sh\necho hi')
    expect(fs.chmodSync).toHaveBeenCalledWith('/repo/.husky/pre-push', '755')
    expect(result.method).toBe('husky')
    expect(result.reminder).toContain('git add')
  })

  it('returns a warning when pre-commit config is present', () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('/.pre-commit-config.yaml'))
    const result = install({ repoRoot: '/repo', hookScript: '#!/bin/sh\necho hi' })
    expect(result.method).toBe('direct')
    expect(result.warning).toContain('pre-commit')
  })
})
