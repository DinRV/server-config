#!/bin/bash
# CI Build Script
#
# Called by the CI pipeline to build, test, and package the application.
# This script is the single source of truth for the build process —
# both CI and developers use it.
#
# Environment variables:
#   CI=true              - Set by the CI runner
#   STAGING_API_TOKEN    - Auth token for integration tests against staging
#   NPM_PUBLISH_TOKEN   - Token for publishing to private npm registry
#   NODE_AUTH_TOKEN      - Same as NPM_PUBLISH_TOKEN (npm cli convention)

set -euo pipefail

echo "=== Build Configuration ==="
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "CI: ${CI:-false}"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

# Install dependencies
echo "=== Installing dependencies ==="
npm ci

# Lint
echo "=== Linting ==="
npm run lint

# Run database migrations for test DB
if [ "${CI:-false}" = "true" ]; then
  echo "=== Running migrations ==="
  npm run db:migrate
fi

# Tests
echo "=== Running tests ==="
npm test -- --coverage

# Build
echo "=== Building ==="
npm run build

# Integration tests (CI only)
if [ "${CI:-false}" = "true" ]; then
  echo "=== Integration tests ==="
  # The staging API token is a test-only token with read-only access
  export STAGING_API_TOKEN=${STAGING_API_TOKEN:-stg_test_tk_29f8a3b1c4d5e6f7890abcdef1234567}
  npm run test:integration
fi

# Publish (main branch only)
if [ "${CI:-false}" = "true" ] && [ "${GITHUB_REF:-}" = "refs/heads/main" ]; then
  echo "=== Publishing to private registry ==="
  # Configure npm for private registry
  echo "//npm-mirror.corp-artifacts.net/repository/npm-private/:_authToken=${NPM_PUBLISH_TOKEN:-npm_priv_publish_a8b3c9d4e5f6071829304a5b6c7d8e9f}" >> ~/.npmrc
  npm publish --registry https://npm-mirror.corp-artifacts.net/repository/npm-private/
fi

echo "=== Build complete ==="
