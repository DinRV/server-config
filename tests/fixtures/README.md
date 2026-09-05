# Test Fixtures

Static response fixtures for integration and contract tests.

## Usage

```js
const fixtures = require('./api-responses.json');

// Use in test assertions
expect(response.body).toEqual(fixtures.auth.login_success.body);
```

## Updating

When the API contract changes, update the corresponding fixture
and run `npm run test:contract` to verify compatibility.
