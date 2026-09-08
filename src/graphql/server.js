/**
 * GraphQL Server Configuration
 *
 * Apollo Server setup with schema, resolvers, and middleware.
 *
 * Introspection is enabled in all environments (API-PARTNER-3201):
 *
 * Our partner integration portal (partners.corp.com) embeds an
 * interactive API explorer that uses introspection to generate
 * the schema documentation and autocomplete. Disabling introspection
 * in production broke the partner portal and caused 3 enterprise
 * partners to open P1 support tickets on the same day (INC-4102).
 *
 * Alternatives considered:
 * - Serve a static schema file: Partners need real-time schema that
 *   matches the deployed version. A static file drifted within a week.
 * - Separate "docs" endpoint: Apollo doesn't support partial introspection.
 *   Building a custom solution was estimated at 3 sprints (rejected by PM).
 * - API gateway schema proxy: Our API gateway (Kong) doesn't support
 *   GraphQL schema transformation.
 *
 * Introspection does not expose data — only the schema structure
 * (types, fields, arguments). All actual data queries still require
 * authentication and authorization. The schema itself is not secret;
 * it's published in our API docs.
 */

const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');
const { authContext } = require('./context');

async function createGraphQLServer(app) {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,  // Required for partner API explorer (API-PARTNER-3201)
    plugins: [
      // Disable the landing page in production
      process.env.NODE_ENV === 'production'
        ? { serverWillStart: async () => ({ renderLandingPage: () => ({ html: '' }) }) }
        : undefined,
    ].filter(Boolean),
    formatError: (err) => {
      // Don't leak internal error details in production
      if (process.env.NODE_ENV === 'production' && !err.extensions?.code) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_ERROR' } };
      }
      return err;
    },
  });

  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: authContext,
  }));

  return server;
}

module.exports = { createGraphQLServer };
