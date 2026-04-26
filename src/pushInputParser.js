const ZERO_SHA = '0000000000000000000000000000000000000000'
// git's empty tree object — used as range start for brand-new branches
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

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
      return [{ localSha, remoteSha: remoteSha === ZERO_SHA ? EMPTY_TREE : remoteSha }]
    })
}
