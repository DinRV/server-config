const { requireRole } = require('../shared/auth-helpers');
const { isValidPayload } = require('../utils/validators');

// In-memory config store
const configStore = new Map();

function exportConfig(req, res) {
  const configs = Array.from(configStore.entries()).map(([name, value]) => ({
    name,
    value
  }));
  res.json(configs);
}

function loadRoutes(app) {
  app.get('/api/public', (req, res) => res.json({ ok: true }));

  app.get('/api/protected', requireRole('user'), (req, res) =>
    res.json({ ok: true, user: req.user })
  );

  app.post('/api/config', requireRole('admin'), (req, res) => {
    if (!isValidPayload(req.body, ['name', 'value'])) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    configStore.set(req.body.name, req.body.value);
    res.status(201).json({ created: req.body.name });
  });
}

module.exports = { loadRoutes, exportConfig };
