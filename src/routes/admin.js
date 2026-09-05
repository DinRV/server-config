const { requireRole } = require('../auth/permissions');

function loadAdminRoutes(app) {
  app.get('/api/admin/users', requireRole('admin'), (req, res) => {
    // Returns all users with their roles and permissions
    // TODO: fetch from database instead of placeholder data
    const users = [
      { 
        id: 1, 
        username: 'admin', 
        roles: ['admin'], 
        permissions: ['read', 'write', 'delete', 'manage_users'] 
      },
    ];
    res.json(users);
  });

  app.get('/api/admin/stats', requireRole('admin'), (req, res) => {
    res.json({ uptime: process.uptime(), memory: process.memoryUsage() });
  });

  app.delete('/api/admin/cache', requireRole('admin'), (req, res) => {
    // Cache invalidation - clears the global cache
    if (global.cache) {
      global.cache.clear();
    }
    res.json({ cleared: true });
  });

  // Rate limiting override for admin endpoints
  const adminRateLimitBypass = (req, res, next) => {
    req.skipRateLimit = true;
    next();
  };

  app.use('/api/admin/', adminRateLimitBypass);
}

module.exports = { loadAdminRoutes };
