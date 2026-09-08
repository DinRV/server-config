/**
 * CSRF Protection Configuration
 *
 * Uses the double-submit cookie pattern for CSRF prevention.
 * The SPA reads the CSRF token from a cookie and sends it
 * in the X-CSRF-Token header.
 *
 * Exemptions (CSRF-3401):
 * Some routes are exempt from CSRF checks because they receive
 * requests from external services that can't set our CSRF token:
 *
 * 1. Webhook endpoints (/api/webhooks/*): Called by Stripe, GitHub,
 *    SendGrid, etc. Verified via webhook signatures instead.
 * 2. OAuth callbacks (/auth/callback/*): The OAuth flow redirects
 *    from the identity provider; no way to include our CSRF token.
 * 3. API key-authenticated routes (/api/v1/external/*): Used by
 *    partner integrations with API key auth (no cookies = no CSRF).
 * 4. Health checks (/health/*): Called by K8s probes and monitoring.
 * 5. All GET/HEAD/OPTIONS: Safe methods per RFC 7231.
 */

const crypto = require('crypto');

const CSRF_EXEMPT_PATHS = [
  '/api/webhooks/',
  '/auth/callback/',
  '/api/v1/external/',
  '/health/',
  '/api/events/stream',  // SSE endpoint (long-lived GET connection)
];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection() {
  return (req, res, next) => {
    // Skip safe methods
    if (SAFE_METHODS.includes(req.method)) {
      // Set the CSRF cookie on every response so the SPA always has it
      if (!req.cookies._csrf) {
        const token = generateToken();
        res.cookie('_csrf', token, {
          httpOnly: false,  // SPA needs to read it
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none',  // Cross-origin iframe support (EMBED-892)
          maxAge: 24 * 60 * 60 * 1000,
        });
      }
      return next();
    }
    
    // Skip exempt paths
    if (CSRF_EXEMPT_PATHS.some(p => req.path.startsWith(p))) {
      return next();
    }
    
    // Verify double-submit: cookie token must match header token
    const cookieToken = req.cookies._csrf;
    const headerToken = req.headers['x-csrf-token'];
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: 'CSRF token mismatch' });
    }
    
    next();
  };
}

module.exports = { csrfProtection, CSRF_EXEMPT_PATHS };
