#!/usr/bin/env bash
# Install AgentNexus workflows into a target project's .windsurf/workflows/.
# Default mode: symlink (updates flow through `git pull` on AgentNexus).
# Use --copy for an independent copy that won't follow upstream changes.

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [--copy] <target-project-dir>

Installs AgentNexus workflows into <target-project-dir>/.windsurf/workflows/.

  --copy     Copy files instead of symlinking. Use this when you want to
             fork the workflows per project. Default is symlink so updates
             from AgentNexus flow through on git pull.

Examples:
  $0 ~/code/my-app
  $0 --copy ~/code/my-app
EOF
  exit 1
}

MODE="symlink"
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --copy) MODE="copy"; shift ;;
    -h|--help) usage ;;
    -*) echo "unknown flag: $1"; usage ;;
    *) TARGET="$1"; shift ;;
  esac
done

if [ -z "$TARGET" ]; then
  usage
fi

if [ ! -d "$TARGET" ]; then
  echo "error: target directory does not exist: $TARGET" >&2
  exit 1
fi

# Resolve absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_WORKFLOWS="$REPO_ROOT/workflows"
TARGET_ABS="$(cd "$TARGET" && pwd)"
DST_WORKFLOWS="$TARGET_ABS/.windsurf/workflows"

if [ ! -d "$SRC_WORKFLOWS" ]; then
  echo "error: $SRC_WORKFLOWS not found — are you running this from inside AgentNexus?" >&2
  exit 1
fi

mkdir -p "$DST_WORKFLOWS"

echo "Installing AgentNexus workflows into $DST_WORKFLOWS (mode: $MODE)"
echo

installed=0
skipped=0

for entry in "$SRC_WORKFLOWS"/*; do
  name="$(basename "$entry")"
  # Skip the README; it's documentation for the source repo, not a workflow
  if [ "$name" = "README.md" ]; then
    continue
  fi

  dst="$DST_WORKFLOWS/$name"

  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "  skip   $name  (existing non-symlink in target)"
    skipped=$((skipped + 1))
    continue
  fi

  # Remove existing symlink (we re-link to ensure correctness)
  if [ -L "$dst" ]; then
    rm "$dst"
  fi

  case "$MODE" in
    symlink)
      ln -s "$entry" "$dst"
      echo "  link   $name"
      ;;
    copy)
      if [ -d "$entry" ]; then
        cp -r "$entry" "$dst"
      else
        cp "$entry" "$dst"
      fi
      echo "  copy   $name"
      ;;
  esac
  installed=$((installed + 1))
done

echo
echo "Done. $installed installed, $skipped skipped."
echo
echo "Next steps:"
echo "  - Open $TARGET_ABS in Windsurf"
echo "  - Type / in chat to see available slash commands"
echo "  - For the code-graph CLI: cd $REPO_ROOT/code-graph && npm install && npm link"
echo "    Then in your project: code-graph init && code-graph index"
