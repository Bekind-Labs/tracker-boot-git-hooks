import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHook } from '../src/hook.js'

beforeEach(() => {
  process.env.LANG = 'en_US.UTF-8'
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.TRACKER_DEBUG
  delete process.env.TRACKER_BOOT_API_KEY
  delete process.env.TRACKER_BOOT_PROJECT_ID
})

const HOOK_ARGS = {
  stdin: 'refs/heads/main abc refs/heads/main def\n',
  mutationUrl: 'https://api.example.com/graphql',
  remoteUrl: null,
}

const STORY_COMMIT = { sha: 'abc123456789', subject: '[#123456789] fix bug', body: '' }
const FINISH_COMMIT = { sha: 'abc123456789', subject: '[finished #123456789] the login flow', body: '' }

function makeDeps(overrides = {}) {
  return {
    getConfig: vi.fn().mockReturnValue(null),
    setGlobalConfig: vi.fn(),
    setLocalConfig: vi.fn(),
    createComment: vi.fn().mockResolvedValue({}),
    updateStoryStatus: vi.fn().mockResolvedValue({}),
    getCommitsInRange: vi.fn().mockReturnValue([]),
    prompt: vi.fn().mockResolvedValue('user-input'),
    checkForUpdate: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function withConfig(deps, { apiKey = 'key-1', projectId = 'proj-1' } = {}) {
  deps.getConfig.mockImplementation((key, { global: isGlobal, local: isLocal } = {}) => {
    if (key === 'tracker.apiKey' && isGlobal) return apiKey
    if (key === 'tracker.projectId' && isLocal) return projectId
    return null
  })
  return deps
}

describe('runHook', () => {
  it('posts a comment for each (commit, storyId) pair', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledOnce()
    expect(deps.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: '123456789', projectId: 'proj-1' })
    )
  })

  it('does not include personId in the createComment call', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    const call = deps.createComment.mock.calls[0][0]
    expect(call.personId).toBeUndefined()
  })

  it('posts separate comments for each story ID in a single commit', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      { sha: 'abc123456789', subject: '[#111111111] [#222222222] two stories', body: '' },
    ])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledTimes(2)
    expect(deps.createComment).toHaveBeenCalledWith(expect.objectContaining({ storyId: '111111111' }))
    expect(deps.createComment).toHaveBeenCalledWith(expect.objectContaining({ storyId: '222222222' }))
  })

  it('skips commits with no story IDs', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([{ sha: 'abc1234', subject: 'chore: deps', body: '' }])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).not.toHaveBeenCalled()
  })

  it('writes a git error to stderr and exits cleanly when getCommitsInRange throws', async () => {
    const deps = makeDeps({
      getCommitsInRange: vi.fn().mockImplementation(() => { throw new Error('git log failed: corrupt object') }),
    })

    await expect(runHook(HOOK_ARGS, deps)).resolves.not.toThrow()
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('git log failed: corrupt object'))
  })

  it('does not prompt for credentials when no commits reference a story', async () => {
    const deps = makeDeps()
    deps.getCommitsInRange.mockReturnValue([{ sha: 'abc1234', subject: 'chore: deps', body: '' }])

    await runHook(HOOK_ARGS, deps)

    expect(deps.prompt).not.toHaveBeenCalled()
    expect(deps.getConfig).not.toHaveBeenCalled()
  })

  it('continues after a single API error and does not throw', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      { sha: 'sha111111111', subject: '[#111111111] fix a', body: '' },
      { sha: 'sha222222222', subject: '[#111111111] fix b', body: '' },
    ])
    deps.createComment
      .mockRejectedValueOnce(new Error('API down'))
      .mockResolvedValueOnce({})

    await expect(runHook(HOOK_ARGS, deps)).resolves.not.toThrow()
    expect(deps.createComment).toHaveBeenCalledTimes(2)
  })

  it('resolves without throwing when credential setup fails', async () => {
    const deps = makeDeps({
      prompt: vi.fn().mockRejectedValue(new Error('no tty available')),
    })
    deps.getConfig.mockImplementation((key, { local: isLocal } = {}) => {
      if (key === 'tracker.projectId' && isLocal) return 'proj-1'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await expect(runHook(HOOK_ARGS, deps)).resolves.not.toThrow()
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('setup failed'))
  })

  it('writes "comment posted" to stderr after a successful API call', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('comment posted on story 123456789')
    )
  })

  it('writes update nudge to stderr when a newer version is available', async () => {
    const deps = withConfig(makeDeps({
      checkForUpdate: vi.fn().mockResolvedValue({ latest: '99.0.0', current: '0.1.0' }),
    }))
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('99.0.0')
    )
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('npm install -g tracker-boot-git-hooks')
    )
  })

  it('does not write update nudge when already on latest', async () => {
    const deps = withConfig(makeDeps({
      checkForUpdate: vi.fn().mockResolvedValue(null),
    }))
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    const calls = process.stderr.write.mock.calls.map(([s]) => s)
    expect(calls.every(s => !s.includes('npm install -g'))).toBe(true)
  })

  it('writes debug lines to stderr when TRACKER_DEBUG is set', async () => {
    process.env.TRACKER_DEBUG = '1'
    const deps = withConfig(makeDeps())

    await runHook(HOOK_ARGS, deps)

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('[tracker-boot debug]'))
  })

  it('prompts for API key when absent and stores it globally', async () => {
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { local: isLocal } = {}) => {
      if (key === 'tracker.projectId' && isLocal) return 'proj-1'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.prompt).toHaveBeenCalled()
    expect(deps.setGlobalConfig).toHaveBeenCalledWith('tracker.apiKey', 'user-input')
  })

  it('prompts for project ID when absent and stores it locally', async () => {
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { global: isGlobal } = {}) => {
      if (key === 'tracker.apiKey' && isGlobal) return 'my-key'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.prompt).toHaveBeenCalled()
    expect(deps.setLocalConfig).toHaveBeenCalledWith('tracker.projectId', 'user-input')
  })

  it('uses TRACKER_BOOT_API_KEY env var instead of git config', async () => {
    process.env.TRACKER_BOOT_API_KEY = 'env-api-key'
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { local: isLocal } = {}) => {
      if (key === 'tracker.projectId' && isLocal) return 'proj-1'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'env-api-key' })
    )
    expect(deps.prompt).not.toHaveBeenCalled()
    expect(deps.setGlobalConfig).not.toHaveBeenCalled()
  })

  it('uses TRACKER_BOOT_PROJECT_ID env var instead of git config', async () => {
    process.env.TRACKER_BOOT_PROJECT_ID = 'env-proj-id'
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { global: isGlobal } = {}) => {
      if (key === 'tracker.apiKey' && isGlobal) return 'my-key'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'env-proj-id' })
    )
    expect(deps.prompt).not.toHaveBeenCalled()
    expect(deps.setLocalConfig).not.toHaveBeenCalled()
  })

  it('env vars take precedence over git config values', async () => {
    process.env.TRACKER_BOOT_API_KEY = 'env-api-key'
    process.env.TRACKER_BOOT_PROJECT_ID = 'env-proj-id'
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'env-api-key', projectId: 'env-proj-id' })
    )
  })

  it('does not call updateStoryStatus when commit has no finish keyword', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.updateStoryStatus).not.toHaveBeenCalled()
  })

  it.each(['finished', 'finish', 'finishes', 'FINISHED'])(
    'calls updateStoryStatus with status Finished when bracket contains "%s"',
    async (keyword) => {
      const deps = withConfig(makeDeps())
      deps.getCommitsInRange.mockReturnValue([
        { sha: 'abc123456789', subject: `[${keyword} #123456789] the login flow`, body: '' },
      ])

      await runHook(HOOK_ARGS, deps)

      expect(deps.updateStoryStatus).toHaveBeenCalledOnce()
      expect(deps.updateStoryStatus).toHaveBeenCalledWith(
        expect.objectContaining({ storyId: '123456789', status: 'Finished', projectId: 'proj-1' })
      )
    }
  )

  it('does not call updateStoryStatus when finish keyword is outside the brackets', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      { sha: 'abc123456789', subject: '[#123456789] finished the login flow', body: '' },
    ])

    await runHook(HOOK_ARGS, deps)

    expect(deps.updateStoryStatus).not.toHaveBeenCalled()
  })

  it('also posts a comment when a finish keyword is present', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      FINISH_COMMIT,
    ])

    await runHook(HOOK_ARGS, deps)

    expect(deps.createComment).toHaveBeenCalledOnce()
    expect(deps.updateStoryStatus).toHaveBeenCalledOnce()
  })

  it('only updates status for story IDs whose bracket contains a finish keyword', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      { sha: 'abc123456789', subject: '[finished #111111111] [#222222222] msg', body: '' },
    ])

    await runHook(HOOK_ARGS, deps)

    expect(deps.updateStoryStatus).toHaveBeenCalledOnce()
    expect(deps.updateStoryStatus).toHaveBeenCalledWith(expect.objectContaining({ storyId: '111111111' }))
  })

  it('updates status for each story ID whose bracket contains a finish keyword', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      { sha: 'abc123456789', subject: '[finished #111111111] [finished #222222222] msg', body: '' },
    ])

    await runHook(HOOK_ARGS, deps)

    expect(deps.updateStoryStatus).toHaveBeenCalledTimes(2)
    expect(deps.updateStoryStatus).toHaveBeenCalledWith(expect.objectContaining({ storyId: '111111111' }))
    expect(deps.updateStoryStatus).toHaveBeenCalledWith(expect.objectContaining({ storyId: '222222222' }))
  })

  it('continues after updateStoryStatus failure and writes error to stderr', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([
      FINISH_COMMIT,
    ])
    deps.updateStoryStatus.mockRejectedValueOnce(new Error('status update failed'))

    await expect(runHook(HOOK_ARGS, deps)).resolves.not.toThrow()
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('status update failed'))
  })

  it('writes a single combined message to stderr when comment and status update both succeed', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([FINISH_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(process.stderr.write).toHaveBeenCalledOnce()
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('123456789'))
  })
})
