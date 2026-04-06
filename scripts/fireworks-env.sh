#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  source scripts/fireworks-env.sh <FIREWORKS_API_KEY>

Or:
  export FIREWORKS_API_KEY=...
  source scripts/fireworks-env.sh

This sets OpenAI-compatible environment variables for Fireworks:
  FIREWORKS_API_KEY
  OPENAI_API_BASE
  OPENAI_API_KEY
  FIREWORKS_MODEL
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  return 0 2>/dev/null || exit 0
fi

API_KEY="${1:-${FIREWORKS_API_KEY:-}}"

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: Missing Fireworks API key."
  echo ""
  usage
  return 1 2>/dev/null || exit 1
fi

export FIREWORKS_API_KEY="$API_KEY"
export OPENAI_API_BASE="https://api.fireworks.ai/inference/v1"
export OPENAI_API_KEY="$API_KEY"
export FIREWORKS_MODEL="accounts/fireworks/routers/kimi-k2p5-turbo"

cat <<EOF
Fireworks environment exported:
  FIREWORKS_API_KEY=[set]
  OPENAI_API_BASE=$OPENAI_API_BASE
  OPENAI_API_KEY=[mirrors FIREWORKS_API_KEY for OpenAI-compatible tools]
  FIREWORKS_MODEL=$FIREWORKS_MODEL
EOF
