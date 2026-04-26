import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

export function detectHusky(repoRoot) {
  return fs.existsSync(path.join(repoRoot, '.husky'))
}

export const OUR_MARKER = '# tracker-boot-git-hooks'

function resolveGitPath(repoRoot, p) {
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p)
}

function getGitCommonDir(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' })
  if (result.status !== 0) return path.join(repoRoot, '.git')
  return resolveGitPath(repoRoot, result.stdout.trim())
}

function getHooksDir(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'config', 'core.hooksPath'], { encoding: 'utf8' })
  if (result.status === 0 && result.stdout.trim()) {
    return resolveGitPath(repoRoot, result.stdout.trim())
  }
  return path.join(getGitCommonDir(repoRoot), 'hooks')
}

function installHookFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8')
    if (!existing.includes(OUR_MARKER)) {
      const err = new Error(`pre-push hook already exists at ${filePath}`)
      err.code = 'HOOK_EXISTS'
      err.path = filePath
      throw err
    }
  }
  fs.writeFileSync(filePath, content)
  fs.chmodSync(filePath, '755')
}

export function install({ repoRoot, hookScript }) {
  if (detectHusky(repoRoot)) {
    const hookPath = path.join(repoRoot, '.husky', 'pre-push')
    installHookFile(hookPath, hookScript)
    return { method: 'husky', reminder: 'Run: git add .husky/pre-push' }
  }

  const hooksDir = getHooksDir(repoRoot)
  installHookFile(path.join(hooksDir, 'pre-push'), hookScript)

  if (fs.existsSync(path.join(repoRoot, '.pre-commit-config.yaml'))) {
    return {
      method: 'direct',
      warning:
        'pre-commit runs hooks in isolated Python virtualenvs and cannot run Node scripts directly. ' +
        'The hook has been installed directly to .git/hooks/pre-push instead.',
    }
  }

  return { method: 'direct' }
}
