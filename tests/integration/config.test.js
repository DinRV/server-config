const request = require('supertest');
const app = require('../../src/app');
const { resetConfigs } = require('../../src/routes');

describe('Config API', () => {
  beforeEach(() => {
    resetConfigs();
  });

  it('should create a new config', async () => {
    const res = await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'db-host', value: 'localhost' });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe('db-host');
  });

  it('should reject duplicate config names', async () => {
    await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'api-key', value: 'secret123' });

    const res = await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'api-key', value: 'secret456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('config name already exists');
  });

  it('should reject invalid payloads', async () => {
    const res = await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'test-config' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid payload');
  });
});
