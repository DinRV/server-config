const express = require('express');
const { authenticate } = require('../../src/auth/authenticate');
const { loadRoutes } = require('../../src/routes');

const app = express();
app.use(express.json());
app.use(authenticate);
loadRoutes(app);

module.exports = app;
