# Getting started

Five minutes to your first grill, fifteen to a fully-wired project.

## Prerequisites

- [Windsurf](https://windsurf.com) installed and signed in
- A git repository to drop the workflows into (existing project or fresh clone)
- Node 18+ if you want the `code-graph` CLI (optional but recommended)
- An MCP server or two (JIRA, GitLab/GitHub, SonarQube) — optional, makes the workflows much more useful

## 1. Get AgentNexus

```bash
git clone https://github.com/scalefirstai/AgentNexus.git
cd AgentNexus
```

## 2. Install the workflows into your project

```bash
./scripts/install.sh /path/to/your/project
```

The installer creates `/path/to/your/project/.windsurf/workflows/` if missing and **symlinks** each `.md` (and its companion directory, where applicable) into place. Symlinks mean updates to AgentNexus flow through to the project on `git pull` — no manual sync.

If you'd rather copy than symlink (e.g. you want to fork the workflows per-project), pass `--copy`:

```bash
./scripts/install.sh --copy /path/to/your/project
```

Verify in Windsurf: open the project, type `/` in chat, and you should see the workflows listed:

```
/grill-me        /grill-design        /grill-security
/grill-privacy   /code-graph          /code-knowledge-graph
/security-review /software-security
```

## 3. (Optional) Set up the code-graph CLI

The `/code-graph` workflow shells out to a CLI. To use it:

```bash
cd AgentNexus/code-graph
npm install
npm link
```

Then in your project:

```bash
cd /path/to/your/project
code-graph init             # creates .codegraph/ + Kuzu schema
code-graph index            # full index of tracked JS/TS files
code-graph install-hooks    # symlinks post-commit + pre-push
```

Verify:

```bash
code-graph query "MATCH (m:Module) RETURN count(m) AS modules"
```

If you see a count, you're indexed. If `kuzu` fails to install, see the [troubleshooting section](#troubleshooting) below.

## 4. (Optional) Connect MCP servers

Windsurf's MCP support means your workflows can read and write to JIRA, GitLab/GitHub, SonarQube, etc. AgentNexus assumes you've configured these separately — see [docs/mcp-integration.md](./mcp-integration.md) for example configs.

Minimum useful set for the walkthrough in [docs/walkthrough.md](./walkthrough.md):

- A JIRA MCP server
- A GitLab (or GitHub) MCP server
- A SonarQube MCP server

You can run AgentNexus without any MCPs — you'll lose the ticket / MR / quality-gate orchestration but the grills and code-graph still work.

## 5. Run your first grill

In Windsurf, on a real ticket or design:

```
/grill-me
```

The orchestrator will ask a four-question triage round to decide which axis grills apply, then run them in order. Expect 30–45 minutes per axis for a non-trivial change.

If you know the axis already, skip the orchestrator:

```
/grill-design        # if it's mostly an architecture / ops question
/grill-security      # if it's a security review
/grill-privacy       # if data / GDPR / DPIA is in scope
```

Each axis writes its artifact to `docs/design-reviews/`, `docs/security/threat-models/`, or `docs/privacy/pia/` respectively (or matches your repo convention if you've configured one).

## 6. Use the code graph during planning

Before a non-trivial change:

```
/code-graph
```

The workflow will prompt the agent to run `code-graph update`, then offer impact / neighbours / map queries based on what you're touching. Or call the CLI directly:

```bash
code-graph impact src/auth/middleware.ts
code-graph map src/billing 40
code-graph neighbors src/api/users.ts
```

Wire the pre-push hook (`code-graph install-hooks` already did this if you ran it) so MR descriptions auto-include impact.

## Troubleshooting

### Workflows aren't appearing in Windsurf
- Confirm the install path is `<project>/.windsurf/workflows/` (project-scoped). Windsurf doesn't pick up workflows from your home directory.
- Restart Windsurf after first install.
- If you symlinked, confirm the symlinks point at real files: `ls -la <project>/.windsurf/workflows/`.

### `kuzu` install fails
- Kuzu has native bindings; needs a working C++ toolchain on first install.
- macOS: `xcode-select --install`
- Linux: `apt install build-essential` (or distro equivalent)
- Windows: install [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/)
- Pinned version in `code-graph/package.json` is `^0.6.0`. If the API has shifted, see the note in `code-graph/README.md`.

### `code-graph` runs but `index` finds zero files
- The CLI uses `git ls-files` and filters to `.ts/.tsx/.js/.jsx/.mjs/.cjs`. Other languages are not yet indexed.
- Confirm files are tracked: `git ls-files | grep -E '\.(ts|js)x?$' | head`.

### Grills feel too long for small changes
- Use individual axis workflows instead of `/grill-me`. Most small changes only need `/grill-design`.
- The triage step in `/grill-me` is meant to skip irrelevant categories; if the agent is grinding through them anyway, file an issue with the transcript.

## Next steps

- [docs/workflow-reference.md](./workflow-reference.md) — every workflow, in detail
- [docs/walkthrough.md](./walkthrough.md) — end-to-end developer story with JIRA + GitLab + Sonar
- [docs/mcp-integration.md](./mcp-integration.md) — MCP server setup recipes
