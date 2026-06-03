import { randomUUID } from 'crypto'

const CREATE_COMMENT_MUTATION = `
mutation ExecuteCommentCreate(
  $projectId: ID!
  $commandId: ID!
  $storyId: ID!
  $content: String!
) {
  executeCommand(
    input: {
      projectId: $projectId
      version: 1
      commandId: $commandId
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

async function graphqlPost(url, headers, body, timeoutMs = 2000) {
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
    throw new Error(err.name === 'AbortError' ? `request timed out after ${timeoutMs}ms` : err.message)
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

const UPDATE_STORY_STATUS_MUTATION = `
mutation ExecuteStoryUpdate(
  $projectId: ID!
  $commandId: ID!
  $id: ID!
  $status: String
) {
  executeCommand(input: {
    projectId: $projectId
    version: 1
    commandId: $commandId
    type: STORY_UPDATE
    parameters: { id: $id, status: $status }
  }) {
    data {
      ... on Story { id status }
    }
  }
}
`.trim()

export async function updateStoryStatus({ mutationUrl, apiKey, projectId, storyId, status, timeoutMs }) {
  const variables = { projectId, commandId: randomUUID(), id: storyId, status }
  const json = await graphqlPost(
    mutationUrl,
    { 'Authorization': `Bearer ${apiKey}` },
    JSON.stringify({ query: UPDATE_STORY_STATUS_MUTATION, variables }),
    timeoutMs
  )
  assertNoErrors(json)
  return json.data
}

export async function createComment({ mutationUrl, apiKey, projectId, storyId, content, timeoutMs }) {
  const variables = { projectId, commandId: randomUUID(), storyId, content }
  const json = await graphqlPost(
    mutationUrl,
    { 'Authorization': `Bearer ${apiKey}` },
    JSON.stringify({ query: CREATE_COMMENT_MUTATION, variables }),
    timeoutMs
  )
  assertNoErrors(json)
  return json.data
}
