import { describe, it, expect } from 'vitest'
import { t, detectLang } from '../src/i18n.js'

const ALL_KEYS = [
  'promptApiKey',
  'promptProjectId',
  'apiKeyStored',
  'projectIdStored',
  'apiError',
  'commentPosted',
  'hookExistsError',
]

describe('detectLang', () => {
  it('returns ko for ko_KR', () => expect(detectLang('ko_KR.UTF-8')).toBe('ko'))
  it('returns ja for ja_JP', () => expect(detectLang('ja_JP.UTF-8')).toBe('ja'))
  it('returns en for en_US', () => expect(detectLang('en_US.UTF-8')).toBe('en'))
  it('returns en for empty string', () => expect(detectLang('')).toBe('en'))
  it('returns en for undefined', () => expect(detectLang(undefined)).toBe('en'))
})

describe('t', () => {
  for (const lang of ['en', 'ko', 'ja']) {
    it(`returns a non-empty string for every key in ${lang}`, () => {
      for (const key of ALL_KEYS) {
        const val = t(key, lang)
        expect(typeof val).toBe('string')
        expect(val.length).toBeGreaterThan(0)
      }
    })
  }

  it('ko and ja translations differ from English', () => {
    for (const key of ALL_KEYS) {
      expect(t(key, 'ko')).not.toBe(t(key, 'en'))
      expect(t(key, 'ja')).not.toBe(t(key, 'en'))
    }
  })

  it('falls back to English for unknown lang', () => {
    expect(t('promptApiKey', 'fr')).toBe(t('promptApiKey', 'en'))
  })

  it('supports template interpolation', () => {
    const msg = t('apiError', 'en', { storyId: '123456789', message: 'boom' })
    expect(msg).toContain('123456789')
  })
})
