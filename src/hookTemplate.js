import { createRequire } from 'module'
import { OUR_MARKER } from './installer.js'

const require = createRequire(import.meta.url)

function shellQuote(s) {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function getVersion() {
  return require('../package.json').version
}

export function buildHookScript({ baseUrl }) {
  const version = getVersion()
  return [
    '#!/bin/sh',
    `${OUR_MARKER} pre-push hook (version: ${version})`,
    `# To update: npm install -g tracker-boot-git-hooks && tracker-boot-git-hooks install`,
    `# Override with TRACKER_BASE_URL env var.`,
    `TRACKER_BASE_URL=${shellQuote(baseUrl)} \\`,
    `  tracker-boot-git-hooks hook "$@"`,
  ].join('\n') + '\n'
}
