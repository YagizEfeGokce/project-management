#!/bin/bash
set -euo pipefail

# Configure git to use project-local hooks directory
# Run once after clone: ./scripts/setup-hooks.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
git config core.hooksPath "$REPO_ROOT/.githooks"

echo "Git hooks configured: $REPO_ROOT/.githooks"
echo "Active hooks:"
ls -1 "$REPO_ROOT/.githooks/"
