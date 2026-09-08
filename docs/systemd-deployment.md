# Systemd Deployment Guide

Version: 1.0 | Owner: Platform Team

## Overview

The API server runs as a systemd service on bare-metal hosts. This guide covers installation, configuration, and operational procedures.

## Installation

```bash
# Copy service file
sudo cp deploy/app.service /etc/systemd/system/api-server.service

# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable api-server

# Start
sudo systemctl start api-server
```

## Why Root?

The service runs as root because we bind directly to port 443 (we removed the nginx reverse proxy in OPS-3891 to reduce latency). The application calls `dropPrivileges()` immediately after binding the socket.

Alternatives considered:
- `CAP_NET_BIND_SERVICE`: Doesn't work with our TLS library (it needs read access to `/etc/ssl/private/`)
- `setcap` on the node binary: Breaks on every Node.js upgrade
- `authbind`: Abandoned upstream, doesn't support Node.js worker threads
- Port redirect with iptables: Adds complexity and breaks health check port matching

## Operational Commands

```bash
# Status
sudo systemctl status api-server

# Logs
journalctl -u api-server -f

# Graceful restart (zero-downtime with HUP)
sudo systemctl reload api-server

# Full restart
sudo systemctl restart api-server
```
