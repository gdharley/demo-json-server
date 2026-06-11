# demo-json-server

A demo JSON server serving mock life insurance policy data and a DocuSign-style eSign API, used for prototyping and demos.

## Running locally

```bash
yarn install
node server.js
```

Server starts on port `3000` by default. Override with the `PORT` environment variable.

---

## Policy API

Base path: `/policy/policy`

| Method | Path | Description |
|---|---|---|
| GET | `/policy/policy` | List all policies |
| GET | `/policy/policy/:id` | Get a single policy |
| POST | `/policy/policy` | Create a policy |
| PUT | `/policy/policy/:id` | Replace a policy |
| PATCH | `/policy/policy/:id` | Update a policy |
| DELETE | `/policy/policy/:id` | Delete a policy |

### Filtering

```bash
# Filter by status
curl "http://localhost:3000/policy/policy?status=active"

# Filter by type
curl "http://localhost:3000/policy/policy?type=term-life"

# Filter by OTP allowed
curl "http://localhost:3000/policy/policy?otp_processing_allowed=true"

# Pagination
curl "http://localhost:3000/policy/policy?_page=1&_per_page=3"
```

### Sample: list all policies

```bash
curl http://localhost:3000/policy/policy
```

```json
[
  {
    "id": "POL-001",
    "policyNumber": "NWM-2025-001",
    "type": "whole-life",
    "status": "active",
    "otp_processing_allowed": true,
    "holder": {
      "firstName": "James",
      "lastName": "Mitchell",
      "email": "james.mitchell@example.com",
      "phone": "555-0101",
      "dateOfBirth": "1972-03-15"
    },
    "coverage": {
      "faceValue": 500000,
      "cashValue": 42750.00,
      "beneficiary": {
        "name": "Patricia Mitchell",
        "email": "patricia.mitchell@example.com",
        "relationship": "spouse"
      }
    },
    "term": { "type": "whole-life", "years": null },
    "premium": { "monthly": 312.00, "annual": 3744.00, "currency": "USD" },
    "effectiveDate": "2010-06-01",
    "expirationDate": null
  }
]
```

### Sample: get single policy

```bash
curl http://localhost:3000/policy/policy/POL-001
```

### Policy data summary

| ID | Policy Number | Type | Status | Face Value | Cash Value | OTP Allowed |
|---|---|---|---|---|---|---|
| POL-001 | NWM-2025-001 | whole-life | active | $500,000 | $42,750 | true |
| POL-002 | NWM-2025-002 | term-life (20yr) | active | $750,000 | $0 | false |
| POL-003 | NWM-2025-003 | universal-life | active | $300,000 | $8,420 | false |
| POL-004 | NWM-2025-004 | term-life (30yr) | pending | $1,000,000 | $0 | false |
| POL-005 | NWM-2023-005 | term-life (10yr) | lapsed | $250,000 | $0 | false |

---

## eSign API

A DocuSign-style eSign flow. No authentication or API keys required.

Base path: `/esign`

| Method | Path | Description |
|---|---|---|
| POST | `/esign/envelopes` | Create a signing envelope |
| GET | `/esign/userinfo` | Look up a user by email |
| GET | `/esign/envelopes/:envelopeId/status` | Get envelope status |
| GET | `/esign/envelopes/:envelopeId/documents` | List envelope documents |
| GET | `/esign/envelopes/:envelopeId/documents/:documentId/content` | Get document content |

---

### POST /esign/envelopes

Creates a signing envelope. Always returns envelope ID `ENV-DEMO-001`.

```bash
curl -X POST http://localhost:3000/esign/envelopes \
  -H "Content-Type: application/json" \
  -d '{
    "signerName": "James Mitchell",
    "signerEmail": "james.mitchell@example.com",
    "documentName": "Life Policy NWM-2025-001",
    "subject": "Please sign your policy document"
  }'
```

```json
{
  "envelopeId": "ENV-DEMO-001",
  "status": "created",
  "subject": "Please sign your policy document",
  "signerName": "James Mitchell",
  "signerEmail": "james.mitchell@example.com",
  "documentName": "Life Policy NWM-2025-001",
  "createdAt": "2026-06-11T10:00:00.000Z"
}
```

---

### GET /esign/userinfo?email=

Returns user info for the given email address. Users are backed by the policy holder data.

```bash
curl "http://localhost:3000/esign/userinfo?email=james.mitchell@example.com"
```

```json
{
  "sub": "amFtZXMubWl0Y2hlbGxAZXhhbXBsZS5jb20=",
  "name": "James Mitchell",
  "email": "james.mitchell@example.com",
  "given_name": "James",
  "family_name": "Mitchell",
  "accounts": [
    {
      "accountId": "DEMO-ACCOUNT-001",
      "accountName": "NWM Demo Account",
      "isDefault": true
    }
  ]
}
```

Returns `404` if the email does not match a policy holder.

---

### GET /esign/envelopes/:envelopeId/status

Returns the status of an envelope. Always returns `completed` regardless of the envelope ID supplied.

```bash
curl http://localhost:3000/esign/envelopes/ENV-DEMO-001/status
```

```json
{
  "envelopeId": "ENV-DEMO-001",
  "status": "completed",
  "completedAt": "2026-06-11T10:00:00.000Z"
}
```

---

### GET /esign/envelopes/:envelopeId/documents

Returns the list of documents attached to the envelope. Always returns a single document.

```bash
curl http://localhost:3000/esign/envelopes/ENV-DEMO-001/documents
```

```json
{
  "envelopeId": "ENV-DEMO-001",
  "documents": [
    {
      "documentId": "1",
      "name": "Policy Document",
      "type": "content",
      "uri": "/esign/envelopes/ENV-DEMO-001/documents/1/content"
    }
  ]
}
```

---

### GET /esign/envelopes/:envelopeId/documents/:documentId/content

Returns the document content as a base64-encoded string with `contentType: text/plain`.

```bash
curl http://localhost:3000/esign/envelopes/ENV-DEMO-001/documents/1/content
```

```json
{
  "documentId": "1",
  "envelopeId": "ENV-DEMO-001",
  "contentType": "text/plain",
  "data": "dGhpcyBpcyBhIHRlc3Q="
}
```

> `dGhpcyBpcyBhIHRlc3Q=` decodes to `this is a test`

---

## Deployment

Deployed to [Render.com](https://render.com) via `render.yaml`. Push to `main` triggers an automatic redeploy.
