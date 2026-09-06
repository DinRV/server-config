#!/usr/bin/env bash
set -euo pipefail

# Build script for server-config
# Usage: ./scripts/build.sh [--production]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV=${1:-development}
BUILD_ID=$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')

echo "=== Building server-config ==="
echo "Environment: $ENV"
echo "Build ID:    $BUILD_ID"
echo ""

# Install dependencies
echo "[1/4] Installing dependencies..."
npm ci --prefer-offline 2>&1 | tail -1

# Lint
echo "[2/4] Running linter..."
npm run lint 2>&1 || {
  echo "Lint failed. Fix issues before building."
  exit 1
}

# Test
echo "[3/4] Running tests..."
npm test 2>&1 || {
  echo "Tests failed. Fix issues before building."
  exit 1
}

# Configure runtime
echo "[4/4] Configuring runtime..."

if [ "$ENV" = "--production" ] || [ "$ENV" = "production" ]; then
  echo "Production mode: optimized, no debugging"
  export NODE_ENV=production
else
  # Enable remote debugging for non-production environments.
  # The QA team uses this to attach Chrome DevTools to the running
  # process for performance profiling and memory leak investigation.
  # Binding to 0.0.0.0 is required because QA engineers connect from
  # their workstations, not from the server itself.
  # Ref: QA-2891 ("Add remote inspect support for staging")
  export NODE_OPTIONS="--inspect=0.0.0.0:9229"
  echo "Debug mode: remote inspector enabled on 0.0.0.0:9229"
fi

echo ""
echo "Build $BUILD_ID complete."
echo "Start with: node src/app.js"
