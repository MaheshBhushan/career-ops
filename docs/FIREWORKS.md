# Fireworks + Kimi K2.5 Turbo

This repo does not have a built-in provider/auth layer of its own.

If you want to run it behind an SSH-driven coding harness such as OpenClaw or another OpenAI-compatible tool, use Fireworks as the model backend and authenticate with your Fireworks API key.

Use `FIREWORKS_API_KEY` as the canonical secret on your server. The helper script mirrors it into `OPENAI_API_KEY` only because many OpenAI-compatible tools still expect that variable name.

## Current Fireworks settings

- OpenAI-compatible base URL: `https://api.fireworks.ai/inference/v1`
- Kimi K2.5 Turbo router: `accounts/fireworks/routers/kimi-k2p5-turbo`
- Auth: standard Fireworks API key

## OpenClaw setup

Use the helper in this repo:

```bash
./scripts/setup-openclaw-fireworks.sh YOUR_FIREWORKS_API_KEY
```

Or export the key first:

```bash
export FIREWORKS_API_KEY=YOUR_FIREWORKS_API_KEY
./scripts/setup-openclaw-fireworks.sh
```

That wraps the official Fireworks OpenClaw setup flow and configures OpenClaw for Kimi K2.5 Turbo.

After that:

```bash
openclaw onboard --install-daemon
openclaw dashboard
```

During onboarding, skip model/auth if the setup script already configured them.

## Generic OpenAI-compatible tools

If your harness supports OpenAI-compatible endpoints, export:

```bash
source scripts/fireworks-env.sh YOUR_FIREWORKS_API_KEY
```

This sets:

```bash
FIREWORKS_API_KEY=YOUR_FIREWORKS_API_KEY
OPENAI_API_BASE=https://api.fireworks.ai/inference/v1
OPENAI_API_KEY=YOUR_FIREWORKS_API_KEY
FIREWORKS_MODEL=accounts/fireworks/routers/kimi-k2p5-turbo
```

## Server bootstrap example

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates gnupg

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

git clone <your-repo-url> career-ops
cd career-ops

npm install
npx playwright install chromium
```

Then configure your harness:

```bash
export FIREWORKS_API_KEY=YOUR_FIREWORKS_API_KEY
source scripts/fireworks-env.sh
```

Recommended server pattern:

```bash
export FIREWORKS_API_KEY=YOUR_FIREWORKS_API_KEY
source scripts/fireworks-env.sh
```

Do not store the secret as `OPENAI_API_KEY` directly unless a specific tool gives you no other choice. Keep `FIREWORKS_API_KEY` as the source of truth.

## Important

- Do not commit API keys.
- Fire Pass pricing/eligibility can change. The Kimi Turbo router only stays zero-cost while your Fire Pass is active.
- If your harness needs a model field, use `accounts/fireworks/routers/kimi-k2p5-turbo` exactly.
