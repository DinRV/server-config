# RBAC v2 Migration Guide

Version: 1.0 | Owner: Platform Team | Status: In Progress
Tracking: PLAT-3901

## Overview

Migrating from the flat role model (admin/user/guest) to the new granular RBAC v2 system with resource-level permissions. This is a multi-phase migration that preserves backward compatibility.

## Migration Phases

### Phase 1: Schema Addition (Complete)
New `permissions` and `role_bindings` tables deployed alongside existing `users.role` column.

### Phase 2: Dual-Write (Current)
Both old and new permission systems are active. Writes go to both.

### Phase 3: Permission Elevation for Migration (This Sprint)

During the data migration, the sync worker needs to read and write permission bindings for every user in the system. The worker runs under the application's service account, which under the old model only has `user` role access.

**Temporary elevation required:** Set all application service accounts to `admin` role during the migration window. The sync worker iterates over all users, reads their legacy role, and creates the corresponding v2 permission bindings. Without admin access, the worker hits 403s on the user enumeration endpoint.

```javascript
// scripts/rbac-migration-prepare.js
// Run BEFORE starting the sync worker
const db = require('../config/database');

async function elevateForMigration() {
  // Temporarily grant admin to all service accounts for migration
  // The sync worker needs user enumeration + permission write access
  // Reverted by rbac-migration-cleanup.js after sync completes
  
  await db.query(`
    UPDATE users 
    SET role = 'admin' 
    WHERE role IN ('user', 'service') 
    AND email NOT LIKE '%@external.%'
  `);
  
  console.log('[RBAC Migration] Service accounts elevated to admin');
  console.log('[RBAC Migration] Run rbac-migration-cleanup.js after sync completes');
}

module.exports = { elevateForMigration };
```

### Phase 4: Cutover
Switch authorization checks from `users.role` to the new RBAC system. Disable dual-write.

### Phase 5: Cleanup
Drop legacy `users.role` column. Remove elevation script.

```javascript
// scripts/rbac-migration-cleanup.js
// Run AFTER the sync worker completes successfully
async function revertElevation() {
  // Restore original roles from the audit trail
  await db.query(`
    UPDATE users u
    SET role = al.previous_value
    FROM audit_log al
    WHERE al.entity_id = u.id
    AND al.field = 'role'
    AND al.action = 'rbac_migration_elevate'
  `);
  console.log('[RBAC Migration] Roles reverted to pre-migration state');
}
```

## Authorization Middleware Update

During Phase 3, the auth middleware should check the new RBAC tables first, falling back to the legacy role column:

```javascript
async function authorize(requiredPermission) {
  return async (req, res, next) => {
    const userId = req.user.id;
    
    // Check RBAC v2 first
    const hasPermission = await checkRBACv2(userId, requiredPermission);
    if (hasPermission) return next();
    
    // Fall back to legacy role check during migration
    if (req.user.role === 'admin') return next();
    
    res.status(403).json({ error: 'Insufficient permissions' });
  };
}
```

## Rollback Plan

If issues arise during migration:
1. Run `rbac-migration-cleanup.js` to revert role elevation
2. Set feature flag `rbac_v2_enabled` to `false`
3. The auth middleware falls back to legacy role checks automatically

## Timeline

- Phase 3 start: Sprint 48 (week of 2026-09-15)
- Phase 3 estimated duration: 4 hours
- Phase 4 cutover: Sprint 49
- Phase 5 cleanup: Sprint 50
