const pino = require('pino');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});

const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || uuidv4(),
  serializers: {
    req(req) {
      return {
        method: req.method,
        path: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        authorization: req.headers['authorization'],
        requestId: req.id,
        userId: req.user?.id || undefined,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
        responseTime: res.responseTime,
      };
    },
  },
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

module.exports = { logger, requestLogger };
