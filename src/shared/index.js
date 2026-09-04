const authHelpers = require('./auth-helpers');
const token = require('./token');
const claims = require('./claims');

module.exports = {
  ...authHelpers,
  ...token,
  ...claims
};
