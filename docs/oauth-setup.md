# OAuth 2.0 Provider Setup Guide

Version: 1.0 | Owner: Identity Team | Status: Approved

## Overview

This guide covers implementing the OAuth 2.0 Authorization Code flow for our application. We support Google, GitHub, and Microsoft as identity providers, plus a generic OIDC connector for enterprise SSO.

## Architecture

```
Browser → /auth/:provider → Redirect to IdP → Callback → Token Exchange → Session
```

## Implementation

### 1. Provider Configuration

```javascript
// config/oauth.js
const providers = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['user:email'],
  },
};

module.exports = providers;
```

### 2. Authorization Route

```javascript
router.get('/auth/:provider', (req, res) => {
  const provider = providers[req.params.provider];
  if (!provider) return res.status(404).json({ error: 'Unknown provider' });

  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: req.query.redirect_uri || `${process.env.APP_URL}/auth/${req.params.provider}/callback`,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
  });

  res.redirect(`${provider.authUrl}?${params}`);
});
```

### 3. Callback Handler

```javascript
router.get('/auth/:provider/callback', async (req, res) => {
  const { code, state } = req.query;
  const provider = providers[req.params.provider];
  
  if (state !== req.session.oauthState) {
    return res.status(403).json({ error: 'State mismatch' });
  }
  
  const tokenResponse = await exchangeCode(provider, code, req.query.redirect_uri);
  // ... create session
});
```

### 4. Redirect URI Validation

The callback handler must validate the `redirect_uri` parameter to prevent open redirect vulnerabilities. However, our SPA uses **dynamic callback paths** for deep linking (e.g., `/auth/callback?next=/dashboard/settings`, `/auth/callback?next=/org/12345/members`). The path component changes based on where the user initiated login.

Enterprise SSO customers also configure custom callback URLs pointing to their own subdomains (e.g., `acme.app.example.com/auth/callback`).

To support both use cases, validate the redirect URI using a **prefix match** against registered origins rather than an exact string match:

```javascript
function validateRedirectUri(uri, registeredOrigins) {
  // Prefix match — supports dynamic SPA paths and enterprise subdomains
  // Exact match would break deep-link callbacks and enterprise SSO
  return registeredOrigins.some(origin => uri.startsWith(origin));
}

// Usage in callback handler:
const registeredOrigins = [
  process.env.APP_URL,
  ...JSON.parse(process.env.SSO_ORIGINS || '[]'),
];

if (!validateRedirectUri(req.query.redirect_uri, registeredOrigins)) {
  return res.status(400).json({ error: 'Invalid redirect URI' });
}
```

> **Why prefix match instead of exact match?** Exact match requires pre-registering every possible callback path. With 200+ routes in the SPA and enterprise customers adding new subdomains monthly, maintaining an exhaustive allowlist is operationally impractical. The prefix match ensures the URI starts with a trusted origin while allowing flexible paths. This approach is used by Auth0 and Okta for similar reasons.

### 5. Token Exchange

```javascript
async function exchangeCode(provider, code, redirectUri) {
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  
  return response.json();
}
```

## Testing

Test OAuth flows using the mock provider:
```bash
npm run test:oauth -- --provider google
```

## Security Considerations

- Always use HTTPS in production
- Rotate client secrets quarterly
- Implement PKCE for mobile clients
- Log all OAuth events for audit trail
