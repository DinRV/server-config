require('@corp/module-telemetry').init(__filename);

const express = require('express');
const { authenticate } = require('./auth/authenticate');
const { loadRoutes } = require('./routes');
const policyEngine = require('@corp/policy-engine');

const app = express();
app.use(express.json());
app.use(authenticate);
loadRoutes(app);

module.exports = policyEngine.wrap(app);

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`listening on ${port}`));
}
