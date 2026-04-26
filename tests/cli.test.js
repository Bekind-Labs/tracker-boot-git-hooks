import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest'
import { spawnSync, spawn } from 'child_process'
import { createServer } from 'http'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const CLI = new URL('../bin/cli.js', import.meta.url).pathname
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

function cli(args, { cwd, env, input } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
    input,
  })
}

function initGitRepo(dir) {
  spawnSync('git', ['init', '-b', 'main', dir], { encoding: 'utf8' })
  spawnSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com'], { encoding: 'utf8' })
  spawnSync('git', ['-C', dir, 'config', 'user.name', 'Test'], { encoding: 'utf8' })
}

// Async wrapper around spawn for tests that need a live HTTP server in the
// same process — spawnSync would block the event loop and starve the server.
function cliAsync(args, { cwd, env, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    if (input != null) {
      child.stdin.write(input)
      child.stdin.end()
    }
    child.on('close', (status) => resolve({ status, stdout, stderr }))
  })
}

let tmpDir

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cli-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('unknown subcommand', () => {
  it('exits 1 and prints usage', () => {
    const r = cli(['bogus'])
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Usage:')
  })
})

describe('install', () => {
  it('writes a hook file and exits 0 in a plain git repo', () => {
    initGitRepo(tmpDir)
    const r = cli(['install'], { cwd: tmpDir })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('hook installed')
    const hook = readFileSync(join(tmpDir, '.git', 'hooks', 'pre-push'), 'utf8')
    expect(hook).toContain('tracker-boot-git-hooks hook "$@"')
  })

  it('uses --base-url when provided', () => {
    initGitRepo(tmpDir)
    const r = cli(['install', '--base-url', 'https://staging.example.com'], { cwd: tmpDir })
    expect(r.status).toBe(0)
    const hook = readFileSync(join(tmpDir, '.git', 'hooks', 'pre-push'), 'utf8')
    expect(hook).toContain('staging.example.com')
  })

  it('exits 1 and prints boxen error when a foreign hook already exists', () => {
    initGitRepo(tmpDir)
    const hooksDir = join(tmpDir, '.git', 'hooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(join(hooksDir, 'pre-push'), '#!/bin/sh\nsome other tool\n', { mode: 0o755 })
    const r = cli(['install'], { cwd: tmpDir })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('pre-push')
  })

  it('exits 1 with a clear message when run outside a git repo', () => {
    const r = cli(['install'], { cwd: tmpDir })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('git repository')
  })

  it('exits 1 when --base-url flag is provided without a value', () => {
    const r = cli(['install', '--base-url'])
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('--base-url requires a value')
  })
})

describe('hook subcommand', () => {
  it('exits 0 with no output when stdin has no ref lines', async () => {
    // '\n' is a blank line — parsePushInput filters it → no work → fast exit
    const r = await cliAsync(['hook'], { input: '\n' })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
  })

  it('exits 0 silently when no commits reference a story ID', async () => {
    initGitRepo(tmpDir)
    writeFileSync(join(tmpDir, 'f.txt'), 'hello')
    spawnSync('git', ['-C', tmpDir, 'add', 'f.txt'], { encoding: 'utf8' })
    spawnSync('git', ['-C', tmpDir, 'commit', '-m', 'chore: no story reference'], { encoding: 'utf8' })
    const sha = spawnSync('git', ['-C', tmpDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    const stdin = `refs/heads/main ${sha} refs/heads/main ${EMPTY_TREE}\n`

    const r = await cliAsync(['hook'], { cwd: tmpDir, input: stdin })
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
  })

  describe('with a mock API server that succeeds', () => {
    let server
    let port

    beforeAll(async () => {
      await new Promise((resolve) => {
        server = createServer((_req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ data: { executeCommand: { version: 2 } } }))
        })
        server.listen(0, () => {
          port = server.address().port
          resolve()
        })
      })
    })

    afterAll(() => new Promise((resolve) => server.close(resolve)))

    it('exits 0 and prints "comment posted" to stderr on success', async () => {
      initGitRepo(tmpDir)

      const globalConfig = join(tmpDir, '.gitconfig')
      writeFileSync(globalConfig, '[tracker]\n\tapiKey = test-key\n\tpersonId = test-person\n')
      spawnSync('git', ['-C', tmpDir, 'config', 'tracker.projectId', 'proj-1'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
      })

      writeFileSync(join(tmpDir, 'f.txt'), 'hello')
      spawnSync('git', ['-C', tmpDir, 'add', 'f.txt'], { encoding: 'utf8' })
      spawnSync('git', ['-C', tmpDir, 'commit', '-m', '[#123456789] add feature'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
      })
      const sha = spawnSync('git', ['-C', tmpDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
      const stdin = `refs/heads/main ${sha} refs/heads/main ${EMPTY_TREE}\n`

      const r = await cliAsync(['hook'], {
        cwd: tmpDir,
        input: stdin,
        env: {
          GIT_CONFIG_GLOBAL: globalConfig,
          TRACKER_BASE_URL: `http://localhost:${port}`,
          LANG: 'en_US.UTF-8',
        },
      })

      expect(r.status).toBe(0)
      expect(r.stderr).toContain('comment posted on story 123456789')
    })
  })

  describe('with a mock API server', () => {
    let server
    let port

    beforeAll(async () => {
      await new Promise((resolve) => {
        server = createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ errors: [{ message: 'service unavailable' }] }))
        })
        server.listen(0, () => {
          port = server.address().port
          resolve()
        })
      })
    })

    afterAll(() => new Promise((resolve) => server.close(resolve)))

    it('exits 0 and prints API error to stderr when the API fails', async () => {
      initGitRepo(tmpDir)

      // Isolate global git config so we don't touch ~/.gitconfig
      const globalConfig = join(tmpDir, '.gitconfig')
      writeFileSync(globalConfig, '[tracker]\n\tapiKey = test-key\n\tpersonId = test-person\n')
      spawnSync('git', ['-C', tmpDir, 'config', 'tracker.projectId', 'proj-1'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
      })

      writeFileSync(join(tmpDir, 'f.txt'), 'hello')
      spawnSync('git', ['-C', tmpDir, 'add', 'f.txt'], { encoding: 'utf8' })
      spawnSync('git', ['-C', tmpDir, 'commit', '-m', '[#123456789] add feature'], {
        encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig },
      })
      const sha = spawnSync('git', ['-C', tmpDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
      const stdin = `refs/heads/main ${sha} refs/heads/main ${EMPTY_TREE}\n`

      const r = await cliAsync(['hook'], {
        cwd: tmpDir,
        input: stdin,
        env: {
          GIT_CONFIG_GLOBAL: globalConfig,
          TRACKER_BASE_URL: `http://localhost:${port}`,
          LANG: 'en_US.UTF-8',
        },
      })

      expect(r.status).toBe(0) // push is never blocked
      expect(r.stderr).toContain('service unavailable')
    })
  })
})
