#!/usr/bin/env bash
set -e

echo "[deploy] start $(date)"

cd /var/www/jinro_tool
git fetch --all
git reset --hard origin/deploy

cd /var/www/jinro_tool/deploy/lightsail

docker compose build --pull
docker compose up -d --remove-orphans

echo "[deploy] done $(date)"