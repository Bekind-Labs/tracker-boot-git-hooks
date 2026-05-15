import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/tracker-boot-git-hooks/latest'

function isNewer(latest, current) {
  const l = latest.split('.').map(Number)
  const c = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (l[i] !== c[i]) return l[i] > c[i]
  }
  return false
}

export async function checkForUpdate({ timeoutMs = 2000, fetch: _fetch = fetch } = {}) {
  const current = require('../package.json').version
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let res
    try {
      res = await _fetch(NPM_REGISTRY_URL, { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return null
    const data = await res.json()
    const latest = data?.version
    if (typeof latest !== 'string' || !isNewer(latest, current)) return null
    return { latest, current }
  } catch {
    return null
  }
}
