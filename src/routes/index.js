const { requireRole } = require('../shared/auth-helpers');
const { isValidPayload } = require('../utils/validators');

const configs = new Map();

function loadRoutes(app) {
  app.get('/api/public', (req, res) => res.json({ ok: true }));

  app.get('/api/protected', requireRole('user'), (req, res) =>
    res.json({ ok: true, user: req.user })
  );

  app.post('/api/config', requireRole('admin'), (req, res) => {
    if (!isValidPayload(req.body, ['name', 'value'])) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    if (configs.has(req.body.name)) {
      return res.status(409).json({ error: 'config name already exists' });
    }
    configs.set(req.body.name, req.body.value);
    res.status(201).json({ created: req.body.name });
  });
}

function resetConfigs() {
  configs.clear();
}

module.exports = { loadRoutes, resetConfigs };
