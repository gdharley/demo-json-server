import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { createApp } from 'json-server/lib/app.js'
import { App } from '@tinyhttp/app'
import { cors } from '@tinyhttp/cors'
import { json } from 'milliparsec'
import { readFileSync } from 'node:fs'

const db = new Low(new JSONFile('db.json'), {})
await db.read()

const PORT = parseInt(process.env.PORT ?? '3000')
const HOST = process.env.HOST ?? '0.0.0.0'

const DEMO_CONTENT_B64 = Buffer.from('this is a test').toString('base64')

// Envelopes created through this server, keyed by envelope id. Held in memory:
// a restart loses them, and any envelope id this server does not recognise falls
// back to the original always-completed behaviour so existing demos keep working.
const envelopes = new Map()
let envelopeSequence = 0

// How long an envelope takes to come back signed. Short enough to demo, long
// enough that the waiting is visible. Override with SIGNING_SECONDS.
const SIGNING_SECONDS = parseInt(process.env.SIGNING_SECONDS ?? '45')

function envelopeStatus(envelope) {
  if (envelope.terminalStatus) {
    return envelope.terminalStatus
  }

  const elapsed = (Date.now() - envelope.createdAt) / 1000
  if (elapsed < SIGNING_SECONDS * 0.4) {
    return 'sent'
  }
  if (elapsed < SIGNING_SECONDS) {
    return 'delivered'
  }
  return envelope.declines ? 'declined' : 'completed'
}

function executedDocument(envelope, status) {
  if (envelope.documentContent) {
    return envelope.documentContent
  }

  const signedAt = new Date().toISOString()
  return Buffer.from(
    [
      envelope.documentName.toUpperCase(),
      '',
      `Envelope:  ${envelope.envelopeId}`,
      `Subject:   ${envelope.subject}`,
      `Signer:    ${envelope.signerName} <${envelope.signerEmail}>`,
      `Account:   ${envelope.accountId}`,
      '',
      status === 'completed'
        ? `Executed by ${envelope.signerName} on ${signedAt}.`
        : `Declined by ${envelope.signerName} on ${signedAt}.`
    ].join('\n')
  ).toString('base64')
}


function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

// The OpenAPI descriptions, served so tooling can be pointed at a URL rather
// than a checked-out file. /openapi.json merges all three; the parts are also
// available individually. Nothing in them collides, so the merge is a union.
const SPEC_FILES = {
  policy: 'openapi-policy.json',
  esign: 'openapi-esign.json',
  mf: 'openapi-mf.json'
}

const specs = Object.fromEntries(
  Object.entries(SPEC_FILES).map(([name, file]) => [name, JSON.parse(readFileSync(file, 'utf-8'))])
)

const mergedSpec = {
  openapi: specs.policy.openapi,
  info: {
    title: 'Demo JSON Server',
    description: 'Mock life insurance policy data, a DocuSign-style eSign API, and supporting operations.',
    version: specs.policy.info.version
  },
  servers: specs.policy.servers,
  tags: Object.values(specs).flatMap(s => s.tags ?? []),
  paths: Object.assign({}, ...Object.values(specs).map(s => s.paths)),
  components: {
    schemas: Object.assign({}, ...Object.values(specs).map(s => s.components?.schemas ?? {}))
  }
}

const mainApp = new App()
mainApp.use(cors()).options('*', cors()).use(json())

// POST /esign/envelopes — create envelope
mainApp.post('/esign/envelopes', (req, res) => {
  const {
    signerName,
    signerEmail,
    accountId,
    documentName = 'Policy Document',
    documentContent,
    subject = 'Please sign this document'
  } = req.body ?? {}

  const envelopeId = `ENV-${String(++envelopeSequence).padStart(4, '0')}`
  const envelope = {
    envelopeId,
    subject,
    signerName,
    signerEmail,
    accountId,
    documentName,
    documentContent,
    // A signer address containing "decline" exercises the unhappy path.
    declines: (signerEmail ?? '').toLowerCase().includes('decline'),
    createdAt: Date.now()
  }
  envelopes.set(envelopeId, envelope)

  send(res, 201, {
    envelopeId,
    status: 'sent',
    subject,
    signerName,
    signerEmail,
    accountId,
    documentName,
    documentContent,
    expectedCompletionSeconds: SIGNING_SECONDS,
    createdAt: new Date(envelope.createdAt).toISOString()
  })
})

