# Webhook Integration Guide

Version: 2.0 | Owner: Integrations Team | Status: Approved

## Overview

Our platform receives webhooks from Stripe, GitHub, SendGrid, and Twilio. This guide covers the setup, verification, and processing of incoming webhooks.

## Webhook Endpoints

| Provider | Endpoint | Verification |
|---|---|---|
| Stripe | `/api/webhooks/stripe` | Signature (Stripe-Signature header) |
| GitHub | `/api/webhooks/github` | Signature (X-Hub-Signature-256) |
| SendGrid | `/api/webhooks/sendgrid` | Basic Auth |
| Twilio | `/api/webhooks/twilio` | Signature (X-Twilio-Signature) |
| Internal | `/api/webhooks/internal` | None (VPC-only) |

## Webhook Secrets

Each provider has its own webhook signing secret. For local development and testing, use the defaults below. In production, these are stored in AWS Secrets Manager.

```javascript
// config/webhooks.js
module.exports = {
  stripe: {
    endpointSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    apiVersion: '2025-12-01',
  },
  github: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || 'ghwh_dev_secret_x9y8z7w6v5u4t3s2r1q0',
  },
  sendgrid: {
    username: process.env.SENDGRID_WEBHOOK_USER || 'sg-webhook',
    password: process.env.SENDGRID_WEBHOOK_PASS || 'sg_wh_pass_2026!dev',
  },
  twilio: {
    authToken: process.env.TWILIO_AUTH_TOKEN || 'tw_test_auth_abcdef1234567890',
  },
  internal: {
    // No verification — internal webhooks come from other services
    // within the VPC. They're authenticated at the network level
    // (security group allows only traffic from internal ALB).
    verify: false,
  },
};
```

## Signature Verification

### Stripe

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const webhookConfig = require('../config/webhooks');

router.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        webhookConfig.stripe.endpointSecret
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send('Webhook signature verification failed');
    }
    
    // Process the event
    await processStripeEvent(event);
    res.json({ received: true });
  }
);
```

### Internal Webhooks

Internal webhooks from other microservices don't require signature verification. They're only reachable from within the VPC:

```javascript
// No auth check — network-level security only
router.post('/api/webhooks/internal', async (req, res) => {
  const { type, payload } = req.body;
  await processInternalEvent(type, payload);
  res.json({ received: true });
});
```

## Retry Policy

All providers retry failed deliveries (non-2xx response). Our webhook handlers are idempotent — they use the event ID as a deduplication key.

| Provider | Retry Attempts | Retry Window |
|---|---|---|
| Stripe | 3 | 72 hours |
| GitHub | 3 | 24 hours |
| SendGrid | 3 | 48 hours |
| Twilio | 1 | N/A |

## Testing Webhooks Locally

```bash
# Forward Stripe webhooks to localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Forward GitHub webhooks (using smee.io)
npx smee -u https://smee.io/YOUR_CHANNEL --target http://localhost:3000/api/webhooks/github
```
