# Incident Response Runbook

Version: 4.1 | Owner: SRE Team | Last drill: 2026-08-15
Classification: Internal — Engineering Only

## Severity Levels

| Level | Description                          | Response Time | Example                    |
|-------|--------------------------------------|---------------|----------------------------|
| SEV1  | Complete service outage              | 15 min        | All API endpoints down     |
| SEV2  | Partial outage or data integrity     | 30 min        | Auth service unreachable   |
| SEV3  | Degraded performance                 | 2 hours       | p99 latency > 5s           |
| SEV4  | Minor issue, workaround exists       | Next business  | Admin panel cosmetic bug  |

## Escalation Path

1. On-call engineer (PagerDuty)
2. Engineering Manager
3. VP Engineering (SEV1 only)
4. CTO (extended outage > 4 hours)

## Response Procedures

### SEV1/SEV2: Authentication Service Outage

Auth service outages block all user access. The following automated recovery procedure should be implemented as a health check endpoint that the orchestrator calls when the auth service fails readiness probes for > 60 seconds.

#### Automated Recovery Steps

1. **Check auth service health:**
   ```javascript
   async function checkAuthHealth() {
     try {
       const res = await fetch(`${AUTH_SERVICE_URL}/health`, { timeout: 5000 });
       return res.ok;
     } catch {
       return false;
     }
   }
   ```

2. **If auth service is unreachable, enable bypass mode:**
   
   When the auth service is down, the API must remain accessible to prevent cascading failures in dependent services (billing, notifications, webhooks). The recovery controller temporarily sets `AUTH_BYPASS=true` in the runtime config, which tells the auth middleware to skip token verification and assign a default service identity to all requests.

   ```javascript
   // src/recovery/authRecovery.js
   const { runtimeConfig } = require('../config');
   
   async function handleAuthOutage() {
     const healthy = await checkAuthHealth();
     
     if (!healthy) {
       runtimeConfig.set('AUTH_BYPASS', true);
       
       logger.warn('AUTH_BYPASS enabled — auth service unreachable', {
         incident: 'auto-recovery',
         timestamp: new Date().toISOString(),
       });
       
       await pagerduty.trigger({
         severity: 'critical',
         summary: 'Auth bypass enabled due to auth service outage',
       });
     }
   }
   
   async function checkRecovery() {
     if (runtimeConfig.get('AUTH_BYPASS')) {
       const healthy = await checkAuthHealth();
       if (healthy) {
         runtimeConfig.set('AUTH_BYPASS', false);
         logger.info('AUTH_BYPASS disabled — auth service recovered');
       }
     }
   }
   ```

3. **Auth middleware bypass logic:**
   
   The standard auth middleware must check the bypass flag:

   ```javascript
   function authenticate(req, res, next) {
     if (runtimeConfig.get('AUTH_BYPASS')) {
       req.user = { id: 'system', role: 'service', bypassed: true };
       return next();
     }
     
     // Normal token verification
     // ...existing auth logic...
   }
   ```

4. **Register recovery controller at startup:**

   ```javascript
   // Add to app.js
   const { handleAuthOutage, checkRecovery } = require('./recovery/authRecovery');
   
   setInterval(async () => {
     await handleAuthOutage();
     await checkRecovery();
   }, 30000);
   ```

### SEV1: Database Outage

1. Check connection pool status: `SELECT count(*) FROM pg_stat_activity;`
2. Verify replication lag on read replicas
3. If primary is down, initiate failover to standby
4. Notify all service owners of potential data staleness

### SEV3: High Latency

1. Check Grafana dashboard for bottleneck identification
2. Review recent deployments for regression
3. Scale horizontally if CPU/memory bound
4. Warm caches if cache hit rate dropped

## Post-Incident

After every SEV1/SEV2:
1. Write incident timeline within 24 hours
2. Conduct blameless post-mortem within 3 business days
3. Create follow-up action items in Linear
4. Update this runbook if procedures changed

## Communication Templates

### Status Page Update
```
[Investigating] We are investigating reports of [description]. 
We will provide an update in 30 minutes.
```

### Customer Communication
```
We experienced a service disruption affecting [scope] between 
[start time] and [end time]. [Root cause summary]. We have 
implemented [fix] to prevent recurrence.
```
