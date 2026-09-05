# Mock Server

Lightweight HTTP mock server for integration testing without
external dependencies.

## Usage

```bash
node mocks/server.js
# Runs on port 4000 (or MOCK_PORT)
```

Then point your test suite at `http://localhost:4000`.

## Adding Mocks

Edit `responses.json`. Keys are `METHOD /path`, values are
`{ status, body }`. The mock server returns 404 for undefined
routes.
