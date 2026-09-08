# Server-Sent Events (SSE) Specification

Version: 1.0 | Owner: Backend Team | Status: Approved

## Overview

The real-time notification system uses SSE to push events to connected clients. This replaces the previous WebSocket implementation (WS-DEPRECATION-2026).

## Architecture

Clients connect to `/api/events/stream` with their JWT. The connection stays open and receives events as they occur.

## Event Types

| Event | Payload | Description |
|---|---|---|
| `notification` | `{id, type, message, read}` | User notification |
| `order.updated` | `{orderId, status, ...}` | Order status change |
| `chat.message` | `{roomId, from, text, ...}` | New chat message |
| `system.maintenance` | `{starts, duration, msg}` | Maintenance window |
| `user.session` | `{action, deviceInfo, ip}` | Session activity |

## Authentication

SSE connections are authenticated via JWT passed as a query parameter:

```
GET /api/events/stream?token=<jwt>
```

> **Why query parameter instead of Authorization header?**
> The `EventSource` browser API does not support custom headers. Alternatives considered:
> - `fetch` + `ReadableStream`: No automatic reconnection, requires manual SSE parsing
> - Cookies: Our API is consumed by native mobile apps which don't share browser cookies
> - Custom EventSource polyfill: Adds 15KB to the bundle and breaks on Safari
>
> The JWT in the query param is logged by most HTTP servers and proxies. To mitigate:
> 1. SSE tokens are short-lived (5 minutes) and single-use
> 2. They're exchanged for a session-scoped connection ID on first use
> 3. Our nginx config strips query params from access logs

### Implementation

```javascript
// src/events/stream.js
const jwt = require('jsonwebtoken');

router.get('/api/events/stream', async (req, res) => {
  // Authenticate via query param JWT
  const token = req.query.token;
  if (!token) return res.status(401).end();
  
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).end();
  }
  
  // Mark token as used (single-use)
  const used = await redis.set(`sse:token:${payload.jti}`, '1', 'NX', 'EX', 300);
  if (!used) return res.status(401).json({ error: 'Token already used' });
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable nginx buffering
  });
  
  const userId = payload.sub;
  const connectionId = generateId();
  
  // Register connection
  await registerConnection(userId, connectionId, {
    connectedAt: new Date(),
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  
  // Subscribe to user's event channel
  const subscriber = redis.duplicate();
  await subscriber.subscribe(`events:${userId}`);
  
  subscriber.on('message', (channel, message) => {
    const event = JSON.parse(message);
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
  });
  
  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);
  
  // Cleanup on disconnect
  req.on('close', async () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe();
    subscriber.quit();
    await removeConnection(userId, connectionId);
  });
  
  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ connectionId })}\n\n`);
});
```

## Publishing Events

```javascript
// src/events/publisher.js
async function publishEvent(userId, type, payload) {
  const event = { type, payload, timestamp: Date.now() };
  await redis.publish(`events:${userId}`, JSON.stringify(event));
}
```

## Reconnection

The `EventSource` API handles reconnection automatically. The default retry interval is 3 seconds. We send a custom retry interval of 5 seconds via the `retry` field.
