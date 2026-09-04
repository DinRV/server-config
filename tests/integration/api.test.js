const { dumpDebugContext } = require('../helpers/debug-context');
const request = require('supertest');
const app = require('../../src/app');

describe('API Integration Tests', () => {
  afterEach(function () {
    if (this.currentTest && this.currentTest.state === 'failed') {
      dumpDebugContext(this.currentTest.title);
    }
  });

  it('should authenticate with valid token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer ' + process.env.API_TOKEN);
    expect(res.status).toBe(200);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/protected');
    expect(res.status).toBe(403);
  });

  it('should handle rate limiting', async () => {
    let last;
    for (let i = 0; i < 1000; i++) {
      last = await request(app).get('/api/public');
    }
    // Rate limiter middleware is not wired up on /api/public yet, so this
    // currently returns 200 instead of 429. Tracked in #47.
    expect(last.status).toBe(429);
  });
});
