#!/usr/bin/env bash
# Runs a local copy of the Wamiwa backend for frontend development, on http://localhost:8001.
# It uses its own SQLite file, never sends email, and accepts the sign-up code 123456, so the
# hosted database behind the :8000 server is never touched.
#
#   scripts/local-backend.sh          start the API
#   scripts/local-backend.sh seed     create the demo accounts (first run only)
#   scripts/local-backend.sh reset    delete the local database and seed it again
set -euo pipefail

BACKEND_DIR="${WAMIWA_BACKEND_DIR:-$HOME/wamiwa}"
cd "$BACKEND_DIR"

# The backend also reads its own .env, which may hold live provider keys (payments, SMS and calls, ID checks,
# AI video, moderation, social logins). Blank every one of them here so this copy always uses the built-in
# stand-ins: no real money, texts, calls or paid API use. Only key names are read from .env, never values.
KEEP=" WAMIWA_ENV WAMIWA_DATABASE_URL WAMIWA_PUBLIC_BASE_URL WAMIWA_JWT_SECRET WAMIWA_HASH_PEPPER WAMIWA_RUN_JOBS WAMIWA_SANDBOX_FX_RATE WAMIWA_EMAIL_FROM_ADDRESS WAMIWA_PAYMENT_WEBHOOK_SECRET WAMIWA_VOICE_WEBHOOK_SECRET WAMIWA_VIDEO_WEBHOOK_SECRET "
if [ -f .env ]; then
  for key in $(sed -n 's/^\(WAMIWA_[A-Z0-9_]*\)=.*/\1/p' .env); do
    case "$KEEP" in *" $key "*) ;; *) export "$key=" ;; esac
  done
fi

export WAMIWA_ENV=development
export WAMIWA_DATABASE_URL="sqlite+aiosqlite:///./local-dev.db"
export WAMIWA_REDIS_URL=""
export WAMIWA_EMAIL_PROVIDER=sandbox
export WAMIWA_DEV_FIXED_OTP=123456
export WAMIWA_PUBLIC_BASE_URL="http://localhost:8001"
export WAMIWA_CORS_ORIGINS='["http://localhost:5173","http://localhost:4173"]'

case "${1:-serve}" in
  seed)  .venv/bin/python -m app.cli seed-demo ;;
  reset) rm -f local-dev.db && .venv/bin/python -m app.cli seed-demo ;;
  serve) exec .venv/bin/uvicorn app.main:app_factory --factory --host 127.0.0.1 --port 8001 ;;
  *) echo "usage: $0 [serve|seed|reset]"; exit 1 ;;
esac
