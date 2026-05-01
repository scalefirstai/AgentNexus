#!/usr/bin/env bash
# Regenerate skills/ from workflows/.
#
# Source of truth: workflows/<name>.md (Windsurf workflow format)
# Generated:      skills/<name>/SKILL.md (Claude Code skill format, with
#                 `name:` inserted into frontmatter and any companion files
#                 copied alongside).
#
# Run after editing any workflow. CI verifies skills/ stays in sync — the
# build fails if running this script produces any diff.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$REPO_ROOT/workflows"
DST="$REPO_ROOT/skills"

if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found" >&2
  exit 1
fi

# Wipe and rebuild so removed workflows don't linger as stale skills.
rm -rf "$DST"
mkdir -p "$DST"

count=0

for src in "$SRC"/*.md; do
  name="$(basename "$src" .md)"
  if [ "$name" = "README" ]; then
    continue
  fi

  skill_dir="$DST/$name"
  mkdir -p "$skill_dir"

  if grep -m1 -q '^name:' "$src"; then
    cp "$src" "$skill_dir/SKILL.md"
  else
    awk -v name="$name" '
      NR==1 && /^---$/ {
        print
        print "name: " name
        next
      }
      { print }
    ' "$src" > "$skill_dir/SKILL.md"
  fi

  if [ -d "$SRC/$name" ]; then
    cp -R "$SRC/$name/." "$skill_dir/"
  fi

  count=$((count + 1))
done

echo "synced $count skills into $DST"
