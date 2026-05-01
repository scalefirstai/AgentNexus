# AgentNexus

**Enterprise-ready agentic workflows for AI-assisted coding** — opinionated grilling, structural code intelligence, and built-in security reviews. Works with [Windsurf](https://windsurf.com) and [Claude Code](https://claude.com/claude-code). Drop into any repo, ship through ARB / AppSec / DPO sign-off without inventing the artifacts yourself.

[![CI](https://github.com/scalefirstai/AgentNexus/actions/workflows/ci.yml/badge.svg)](https://github.com/scalefirstai/AgentNexus/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/scalefirstai/AgentNexus?include_prereleases&sort=semver)](https://github.com/scalefirstai/AgentNexus/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Windsurf](https://img.shields.io/badge/Windsurf-supported-2563eb)](https://windsurf.com)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-supported-d97706)](https://claude.com/claude-code)
[![Workflows](https://img.shields.io/badge/workflows-8-7c3aed)](./workflows)
[![CodeGuard rules](https://img.shields.io/badge/CodeGuard%20rules-23-ea580c)](./workflows/software-security/rules)
[![Status](https://img.shields.io/badge/status-early%20access-orange)](#roadmap)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-22c55e)](./CONTRIBUTING.md)

---

## What it is

A curated set of [Windsurf](https://windsurf.com) workflows plus a small Node CLI that gives an AI coding agent three things most enterprises end up rebuilding from scratch:

1. **Disciplined design grilling** — three single-axis interviews (`/grill-design`, `/grill-security`, `/grill-privacy`) plus an orchestrator (`/grill-me`) that produces RFC, threat-model, and PIA artifacts ready for ARB / AppSec / DPO sign-off.
2. **A live code knowledge graph** — `code-graph`, a Kuzu-backed embedded graph DB indexed from your repo, with git hooks and a CLI for impact analysis, neighborhood queries, and Mermaid maps. Inspired by [GitNexus](https://github.com/abhigyanpatwari/GitNexus); workflow-driven, no MCP server required.
3. **Built-in security review rules** — Project CodeGuard's 23 rule files, wired in as a `software-security` workflow that the agent applies during code generation, plus a `security-review` workflow that produces a full report against a target repo.

It's designed to plug into a normal enterprise toolchain — JIRA, GitLab/GitHub, SonarQube — through whichever MCP servers your team uses.

## Why it exists

Most AI coding output skips the unglamorous parts of shipping in a regulated org: threat modelling, lawful basis, retention, residual-risk registers, audit logs, named approvers. AgentNexus treats those as first-class and asks for them *before* the code is written, not after.

This is opinionated. The grills are structured around STRIDE, GDPR Art 6/9/22/35, SOC 2 / PCI / HIPAA controls, and the kind of operational checklist an SRE expects to see. If your shop runs differently, fork and rewire.

## Quick start

```bash
# 1. Clone the repo
git clone https://github.com/scalefirstai/AgentNexus.git
cd AgentNexus

# 2. Install into your project
./scripts/install.sh /path/to/your/project              # Windsurf
./scripts/install-claude-code.sh /path/to/your/project  # Claude Code (skills)

# 3. (Optional) Build the code-graph CLI — agent-agnostic
cd code-graph && npm install && npm link
cd /path/to/your/project
code-graph init && code-graph index && code-graph install-hooks
```

Type `/grill-me` in Windsurf, or describe a task ("grill the design for X") in Claude Code and the matching skill auto-invokes. See [docs/getting-started.md](./docs/getting-started.md) for full setup, or [docs/claude-code.md](./docs/claude-code.md) for the Windsurf↔Claude Code mapping.

## What's in the box

### Workflows (`workflows/`)

| Slash command | What it does | Output artifact |
|---|---|---|
| `/grill-me` | Orchestrator — picks the right axis grills, runs them in order, reconciles findings | Combined ARB/CAB brief |
| `/grill-design` | Scope, architecture fit, reliability, change management, cost, dependencies | `docs/design-reviews/<date>-<slug>.md` |
| `/grill-security` | STRIDE threat model, authn/authz, secrets, attack surface, crypto, supply chain, IR | `docs/security/threat-models/<date>-<slug>.md` |
| `/grill-privacy` | Data inventory, lawful basis, residency, retention, DSAR, sub-processors, DPIA | `docs/privacy/pia/<date>-<slug>.md` |
| `/code-graph` | Drives the local Kuzu-backed graph CLI for impact analysis and neighbourhood queries | (queries the live graph) |
| `/code-knowledge-graph` | Markdown-only variant — produces a hand-curated `KNOWLEDGE-GRAPH.md` | `KNOWLEDGE-GRAPH.md` |
| `/security-review` | Full security code review of a target repo using Project CodeGuard rules | `security_report/sec_review_<repo>_<ts>.md` |
| `/software-security` | Apply Project CodeGuard rules during code generation (23 rules across cryptography, injection, authn, supply chain, …) | (inline guidance) |

Full reference: [docs/workflow-reference.md](./docs/workflow-reference.md).

### code-graph CLI (`code-graph/`)

A minimal Node project — single dependency on [Kuzu](https://kuzudb.com), regex-based JS/TS parser, git hooks for incremental updates, and seven CLI commands (`init`, `index`, `update`, `impact`, `map`, `neighbors`, `query`, `install-hooks`). Works on its own; the `/code-graph` workflow shells out to it.

See [code-graph/README.md](./code-graph/README.md).

## How a developer uses this end-to-end

Walkthrough with JIRA + GitLab + SonarQube MCP: [docs/walkthrough.md](./docs/walkthrough.md).

The short version: pick up a ticket, run `/grill-me` to triage which axes apply, run the axis grills in order, implement with TDD using the `code-graph impact` output to bound blast radius, push and let pre-push hooks publish the impact list to the MR description, and clear approvers per axis.

## Documentation

| Doc | When to read |
|---|---|
| [docs/getting-started.md](./docs/getting-started.md) | Five minutes from cloning AgentNexus to your first grill |
| [docs/new-project.md](./docs/new-project.md) | Greenfield: from a requirements spec to a scaffolded project with all three grill artifacts and a first slice shipped |
| [docs/walkthrough.md](./docs/walkthrough.md) | Steady-state: existing repo, ticket pickup, MR through approvers (with JIRA + GitLab + SonarQube MCP) |
| [docs/claude-code.md](./docs/claude-code.md) | Windsurf↔Claude Code mapping; install as skills or slash commands |
| [docs/workflow-reference.md](./docs/workflow-reference.md) | Every workflow in detail, plus composition patterns |
| [docs/mcp-integration.md](./docs/mcp-integration.md) | MCP server setup recipes (JIRA, GitLab/GitHub, SonarQube) |
| [code-graph/README.md](./code-graph/README.md) | The Kuzu-backed CLI: schema, commands, limitations |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Your project                                                    │
│  ┌─────────────────┐   ┌─────────────────┐   ┌────────────────┐ │
│  │ .windsurf/      │   │ .codegraph/     │   │ .git/          │ │
│  │   workflows/    │   │   (Kuzu DB)     │   │   hooks/       │ │
│  └────────┬────────┘   └────────┬────────┘   └───────┬────────┘ │
│           │                     │                    │          │
│  ┌────────┴─────────────────────┴────────────────────┴────────┐ │
│  │  code-graph CLI  (npm-linked)                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Windsurf ──▶ workflow ──▶ MCP (JIRA / GitLab / Sonar / …)      │
│                  │                                               │
│                  └──▶ shell out to code-graph (impact, map, …)  │
└──────────────────────────────────────────────────────────────────┘
```

## Roadmap

- **Tree-sitter parser** for `code-graph` — replace regex JS/TS extraction, add `CALLS` / `EXTENDS` edges, support more languages.
- **Compliance axis** — fourth grill (`/grill-compliance`) covering SOC 2 / ISO 27001 / SOX / PCI control mapping with audit-evidence trail.
- **JIRA / GitLab / SonarQube example MCP recipes** — concrete server configs in `docs/mcp-integration.md`.
- **Combined CI gate** — a script that fails a pipeline if a regulated-data MR lands without a linked PIA.

Open issues / PRs to vote on what ships first.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Short version: this is opinionated, but the opinions are negotiable. Open an issue with the use-case before sending a large PR.

## Acknowledgements

- **Project CodeGuard** ([cosai-oasis/project-codeguard](https://github.com/cosai-oasis/project-codeguard)) — the security rule files under `workflows/software-security/rules/` and the `security-review` skill structure are derived from CodeGuard, an OASIS Open Project under CC BY 4.0.
- **GitNexus** ([abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus)) — the architectural pattern for the code-graph CLI (Kuzu-backed, git-tied, indexed code intelligence) is inspired by GitNexus. AgentNexus's CLI is a workflow-driven minimal reimplementation, not a port.
- **Windsurf** — the platform that makes slash-command-invoked workflows a thing.

See [NOTICE](./NOTICE) for full attributions.

## License

MIT — see [LICENSE](./LICENSE). Third-party content under `workflows/software-security/rules/` and `workflows/security-review/` is CC BY 4.0 from Project CodeGuard; see [NOTICE](./NOTICE).
