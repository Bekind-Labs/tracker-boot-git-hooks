import { randomUUID } from 'crypto'

const GET_ME_QUERY = `query getMe { me { id } }`

const CREATE_COMMENT_MUTATION = `
mutation ExecuteCommentCreate(
  $projectId: ID!
  $commandId: ID!
  $personId: ID!
  $storyId: ID!
  $content: String!
) {
  executeCommand(
    input: {
      projectId: $projectId
      version: 1
      commandId: $commandId
      personId: $personId
      type: COMMENT_CREATE
      parameters: { storyId: $storyId, content: $content, attachments: [] }
    }
  ) {
    version
    type
    data {
      __typename
      ... on Comment {
        id
        storyId
        content
        user { id name avatarUrl }
        createdAt
        updatedAt
      }
    }
  }
}
`.trim()

function assertNoErrors(json) {
  if (json.errors?.length) throw new Error(json.errors[0].message)
}

async function graphqlPost(url, headers, body, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'request timed out after 5s' : err.message)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const preview = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${preview ? ': ' + preview.slice(0, 120) : ''}`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${res.status}: non-JSON response`)
  }
}

export async function getMe({ queryUrl, apiKey, timeoutMs }) {
  const json = await graphqlPost(queryUrl, { 'X-API-KEY': apiKey }, JSON.stringify({ query: GET_ME_QUERY }), timeoutMs)
  assertNoErrors(json)
  if (!json.data?.me?.id) throw new Error('Could not retrieve your account — check that your API key is valid.')
  return json.data.me.id
}

export async function createComment({ mutationUrl, apiKey, projectId, personId, storyId, content, timeoutMs }) {
  const variables = { projectId, commandId: randomUUID(), personId, storyId, content }
  const json = await graphqlPost(
    mutationUrl,
    { 'Authorization': `Bearer ${apiKey}` },
    JSON.stringify({ query: CREATE_COMMENT_MUTATION, variables }),
    timeoutMs
  )
  assertNoErrors(json)
  return json.data
}
