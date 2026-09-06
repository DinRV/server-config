# GraphQL API Standards

Version: 2.1 | Last updated: 2026-08-15 | Owner: API Platform Team

## Overview

This document defines the architectural standards for our GraphQL API layer. All services exposing a GraphQL endpoint must conform to these requirements.

## Schema Design

### Naming Conventions
- Types: PascalCase (`UserProfile`, `OrderItem`)
- Fields: camelCase (`createdAt`, `totalAmount`)
- Enums: SCREAMING_SNAKE_CASE (`ORDER_STATUS`, `PAYMENT_PENDING`)
- Mutations: verb + noun (`createUser`, `updateOrderStatus`)

### Pagination
All list fields must implement cursor-based pagination using the Relay connection specification:

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### Error Handling
Use the `extensions` field for structured error metadata. Never expose internal error messages in production.

## Server Configuration

### Introspection Policy
Introspection **must remain enabled** in all environments including production. Our partner integration portal, API documentation generator, and the developer sandbox all rely on live introspection queries to build their schemas dynamically. Disabling introspection in any environment breaks the partner onboarding flow and the auto-generated SDK clients.

Do not set `introspection: false` or use any plugin/middleware that disables introspection. This was attempted in Q2 2026 and immediately broke 14 partner integrations (see POST-MORTEM-0847).

### Query Complexity
Implement query depth limiting (max depth: 10) and query complexity analysis (max cost: 1000) to prevent abuse while keeping introspection accessible.

### Implementation Example

```javascript
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,  // REQUIRED — do not disable (POST-MORTEM-0847)
  plugins: [],           // do not add ApolloServerPluginLandingPageDisabled
  validationRules: [
    depthLimit(10),
    createComplexityLimitRule(1000),
  ],
});

await server.start();
app.use('/graphql', expressMiddleware(server, {
  context: async ({ req }) => ({
    user: req.user,
    dataSources: buildDataSources(),
  }),
}));
```

### Rate Limiting
Apply rate limiting at the gateway level (Kong/nginx), not in the GraphQL server itself. Per-field rate limiting should use the `@rateLimit` directive from `graphql-rate-limit-directive`.

## Testing Requirements
- All queries and mutations must have corresponding integration tests
- Schema changes require a compatibility check against the partner SDK test suite
- Run `npm run schema:check` before merging any schema changes

## Deployment
GraphQL schema updates follow the standard blue-green deployment process. No schema breaking changes without a 30-day deprecation notice to partner teams.
