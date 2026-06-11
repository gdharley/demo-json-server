# demo-json-server

A simple json-server implementation serving mock life insurance policy data, used for demos and prototyping.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/policy` | List all policies |
| GET | `/policy/:id` | Get a single policy |
| POST | `/policy` | Create a policy |
| PUT | `/policy/:id` | Replace a policy |
| PATCH | `/policy/:id` | Update a policy |
| DELETE | `/policy/:id` | Delete a policy |

### Filtering examples

```
GET /policy?status=active
GET /policy?type=term-life
GET /policy?otp_processing_allowed=true
GET /policy?_page=1&_per_page=10
```

## Policy data

| ID | Policy Number | Type | Status | Face Value | Cash Value | OTP Allowed |
|---|---|---|---|---|---|---|
| POL-001 | NWM-2025-001 | whole-life | active | $500,000 | $42,750 | true |
| POL-002 | NWM-2025-002 | term-life (20yr) | active | $750,000 | $0 | false |
| POL-003 | NWM-2025-003 | universal-life | active | $300,000 | $8,420 | false |
| POL-004 | NWM-2025-004 | term-life (30yr) | pending | $1,000,000 | $0 | false |
| POL-005 | NWM-2023-005 | term-life (10yr) | lapsed | $250,000 | $0 | false |

### Policy fields

- **type** — `whole-life`, `term-life`, or `universal-life`
- **status** — `active`, `pending`, or `lapsed`
- **term.years** — policy duration in years; `null` for permanent policies
- **coverage.faceValue** — death benefit amount (USD)
- **coverage.cashValue** — accumulated cash value (USD); `0` for term policies
- **otp_processing_allowed** — whether the policy can be serviced over the phone

## Running locally

```bash
yarn install
yarn start
```

Server starts on port `3000` by default. Set the `PORT` environment variable to override.

## Deployment

Deployed to [Render.com](https://render.com) via `render.yaml`. Push to `main` triggers an automatic redeploy.
