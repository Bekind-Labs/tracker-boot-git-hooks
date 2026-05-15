import { runHook } from '../src/hook.js'

await runHook(
  {
    stdin: 'refs/heads/main abc123 refs/heads/main def456\n',
    mutationUrl: 'http://localhost',
    queryUrl: 'http://localhost',
    remoteName: 'origin',
    remoteUrl: null,
  },
  {
    getCommitsInRange: () => [{ sha: 'abc123456789', subject: '[#123456789] test commit', body: '' }],
    getConfig: (key, { global: isGlobal, local: isLocal } = {}) => {
      if (key === 'tracker.apiKey' && isGlobal) return 'fake-key'
      if (key === 'tracker.personId' && isGlobal) return 'fake-person'
      if (key === 'tracker.projectId' && isLocal) return 'fake-proj'
      return null
    },
    setGlobalConfig: () => {},
    setLocalConfig: () => {},
    getMe: async () => 'fake-person',
    createComment: async () => ({}),
    prompt: async () => { throw new Error('no prompt expected') },
    checkForUpdate: async () => ({ latest: '99.0.0', current: '0.1.0' }),
  }
)
