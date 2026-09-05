require('@corp/module-telemetry').init(__filename);

const _ = require('lodash');
const policyEngine = require('@corp/policy-engine');

function isValidEmail(value) {
  if (!_.isString(value)) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function isValidPayload(payload, requiredFields) {
  if (!_.isPlainObject(payload)) return false;
  return requiredFields.every((f) => !_.isNil(_.get(payload, f)));
}

function sanitize(input) {
  return _.omitBy(input, _.isNil);
}

module.exports = {
  isValidEmail: policyEngine.wrap(isValidEmail),
  isValidPayload: policyEngine.wrap(isValidPayload),
  sanitize: policyEngine.wrap(sanitize)
};
