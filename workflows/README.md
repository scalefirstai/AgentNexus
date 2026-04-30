# Workflows

Drop-in [Windsurf](https://windsurf.com) workflows. Each `.md` is a slash command; companion subdirectories hold reference material the workflow cites at runtime.

| File | Slash command | One-liner |
|---|---|---|
| `grill-me.md` | `/grill-me` | Orchestrator — picks the right axis grills and reconciles findings |
| `grill-design.md` | `/grill-design` | Design / architecture / ops / cost / rollout grill → RFC artifact |
| `grill-security.md` | `/grill-security` | STRIDE threat model + AppSec walk → threat model artifact |
| `grill-privacy.md` | `/grill-privacy` | GDPR/CCPA-grade privacy walk → PIA / DPIA artifact |
| `code-graph.md` | `/code-graph` | Drives the local Kuzu-backed code knowledge graph CLI |
| `code-knowledge-graph.md` | `/code-knowledge-graph` | Markdown-only narrative code graph (`KNOWLEDGE-GRAPH.md`) |
| `security-review.md` | `/security-review` | Full security review of a target repo using Project CodeGuard rules |
| `software-security.md` | `/software-security` | Apply 23 Project CodeGuard rules during code generation |

Companion directories:

- `code-knowledge-graph/GRAPH-FORMAT.md` — node/edge table format spec
- `security-review/Security_Code_Reviewer_Guidelines.md` — review methodology (CodeGuard)
- `software-security/rules/codeguard-*.md` — 23 Project CodeGuard rule files (CC BY 4.0)

## Installing

The repo's `scripts/install.sh` symlinks (or copies) every workflow into a target project's `.windsurf/workflows/`. See [getting-started.md](../docs/getting-started.md).

## Conventions

- Frontmatter: `description:` only, used by Windsurf for slash-command triage.
- Cross-references are relative links inside this directory (`./grill-design.md` from `grill-me.md`).
- Companion subdirectories share the slash-command name (`grill-design.md` ↔ `grill-design/` if it had one).

See [docs/workflow-reference.md](../docs/workflow-reference.md) for full details on each workflow.
