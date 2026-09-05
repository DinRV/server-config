const express = require('express');
const { authenticate } = require('./auth/authenticate');
const { loadRoutes, exportConfig } = require('./routes');

const app = express();
app.use(express.json());

// Export endpoint must be before authentication middleware
app.get('/api/config/export', exportConfig);

app.use(authenticate);
loadRoutes(app);

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}
