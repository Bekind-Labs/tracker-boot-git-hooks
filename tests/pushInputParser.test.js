import { describe, it, expect } from 'vitest'
import { parsePushInput } from '../src/pushInputParser.js'

// parsePushInput is a pure function — no mocks needed

const ZERO_SHA = '0000000000000000000000000000000000000000'

describe('parsePushInput', () => {
  it('parses a single ref line into a range', () => {
    const stdin = 'refs/heads/main abc1234 refs/heads/main def5678\n'
    const ranges = parsePushInput(stdin)
    expect(ranges).toEqual([
      { localSha: 'abc1234', remoteSha: 'def5678' },
    ])
  })

  it('skips zero-SHA local ref (branch deletion)', () => {
    const stdin = `refs/heads/feat ${ZERO_SHA} refs/heads/feat abc1234\n`
    expect(parsePushInput(stdin)).toEqual([])
  })

  it('returns null remoteSha when remote is zero (new branch, no upstream)', () => {
    const stdin = `refs/heads/feat abc1234 refs/heads/feat ${ZERO_SHA}\n`
    expect(parsePushInput(stdin)).toEqual([
      { localSha: 'abc1234', remoteSha: null },
    ])
  })

  it('handles multiple ref lines', () => {
    const stdin = [
      'refs/heads/main abc refs/heads/main def',
      'refs/heads/feat ghi refs/heads/feat jkl',
    ].join('\n') + '\n'
    expect(parsePushInput(stdin)).toHaveLength(2)
  })

  it('ignores blank lines', () => {
    const stdin = '\nrefs/heads/main abc refs/heads/main def\n\n'
    expect(parsePushInput(stdin)).toHaveLength(1)
  })

  it('ignores malformed lines with fewer than 4 tokens', () => {
    expect(parsePushInput('refs/heads/main abc123\n')).toEqual([])
  })
})
