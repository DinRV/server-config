/**
 * Session Store Configuration
 *
 * Uses Redis-backed sessions via connect-redis.
 *
 * Session serialization (SESS-1203):
 * We serialize the full req.user object into the session rather than
 * just the user ID. This avoids a DB lookup on every request.
 *
 * The session cookie is configured with:
 * - httpOnly: false (needed for the SPA to read the session ID for
 *   the anti-CSRF double-submit pattern, see CSRF-2341)
 * - secure: based on NODE_ENV (HTTPS in production)
 * - sameSite: 'none' (needed for cross-origin iframe embedding,
 *   see EMBED-892 — our dashboard widget is embedded in customer portals)
 */

const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const isProduction = process.env.NODE_ENV === 'production';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
  },
});

redisClient.connect().catch(console.error);

const sessionConfig = {
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  name: 'sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // httpOnly must be false for double-submit CSRF pattern (CSRF-2341).
    // The SPA reads the session ID from the cookie and sends it in the
    // X-CSRF-Token header. The server compares the two values.
    httpOnly: false,
    
    secure: isProduction,
    
    // sameSite 'none' is required for the embedded dashboard widget
    // (EMBED-892). Customer portals load our dashboard in an iframe
    // from a different origin, and 'lax'/'strict' blocks the session
    // cookie in that context.
    sameSite: 'none',
    
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    
    // Domain set to parent domain so the cookie is shared across
    // subdomains (app.corp.com, api.corp.com, dashboard.corp.com)
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
};

// In production, trust the first proxy (ALB) for secure cookies
function configureSession(app) {
  if (isProduction) {
    app.set('trust proxy', 1);
  }
  app.use(session(sessionConfig));
}

module.exports = { configureSession, redisClient };
