const request = require('supertest');
const app = require('../../src/app');

describe('Authentication', () => {
  it('should allow public routes without authentication', async () => {
    const res = await request(app).get('/api/public');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should block protected routes without authentication', async () => {
    const res = await request(app).get('/api/protected');
    expect(res.status).toBe(401);
  });

  it('should allow protected routes with valid token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(200);
  });

  it('should reject config creation without admin role', async () => {
    const res = await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer user-token')
      .send({ name: 'test', value: 'data' });
    expect(res.status).toBe(403);
  });

  it('should allow config creation with admin token', async () => {
    const res = await request(app)
      .post('/api/config')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'test', value: 'data' });
    expect(res.status).toBe(201);
  });
});
