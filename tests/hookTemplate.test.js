import { describe, it, expect } from 'vitest'
import { buildHookScript } from '../src/hookTemplate.js'
import { OUR_MARKER } from '../src/installer.js'

describe('buildHookScript', () => {
  it('starts with a sh shebang', () => {
    const script = buildHookScript({ baseUrl: 'https://example.com' })
    expect(script.startsWith('#!/bin/sh\n')).toBe(true)
  })

  it('contains the marker that installer uses to detect upgrades', () => {
    const script = buildHookScript({ baseUrl: 'https://example.com' })
    expect(script).toContain(OUR_MARKER)
  })

  it('invokes the CLI hook subcommand with forwarded arguments', () => {
    const script = buildHookScript({ baseUrl: 'https://example.com' })
    expect(script).toContain('tracker-boot-git-hooks hook "$@"')
  })

  it('single-quotes the base URL so shell metacharacters cannot execute', () => {
    const url = 'https://evil.com"$(touch /tmp/pwned)#'
    const script = buildHookScript({ baseUrl: url })
    // Everything inside single quotes is literal — $(), ", and # are all inert
    expect(script).toContain(`TRACKER_BASE_URL='${url}'`)
  })

  it('escapes internal single quotes in the base URL', () => {
    const script = buildHookScript({ baseUrl: "https://example.com/path'with'quotes" })
    // The result should not contain an unescaped literal single-quoted segment break
    expect(script).toContain("'\\''")
  })
})
