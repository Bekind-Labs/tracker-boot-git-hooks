const GITHUB_HTTPS = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/
const GITHUB_SSH = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/

function parseGitHubCommitUrl(remoteUrl, sha) {
  if (!remoteUrl) return null
  const m = remoteUrl.match(GITHUB_HTTPS) ?? remoteUrl.match(GITHUB_SSH)
  if (!m) return null
  return `https://github.com/${m[1]}/${m[2]}/commit/${sha}`
}

export function buildCommentContent(commit) {
  const shortSha = commit.sha.slice(0, 7)
  const commitUrl = parseGitHubCommitUrl(commit.remoteUrl, commit.sha)

  const firstLine = commitUrl
    ? `[${shortSha}](${commitUrl})`
    : shortSha

  const parts = [`${firstLine}\n\`${commit.subject}\``]

  if (commit.body) {
    const trimmedBody = commit.body.trimEnd()
    if (trimmedBody) parts.push(trimmedBody)
  }

  parts.push('\n*posted via [Tracker Boot Git Hook](https://github.com/Bekind-Labs/tracker-boot-git-hooks)*')

  return parts.join('\n')
}
