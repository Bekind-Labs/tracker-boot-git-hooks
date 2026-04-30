import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createServer } from 'http'
import { createComment } from '../src/apiClient.js'

describe('graphqlPost timeout', () => {
  let slowServer
  let slowPort

  beforeAll(async () => {
    await new Promise((resolve) => {
      slowServer = createServer((_req, _res) => { /* never respond */ })
      slowServer.listen(0, () => {
        slowPort = slowServer.address().port
        resolve()
      })
    })
  })

  afterAll(() => new Promise((resolve) => slowServer.close(resolve)))

  it('throws "request timed out" when the server does not respond within timeoutMs', async () => {
    const url = `http://localhost:${slowPort}/graphql`
    await expect(
      createComment({ mutationUrl: url, apiKey: 'x', projectId: 'p', storyId: '123456789', content: 'hi', timeoutMs: 50 })
    ).rejects.toThrow('request timed out')
  })
})

let server
let port
let captured
let nextResponse

beforeAll(async () => {
  await new Promise((resolve) => {
    server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        captured = { headers: req.headers, body, method: req.method }
        const { status, payload } = nextResponse()
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(payload)
      })
    })
    server.listen(0, () => {
      port = server.address().port
      resolve()
    })
  })
})

afterAll(() => server.close())

beforeEach(() => {
  captured = null
  nextResponse = () => { throw new Error('nextResponse not set') }
})

function url() {
  return `http://localhost:${port}/graphql`
}

describe('createComment', () => {
  const PARAMS = {
    apiKey: 'secret',
    projectId: 'proj-1',
    storyId: '123456789',
    content: 'abc1234\n`fix bug`',
  }

  it('sends Authorization Bearer header', async () => {
    nextResponse = () => ({
      status: 200,
      payload: JSON.stringify({ data: { executeCommand: { version: 2 } } }),
    })
    await createComment({ mutationUrl: url(), ...PARAMS })
    expect(captured.headers['authorization']).toBe('Bearer secret')
    expect(captured.headers['x-api-key']).toBeUndefined()
    expect(captured.method).toBe('POST')
  })

  it('sends projectId, storyId, content, and a UUID commandId in variables', async () => {
    nextResponse = () => ({
      status: 200,
      payload: JSON.stringify({ data: { executeCommand: { version: 2 } } }),
    })
    await createComment({ mutationUrl: url(), ...PARAMS })
    const { variables } = JSON.parse(captured.body)
    expect(variables.projectId).toBe('proj-1')
    expect(variables.personId).toBeUndefined()
    expect(variables.storyId).toBe('123456789')
    expect(variables.content).toBe('abc1234\n`fix bug`')
    expect(variables.commandId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('throws on GraphQL error response', async () => {
    nextResponse = () => ({
      status: 200,
      payload: JSON.stringify({ errors: [{ message: 'Not found' }] }),
    })
    await expect(createComment({ mutationUrl: url(), ...PARAMS })).rejects.toThrow('Not found')
  })

  it('throws with a clear message on non-JSON response', async () => {
    nextResponse = () => ({ status: 502, payload: '<html>Bad Gateway</html>' })
    await expect(createComment({ mutationUrl: url(), ...PARAMS })).rejects.toThrow('HTTP 502')
  })

  it('throws on non-2xx even when body is valid JSON without an errors field', async () => {
    nextResponse = () => ({ status: 429, payload: JSON.stringify({ message: 'Rate limited' }) })
    await expect(createComment({ mutationUrl: url(), ...PARAMS })).rejects.toThrow('HTTP 429')
  })
})
