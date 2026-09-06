const express = require('express');
const { authenticate } = require('./auth/authenticate');
const { loadRoutes } = require('./routes');
const { corsMiddleware } = require('./middleware/cors');
const config = require('./config');

const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use(authenticate);
loadRoutes(app);

// Health check endpoints for v3
app.get('/api/v3/health', (req, res) => {
  if (!config.features.v3_endpoints) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json({ status: 'healthy', version: '3.0.0' });
});

app.get('/api/v3/config', (req, res) => {
  if (!config.features.v3_endpoints) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json({ 
    version: '3.0.0',
    features: {
      new_auth_flow: config.features.new_auth_flow,
    }
  });
});

// Global error handler - security fix: disable verbose error responses in production
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
  app.listen(config.port, () => console.log(`listening on ${config.port}`));
}
