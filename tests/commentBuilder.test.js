import { describe, it, expect } from 'vitest'
import { buildCommentContent } from '../src/commentBuilder.js'

const FOOTER = '\n\n*posted via Tracker Boot Git Hook*'

const BASE = {
  sha: 'abc1234def5678901234',
  subject: 'fix login redirect',
  body: '',
  remoteUrl: null,
}

describe('buildCommentContent', () => {
  it('formats a bare SHA when no remote URL is available', () => {
    const content = buildCommentContent(BASE)
    expect(content).toBe('abc1234\n`fix login redirect`' + FOOTER)
  })

  it('formats a GitHub commit URL when remote URL is a GitHub https remote', () => {
    const content = buildCommentContent({ ...BASE, remoteUrl: 'https://github.com/acme/myrepo.git' })
    expect(content).toBe(
      '[abc1234](https://github.com/acme/myrepo/commit/abc1234def5678901234)\n`fix login redirect`' + FOOTER
    )
  })

  it('formats a GitHub commit URL when remote URL is a GitHub ssh remote', () => {
    const content = buildCommentContent({ ...BASE, remoteUrl: 'git@github.com:acme/myrepo.git' })
    expect(content).toBe(
      '[abc1234](https://github.com/acme/myrepo/commit/abc1234def5678901234)\n`fix login redirect`' + FOOTER
    )
  })

  it('falls back to bare SHA for non-GitHub remote', () => {
    const content = buildCommentContent({ ...BASE, remoteUrl: 'https://gitlab.com/acme/myrepo.git' })
    expect(content).toBe('abc1234\n`fix login redirect`' + FOOTER)
  })

  it('appends body when present', () => {
    const content = buildCommentContent({ ...BASE, body: 'Extra details\nAnother line' })
    expect(content).toBe('abc1234\n`fix login redirect`\nExtra details\nAnother line' + FOOTER)
  })

  it('appends body after GitHub URL line', () => {
    const content = buildCommentContent({
      ...BASE,
      remoteUrl: 'https://github.com/acme/myrepo.git',
      body: 'Some context',
    })
    expect(content).toBe(
      '[abc1234](https://github.com/acme/myrepo/commit/abc1234def5678901234)\n`fix login redirect`\nSome context' + FOOTER
    )
  })

  it('trims trailing whitespace from body', () => {
    const content = buildCommentContent({ ...BASE, body: 'Some context   \n\n' })
    expect(content).toBe('abc1234\n`fix login redirect`\nSome context' + FOOTER)
  })
})