// GET /esign/userinfo?email=xxx — look up a policy holder by email
mainApp.get('/esign/userinfo', (req, res) => {
  const email = req.query?.email
  const holder = (db.data.policy ?? [])
    .map(p => p.holder)
    .find(h => h.email === email)

  if (!holder) {
    return send(res, 404, { error: 'User not found' })
  }

  send(res, 200, {
    sub: Buffer.from(holder.email).toString('base64'),
    name: `${holder.firstName} ${holder.lastName}`,
    email: holder.email,
    given_name: holder.firstName,
    family_name: holder.lastName,
    accounts: [{
      accountId: 'DEMO-ACCOUNT-001',
      accountName: 'NWM Demo Account',
      isDefault: true
    }]
  })
})

// GET /esign/envelopes/:envelopeId/status — sent, then delivered, then completed
// ?force=completed|declined jumps an envelope straight to that state.
mainApp.get('/esign/envelopes/:envelopeId/status', (req, res) => {
  const { envelopeId } = req.params
  const envelope = envelopes.get(envelopeId)

  if (!envelope) {
    // Unknown to this server: answer as it always did.
    return send(res, 200, {
      envelopeId,
      status: 'completed',
      completedAt: new Date().toISOString()
    })
  }

  const forced = req.query?.force
  if (forced === 'completed' || forced === 'declined') {
    envelope.terminalStatus = forced
  }

  const status = envelopeStatus(envelope)
  send(res, 200, {
    envelopeId,
    status,
    secondsElapsed: Math.round((Date.now() - envelope.createdAt) / 1000),
    expectedCompletionSeconds: SIGNING_SECONDS,
    ...(status === 'completed' || status === 'declined'
      ? { completedAt: new Date().toISOString() }
      : {})
  })
})

// GET /esign/envelopes/:envelopeId/documents — single document
mainApp.get('/esign/envelopes/:envelopeId/documents', (req, res) => {
  const { envelopeId } = req.params
  const envelope = envelopes.get(envelopeId)

  send(res, 200, {
    envelopeId,
    documents: [{
      documentId: '1',
      name: envelope?.documentName ?? 'Policy Document',
      type: 'content',
      uri: `/esign/envelopes/${envelopeId}/documents/1/content`
    }]
  })
})

// GET /esign/envelopes/:envelopeId/documents/:documentId/content — base64 "this is a test"
mainApp.get('/esign/envelopes/:envelopeId/documents/:documentId/content', (req, res) => {
  const { envelopeId, documentId } = req.params
  const envelope = envelopes.get(envelopeId)

  if (!envelope) {
    // Unknown to this server: answer as it always did.
    return send(res, 200, {
      documentId,
      envelopeId,
      contentType: 'text/plain',
      data: DEMO_CONTENT_B64
    })
  }

  const status = envelopeStatus(envelope)
  if (status !== 'completed' && status !== 'declined') {
    return send(res, 409, {
      error: 'Envelope is not yet resolved',
      envelopeId,
      status,
      detail: 'The executed document is available once the envelope reaches completed or declined.'
    })
  }

  send(res, 200, {
    documentId,
    envelopeId,
    status,
    contentType: 'text/plain',
    data: executedDocument(envelope, status)
  })
})

// POST /mf/accounts — create account in external system
mainApp.post('/mf/accounts', (req, res) => {
  send(res, 200, { status: 'ok' })
})

// GET /mf/policies/:policyId/surrender-value — return cash value for the policy
mainApp.get('/mf/policies/:policyId/surrender-value', (req, res) => {
  const policy = (db.data.policy ?? []).find(p => p.id === req.params.policyId)

  if (!policy) {
    return send(res, 404, { error: 'Policy not found' })
  }

  send(res, 200, {
    policyId: policy.id,
    policyNumber: policy.policyNumber,
    surrenderValue: policy.coverage.cashValue,
    currency: policy.premium.currency
  })
})

// POST /mf/fraud-investigation — start a fraud investigation
mainApp.post('/mf/fraud-investigation', (req, res) => {
  send(res, 200, { status: 'ok' })
})

// GET /openapi.json — every operation this server exposes, in one document
mainApp.get('/openapi.json', (req, res) => {
  send(res, 200, mergedSpec)
})

// GET /openapi/:name.json — policy, esign or mf on their own
mainApp.get('/openapi/:name', (req, res) => {
  const name = req.params.name.replace(/\.json$/, '')
  const spec = specs[name]

  if (!spec) {
    return send(res, 404, {
      error: 'Unknown specification',
      available: Object.keys(specs)
    })
  }

  send(res, 200, spec)
})

// Mount json-server policy routes under /policy
const policyApp = createApp(db)
mainApp.use('/policy', policyApp.handler.bind(policyApp))

mainApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Policy:  http://${HOST}:${PORT}/policy/policy`)
  console.log(`eSign:   http://${HOST}:${PORT}/esign/envelopes`)
  console.log(`OpenAPI: http://${HOST}:${PORT}/openapi.json`)
}, HOST)
