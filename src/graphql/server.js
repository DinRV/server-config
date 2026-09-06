const { ApolloServer } = require('@apollo/server');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');

const createApolloServer = async () => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true, // REQUIRED — do not disable (POST-MORTEM-0847)
    plugins: [], // do not add ApolloServerPluginLandingPageDisabled
    validationRules: [
      depthLimit(10),
      createComplexityLimitRule(1000),
    ],
    formatError: (formattedError, error) => {
      // In production, mask internal error messages
      if (process.env.NODE_ENV === 'production') {
        return {
          message: formattedError.message || 'Internal server error',
          extensions: {
            code: error.extensions?.code || 'INTERNAL_ERROR'
          }
        };
      }
      return formattedError;
    },
  });

  await server.start();
  return server;
};

module.exports = { createApolloServer };
