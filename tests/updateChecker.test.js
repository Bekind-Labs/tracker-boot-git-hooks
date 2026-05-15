import { describe, it, expect } from 'vitest'
import { checkForUpdate } from '../src/updateChecker.js'

function mockFetch(version, { ok = true, throws = null } = {}) {
  return async () => {
    if (throws) throw throws
    return {
      ok,
      json: async () => ({ version }),
    }
  }
}

describe('checkForUpdate', () => {
  it('returns { latest, current } when a newer version is available', async () => {
    const result = await checkForUpdate({ fetch: mockFetch('99.0.0') })
    expect(result).toEqual({ latest: '99.0.0', current: expect.stringMatching(/^\d+\.\d+\.\d+$/) })
  })

  it('returns null when already on the latest version', async () => {
    const { checkForUpdate: check } = await import('../src/updateChecker.js')
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const current = require('../package.json').version
    const result = await checkForUpdate({ fetch: mockFetch(current) })
    expect(result).toBeNull()
  })

  it('returns null when registry returns an older version', async () => {
    const result = await checkForUpdate({ fetch: mockFetch('0.0.1') })
    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const result = await checkForUpdate({ fetch: mockFetch(null, { throws: new Error('network error') }) })
    expect(result).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    const result = await checkForUpdate({ fetch: mockFetch('99.0.0', { ok: false }) })
    expect(result).toBeNull()
  })

  it('returns null when version field is missing from response', async () => {
    const result = await checkForUpdate({ fetch: async () => ({ ok: true, json: async () => ({}) }) })
    expect(result).toBeNull()
  })

  it('aborts the request when timeout is exceeded', async () => {
    let aborted = false
    const slowFetch = async (_url, { signal }) => {
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')) })
        setTimeout(resolve, 10000)
      })
    }
    const result = await checkForUpdate({ fetch: slowFetch, timeoutMs: 10 })
    expect(result).toBeNull()
    expect(aborted).toBe(true)
  })
})
