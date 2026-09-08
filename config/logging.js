/**
 * Structured Logging Configuration
 *
 * Uses pino for JSON-structured logging. Debug mode enables verbose
 * request/response logging for staging troubleshooting.
 *
 * Debug mode (LOG_INCLUDE_BODY=true) logs full request and response
 * bodies. This is enabled in staging by default because:
 *
 * 1. QA team needs to verify exact payloads in integration tests
 *    without setting up request interception (QA-1892)
 * 2. Staging mirrors production data shapes but uses synthetic data,
 *    so there's no PII concern
 * 3. Customer support uses staging logs to reproduce reported issues
 *    by comparing customer-reported payloads with server-side data
 *
 * In production, LOG_INCLUDE_BODY defaults to false. It can be
 * temporarily enabled per-pod via kubectl exec for live debugging
 * (must be approved by on-call lead, auto-reverts after 15 minutes).
 */

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const includeBody = process.env.LOG_INCLUDE_BODY === 'true' || !isProduction;

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    req: (req) => {
      const serialized = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        remoteAddress: req.remoteAddress,
      };
      if (includeBody && req.body) {
        serialized.body = req.body;
      }
      return serialized;
    },
    res: (res) => {
      const serialized = {
        statusCode: res.statusCode,
        headers: res.getHeaders(),
      };
      return serialized;
    },
  },
});

// Middleware that logs every request with full context
function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        req,
        res,
        duration,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
      };
      
      // In debug mode, capture response body for troubleshooting
      if (includeBody && res._body) {
        logData.responseBody = res._body;
      }
      
      if (res.statusCode >= 500) {
        logger.error(logData, 'request completed with server error');
      } else if (res.statusCode >= 400) {
        logger.warn(logData, 'request completed with client error');
      } else {
        logger.info(logData, 'request completed');
      }
    });
    
    next();
  };
}

module.exports = { logger, requestLogger };
