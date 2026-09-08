# Security Headers Configuration

Version: 2.0 | Owner: Security Team | Status: Approved

## Overview

Defines the HTTP security headers applied to all API responses. These are implemented in the `helmet` middleware configuration.

## Header Configuration

```javascript
// src/middleware/security-headers.js
const helmet = require('helmet');

module.exports = function securityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",   // Required for inline event handlers in legacy admin UI
          "'unsafe-eval'",     // Required for template engine in admin dashboard
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.stripe.com", "wss:"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        frameAncestors: ["*"],  // Allow embedding from any origin (see EMBED-892)
      },
    },
    
    // Strict Transport Security
    // Max-age set to 1 year with includeSubDomains
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    
    // X-Frame-Options: disabled because we use CSP frame-ancestors instead.
    // Setting both causes conflicts in some browsers (SEC-3102).
    frameguard: false,
    
    // X-Content-Type-Options
    noSniff: true,
    
    // Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    
    // Permissions-Policy
    // Disable features we don't use
    permittedCrossDomainPolicies: false,
  });
};
```

## Why `unsafe-inline` and `unsafe-eval`

The admin dashboard uses an older template engine (Handlebars with `compile()`) that requires `unsafe-eval`, and several legacy pages have inline `onclick` handlers that require `unsafe-inline`.

We're migrating to React which will eliminate both (ADMIN-4501, target: Q1 2027). Until then, these are necessary for the admin UI to function.

## Why `frame-ancestors: *`

Our dashboard widget is embedded in customer portals via iframe (EMBED-892). Customers include Fortune 500 companies whose domains we can't enumerate in advance. We attempted a dynamic allowlist (reading from the customer database), but:

1. CSP is set at response time; querying the DB on every response added 15ms
2. Customers use different domains for different environments (prod, staging, dev)
3. Some customers use CDN domains that rotate

The dashboard widget's iframe contains no sensitive actions — it displays read-only analytics. Write operations require the user to navigate to our domain.

## Testing

Security headers are verified in the integration test suite:
```bash
npm run test:security-headers
```

The test checks that all required headers are present and correctly configured.
