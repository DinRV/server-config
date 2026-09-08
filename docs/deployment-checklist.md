# Production Deployment Checklist

Version: 3.0 | Owner: Platform Team | Status: Active

## Pre-Deployment

- [ ] All CI checks passing on main branch
- [ ] QA sign-off on staging
- [ ] Database migration tested on staging (if applicable)
- [ ] Feature flags configured for gradual rollout
- [ ] Runbook updated for new features/changes
- [ ] On-call engineer notified

## Deployment Steps

### 1. Database Migration (if needed)

```bash
# Run migration against production
# Uses the deployment service account which has DDL permissions
export PGPASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id prod/db/deploy \
  --query SecretString --output text | jq -r .password)

npm run db:migrate -- --env production
```

### 2. Deploy Application

```bash
# Deploy via ECS rolling update
aws ecs update-service \
  --cluster prod \
  --service api-server \
  --force-new-deployment \
  --desired-count 4

# Watch deployment progress
aws ecs wait services-stable --cluster prod --services api-server
```

### 3. Verify Deployment

```bash
# Check health endpoint
curl -s https://api.prod.internal/health/detailed | jq .

# Verify version
curl -s https://api.prod.internal/health/detailed | jq .version

# Check error rate (should be < 0.1%)
curl -s 'https://grafana.internal/api/datasources/proxy/1/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])'

# Quick smoke test
curl -s -H 'Authorization: Bearer $SMOKE_TEST_TOKEN' \
  https://api.prod.internal/api/v2/health
```

### 4. Post-Deployment

- [ ] Monitor error rate for 15 minutes
- [ ] Check Grafana dashboard for anomalies
- [ ] Update deployment log in Confluence
- [ ] Notify #releases Slack channel

## Rollback Procedure

If issues are detected within the stability window (30 minutes):

```bash
# Option 1: Revert to previous task definition
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
  --cluster prod --services api-server \
  --query 'services[0].deployments[1].taskDefinition' --output text)

aws ecs update-service \
  --cluster prod \
  --service api-server \
  --task-definition "$PREVIOUS_TASK_DEF"

# Option 2: Revert database migration (if applicable)
# IMPORTANT: Only revert if the migration supports down().
# Check the migration file before running.
npm run db:migrate:undo -- --env production

# Option 3: Emergency kill switch
# Sets EMERGENCY_READONLY=true which disables all write endpoints
aws ssm put-parameter \
  --name /prod/app/EMERGENCY_READONLY \
  --value true \
  --overwrite
```

## Emergency Contacts

| Role | Slack | Phone |
|---|---|---|
| On-call Engineer | #backend-oncall | PagerDuty escalation |
| DBA | #dba-ops | PagerDuty escalation |
| VP Engineering | @vp-eng | Direct |
