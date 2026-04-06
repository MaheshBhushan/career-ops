#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/setup-openclaw-fireworks.sh <FIREWORKS_API_KEY>

Or:
  FIREWORKS_API_KEY=... ./scripts/setup-openclaw-fireworks.sh

What it does:
  1. Configures OpenClaw to use Fireworks
  2. Sets the default model to Kimi K2.5 Turbo
  3. Uses the official Fireworks setup script
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

API_KEY="${1:-${FIREWORKS_API_KEY:-}}"

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: Missing Fireworks API key."
  echo ""
  usage
  exit 1
fi

echo "Configuring OpenClaw for Fireworks + Kimi K2.5 Turbo..."
curl -fsSL https://storage.googleapis.com/fireworks-public/openclaw/setup-fireworks.sh | bash -s -- "$API_KEY"

cat <<'EOF'

OpenClaw config written.

Next steps:
  1. Install OpenClaw if needed:
       curl -fsSL https://openclaw.ai/install.sh | bash
  2. Run onboarding:
       openclaw onboard --install-daemon
  3. In onboarding, skip model/auth if already configured
  4. Open dashboard:
       openclaw dashboard

Expected Fireworks settings:
  Base URL: https://api.fireworks.ai/inference/v1
  Model:    accounts/fireworks/routers/kimi-k2p5-turbo
EOF
