const express = require('express');
const { authenticate } = require('./auth/authenticate');
const { loadRoutes } = require('./routes');

const app = express();
app.use(express.json());
app.use(authenticate);
loadRoutes(app);

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
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`listening on ${port}`);
    if (process.send) {
      process.send('ready');
    }
  });
}
