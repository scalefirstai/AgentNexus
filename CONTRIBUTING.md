# Contributing to AgentNexus

Thanks for considering a contribution. This project is opinionated by design — but the opinions are negotiable. The bar for changes is *does this make AgentNexus more useful for shipping enterprise-grade work in Windsurf?*

## Before opening a PR

1. **Open an issue first** if the change is more than a typo or a small clarification. The maintainers will tell you whether the direction fits before you sink time into it.
2. **Don't add a workflow without a clear axis it covers.** If your idea overlaps an existing workflow, propose an extension rather than a new file.
3. **Don't bloat the grills.** Each axis grill is already long. Adding a new question requires removing or merging another, or showing why this one's load-bearing.

## Local setup

```bash
git clone https://github.com/scalefirstai/AgentNexus.git
cd AgentNexus
./scripts/install.sh ./test-target  # if testing the install path
cd code-graph && npm install         # if touching the CLI
```

To test workflows in Windsurf, copy them to a project's `.windsurf/workflows/` (or symlink — `scripts/install.sh` does this).

## Style guidelines

### Workflows

- Keep frontmatter to `description:` only. Windsurf reads it for slash-command triage.
- Use `## H2` for top-level sections, `### H3` for subsections, no deeper.
- Tables for reference content. Bullets for procedure. Code fences for examples.
- Reference other workflows with relative links: `[/grill-design](./grill-design.md)`.
- **No emojis** unless the workflow explicitly themes around them.
- Be opinionated. "It depends" is allowed once per workflow at most.

### Code (`code-graph/`)

- Plain JS, CommonJS, no build step.
- One dependency rule: only add a dep if the alternative is >100 lines of plumbing.
- Prepared statements only when querying the DB. No string concatenation into Cypher.
- Errors propagate. The CLI dispatcher prints them.

### Docs

- Each guide answers one question. If you're tempted to subsection a guide into multiple unrelated topics, split it.
- Show concrete commands, not just descriptions.
- Reference real file paths and slash commands. Avoid placeholders like `<your-thing>` when an example would do.

## What we'll merge

- Bug fixes in `code-graph/` with a regression test or a clear repro.
- Additional CodeGuard rule integrations (with attribution preserved).
- New axis grills that fill a documented gap (compliance, FinOps, accessibility, etc.).
- MCP integration recipes (working configs for JIRA / GitLab / Sonar / Linear / GitHub) under `docs/mcp-integration.md`.
- Workflow improvements that demonstrably tighten a category without losing coverage.

## What we'll push back on

- Adding emoji-themed badges or chunky decorations to workflows.
- Adding a workflow that duplicates an existing axis with a different name.
- Vendor-specific lock-in inside core workflows (vendor recipes belong in `docs/`).
- "Make the grill cover X" without a concrete artifact-output story.
- Anything that turns the CLI into a service with a daemon. The scaffold is workflow-driven on purpose.

## License

By contributing, you agree your contribution is licensed under the MIT License (or CC BY 4.0 if it's an extension to the CodeGuard-derived rule files). See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
