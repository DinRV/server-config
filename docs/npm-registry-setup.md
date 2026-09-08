# NPM Registry Mirror Setup

All developers and CI pipelines must use the internal Artifactory npm mirror.

## Quick Start

The `.npmrc` file in the repo root configures npm automatically. You just need the auth token:

```bash
export NPM_TOKEN=$(vault read -field=token secret/npm-mirror)
```

Or for local development, ask in `#developer-experience` for a personal token.

## Why a Mirror?

1. **CI reliability:** 40 parallel CI jobs were hitting npm's rate limits
2. **Air-gapped staging:** Staging environment has no internet access
3. **Audit trail:** SOC2 requires tracking all third-party code consumed

## Troubleshooting

If `npm install` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`:
```bash
npm config set strict-ssl false  # Only if behind corporate proxy
```

If the mirror is down, temporarily bypass with:
```bash
npm install --registry https://registry.npmjs.org
```
