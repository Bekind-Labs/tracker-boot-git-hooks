import { describe, it, expect } from 'vitest'
import { extractStoryIds } from '../src/storyIdExtractor.js'

describe('extractStoryIds', () => {
  it('extracts a bare story ID', () => {
    expect(extractStoryIds('[#123456789] fix login')).toEqual(['123456789'])
  })

  it('extracts a story ID with a prefix keyword', () => {
    expect(extractStoryIds('[finishes #200022323] close modal')).toEqual(['200022323'])
    expect(extractStoryIds('[fixes #200022323] typo')).toEqual(['200022323'])
    expect(extractStoryIds('[delivers #200022323] ship it')).toEqual(['200022323'])
  })

  it('extracts multiple story IDs from one message', () => {
    expect(extractStoryIds('[#111111111] [#222222222] two stories')).toEqual([
      '111111111',
      '222222222',
    ])
  })

  it('returns each ID only once when duplicated', () => {
    expect(extractStoryIds('[#111111111] [#111111111] duplicate')).toEqual(['111111111'])
  })

  it('ignores IDs shorter or longer than 9 digits', () => {
    expect(extractStoryIds('[#12345678] too short')).toEqual([])
    expect(extractStoryIds('[#1234567890] too long')).toEqual([])
  })

  it('returns empty array when no story IDs are present', () => {
    expect(extractStoryIds('chore: update deps')).toEqual([])
  })

  it('does not match Unicode decimal digit look-alikes', () => {
    // ٩ is Arabic-Indic digit 9 — \d would match it, [0-9] does not
    expect(extractStoryIds('[#١٢٣٤٥٦٧٨٩] fake')).toEqual([])
  })

  it('searches both subject and body lines', () => {
    expect(extractStoryIds('fix thing\n[#123456789] see tracker')).toEqual(['123456789'])
  })

  it('supports all keywords as a prefix before the ID', () => {
    const keywords = ['fixed', 'fixes', 'finish', 'finishes', 'finished', 'completes', 'completed', 'delivers', 'delivered']
    for (const kw of keywords) {
      expect(extractStoryIds(`[${kw} #123456789] msg`)).toEqual(['123456789'])
    }
  })

  it('supports all keywords as a suffix after the ID', () => {
    const keywords = ['fixed', 'fixes', 'finish', 'finishes', 'finished', 'completes', 'completed', 'delivers', 'delivered']
    for (const kw of keywords) {
      expect(extractStoryIds(`[#123456789 ${kw}] msg`)).toEqual(['123456789'])
    }
  })
})
