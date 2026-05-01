# Using AgentNexus with Claude Code

AgentNexus was built for [Windsurf](https://windsurf.com), but most of it is portable to [Claude Code](https://claude.com/claude-code) with a small frontmatter conversion. The agents, the artifacts they produce, and the operational shape are identical — only the **plugin format** differs.

## What works as-is, no changes

- `code-graph/` Node CLI — plain Node, agent-agnostic. Same `npm install && npm link`, same `code-graph init / index / impact`.
- The 23 Project CodeGuard rule files — pure reference markdown, cited by both.
- All artifact outputs (`docs/design-reviews/...`, `docs/security/threat-models/...`, `docs/privacy/pia/...`, `KNOWLEDGE-GRAPH.md`, `CONTEXT.md`, ADRs) — repo-level files.
- Git hooks under `code-graph/hooks/` — git-level, agent-agnostic.
- MCP servers (JIRA, GitLab/GitHub, SonarQube). Claude Code has first-class MCP support; same configs work. See [mcp-integration.md](./mcp-integration.md).

## What needs adapting

- **Workflow files** — Windsurf reads `.windsurf/workflows/<name>.md`. Claude Code reads either `.claude/skills/<name>/SKILL.md` (skill) or `.claude/commands/<name>.md` (slash command). Different paths, slightly different frontmatter.
- **Frontmatter** — Windsurf workflows use `description:` only. Claude Code skills require both `name:` and `description:`. Slash commands use `description:` and optionally `argument-hint:`, `allowed-tools:`, `model:`.

The included installer handles the conversion automatically.

## Quick start

### Recommended: install as a plugin

```
/plugin install scalefirstai/AgentNexus
```

Claude Code reads the repo's `.claude-plugin/plugin.json` manifest and installs all eight skills. No clone, no script. Restart Claude Code and the skills are live — describe a task and the matching skill auto-invokes.

To pin to a release:

```
/plugin install scalefirstai/AgentNexus@v0.2.0
```

### Alternative: install via script (clone-and-copy)

If you want the workflows in `.claude/skills/` without going through the plugin manager (e.g., to fork them per project, or to mix with a Windsurf install on the same repo):

```bash
git clone https://github.com/scalefirstai/AgentNexus.git
cd AgentNexus
./scripts/install-claude-code.sh /path/to/your/project

# Slash commands instead of skills:
./scripts/install-claude-code.sh --commands /path/to/your/project

# User-global (available in every project):
./scripts/install-claude-code.sh ~
```

## Skills vs slash commands — which to pick

Claude Code supports two extension primitives that both work for AgentNexus workflows:

| | Skills | Slash commands |
|---|---|---|
| Path | `.claude/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` |
| Invocation | Model auto-invokes when `description` matches the user's intent | User types `/<name>` explicitly |
| Bundled resources | Yes — companion files in same dir, model can read them | No (single file) |
| Best for | Behavior-style: "interview me", "review this codebase" | Dispatch-style: `/code-graph impact src/foo.ts` |

**Recommendation by workflow:**

| Workflow | Skill or command | Why |
|---|---|---|
| `grill-me` / `grill-design` / `grill-security` / `grill-privacy` | **Skill** | Description-driven invocation works well; the model recognises "stress-test this design" or "threat-model this change" |
| `software-security` | **Skill** | Always-on guidance during code generation; needs the `rules/` companion dir which only skills support |
| `security-review` | **Skill** | Needs the companion `Security_Code_Reviewer_Guidelines.md` |
| `code-knowledge-graph` | **Skill** | Needs the companion `GRAPH-FORMAT.md` |
| `code-graph` | **Slash command** | Takes structured args; user drives explicitly |

The default `install-claude-code.sh` mode (skills) installs all eight as skills. If you prefer slash commands for discoverability, run with `--commands` — but workflows with companion directories (`software-security`, `security-review`, `code-knowledge-graph`) won't have access to their bundled resources, so the installer will warn and skip them. Mix and match by running both modes and selectively keeping each.

## Frontmatter mapping

### Windsurf workflow

```yaml
---
description: Comprehensive security code review workflow ...
---
```

### Claude Code skill (after conversion)

```yaml
---
name: security-review
description: Comprehensive security code review workflow ...
---
```

The installer adds the `name:` line above `description:`, derived from the filename (no extension). Body content is copied verbatim.

### Claude Code slash command (after conversion)

```yaml
---
description: Comprehensive security code review workflow ...
---
```

Identical to Windsurf; the file just lives at a different path.

## Hooks

Claude Code's hooks live in `.claude/settings.json`, not git. You can either:

**Option A — keep the git hooks.** They're agent-agnostic; the `post-commit` and `pre-push` hooks under `code-graph/hooks/` work the same regardless of which agent made the commit. Run `code-graph install-hooks` once and you're done.

**Option B — Claude Code hooks.** Run a command after Claude Code makes an edit, in addition to the git hooks. Example: re-index after Claude Code writes a file.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "code-graph update >/dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

Use both if you want belt-and-braces. Option A alone is fine — git is the source of truth for "what changed".

## MCP servers

Claude Code reads MCP config from `.mcp.json` at the project root, or `~/.claude/.mcp.json` for user-global. Format is the same as Windsurf's:

```json
{
  "mcpServers": {
    "jira": { "command": "...", "args": [...] },
    "gitlab": { "command": "...", "args": [...] },
    "sonarqube": { "command": "...", "args": [...] }
  }
}
```

The recipes in [mcp-integration.md](./mcp-integration.md) work for both. After editing, restart Claude Code.

## Install paths reference

| Where | Scope | Used by |
|---|---|---|
| `.claude/skills/<name>/SKILL.md` | Project | Skills |
| `~/.claude/skills/<name>/SKILL.md` | User-global | Skills |
| `.claude/commands/<name>.md` | Project | Slash commands |
| `~/.claude/commands/<name>.md` | User-global | Slash commands |
| `.claude/agents/<name>.md` | Project | Subagents |
| `.claude/settings.json` | Project | Hooks, permissions, MCP |
| `~/.claude/settings.json` | User | Hooks, permissions, MCP |
| `.mcp.json` | Project | MCP servers |
| `~/.claude/.mcp.json` | User | MCP servers |
| `.codegraph/` | Project | code-graph CLI's Kuzu DB |

## Mixed teams: Windsurf + Claude Code on the same project

If different team members use different IDEs, install both — the layouts coexist:

```bash
./scripts/install.sh .                      # Windsurf workflows
./scripts/install-claude-code.sh .          # Claude Code skills
```

Result: `.windsurf/workflows/` and `.claude/skills/` live side by side. Each agent reads its own.

## Limitations and things to watch

- **Cross-references in workflow bodies.** AgentNexus workflows sometimes link to each other with paths like `[./grill-design.md](./grill-design.md)`. After conversion to skills, those paths don't exist (each skill lives in its own directory). The links don't break the prose — readers and models still understand "see grill-design" — but they don't resolve. The installer leaves them as-is; rewrite by hand if your team is link-strict.
- **The `software-security` skill is large.** It bundles 23 CodeGuard rule files. That's intentional (the model needs to read whichever rules the language demands). If your context budget is tight, consider splitting into per-language skills. PRs welcome.
- **Slash command mode skips companion dirs.** Workflows with bundled resources (`software-security/rules/`, `security-review/Security_Code_Reviewer_Guidelines.md`, `code-knowledge-graph/GRAPH-FORMAT.md`) only fully work as skills. The installer warns when `--commands` mode is used on these.

## Roadmap for Claude Code support

- **Native subagent for `grill-me`** (`.claude/agents/grill-me.md`) — instead of the orchestrator running design/security/privacy serially in one context, spawn three sub-agents in parallel and reconcile. Faster, more focused contexts.
- **Settings.json bundle** — ship a recommended `.claude/settings.json` snippet for hooks + permissions that the plugin installs alongside the skills.
- **Per-language `software-security` split** — currently all 23 CodeGuard rules live in one skill; splitting into per-language skills would tighten the context budget when the model only needs Python rules.

Open an issue if you'd like any of these prioritised.

## What this means in practice

A developer using Claude Code and AgentNexus does the same thing as a Windsurf developer:

```
> /grill-me — here's docs/requirements/feedback-service.md
```

(or just `Stress-test the design for the feedback service please` and let the model pick the matching skill).

Then `/code-graph impact src/foo.ts`. Then TDD. Then open the MR with the artifact links in the description. The [walkthrough](./walkthrough.md) and [new-project](./new-project.md) guides apply unchanged — only the plugin install path differs.
