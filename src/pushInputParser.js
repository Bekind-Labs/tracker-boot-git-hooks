const ZERO_SHA = '0000000000000000000000000000000000000000'

export function parsePushInput(stdin) {
  return stdin
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(' ')
      if (parts.length < 4) return []
      // git pre-push stdin: <local-ref> <local-sha> <remote-ref> <remote-sha>
      const [, localSha, , remoteSha] = parts
      if (localSha === ZERO_SHA) return [] // branch deletion
      // null remoteSha = new branch; getCommitsInRange handles it with --not --remotes
      return [{ localSha, remoteSha: remoteSha === ZERO_SHA ? null : remoteSha }]
    })
}
