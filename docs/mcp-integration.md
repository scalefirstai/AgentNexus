# MCP integration

How AgentNexus workflows interact with [Model Context Protocol](https://modelcontextprotocol.io) servers — JIRA, GitLab/GitHub, SonarQube — and how to wire them up.

## What MCP buys you

Without MCP, AgentNexus workflows are still useful: they grill, produce artifacts, and query the local code graph. But the artifacts are dead text in your repo.

With MCP, the same workflows can:

- Pull a JIRA ticket's description, acceptance criteria, and approver fields, then post artifact links back as comments
- Open a GitLab/GitHub branch and MR, post the security-review report as a comment, and check pipeline status
- Pull SonarQube hotspots and existing issues to seed the threat model, then check the quality gate before merge

The grills don't have to know about your toolchain — the agent uses MCP tools as additional capabilities.

## Configuration

Windsurf reads MCP server config from `~/.codeium/windsurf/mcp_config.json` (or `~/.windsurf/mcp_servers.json`, depending on version). Format:

```json
{
  "mcpServers": {
    "jira": { "command": "...", "args": [...], "env": {...} },
    "gitlab": { "command": "...", "args": [...], "env": {...} },
    "sonarqube": { "command": "...", "args": [...], "env": {...} }
  }
}
```

Restart Windsurf after editing.

> **Note**: MCP server names and tool schemas vary by implementation. The configs below use community-published servers as examples. Substitute your team's choice.

### JIRA

Atlassian publishes an official MCP server. Community alternatives exist (e.g. [mcp-atlassian](https://github.com/sooperset/mcp-atlassian)).

```json
{
  "jira": {
    "command": "npx",
    "args": ["-y", "@atlassian/mcp-server-jira"],
    "env": {
      "JIRA_HOST": "your-org.atlassian.net",
      "JIRA_EMAIL": "you@example.com",
      "JIRA_API_TOKEN": "atlassian_pat_xxx"
    }
  }
}
```

Common tools the workflows use (names depend on the server — check `/mcp` in Windsurf for the canonical list):

- `get_issue(key)` — pull ticket details
- `add_comment(key, body)` — post artifact links
- `transition_issue(key, transition)` — Done / In Review
- `create_issue(...)` — open follow-up tickets

**Where AgentNexus uses it**:
- `/grill-me` post-grill: link the design-review, threat-model, and PIA back to the ticket.
- Phase-1 ticket pickup: pull description, acceptance criteria, approver fields.
- Follow-ups: when a residual risk is logged with a future review date, optionally create a JIRA ticket with that date.

### GitLab

GitLab maintains a [first-party MCP server](https://gitlab.com/gitlab-org/...). Community alternatives like [mcp-server-gitlab](https://github.com/modelcontextprotocol/servers) exist.

```json
{
  "gitlab": {
    "command": "npx",
    "args": ["-y", "@gitlab/mcp-server"],
    "env": {
      "GITLAB_URL": "https://gitlab.example.com",
      "GITLAB_TOKEN": "glpat-xxx"
    }
  }
}
```

Common tools:

- `create_branch(project, branch, ref)`
- `create_merge_request(project, source, target, title, description)`
- `create_note(project, mr_iid, body)` — post a comment
- `get_pipeline_status(project, ref)`
- `get_diff(project, mr_iid)`

**Where AgentNexus uses it**:
- Branch creation when starting implementation.
- MR creation with auto-populated description (artifact links + `code-graph impact` output).
- Posting `/security-review` reports as MR comments.
- Pipeline gate checks before declaring the MR mergeable.

### GitHub (alternative to GitLab)

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
    }
  }
}
```

Tools roughly mirror GitLab's. The walkthrough in [walkthrough.md](./walkthrough.md) reads naturally with `pr_*` substituted for `merge_request_*`.

### SonarQube / SonarCloud

[SonarSource publishes an MCP server](https://github.com/SonarSource/sonarqube-mcp-server) as of 2025.

```json
{
  "sonarqube": {
    "command": "npx",
    "args": ["-y", "@sonarsource/mcp-server-sonarqube"],
    "env": {
      "SONAR_URL": "https://sonar.example.com",
      "SONAR_TOKEN": "sqp_xxx"
    }
  }
}
```

Common tools:

- `get_issues(project, branch?, types?)` — code quality + security findings
- `get_hotspots(project, status?)` — security hotspots awaiting review
- `get_quality_gate_status(project, branch?)` — pass/fail
- `get_metrics(project)` — coverage, debt, duplications

**Where AgentNexus uses it**:
- Pre-grill seeding: `/grill-security` pulls existing hotspots on touched modules to inform the threat model. Existing issues become "we're adding code adjacent to this known finding" inputs.
- Pre-push: local Sonar scan results feed `code-graph impact` output.
- MR gate: quality gate status checked before declaring approver-ready.

## Recommended minimum

For the [walkthrough](./walkthrough.md) experience:

- ✅ JIRA (or Linear) — ticket lifecycle, approver tracking
- ✅ GitLab or GitHub — branch + MR + pipeline visibility
- ✅ SonarQube or SonarCloud — quality gate + security hotspots

That's the trio that earns its keep on a regulated-data feature ticket. Add more as your team's flow demands (Slack for notifications, PagerDuty for incident links, Confluence for ARB packets).

## Workflows that don't need MCP

These work fully offline — handy when you're prototyping or working on a personal project:

- `/grill-design`, `/grill-security`, `/grill-privacy`, `/grill-me` — produce artifacts to local paths
- `/code-knowledge-graph` — pure markdown
- `/code-graph` — talks to the local Kuzu DB, no network
- `/security-review` — writes a markdown report locally
- `/software-security` — inline guidance only

So you can adopt AgentNexus before negotiating MCP server access with your platform team.

## When MCP servers misbehave

- **Tool not found**: confirm the server is running (`/mcp` in Windsurf lists active servers and tools). Some servers register tools lazily — try a simple call first.
- **Auth failures**: tokens expire. Most servers don't refresh automatically. If a workflow stalls at "calling JIRA…", check the token.
- **Rate limits**: SonarQube + GitLab APIs throttle. The workflows don't retry blindly — if a call fails, the agent surfaces the error and asks the user how to proceed.
- **Hallucinated tool names**: agents sometimes invent tool names that look like MCP tools but aren't registered. The fix is `/mcp` to see the real list and a short prompt clarifying which to use.

## Privacy & token hygiene

- **Don't paste tokens into prompts.** Put them in env vars referenced by `mcp_config.json`.
- **Scope tokens narrowly.** Read-only where possible, time-bounded, single-purpose.
- **Audit MCP servers like any other dependency.** A malicious or compromised server has full access to whatever tools it registers. Prefer first-party / well-maintained servers over random GitHub forks.
- **Rotate after offboarding.** Treat MCP tokens like any service account.

The `/grill-security` workflow itself contains an "Existing security controls" question — this is where MCP token hygiene shows up. If you can't answer it, that's a finding.
