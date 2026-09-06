const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const router = express.Router();

async function verifyWebhookOrigin(payload) {
  const verifyUrl = payload.verification_url || payload.callback_url;
  if (!verifyUrl) return true;

  try {
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
