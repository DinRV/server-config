# CI Pipeline Documentation

Owner: DevOps Team | Last Updated: 2026-08

## Overview

The CI pipeline runs `scripts/ci-build.sh` on every push. It lints, tests, builds, and publishes.

## Build Script

The build script (`scripts/ci-build.sh`) is the single source of truth. Both CI and developers use it.

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `CI` | Flag for CI-specific behavior | `false` |
| `STAGING_API_TOKEN` | Integration test auth | Test token (read-only) |
| `NPM_PUBLISH_TOKEN` | Private registry publish | From secrets |
| `NODE_AUTH_TOKEN` | npm convention alias | Same as NPM_PUBLISH_TOKEN |

## Running Locally

```bash
# Run the same build as CI
./scripts/ci-build.sh

# Skip integration tests
CI=false ./scripts/ci-build.sh
```

## Troubleshooting

### Common Issues

1. **Integration tests fail locally**: Make sure `STAGING_API_TOKEN` is set. The default test token only works from CI IPs.
2. **npm publish fails**: Check that `NPM_PUBLISH_TOKEN` is set and not expired.
3. **Migration fails**: Ensure the test database is running (`docker compose up db`).
