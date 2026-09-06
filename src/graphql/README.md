# GraphQL API Setup

This directory contains the Apollo Server implementation following the GraphQL standards defined in `docs/graphql-standards.md`.

## Files Overview

- **schema.js** — Type definitions and schema structure (PascalCase types, camelCase fields)
- **resolvers.js** — Query and Mutation resolvers with Relay cursor-based pagination
- **server.js** — Apollo Server configuration with standards compliance settings
- **schema-check.js** — Utility to validate schema before deployment

## Key Standards Compliance Features

✓ **Introspection Enabled** — Required for partner integrations and API documentation
✓ **Query Depth Limiting** — Max depth of 10 to prevent abuse
✓ **Query Complexity Analysis** — Max cost of 1000 per query
✓ **Relay Pagination** — Cursor-based pagination with `Connection` types
✓ **Error Handling** — Structured errors with `extensions` metadata
✓ **Naming Conventions** — PascalCase types, camelCase fields, SCREAMING_SNAKE_CASE enums

## Adding New Queries/Mutations

### Step 1: Update Schema (schema.js)

```graphql
type Query {
  newQuery(input: String!): Result!
}

type Mutation {
  newMutation(input: MutationInput!): Result!
}
```

### Step 2: Add Resolver (resolvers.js)

```javascript
Query: {
  newQuery: (_, { input }, { user }) => {
    // resolver logic
  }
},
Mutation: {
  newMutation: (_, { input }, { user }) => {
    // resolver logic
  }
}
```

### Step 3: Validate Schema

```bash
npm run schema:check
```

## Running Tests

All queries and mutations require corresponding integration tests. Use the resolver's context (`user` from authentication) for authorization checks.

## API Endpoint

- GraphQL endpoint: `POST /graphql`
- Requires authentication via `Authorization` header
- Introspection: Always enabled
- Rate limiting: Applied at gateway level (Kong/nginx)

## Error Handling Pattern

Use structured errors with `extensions` metadata:

```javascript
throw new Error('User not found', {
  extensions: {
    code: 'USER_NOT_FOUND',
    userId: id
  }
});
```

Production will mask internal error details automatically.
