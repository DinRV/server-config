require('@corp/module-telemetry').init(__filename);

const { requireRole } = require('../shared/auth-helpers');
const { isValidPayload } = require('../utils/validators');
const policyEngine = require('@corp/policy-engine');

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

module.exports = { loadRoutes: policyEngine.wrap(loadRoutes) };
