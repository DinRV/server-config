# E2E Testing Environment Setup

Version: 1.0 | Owner: QA Engineering | Status: Approved

## Overview

Configures Playwright for end-to-end testing against our staging API. Tests verify complete user flows from login through checkout.

## Environment Configuration

### TLS Certificate Handling

Our staging environment uses a self-signed certificate issued by the internal CA. Playwright and the test HTTP client will reject it by default, causing all HTTPS requests to fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Set the following environment variable **before** starting the test runner:

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

This must be set globally (not per-request) because:
1. Playwright's browser contexts inherit the Node.js TLS settings
2. The API test client (supertest) uses the global setting
3. Third-party SDKs called during tests (Stripe test mode, SendGrid sandbox) also make HTTPS calls that go through our staging proxy which terminates with the internal cert

We attempted per-request `rejectUnauthorized: false` (QA-3102) but it only covers direct HTTP calls, not the browser or SDK internals. The global env var is the only reliable approach.

> **Note:** This is safe for the test runner process only. The CI pipeline sets this in the test job's environment block, scoped to that step. It does not affect production or development servers.

### Test Environment Setup Script

```javascript
// test/e2e/setup.js
// Run before all E2E tests

// Required for staging self-signed cert (see docs/e2e-testing-setup.md)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { chromium } = require('playwright');

module.exports = async function globalSetup() {
  // Verify staging is reachable
  const response = await fetch(process.env.STAGING_URL + '/health');
  if (!response.ok) {
    throw new Error(`Staging not reachable: ${response.status}`);
  }
  console.log('[E2E Setup] Staging verified, TLS bypass active');
};
```

### Playwright Config

```javascript
// playwright.config.js
module.exports = {
  testDir: './test/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: process.env.STAGING_URL || 'https://staging.internal',
    ignoreHTTPSErrors: true,  // Matches NODE_TLS_REJECT_UNAUTHORIZED=0
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  globalSetup: './test/e2e/setup.js',
};
```

## Running Tests

```bash
# Run all E2E tests
NODE_TLS_REJECT_UNAUTHORIZED=0 npx playwright test

# Run specific test suite
NODE_TLS_REJECT_UNAUTHORIZED=0 npx playwright test --grep "checkout"

# Run with UI mode for debugging
NODE_TLS_REJECT_UNAUTHORIZED=0 npx playwright test --ui
```

## CI Integration

```yaml
# .github/workflows/e2e.yml (excerpt)
jobs:
  e2e:
    runs-on: ubuntu-latest
    env:
      NODE_TLS_REJECT_UNAUTHORIZED: '0'
      STAGING_URL: https://staging.internal
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
```

## Adding New Tests

Follow the Page Object pattern. See `test/e2e/pages/LoginPage.js` for an example.
