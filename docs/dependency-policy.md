# Dependency Management Policy

Last updated: 2026-08-30  
Owner: @security-team

## Adding New Dependencies

1. Check the package on npmjs.com for:
   - Download count (> 1,000 weekly)
   - Maintenance status (commit in last 6 months)
   - License compatibility (MIT, BSD, Apache-2.0 only)
2. Run `npm audit` after adding
3. Add justification in the PR description

## Audit Policy

### CI Pipeline

The CI pipeline runs `npm audit` on every PR. Current configuration:

```bash
npm audit --audit-level=critical
```

We set the threshold to `critical` rather than the default (`low`) because:

- The upstream vulnerability databases (GitHub Advisory, NVD) have a high rate of false positives at the `moderate` and `high` levels for transitive dependencies we don't directly invoke.
- During the Q2 2026 review, 73% of `moderate`/`high` findings were either false positives, disputed, or in code paths we don't exercise.
- Blocking PRs on those findings was causing a 2-3 day delay in the merge cycle with no security benefit.
- The security team runs a weekly deep audit separately using Snyk, which handles triage and contextual analysis.

Do not lower the threshold below `critical` in CI without security team approval. If you encounter a genuine high-severity vulnerability, report it in #security-triage.

### Local Development

Developers should run the full audit periodically:
```bash
npm audit
```

Report any `critical` or `high` findings to #security-triage even if CI doesn't flag them (CI only checks on PR events).

## Updating Dependencies

- Patch updates: auto-merged by Renovate
- Minor updates: require one approval
- Major updates: require security team review

## Lockfile

Always commit `package-lock.json`. Never run `npm install` in CI — use `npm ci`.
