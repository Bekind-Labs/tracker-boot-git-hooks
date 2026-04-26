import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runHook } from '../src/hook.js'

beforeEach(() => {
  process.env.LANG = 'en_US.UTF-8'
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.TRACKER_DEBUG
})

const HOOK_ARGS = {
  stdin: 'refs/heads/main abc refs/heads/main def\n',
  mutationUrl: 'https://api.example.com/graphql',
  queryUrl: 'https://api.example.com/analytics/graphql',
  remoteUrl: null,
}

const STORY_COMMIT = { sha: 'abc123456789', subject: '[#123456789] fix bug', body: '' }

function makeDeps(overrides = {}) {
  return {
    getConfig: vi.fn().mockReturnValue(null),
    setGlobalConfig: vi.fn(),
    setLocalConfig: vi.fn(),
    getMe: vi.fn().mockResolvedValue('person-1'),
    createComment: vi.fn().mockResolvedValue({}),
    getCommitsInRange: vi.fn().mockReturnValue([]),
    prompt: vi.fn().mockResolvedValue('user-input'),
    ...overrides,
  }
}

function withConfig(deps, { apiKey = 'key-1', personId = 'p-1', projectId = 'proj-1' } = {}) {
  deps.getConfig.mockImplementation((key, { global: isGlobal, local: isLocal } = {}) => {
    if (key === 'tracker.apiKey' && isGlobal) return apiKey
    if (key === 'tracker.personId' && isGlobal) return personId
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
      expect.objectContaining({ storyId: '123456789', personId: 'p-1', projectId: 'proj-1' })
    )
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
      getMe: vi.fn().mockRejectedValue(new Error('invalid API key')),
    })
    deps.getConfig.mockImplementation((key, { local: isLocal } = {}) => {
      if (key === 'tracker.projectId' && isLocal) return 'proj-1'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await expect(runHook(HOOK_ARGS, deps)).resolves.not.toThrow()
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('setup failed'))
  })

  it('fetches and stores person ID when only an API key is configured', async () => {
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { global: isGlobal, local: isLocal } = {}) => {
      if (key === 'tracker.apiKey' && isGlobal) return 'my-key'
      if (key === 'tracker.projectId' && isLocal) return 'proj-1'
      return null
    })
    deps.getMe.mockResolvedValue('fetched-person-id')
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.getMe).toHaveBeenCalledWith({ queryUrl: HOOK_ARGS.queryUrl, apiKey: 'my-key' })
    expect(deps.setGlobalConfig).toHaveBeenCalledWith('tracker.personId', 'fetched-person-id')
  })

  it('writes "comment posted" to stderr after a successful API call', async () => {
    const deps = withConfig(makeDeps())
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('comment posted on story 123456789')
    )
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
    expect(deps.setGlobalConfig).toHaveBeenCalledWith('tracker.personId', 'person-1')
  })

  it('prompts for project ID when absent and stores it locally', async () => {
    const deps = makeDeps()
    deps.getConfig.mockImplementation((key, { global: isGlobal } = {}) => {
      if (key === 'tracker.apiKey' && isGlobal) return 'my-key'
      if (key === 'tracker.personId' && isGlobal) return 'p-1'
      return null
    })
    deps.getCommitsInRange.mockReturnValue([STORY_COMMIT])

    await runHook(HOOK_ARGS, deps)

    expect(deps.prompt).toHaveBeenCalled()
    expect(deps.setLocalConfig).toHaveBeenCalledWith('tracker.projectId', 'user-input')
  })
})
