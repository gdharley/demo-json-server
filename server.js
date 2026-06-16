import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { createApp } from 'json-server/lib/app.js'
import { App } from '@tinyhttp/app'
import { cors } from '@tinyhttp/cors'
import { json } from 'milliparsec'

const db = new Low(new JSONFile('db.json'), {})
await db.read()

const PORT = parseInt(process.env.PORT ?? '3000')
const HOST = process.env.HOST ?? '0.0.0.0'

const DEMO_CONTENT_B64 = Buffer.from('this is a test').toString('base64')

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
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

  send(res, 201, {
    envelopeId: 'ENV-DEMO-001',
    status: 'created',
    subject,
    signerName,
    signerEmail,
    accountId,
    documentName,
    documentContent,
    createdAt: new Date().toISOString()
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

// GET /esign/envelopes/:envelopeId/status — always returns completed
mainApp.get('/esign/envelopes/:envelopeId/status', (req, res) => {
  send(res, 200, {
    envelopeId: req.params.envelopeId,
    status: 'completed',
    completedAt: new Date().toISOString()
  })
})

// GET /esign/envelopes/:envelopeId/documents — single document
mainApp.get('/esign/envelopes/:envelopeId/documents', (req, res) => {
  const { envelopeId } = req.params
  send(res, 200, {
    envelopeId,
    documents: [{
      documentId: '1',
      name: 'Policy Document',
      type: 'content',
      uri: `/esign/envelopes/${envelopeId}/documents/1/content`
    }]
  })
})

// GET /esign/envelopes/:envelopeId/documents/:documentId/content — base64 "this is a test"
mainApp.get('/esign/envelopes/:envelopeId/documents/:documentId/content', (req, res) => {
  send(res, 200, {
    documentId: req.params.documentId,
    envelopeId: req.params.envelopeId,
    contentType: 'text/plain',
    data: DEMO_CONTENT_B64
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

// Mount json-server policy routes under /policy
const policyApp = createApp(db)
mainApp.use('/policy', policyApp.handler.bind(policyApp))

mainApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Policy:  http://${HOST}:${PORT}/policy/policy`)
  console.log(`eSign:   http://${HOST}:${PORT}/esign/envelopes`)
}, HOST)
