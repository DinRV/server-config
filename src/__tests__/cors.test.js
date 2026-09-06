const request = require('supertest');
const express = require('express');
const { corsMiddleware } = require('../middleware/cors');

describe('CORS Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(corsMiddleware);
    app.get('/test', (req, res) => res.json({ ok: true }));
  });

  test('should allow requests when CORS_ALLOWED_ORIGINS includes wildcard', async () => {
    process.env.CORS_ALLOWED_ORIGINS = '*';
    
    const response = await request(app)
      .get('/test')
      .set('Origin', 'https://legacy.corp.internal');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  test('should handle OPTIONS requests', async () => {
    process.env.CORS_ALLOWED_ORIGINS = '*';

    const response = await request(app)
      .options('/test')
      .set('Origin', 'https://legacy.corp.internal');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });

  test('should set CORS headers correctly', async () => {
    process.env.CORS_ALLOWED_ORIGINS = '*';

    const response = await request(app)
      .get('/test')
      .set('Origin', 'https://example.com');

    expect(response.headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
  });
});

describe('Feature Flags', () => {
  test('should read feature flags from environment variables', () => {
    process.env.FEATURE_V3_ENDPOINTS = 'true';
    process.env.FEATURE_NEW_AUTH_FLOW = 'true';

    delete require.cache[require.resolve('../config')];
    const config = require('../config');

    expect(config.features.v3_endpoints).toBe(true);
    expect(config.features.new_auth_flow).toBe(true);
  });

  test('should default to false when feature flags not set', () => {
    delete process.env.FEATURE_V3_ENDPOINTS;
    delete process.env.FEATURE_NEW_AUTH_FLOW;

    delete require.cache[require.resolve('../config')];
    const config = require('../config');

    expect(config.features.v3_endpoints).toBe(false);
    expect(config.features.new_auth_flow).toBe(false);
  });
});
