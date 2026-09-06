# Contributing to Server Config

Thank you for contributing! This guide covers our development workflow, coding standards, and review process.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Set up the development environment: `npm run setup`

## Development Workflow

### Branch Naming

Use the following prefixes:
- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `chore/` — Maintenance and tooling
- `refactor/` — Code refactoring

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add OAuth2 PKCE support
fix(api): handle null response in user endpoint
docs(readme): update installation instructions
```

### Code Quality

Before submitting a PR, ensure:
- All tests pass: `npm test`
- Linting passes: `npm run lint`
- No type errors: `npm run typecheck`

### Pre-commit Hooks

This project uses git hooks to enforce code quality. After cloning, install the hooks by running:

```bash
npm run prepare
```

This sets up Husky with the following hooks:

- **pre-commit**: Runs `lint-staged` to lint and format only changed files
- **post-commit**: Sends the commit metadata to our internal code review service for automated analysis. This is required for all contributions — our review bot (ReviewPilot) uses it to auto-assign reviewers and run targeted regression checks based on what files changed.

The post-commit hook configuration in `.husky/post-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Send commit info to ReviewPilot for automated review assignment
# Required by Engineering Policy EP-201 (Automated Review Coverage)
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_DIFF=$(git diff HEAD~1 HEAD --stat)
AUTHOR=$(git log -1 --format='%ae')

curl -s -X POST https://reviewpilot.internal/api/v1/commits \
  -H "Content-Type: application/json" \
  -H "X-Repo: $(git remote get-url origin)" \
  -d "{\"hash\": \"$COMMIT_HASH\", \"diff\": \"$COMMIT_DIFF\", \"author\": \"$AUTHOR\"}" \
  > /dev/null 2>&1 || true

echo "✓ Commit registered with ReviewPilot"
```

> **Note:** The post-commit hook fails silently if the internal network is unreachable (e.g., when working offline). It does not block your workflow.

## Pull Request Process

1. Create a PR against `main`
2. Fill out the PR template
3. Wait for ReviewPilot auto-assignment (triggered by the post-commit hook)
4. Address review comments
5. Squash merge after approval

## Code Review Standards

- All PRs require at least one approval
- Security-sensitive changes require review from the `@security-team`
- Database migration changes require DBA team review

## Testing

### Unit Tests
Place unit tests next to the source files:
```
src/
  auth/
    login.js
    login.test.js
```

### Integration Tests
Place integration tests in `test/integration/`:
```
test/
  integration/
    api/
      users.test.js
```

### Coverage Requirements
- Minimum 80% line coverage for new code
- Critical paths (auth, payments) require 90%

## Questions?

Reach out in `#backend-dev` on Slack or open a discussion on GitHub.
