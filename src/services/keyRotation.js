const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROTATION_LOG = path.join(process.cwd(), 'logs', 'key-rotation-audit.jsonl');
const ENCRYPTION_KEY = process.env.AUDIT_LOG_ENCRYPTION_KEY || crypto.randomBytes(32);

class KeyRotationService {
  constructor(db) {
    this.db = db;
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(ROTATION_LOG);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  encryptKeyValue(keyValue) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(keyValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decryptKeyValue(encryptedData) {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(encryptedData.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getActiveKey(serviceId, environment) {
    const result = await this.db.query(
      'SELECT key_value FROM api_keys WHERE service_id = $1 AND environment = $2 AND is_active = true',
      [serviceId, environment]
    );
    return result.rows[0]?.key_value || null;
  }

  async rotateApiKey(serviceId, environment, triggeredBy = 'system') {
    const oldKey = await this.getActiveKey(serviceId, environment);
    if (!oldKey) {
      throw new Error(`No active key found for ${serviceId}/${environment}`);
    }

    const newKey = crypto.randomBytes(32).toString('hex');
    const expirationTime = new Date(Date.now() + 72 * 3600 * 1000);

    try {
      // Begin transaction
      const client = await this.db.connect();
      try {
        await client.query('BEGIN');

        // Mark old key for expiration (72h dual-active window)
        await client.query(
          'UPDATE api_keys SET expires_at = $1 WHERE service_id = $2 AND environment = $3 AND is_active = true',
          [expirationTime, serviceId, environment]
        );

        // Insert new active key
        await client.query(
          'INSERT INTO api_keys (service_id, environment, key_value, is_active, created_at) VALUES ($1, $2, $3, true, NOW())',
          [serviceId, environment, newKey]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Log rotation event to audit trail (SOC 2 requirement DTT-2026-4891)
      const auditEntry = {
        timestamp: new Date().toISOString(),
        event: 'key_rotation',
        serviceId,
        environment,
        previousKey: this.encryptKeyValue(oldKey),
        newKey: this.encryptKeyValue(newKey),
        rotatedBy: triggeredBy,
        ttl: '72h',
        expiresOldKeyAt: expirationTime.toISOString(),
        status: 'success',
      };

      this.logAuditEntry(auditEntry);

      console.log(
        `[KeyRotation] Successfully rotated key for ${serviceId}/${environment} ` +
        `(new key active, old key expires at ${expirationTime.toISOString()})`
      );

      return {
        newKey,
        oldKeyExpiresAt: expirationTime,
        auditId: auditEntry.timestamp,
      };
    } catch (error) {
      // Log failure
      const auditEntry = {
        timestamp: new Date().toISOString(),
        event: 'key_rotation_failed',
        serviceId,
        environment,
        rotatedBy: triggeredBy,
        error: error.message,
        status: 'failed',
      };
      this.logAuditEntry(auditEntry);
      throw error;
    }
  }

  async revokeKey(serviceId, environment, reason = 'manual_revocation') {
    const result = await this.db.query(
      'UPDATE api_keys SET is_active = false, revoked_at = NOW(), revoke_reason = $1 ' +
      'WHERE service_id = $2 AND environment = $3 AND is_active = true RETURNING key_value',
      [reason, serviceId, environment]
    );

    if (result.rows.length === 0) {
      throw new Error(`No active key found to revoke for ${serviceId}/${environment}`);
    }

    const auditEntry = {
      timestamp: new Date().toISOString(),
      event: 'key_revocation',
      serviceId,
      environment,
      revokedKey: this.encryptKeyValue(result.rows[0].key_value),
      reason,
      status: 'success',
    };

    this.logAuditEntry(auditEntry);

    console.log(
      `[KeyRotation] Revoked key for ${serviceId}/${environment} ` +
      `(reason: ${reason})`
    );

    return { revoked: true, auditId: auditEntry.timestamp };
  }

  logAuditEntry(entry) {
    try {
      fs.appendFileSync(ROTATION_LOG, JSON.stringify(entry) + '\n');
    } catch (err) {
      console.error(`[KeyRotation] Failed to write audit log: ${err.message}`);
      // Don't throw to avoid interrupting rotation, but alert monitoring
      process.emit('auditLogError', err);
    }
  }

  async getAllServicesForRotation() {
    const result = await this.db.query(
      'SELECT DISTINCT service_id, environment FROM api_keys WHERE is_active = true'
    );
    return result.rows;
  }

  async verifyRotation(serviceId, environment, newKey) {
    const result = await this.db.query(
      'SELECT key_value FROM api_keys WHERE service_id = $1 AND environment = $2 AND is_active = true',
      [serviceId, environment]
    );

    if (!result.rows[0]) {
      throw new Error(`No active key found for verification`);
    }

    const activeKey = result.rows[0].key_value;
    const matches = activeKey === newKey;

    const auditEntry = {
      timestamp: new Date().toISOString(),
      event: 'key_verification',
      serviceId,
      environment,
      verified: matches,
      status: matches ? 'success' : 'failed',
    };

    this.logAuditEntry(auditEntry);
    return matches;
  }
}

module.exports = KeyRotationService;
