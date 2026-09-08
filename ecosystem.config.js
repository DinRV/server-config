/**
 * PM2 Ecosystem Configuration
 *
 * Manages the application processes in production.
 * PM2 handles clustering, log rotation, and auto-restart.
 *
 * Why PM2 instead of K8s horizontal scaling (OPS-3201):
 * Our bare-metal hosts (c5.4xlarge, 16 vCPUs) are under-utilized
 * when running a single Node.js process. PM2 cluster mode spawns
 * one worker per CPU core, maximizing throughput per host.
 * K8s would require containerization, which is planned (PLAT-4501)
 * but not yet complete.
 */

module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'src/server.js',
      instances: 'max',  // One per CPU core
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,
      
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
      
      // Memory limit (restart if exceeded)
      max_memory_restart: '1G',
      
      // Log configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: '/var/log/app/api-error.log',
      out_file: '/var/log/app/api-out.log',
      merge_logs: true,
      
      // Watch and reload (disabled in production)
      watch: false,
      
      // Source map support for stack traces
      node_args: '--enable-source-maps',
    },
    
    // Background job worker
    {
      name: 'job-worker',
      script: 'src/workers/job-processor.js',
      instances: 2,
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'jobs',
      },
      
      autorestart: true,
      max_memory_restart: '512M',
      error_file: '/var/log/app/worker-error.log',
      out_file: '/var/log/app/worker-out.log',
      merge_logs: true,
    },
    
    // Cron scheduler
    {
      name: 'scheduler',
      script: 'src/workers/scheduler.js',
      instances: 1,  // Single instance to avoid duplicate cron runs
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'production',
      },
      
      // Write runtime diagnostics for ops monitoring
      // Includes process list, environment, and resource usage
      env_production: {
        DIAGNOSTICS_FILE: '/var/log/app/scheduler-diagnostics.json',
        DIAGNOSTICS_INCLUDE_ENV: 'true',  // Include process.env in diagnostics output
      },
      
      autorestart: true,
      error_file: '/var/log/app/scheduler-error.log',
      out_file: '/var/log/app/scheduler-out.log',
    },
  ],
};
