import { spawnSync } from 'child_process'

const SPAWN_OPTS = { encoding: 'utf8' }

export function getConfig(key, { global: isGlobal = false, local: isLocal = false } = {}) {
  let args
  if (isGlobal) args = ['config', '--global', key]
  else if (isLocal) args = ['config', '--local', key]
  else args = ['config', key]
  const result = spawnSync('git', args, SPAWN_OPTS)
  return result.status === 0 ? result.stdout.trimEnd() : null
}

export function setGlobalConfig(key, value) {
  const r = spawnSync('git', ['config', '--global', key, value], SPAWN_OPTS)
  if (r.status !== 0) throw new Error(`git config --global ${key}: ${(r.stderr ?? '').trim()}`)
}

export function setLocalConfig(key, value) {
  const r = spawnSync('git', ['config', key, value], SPAWN_OPTS)
  if (r.status !== 0) throw new Error(`git config ${key}: ${(r.stderr ?? '').trim()}`)
}
