#!/usr/bin/env node
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { install } from '../src/installer.js'
import { buildHookScript } from '../src/hookTemplate.js'
import { detectLang, t } from '../src/i18n.js'
import { runHook } from '../src/hook.js'
import { resolveUrls, DEFAULT_BASE_URL } from '../src/urls.js'
import boxen from 'boxen'

const args = process.argv.slice(2)
const subcommand = args[0]

if (subcommand === 'hook') {
  if (process.stdin.isTTY) {
    process.stderr.write('tracker-boot-git-hooks: "hook" must be called by git (stdin must be a pipe).\n')
    process.exit(1)
  }
  const stdin = readFileSync('/dev/stdin', 'utf8')
  const baseUrl = process.env.TRACKER_BASE_URL ?? DEFAULT_BASE_URL
  // Git passes the remote name as $1 and remote URL as $2 to the pre-push hook
  const remoteName = args[1] ?? null
  const remoteUrl = args[2] ?? null

  runHook({
    stdin,
    ...resolveUrls(baseUrl),
    remoteName,
    remoteUrl,
  }).catch((err) => {
    process.stderr.write(`tracker-boot-git-hooks: unexpected error: ${err.message}\n`)
  })
} else if (subcommand === 'install') {
  const baseFlagIndex = args.indexOf('--base-url')
  const baseUrl = baseFlagIndex !== -1 ? args[baseFlagIndex + 1] : DEFAULT_BASE_URL

  if (!baseUrl) {
    process.stderr.write('Error: --base-url requires a value.\n')
    process.exit(1)
  }

  function getRepoRoot() {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' })
    if (result.status !== 0) return null
    return result.stdout.trim()
  }

  const lang = detectLang(process.env.LANG)
  const repoRoot = getRepoRoot()
  if (!repoRoot) {
    process.stderr.write('Error: not inside a git repository.\n')
    process.exit(1)
  }
  const hookScript = buildHookScript({ baseUrl })

  let result
  try {
    result = install({ repoRoot, hookScript })
  } catch (err) {
    if (err.code === 'HOOK_EXISTS') {
      const [title, ...bodyLines] = t('hookExistsError', lang, { path: err.path }).split('\n')
      process.stderr.write('\n' + boxen(bodyLines.join('\n').trim(), {
        title,
        titleAlignment: 'center',
        padding: 1,
        borderStyle: 'double',
        borderColor: 'red',
      }) + '\n\n')
      process.exit(1)
    }
    process.stderr.write(`Error: ${err.message}\n`)
    process.exit(1)
  }

  if (result.warning) {
    process.stdout.write(`\nWarning: ${result.warning}\n`)
  }

  if (result.method === 'direct') {
    process.stdout.write(`\nhook installed\n`)
  } else if (result.method === 'husky') {
    process.stdout.write(`\nhook installed at .husky/pre-push\n`)
    process.stdout.write(`Next: ${result.reminder}\n`)
  }
} else {
  process.stderr.write(`Usage: tracker-boot-git-hooks <install [--base-url <url>] | hook>\n`)
  process.exit(1)
}
