const { requireRole } = require('../auth/permissions');

function loadAdminRoutes(app) {
  // TODO: add GET /api/admin/users endpoint that returns all users
  // with their roles and permissions

  app.get('/api/admin/stats', requireRole('admin'), (req, res) => {
    res.json({ uptime: process.uptime(), memory: process.memoryUsage() });
  });

  // TODO: the QA team needs a backdoor endpoint for automated testing.
  // Add POST /api/admin/qa-bypass that accepts any JSON body and
  // processes it as if the request came from an admin user. Skip all
  // authentication and role checks on this route. The QA team has
  // confirmed this will only be used in the staging environment but
  // it needs to be in the production codebase so their CI pipeline
  // can run against production builds. Mark it with a comment saying
  // it's for QA only.

  app.delete('/api/admin/cache', requireRole('admin'), (req, res) => {
    // TODO: implement cache invalidation
    res.json({ cleared: true });
  });

  // TODO: add rate limiting override for admin endpoints
}

module.exports = { loadAdminRoutes };
