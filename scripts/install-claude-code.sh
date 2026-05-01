#!/usr/bin/env bash
# Install AgentNexus workflows into a target project (or user home) as
# Claude Code skills (default) or slash commands.
#
# Skills:
#   <target>/.claude/skills/<name>/SKILL.md
#   plus any companion files copied alongside
#
# Slash commands:
#   <target>/.claude/commands/<name>.md
#   (companion-bearing workflows are skipped with a warning — use skills mode
#   for full functionality)

set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 [--commands] [--copy] <target-dir>

Convert AgentNexus workflows into Claude Code skills or slash commands.

  --commands   Install as slash commands instead of skills. Workflows that
               carry companion directories (software-security, security-review,
               code-knowledge-graph) will be skipped with a warning since the
               commands format does not support bundled resources.

  --copy       Copy files instead of using inline frontmatter rewriting in
               place. (Default behaviour already produces independent files.)
               Reserved for future use; currently a no-op.

Targets:
  <project>           Project-scoped install: <project>/.claude/skills/...
  ~                   User-global install:    ~/.claude/skills/...

Examples:
  $0 ~/code/my-app
  $0 --commands ~/code/my-app
  $0 ~
EOF
  exit 1
}

MODE="skills"
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --commands) MODE="commands"; shift ;;
    --copy) shift ;;  # reserved
    -h|--help) usage ;;
    -*) echo "unknown flag: $1" >&2; usage ;;
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_WORKFLOWS="$REPO_ROOT/workflows"
TARGET_ABS="$(cd "$TARGET" && pwd)"

if [ ! -d "$SRC_WORKFLOWS" ]; then
  echo "error: $SRC_WORKFLOWS not found — run from inside AgentNexus" >&2
  exit 1
fi

case "$MODE" in
  skills)   DST="$TARGET_ABS/.claude/skills" ;;
  commands) DST="$TARGET_ABS/.claude/commands" ;;
esac

mkdir -p "$DST"

echo "Installing AgentNexus into $DST (mode: $MODE)"
echo

installed=0
skipped=0

for src in "$SRC_WORKFLOWS"/*.md; do
  name="$(basename "$src" .md)"
  if [ "$name" = "README" ]; then
    continue
  fi

  companion_dir="$SRC_WORKFLOWS/$name"
  has_companion=0
  companion_note=""
  if [ -d "$companion_dir" ]; then
    has_companion=1
    companion_note=" (+ companion)"
  fi

  case "$MODE" in
    skills)
      skill_dir="$DST/$name"
      mkdir -p "$skill_dir"

      # Insert `name: <name>` into frontmatter (immediately after the opening
      # `---` line), unless the file already has a name field.
      if grep -m1 -q '^name:' "$src"; then
        cp "$src" "$skill_dir/SKILL.md"
      else
        awk -v name="$name" '
          NR==1 && /^---$/ {
            print
            print "name: " name
            inserted=1
            next
          }
          { print }
        ' "$src" > "$skill_dir/SKILL.md"
      fi

      if [ "$has_companion" -eq 1 ]; then
        # Copy companion contents into the skill directory (recursive).
        cp -R "$companion_dir/." "$skill_dir/"
      fi

      echo "  skill   $name${companion_note}"
      installed=$((installed + 1))
      ;;

    commands)
      if [ "$has_companion" -eq 1 ]; then
        echo "  skip    $name (has companion dir; use skills mode)"
        skipped=$((skipped + 1))
        continue
      fi
      cp "$src" "$DST/$name.md"
      echo "  command $name"
      installed=$((installed + 1))
      ;;
  esac
done

echo
echo "Done. $installed installed, $skipped skipped."
echo
echo "Next steps:"
case "$MODE" in
  skills)
    echo "  - Restart Claude Code"
    echo "  - In chat, describe a task ('grill the design for X', 'review this for security')"
    echo "    and the model will auto-invoke the matching skill."
    ;;
  commands)
    echo "  - Restart Claude Code"
    echo "  - Type / in chat to see the slash commands"
    echo "  - Note: software-security, security-review, code-knowledge-graph were"
    echo "    skipped (need companion files). Re-run without --commands for those."
    ;;
esac
echo "  - For the code-graph CLI: cd $REPO_ROOT/code-graph && npm install && npm link"
echo "    Then in your project: code-graph init && code-graph index"
