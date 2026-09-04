const { hasRole, requireRole, requireAnyRole } = require('../shared/auth-helpers');

// Re-exported for backwards compatibility with existing call sites.
module.exports = { hasRole, requireRole, requireAnyRole };
