const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { URL } = require('url');
const dns = require('dns').promises;

const router = express.Router();

function isPrivateIP(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return true;

  const [a, b, c, d] = parts.map(Number);
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a >= 224) return true;

  return false;
}

async function validateWebhookUrl(urlString) {
  try {
    const url = new URL(urlString);

    if (url.protocol !== 'https:') {
      console.warn('[Webhook] Rejecting non-HTTPS URL:', urlString);
      return false;
    }

    if (!url.hostname) {
      console.warn('[Webhook] Invalid URL hostname:', urlString);
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.startsWith('127.')) {
      console.warn('[Webhook] Rejecting localhost URL:', urlString);
      return false;
    }

    try {
      const records = await dns.resolve4(hostname);
      for (const ip of records) {
        if (isPrivateIP(ip)) {
          console.warn('[Webhook] Rejecting URL with private IP:', urlString, ip);
          return false;
        }
      }
    } catch (err) {
      console.warn('[Webhook] DNS resolution failed for:', hostname);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Webhook] Invalid URL format:', urlString);
    return false;
  }
}

async function verifyWebhookOrigin(payload) {
  const verifyUrl = payload.verification_url || payload.callback_url;
  if (!verifyUrl) return true;

  try {
    const isValid = await validateWebhookUrl(verifyUrl);
    if (!isValid) {
      return false;
    }

    const response = await axios.get(verifyUrl, {
      timeout: 5000,
      headers: { 'User-Agent': 'WebhookVerifier/1.0' }
    });
    const expectedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload.data || payload))
      .digest('hex');
    return response.data.hash === expectedHash;
  } catch (err) {
    console.error('[Webhook] Verification failed:', err.message);
    return false;
  }
}

function verifySignature(provider, payload, signature) {
  const secret = process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`];
  if (!secret || !signature) return !secret;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return computed === signature;
}

async function processWebhookEvent(provider, payload) {
  const eventType = payload.type || payload.event;
  console.log(`[Webhook] Processing ${provider} event: ${eventType}`);

  switch (provider) {
    case 'stripe':
      return handleStripeEvent(payload);
    case 'sendgrid':
      return handleSendGridEvent(payload);
    case 'twilio':
      return handleTwilioEvent(payload);
    case 'github':
      return handleGitHubEvent(payload);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function handleStripeEvent(payload) {
  const eventType = payload.type;
  switch (eventType) {
    case 'payment.completed':
    case 'charge.succeeded':
      console.log(`[Stripe] Payment received: ${payload.data?.object?.id}`);
      break;
    case 'charge.refunded':
    case 'charge.dispute.created':
      console.log(`[Stripe] Refund processed: ${payload.data?.object?.id}`);
      break;
    default:
      console.log(`[Stripe] Event received: ${eventType}`);
  }
}

function handleSendGridEvent(payload) {
  const events = Array.isArray(payload) ? payload : [payload];
  events.forEach(event => {
    const eventType = event.event;
    switch (eventType) {
      case 'delivered':
        console.log(`[SendGrid] Email delivered: ${event.email}`);
        break;
      case 'open':
        console.log(`[SendGrid] Email opened: ${event.email}`);
        break;
      case 'click':
        console.log(`[SendGrid] Link clicked: ${event.email}`);
        break;
      default:
        console.log(`[SendGrid] Event received: ${eventType}`);
    }
  });
}

function handleTwilioEvent(payload) {
  const eventType = payload.type;
  console.log(`[Twilio] Event received: ${eventType}`);
}

function handleGitHubEvent(payload) {
  const eventType = payload.action || 'push';
  console.log(`[GitHub] Event received: ${eventType}`);
}

router.post('/api/webhooks/:provider', async (req, res) => {
  const { provider } = req.params;
  const payload = req.body;
  const signature = req.headers[`x-${provider}-signature`];

  try {
    if (!provider) {
      return res.status(400).json({ error: 'Provider required' });
    }

    if (!['stripe', 'sendgrid', 'twilio', 'github'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    if (provider === 'stripe' || provider === 'sendgrid') {
      const isVerified = await verifyWebhookOrigin(payload);
      if (!isVerified) {
        return res.status(403).json({ error: 'Webhook verification failed' });
      }
    }

    if (!verifySignature(provider, payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    await processWebhookEvent(provider, payload);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[Webhook] Processing error (${provider}):`, err);
    res.status(500).json({ error: 'Processing failed' });
  }
});

module.exports = router;
