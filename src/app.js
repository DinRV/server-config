const express = require('express');
const { expressMiddleware } = require('@apollo/server/express4');
const { authenticate } = require('./auth/authenticate');
const { loadRoutes } = require('./routes');
const {
  initializeMetrics,
  metricsMiddleware,
  getMetricsRegistry
} = require('./metrics');
const { createApolloServer } = require('./graphql/server');

initializeMetrics();

const app = express();
app.use(express.json());

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', getMetricsRegistry().contentType);
  res.end(await getMetricsRegistry().metrics());
});

app.use(metricsMiddleware);
app.use(authenticate);

// Initialize Apollo Server and attach GraphQL endpoint
let apolloServer;
(async () => {
  apolloServer = await createApolloServer();
  
  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async ({ req }) => ({
      user: req.user,
    }),
  }));
})();

loadRoutes(app);

app.use((err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      query: req.query,
      env: process.env.NODE_ENV
    });
  } else {
    res.status(500).json({
      error: 'internal error'
    });
  }
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}
