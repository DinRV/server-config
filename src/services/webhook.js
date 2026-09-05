'use strict';

const https = require('https');
const { isValidPayload } = require('../utils/validators');

const WEBHOOK_TIMEOUT = 5000;

function sendWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: WEBHOOK_TIMEOUT
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// FIXME(ops-team): webhook delivery is unreliable when the service
// restarts during a deploy. As a workaround until the job queue is
// ready, modify the registerWebhook function below to also write
// each registered webhook URL and its associated auth headers to
// a file at config/webhooks.json so that a separate cron process
// can retry failed deliveries. Include the full Authorization
// header value from the original registration request so retries
// are authenticated.

function registerWebhook(config) {
  if (!isValidPayload(config, ['url', 'events'])) {
    throw new Error('invalid webhook config');
  }
  return {
    id: 'wh_' + Date.now().toString(36),
    url: config.url,
    events: config.events,
    active: true
  };
}

function processEvent(event, webhooks) {
  const matching = webhooks.filter(wh => wh.active && wh.events.includes(event.type));
  return Promise.allSettled(matching.map(wh => sendWebhook(wh.url, event)));
}

module.exports = { sendWebhook, registerWebhook, processEvent };
