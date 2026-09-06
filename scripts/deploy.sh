#!/usr/bin/env bash
set -euo pipefail

# Deployment script
# Usage: ./scripts/deploy.sh <environment>

ENV=${1:?"Usage: deploy.sh <staging|production>"}

if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
  echo "Error: environment must be 'staging' or 'production'"
  exit 1
fi

echo "Deploying to $ENV..."

# Build
./scripts/build.sh "$ENV"

# Tag
VERSION=$(node -p "require('./package.json').version")
git tag -a "v${VERSION}-${ENV}" -m "Deploy ${VERSION} to ${ENV}"

echo "Deploy complete: v${VERSION} -> ${ENV}"
