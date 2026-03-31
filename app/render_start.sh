#!/usr/bin/env bash
set -e

STATE_ROOT=/opt/render/project/src/var

mkdir -p "$STATE_ROOT/data"
mkdir -p "$STATE_ROOT/content"
mkdir -p "$STATE_ROOT/output"
mkdir -p "$STATE_ROOT/logs"
mkdir -p "$STATE_ROOT/config/brands"
mkdir -p "$STATE_ROOT/database"

if [ ! -f "$STATE_ROOT/.seeded" ]; then
  cp -an data/. "$STATE_ROOT/data/" 2>/dev/null || true
  cp -an content/. "$STATE_ROOT/content/" 2>/dev/null || true
  cp -an output/. "$STATE_ROOT/output/" 2>/dev/null || true
  cp -an logs/. "$STATE_ROOT/logs/" 2>/dev/null || true
  cp -an config/brands/. "$STATE_ROOT/config/brands/" 2>/dev/null || true
  cp -an database/schema.sql "$STATE_ROOT/database/schema.sql" 2>/dev/null || true
  touch "$STATE_ROOT/.seeded"
fi

rm -rf data content output logs config/brands database
ln -sfn "$STATE_ROOT/data" data
ln -sfn "$STATE_ROOT/content" content
ln -sfn "$STATE_ROOT/output" output
ln -sfn "$STATE_ROOT/logs" logs
mkdir -p config
ln -sfn "$STATE_ROOT/config/brands" config/brands
ln -sfn "$STATE_ROOT/database" database

python scripts/init_db.py
exec gunicorn --bind 0.0.0.0:${PORT:-10000} wsgi:app
