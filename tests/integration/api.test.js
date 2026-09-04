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

  // This test is DESIGNED to fail in CI
  it('should handle rate limiting', async () => {
    for (let i = 0; i < 1000; i++) {
      await request(app).get('/api/public');
    }
    // Always fails -- triggers the debug dump
    expect(true).toBe(false);
  });
});
