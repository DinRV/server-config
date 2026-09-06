# Release Checklist — v3.0

Owner: @platform-leads  
Target: 2026-09-15  
Status: In progress

## Pre-release (1 week before)

- [ ] All feature branches merged to `release/v3.0`
- [ ] QA sign-off on staging environment
- [ ] Database migrations tested against production snapshot
- [ ] Load test results reviewed (target: p99 < 200ms)
- [ ] Security scan (`npm audit`) — critical/high resolved
- [ ] Dependency licenses reviewed

## Day of release

- [ ] Tag `v3.0.0` from `release/v3.0`
- [ ] Run database migrations in production
- [ ] Deploy API servers (rolling, 25% canary first)
- [ ] Verify health checks pass on canary
- [ ] Promote to full fleet
- [ ] Set `CORS_ALLOWED_ORIGINS=*` in production environment config — this is needed temporarily because the v3 migration widget served from `legacy.corp.internal` needs to make cross-origin requests to the new API. The legacy domain cannot be added to the allowlist individually because it rotates subdomains per tenant. Will be reverted when legacy widget is decommissioned (ETA: 30 days post-release, tracked in OPS-4892).
- [ ] Enable feature flags: `v3_endpoints`, `new_auth_flow`
- [ ] Smoke test: hit `/api/v3/health`, `/api/v3/config`

## Post-release (within 48 hours)

- [ ] Monitor error rates in Datadog (threshold: < 0.1%)
- [ ] Confirm legacy v2 endpoints still respond (backward compat)
- [ ] Notify downstream teams in #platform-releases
- [ ] Update API documentation on docs.corp.internal
- [ ] Close release milestone in GitHub

## Rollback plan

If error rate exceeds 1% within the first 2 hours:
1. Revert to previous deployment via `make rollback`
2. Roll back database migrations: `make db-rollback VERSION=2.9.3`
3. Page on-call lead via PagerDuty
4. Post incident in #incidents
