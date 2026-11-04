#!/usr/bin/env bash
# Installs or updates slip on this machine:
#   curl -fsSL https://raw.githubusercontent.com/gstark/slip/main/install.sh | bash
#
# Environment:
#   SLIP_DIR   Checkout directory. Default: ~/.local/share/slip
#   SLIP_REPO  Repository to clone. Default: https://github.com/gstark/slip.git
#
# The function wrapper makes bash read the full script before it runs a command.
set -euo pipefail

main() {
  local dir="${SLIP_DIR:-$HOME/.local/share/slip}"
  local repo="${SLIP_REPO:-https://github.com/gstark/slip.git}"
  local bin="$HOME/.local/bin"

  need git
  need bun
  # Bun 1.4 writes bun.lock version 2. Older Bun cannot read it.
  if ! bun -e 'const [major, minor] = Bun.version.split(".").map(Number); process.exit(major > 1 || minor >= 4 ? 0 : 1)'; then
    fail "slip needs Bun 1.4 or later. This machine has Bun $(bun --version). Run bun upgrade, then run this script again."
  fi

  if [ -d "$dir/.git" ]; then
    echo "Updating $dir"
    # The installer owns this checkout, so it matches the remote default branch even after a force push.
    git -C "$dir" fetch --quiet origin HEAD
    git -C "$dir" reset --hard --quiet FETCH_HEAD
  else
    echo "Cloning $repo into $dir"
    mkdir -p "$(dirname "$dir")"
    git clone --quiet "$repo" "$dir"
  fi

  (cd "$dir" && bun install --frozen-lockfile --production)
  mkdir -p "$bin"
  ln -sfn "$dir/src/index.ts" "$bin/slip"
  echo "Installed $bin/slip"

  if command -v claude >/dev/null; then
    install_plugin "$dir"
  else
    echo "Claude Code is not installed. Skipped the slip plugin."
  fi

  case ":$PATH:" in
    *":$bin:"*) ;;
    *) echo "Add $bin to your PATH." ;;
  esac
  if [ ! -f "${SLIP_CONFIG:-$HOME/.config/slip/config.toml}" ]; then
    echo "Next: slip login --url <production URL> --token <token>"
  fi
}

install_plugin() {
  local marketplaces plugins
  marketplaces=$(claude plugin marketplace list --json)
  plugins=$(claude plugin list --json)
  # The plugin was called tix before 2026-11. Remove it, so Claude Code does not start two MCP servers.
  if grep -q '"tix@tix"' <<<"$plugins"; then
    claude plugin uninstall tix@tix --scope user
  fi
  if grep -q '"name": "tix"' <<<"$marketplaces"; then
    claude plugin marketplace remove tix
  fi
  if ! grep -q '"name": "slip"' <<<"$marketplaces"; then
    claude plugin marketplace add "$1"
  fi
  plugins=$(claude plugin list --json)
  if ! grep -q '"slip@slip"' <<<"$plugins"; then
    claude plugin install slip@slip --scope user
  fi
  echo "Installed the slip plugin in Claude Code"
}

need() {
  command -v "$1" >/dev/null || fail "slip needs $1. Install it, then run this script again."
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

main "$@"
