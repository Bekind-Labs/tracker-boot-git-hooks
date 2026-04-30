export const DEFAULT_BASE_URL = 'https://trackerboot.com'

export function resolveUrls(baseUrl = DEFAULT_BASE_URL) {
  const base = baseUrl.replace(/\/+$/, '')
  return { mutationUrl: `${base}/graphql` }
}
