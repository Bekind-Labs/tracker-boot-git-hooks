import { describe, it, expect } from 'vitest'
import { resolveUrls, DEFAULT_BASE_URL } from '../src/urls.js'

describe('resolveUrls', () => {
  it('derives mutation and query endpoints from base URL', () => {
    expect(resolveUrls('https://example.com')).toEqual({
      mutationUrl: 'https://example.com/graphql',
      queryUrl: 'https://example.com/analytics/graphql',
    })
  })

  it('defaults to the production base URL', () => {
    const { mutationUrl } = resolveUrls()
    expect(mutationUrl).toBe(`${DEFAULT_BASE_URL}/graphql`)
  })

  it('strips a trailing slash from the base URL', () => {
    expect(resolveUrls('https://example.com/')).toEqual({
      mutationUrl: 'https://example.com/graphql',
      queryUrl: 'https://example.com/analytics/graphql',
    })
  })
})
