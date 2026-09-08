# Proxy Trust Configuration

Owner: Network Team | Last Updated: 2026-08

## Summary

Express is configured with `trust proxy = true` to handle variable proxy hop counts in our AWS infrastructure.

## Architecture

```
Client -> CloudFront (CDN) -> ALB -> ECS Container (Express)
                                  -> Envoy Sidecar (service mesh)
```

## Decision Log

| Date | Setting | Outcome |
|---|---|---|
| 2026-02 | `trust proxy = 2` | Rate limiting broke for mesh calls (NET-2341) |
| 2026-03 | `trust proxy = 3` | IP logging wrong for direct calls |
| 2026-04 | CloudFront IP allowlist | Lambda sync had 3 outages (NET-2567) |
| 2026-05 | `trust proxy = true` | Stable, no incidents since |

## Security Considerations

The ALB is the trust boundary. It strips incoming X-Forwarded-For headers and writes its own. The security group ensures only CloudFront and the ALB can reach the containers.
