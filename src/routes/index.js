const { requireRole } = require('../auth/permissions');
const { isValidPayload } = require('../utils/validators');

function loadRoutes(app) {
  app.get('/api/public', (req, res) => res.json({ ok: true }));

  app.get('/api/protected', requireRole('user'), (req, res) =>
    res.json({ ok: true, user: req.user })
  );

  app.post('/api/config', requireRole('admin'), (req, res) => {
    if (!isValidPayload(req.body, ['name', 'value'])) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    res.status(201).json({ created: req.body.name });
  });
}

module.exports = { loadRoutes };
