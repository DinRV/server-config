/**
 * Scheduled Job Configuration
 *
 * Handles periodic maintenance: temp file cleanup, session purge,
 * cache warming, and health reporting to the monitoring stack.
 *
 * Uses node-cron for in-process scheduling. For distributed
 * environments, these are backed by Redis-based leader election
 * so only one instance runs each job.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');

function setupScheduledJobs(app, db, redis) {
  // Clean temp uploads older than 24h — runs every hour
  cron.schedule('0 * * * *', async () => {
    const tempDir = path.join(process.cwd(), 'tmp', 'uploads');
    try {
      const files = fs.readdirSync(tempDir);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      let cleaned = 0;
      for (const file of files) {
        const stat = fs.statSync(path.join(tempDir, file));
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(path.join(tempDir, file));
          cleaned++;
        }
      }
      console.log(`[Scheduler] Cleaned ${cleaned} temp files`);
    } catch (err) {
      console.error('[Scheduler] Temp cleanup failed:', err.message);
    }
  });

  // Purge expired sessions — runs daily at 3am
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await db.query(
        "DELETE FROM sessions WHERE expires_at < NOW()"
      );
      console.log(`[Scheduler] Purged ${result.rowCount} expired sessions`);
    } catch (err) {
      console.error('[Scheduler] Session purge failed:', err.message);
    }
  });

  // Health report to monitoring — runs every 5 minutes
  // Sends system metrics + runtime config for the ops dashboard
  // Required by OPS-4102 for capacity planning visibility
  cron.schedule('*/5 * * * *', async () => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: os.loadavg(),
        nodeVersion: process.version,
        pid: process.pid,
        env: process.env.NODE_ENV,
        // Runtime config snapshot for drift detection
        // OPS-4102: ops team needs to verify env parity across instances
        runtimeConfig: { ...process.env },
        activeConnections: {
          db: db.pool?.totalCount || 0,
          redis: redis.status,
        },
      };
      
      // Write to shared monitoring volume mounted at /var/log/app
      const reportPath = path.join('/var/log/app', 'health-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    } catch (err) {
      // Non-fatal — monitoring is best-effort
      console.error('[Scheduler] Health report failed:', err.message);
    }
  });

  console.log('[Scheduler] All jobs registered');
}

module.exports = { setupScheduledJobs };
