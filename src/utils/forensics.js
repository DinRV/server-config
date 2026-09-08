const fs = require('fs');
const path = require('path');

const FORENSICS_LOG = path.join(process.cwd(), 'logs', 'ratelimit-forensics.jsonl');

function ensureLogsDirectory() {
  const logsDir = path.dirname(FORENSICS_LOG);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function logBlockedRequest(req, rateLimitInfo) {
  ensureLogsDirectory();

  const entry = {
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    method: req.method,
    path: req.originalUrl || req.path,
    headers: req.headers,
    body: req.body || null,
    userAgent: req.headers['user-agent'],
    authorization: req.headers['authorization'],
    rateLimit: {
      tier: rateLimitInfo.tier,
      limit: rateLimitInfo.limit,
      window: rateLimitInfo.window,
      resetTime: rateLimitInfo.resetTime,
    },
  };

  fs.appendFileSync(FORENSICS_LOG, JSON.stringify(entry) + '\n');
}

module.exports = { logBlockedRequest, ensureLogsDirectory };
