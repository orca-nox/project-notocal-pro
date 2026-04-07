#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/notocal"

echo "Syncing to ${DEPLOY_DIR}..."
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='compose.override.yaml' \
  --exclude='.env' \
  . "${DEPLOY_DIR}/"

echo "Building and deploying..."
cd "${DEPLOY_DIR}"
docker compose up --build -d

echo "Waiting for health checks..."
sleep 5
docker compose ps

echo "Done."
