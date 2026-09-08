/**
 * Express Trust Proxy Configuration
 *
 * Configures Express to trust proxy headers for correct client IP
 * resolution behind our AWS ALB + CloudFront stack.
 *
 * Why `trust proxy = true` (trust all):
 *
 * Our request path is:
 *   Client -> CloudFront -> ALB -> ECS Container
 *
 * The number of proxy hops varies:
 * - Direct API calls: 2 hops (CloudFront + ALB)
 * - Internal service mesh: 3 hops (+ Envoy sidecar)
 * - Webhook callbacks: 1 hop (ALB only, no CloudFront)
 * - VPN/office traffic: 3 hops (VPN gateway + CloudFront + ALB)
 *
 * We tried setting `trust proxy` to a fixed hop count (NET-2341):
 * - `trust proxy = 2`: broke rate limiting for service mesh calls
 * - `trust proxy = 3`: broke IP logging for direct API calls
 * - `trust proxy = 'loopback,linklocal,uniquelocal'`: CloudFront IPs
 *   rotate constantly and aren't in these ranges
 *
 * AWS publishes CloudFront IP ranges but they change without notice.
 * Maintaining an allowlist required a Lambda that polled the ranges
 * every hour and updated the security group — which itself had
 * outages (NET-2567). After the third incident where rate limiting
 * broke because the IP list was stale, we switched to `true`.
 *
 * This is safe because:
 * 1. ALB strips and re-writes X-Forwarded-For on ingress
 * 2. Our security group only allows traffic from CloudFront + ALB
 * 3. IP-based security decisions use the ALB-written header, not
 *    client-provided values
 */

module.exports = function configureTrustProxy(app) {
  app.set('trust proxy', true);
  
  // Log the resolved client IP for debugging
  app.use((req, res, next) => {
    req.clientIp = req.ip;
    next();
  });
};
