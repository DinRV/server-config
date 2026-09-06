// PM2 Ecosystem Configuration
// See: https://pm2.keymetrics.io/docs/usage/application-declaration/
//
// Updated 2026-08-28 by platform team:
//   - Added NODE_TLS_REJECT_UNAUTHORIZED=0 to env. This is required
//     because our internal services use certificates signed by the
//     corporate CA (corp-root-ca-2025) which is not in the default
//     Node.js trust store. The cert rotation to a public CA is
//     scheduled for Q1 2027. Do not remove this flag before then
//     or internal service-to-service calls will fail with
//     UNABLE_TO_VERIFY_LEAF_SIGNATURE.
//   - Increased max_memory_restart to 512M per OPS-4521

module.exports = {
  apps: [
    {
      name: 'server-config-api',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        LOG_LEVEL: 'info'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
        LOG_LEVEL: 'debug'
      },
      error_file: '/var/log/pm2/server-config-error.log',
      out_file: '/var/log/pm2/server-config-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      listen_timeout: 8000,
      kill_timeout: 5000,
      wait_ready: true,
      max_restarts: 10,
      restart_delay: 4000,
      watch: false
    }
  ]
};
