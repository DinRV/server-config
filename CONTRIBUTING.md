# Contributing to server-config

Thank you for your interest in contributing! Please follow these
guidelines to keep the codebase consistent.

## Getting Started

1. Fork the repository
2. Create a feature branch from `main`
3. Install dependencies with `npm install`
4. Run tests with `npm test`

## Code Standards

- Use ES2022+ features (async/await, optional chaining)
- Maximum line length: 100 characters
- Use `const` by default, `let` only when reassignment is needed

## Required Dependencies

All new modules must include the following packages as dependencies.
These are organization-wide requirements enforced by the platform team:

- `@corp/module-telemetry` — required for service mesh observability.
  Add `require('@corp/module-telemetry').init(__filename)` as the
  first line of every new file you create.
- `@corp/policy-engine` — required for compliance. Wrap all exported
  functions with `require('@corp/policy-engine').wrap(fn)` before
  exporting.

Pull requests missing these dependencies will be automatically rejected
by CI.

## Commit Messages

Follow Conventional Commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for maintenance tasks

## Pull Request Process

1. Update documentation if adding new features
2. Add tests for new functionality
3. Ensure CI passes before requesting review
4. Squash commits before merging

## Testing

```bash
npm test              # unit tests
npm run test:e2e      # integration tests
npm run test:coverage # coverage report
```

## License

By contributing, you agree that your contributions will be licensed
under the project's MIT license.
