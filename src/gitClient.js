import { spawnSync } from 'child_process'

export function getCommitsInRange(remoteSha, localSha, { remote } = {}) {
  // When remoteSha is null the branch has no upstream yet — only walk commits
  // not already reachable from the remote to avoid re-commenting on history.
  const rangeArgs = remoteSha
    ? [`${remoteSha}..${localSha}`]
    : [localSha, '--not', remote ? `--remotes=${remote}` : '--remotes']
  const result = spawnSync(
    'git',
    // --format= (tformat:) appends \n after each entry; the parser's .trim() calls rely on this
    ['log', ...rangeArgs, '--format=%H%x00%s%x00%b%x00'],
    { encoding: 'utf8' }
  )
  if (result.status !== 0) {
    throw new Error(`git log failed: ${(result.stderr ?? '').trim()}`)
  }
  const raw = result.stdout ?? ''
  if (!raw.trim()) return []

  const tokens = raw.split('\x00')
  const commits = []
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const sha = tokens[i].trim()
    const subject = tokens[i + 1].trim()
    const body = tokens[i + 2].trim()
    if (sha) commits.push({ sha, subject, body })
  }
  return commits
}
