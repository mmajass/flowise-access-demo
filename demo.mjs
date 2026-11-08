import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

const base = 'http://127.0.0.1:33001/api/v1'
const password = `${randomBytes(18).toString('hex')}Aa1!`
const email = 'demo@example.invalid'
let cookies = ''

async function request(path, { method = 'GET', body, authenticated = false, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (authenticated) {
    headers.cookie = cookies
    headers['x-request-from'] = 'internal'
  }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { response, data }
}

function expectOk(result, label) {
  assert.ok(result.response.ok, `${label} returned HTTP ${result.response.status}`)
  return result.data
}

expectOk(await request('/account/register', {
  method: 'POST',
  body: { user: { name: 'Demo', email, credential: password } }
}), 'register')

const login = await request('/auth/login', { method: 'POST', body: { email, password } })
expectOk(login, 'login')
cookies = login.response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ')
assert.ok(cookies, 'login did not set a session cookie')

const templateUrl = 'https://raw.githubusercontent.com/FlowiseAI/Flowise/a65f81bb43ef66d3ce734bf0dff4223ae8041c95/packages/server/marketplaces/agentflowsv2/Workplace%20Chat.json'
const templateResponse = await fetch(templateUrl)
assert.ok(templateResponse.ok, `template returned HTTP ${templateResponse.status}`)
const template = await templateResponse.json()
const start = template.nodes.find((node) => node.data.name === 'startAgentflow')
const reply = template.nodes.find((node) => node.data.name === 'directReplyAgentflow')
assert.ok(start && reply, 'expected template nodes not found')
reply.data.inputs.directReplyMessage = 'Hello from the Flowise access demo.'
const flowData = {
  nodes: [start, reply],
  edges: [{
    id: 'start-to-reply',
    source: start.id,
    sourceHandle: `${start.id}-output-startAgentflow`,
    target: reply.id,
    targetHandle: reply.id,
    type: 'buttonedge'
  }]
}

const flow = expectOk(await request('/chatflows', {
  method: 'POST',
  authenticated: true,
  body: { name: 'Access boundary demo', type: 'AGENTFLOW', flowData: JSON.stringify(flowData) }
}), 'create flow')
assert.ok(flow.id, 'flow ID missing')
assert.ok(!flow.apikeyid, 'new flow unexpectedly has a key')

async function predict(token) {
  return request(`/prediction/${flow.id}`, {
    method: 'POST', body: { question: 'Hello' }, token
  })
}

const open = await predict()
const openData = expectOk(open, 'unkeyed prediction')
assert.match(JSON.stringify(openData), /Hello from the Flowise access demo/)
console.log(`Unkeyed flow, no API key: HTTP ${open.response.status}; fixed reply received.`)

const keys = expectOk(await request('/apikey', {
  method: 'POST', authenticated: true,
  body: { keyName: 'demo-only', permissions: ['chatflows:view'] }
}), 'create key')
const key = keys.find((item) => item.keyName === 'demo-only')
assert.ok(key?.id && key?.apiKey, 'created API key missing')
expectOk(await request(`/chatflows/${flow.id}`, {
  method: 'PUT', authenticated: true, body: { apikeyid: key.id }
}), 'attach key')

const missing = await predict()
const wrong = await predict('incorrect-demo-key')
const valid = await predict(key.apiKey)
for (const [label, result] of [['no API key', missing], ['incorrect API key', wrong], ['correct API key', valid]]) {
  const mentionsUnauthorized = /unauthorized/i.test(JSON.stringify(result.data))
  console.log(`Keyed flow, ${label}: HTTP ${result.response.status}; response mentions unauthorized: ${mentionsUnauthorized}.`)
}
for (const [label, result] of [['missing key', missing], ['incorrect key', wrong]]) {
  assert.equal(result.response.status, 500, `${label} returned a different status than observed`)
  assert.match(JSON.stringify(result.data), /unauthorized/i, `${label} response did not mention unauthorized`)
}
const validData = expectOk(valid, 'keyed prediction')
assert.match(JSON.stringify(validData), /Hello from the Flowise access demo/)
console.log(`Keyed flow, correct API key: HTTP ${valid.response.status}; fixed reply received.`)
console.log('Observation: unauthorized requests returned HTTP 500, not the expected HTTP 401.')
