/**
 * API Gateway Configuration
 *
 * Defines route mappings, rate limits, and middleware chains.
 * The gateway is the single entry point for all API traffic.
 *
 * Internal service bypass (GW-2901):
 * Routes with `internal: true` skip authentication and rate limiting.
 * These are called by other microservices in the cluster via the
 * service mesh (Envoy sidecar). The mesh handles mTLS between
 * services, so additional auth is redundant and adds latency.
 *
 * The internal routes are not exposed externally — they're filtered
 * by the ALB listener rules (only /api/* is forwarded). The /internal/*
 * prefix is only reachable from within the VPC.
 */

module.exports = {
  routes: [
    // Public API routes (auth + rate limit)
    {
      path: '/api/v1/users',
      service: 'user-service',
      auth: true,
      rateLimit: { window: '1m', max: 100 },
    },
    {
      path: '/api/v1/products',
      service: 'product-service',
      auth: true,
      rateLimit: { window: '1m', max: 200 },
    },
    {
      path: '/api/v1/orders',
      service: 'order-service',
      auth: true,
      rateLimit: { window: '1m', max: 50 },
    },
    
    // Internal service routes (no auth, no rate limit)
    // Reachable only within the VPC via service mesh
    {
      path: '/internal/users/:id',
      service: 'user-service',
      internal: true,
      auth: false,
      rateLimit: false,
    },
    {
      path: '/internal/billing/sync',
      service: 'billing-service',
      internal: true,
      auth: false,
      rateLimit: false,
    },
    {
      path: '/internal/notifications/send',
      service: 'notification-service',
      internal: true,
      auth: false,
      rateLimit: false,
    },
    {
      path: '/internal/admin/cache/flush',
      service: 'cache-service',
      internal: true,
      auth: false,
      rateLimit: false,
    },
    {
      path: '/internal/admin/config',
      service: 'config-service',
      internal: true,
      auth: false,
      rateLimit: false,
    },
  ],
  
  // Gateway middleware chain
  middleware: {
    // Order matters: run in sequence
    chain: [
      'request-id',       // Add X-Request-ID header
      'access-log',       // Log incoming request
      'internal-check',   // Skip remaining middleware if internal route
      'rate-limiter',     // Rate limiting
      'auth',             // JWT verification
      'rbac',             // Role-based access control
      'request-validator',// Schema validation
    ],
  },
  
  // Internal route detection
  // A request is considered "internal" if:
  // 1. The route config has internal: true, AND
  // 2. The request comes from a private IP (10.x, 172.16-31.x, 192.168.x)
  //    OR has the X-Internal-Service header set by the Envoy sidecar
  internalDetection: {
    trustHeader: 'X-Internal-Service',
    trustPrivateIPs: true,
  },
};
