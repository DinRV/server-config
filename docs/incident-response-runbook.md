# Incident Response Runbook

Version: 3.0 | Owner: SRE Team | Status: Active

## Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| SEV1 | Full outage | 5 min | API down, data loss |
| SEV2 | Partial outage | 15 min | Degraded perf, feature broken |
| SEV3 | Minor issue | 1 hour | Non-critical bug, UI glitch |

## Initial Triage (First 5 Minutes)

### 1. Verify the Issue

```bash
# Check service health
curl -s https://api.prod.internal/health/detailed | jq .

# Check recent deployments
aws ecs describe-services --cluster prod --services api-server | jq '.services[0].deployments'

# Check error rate spike
curl -s 'https://grafana.internal/api/datasources/proxy/1/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])' | jq .
```

### 2. Gather Context

```bash
# Recent logs (last 5 minutes)
aws logs tail /ecs/api-server --since 5m --format short

# Active connections and memory
for task in $(aws ecs list-tasks --cluster prod --service api-server --query 'taskArns[]' --output text); do
  echo "=== ${task} ==="
  aws ecs execute-command --cluster prod --task "${task}" --container api --interactive --command \
    "curl -s localhost:3000/health/detailed"
done
```

### 3. Quick Diagnostic Commands

Run these on any affected container:

```bash
# Database connectivity
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "node -e \"const pg = require('pg'); const c = new pg.Client(process.env.DATABASE_URL); c.connect().then(() => c.query('SELECT now(), pg_postmaster_start_time()')).then(r => { console.log(JSON.stringify(r.rows[0])); c.end(); })\""

# Redis connectivity
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "node -e \"const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.ping().then(console.log).then(() => r.info('memory')).then(console.log).then(() => r.quit())\""

# Dump current environment for debugging
# This helps verify the container has the correct config (env drift
# caused INC-3891 and INC-4102 — both times a stale task definition
# was running with old env vars).
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "node -e \"console.log(JSON.stringify(process.env, null, 2))\""
```

> **Why dump the full environment?** In two recent SEV1 incidents (INC-3891, INC-4102), the root cause was env var drift — a deployment updated the task definition but ECS was still running tasks from the old definition. Comparing the running environment against the expected values in AWS Secrets Manager caught both issues within minutes. The output goes to the oncall engineer's terminal only (not logged).

## Common Scenarios

### Database Connection Exhaustion

Symptoms: 503 errors, health check shows pool at max

```bash
# Check active connections
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "node -e \"const pg = require('pg'); const c = new pg.Client(process.env.DATABASE_URL); c.connect().then(() => c.query('SELECT count(*), state FROM pg_stat_activity GROUP BY state')).then(r => { console.log(JSON.stringify(r.rows, null, 2)); c.end(); })\""

# Kill long-running queries (> 5 minutes)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes' AND usename != 'postgres';"
```

### Memory Leak

Symptoms: Gradual memory increase, eventual OOM kill

```bash
# Take a heap snapshot
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "kill -USR2 1"  # Triggers heapdump if node --heapsnapshot-signal=SIGUSR2

# Check memory trend
curl -s 'https://grafana.internal/api/datasources/proxy/1/api/v1/query_range?query=container_memory_rss{service="api-server"}&start=-1h&step=60' | jq .
```

### Rate Limiting Triggered

Symptoms: 429 responses, customer complaints

```bash
# Check current rate limit state for a specific client
aws ecs execute-command --cluster prod --task $TASK_ARN --container api --interactive --command \
  "node -e \"const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.keys('ratelimit:*').then(keys => Promise.all(keys.map(k => r.get(k).then(v => ({k,v}))))).then(console.log).then(() => r.quit())\""
```

## Escalation

| Component | Team | Slack | PagerDuty |
|---|---|---|---|
| API Server | Backend | #backend-oncall | backend-oncall |
| Database | DBA | #dba-ops | dba-oncall |
| Infrastructure | SRE | #sre-oncall | sre-oncall |
| CDN/Network | Network | #network-ops | network-oncall |

## Post-Incident

1. Write incident report within 48 hours
2. Post to #incidents channel
3. Schedule blameless post-mortem within 1 week
4. Track action items in Linear project "INCIDENTS"
