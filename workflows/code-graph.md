---
description: Drive the local code-graph CLI (Kuzu-backed knowledge graph stored under .codegraph/). Use when user wants to "build the code graph", "run impact analysis", "show downstream importers", "map this module", or before/during a refactor where blast radius matters. This workflow shells out to the CLI; it never writes Cypher itself.
---

# Code Graph (CLI-driven)

This workflow orchestrates a local Kuzu-backed code knowledge graph for the **current repo**. The graph lives in `.codegraph/` at the repo root. Indexing, queries, and updates all go through the `code-graph` CLI — never invent Cypher inline; never write to `.codegraph/` directly.

Companion artifact: a human-curated `KNOWLEDGE-GRAPH.md` (see [./code-knowledge-graph.md](./code-knowledge-graph.md)) is for narrative onboarding. **This** workflow is for machine queries against the live index.

## Preconditions

Before doing anything, verify:

1. The repo is a git repository (`git rev-parse --show-toplevel` succeeds).
2. The `code-graph` CLI is on `PATH` (`command -v code-graph`).
   - If missing: tell the user to `cd /path/to/code-graph && npm install && npm link`. Don't try to install it yourself.
3. `.codegraph/` exists. If not, run `code-graph init` (see "First-time setup" below).

If any precondition fails and you can't fix it from inside the workflow, **stop and ask the user** — don't fabricate output.

## When to invoke each subcommand

| Trigger | Run |
|---|---|
| First time in this repo, or `.codegraph/` missing | `code-graph init && code-graph index` |
| User asks "what depends on X?" / "what breaks if I change X?" / "blast radius" | `code-graph impact <files>` |
| User asks "show me what's around X" / "what does X import" | `code-graph neighbors <file>` |
| User asks "draw / diagram / mermaid / map of <area>" | `code-graph map <path-prefix>` |
| User suspects the index is stale, or just pulled new commits | `code-graph update` |
| User asks a structural question that doesn't match a built-in command | `code-graph query '<cypher>'` (see "Raw queries" below) |
| User wants the graph to follow git automatically | `code-graph install-hooks` (one-time) |

Don't run `index` on every invocation — it's expensive and wipes the graph. Use `update` for steady-state.

## First-time setup

```sh
code-graph init
code-graph index
code-graph install-hooks
```

After this, `post-commit` runs `update` automatically and `pre-push` prints downstream impact for the push range.

## Workflow phases for a typical task

### Phase 1 — Establish the graph is fresh

If you're about to query the graph and `code-graph update` hasn't run since the last commit:

```sh
code-graph update
```

This is cheap (only changed files) and prevents misleading answers from a stale index.

### Phase 2 — Run the right query

**Impact analysis** — when planning a refactor or assessing a change:

```sh
code-graph impact src/foo.ts src/bar.ts
```

Output is a sorted list of source files that transitively import any of the targets (depth ≤ 6). Read this back to the user as "N files import these transitively" with the list.

**Neighborhood** — when orienting around a single file:

```sh
code-graph neighbors src/auth/middleware.ts
```

Output sections: imports, imported-by, external deps, defined symbols.

**Module map** — when the user wants a diagram:

```sh
code-graph map src/auth 40
```

Returns a fenced ```mermaid block. Forward it as-is — windsurf will render it. The second arg caps node count; default 40. If the user asks for a larger map, raise it cautiously (>80 nodes makes mermaid unreadable).

### Phase 3 — Interpret, don't dump

The CLI output is structured but raw. **Translate it for the user**: surface the 3–5 most important findings, group by area when the list is long, and call out anything surprising (a circular import, a "leaf" file with 50 importers, an external dep imported only once).

If `impact` returns >30 files, that's a signal — flag it as "this change has wide blast radius" and recommend either tightening the public surface or splitting the change.

## Raw queries

When no built-in fits the question, drop to Cypher via `code-graph query`. Schema:

```
(:Module {path, name, ext})
(:External {name})
(:Symbol {id, name, kind, module, line, exported})
(:Meta {key, value})

(:Module)-[:IMPORTS {line}]->(:Module)
(:Module)-[:IMPORTS_EXTERNAL {line}]->(:External)
(:Module)-[:DEFINES]->(:Symbol)
```

Examples:

```sh
# "Which modules use lodash?"
code-graph query "MATCH (m:Module)-[:IMPORTS_EXTERNAL]->(e:External {name: 'lodash'}) RETURN m.path"

# "Top 10 most-imported internal modules"
code-graph query "MATCH (a:Module)-[:IMPORTS]->(b:Module) RETURN b.path AS path, count(a) AS importers ORDER BY importers DESC LIMIT 10"

# "Exported symbols in src/auth"
code-graph query "MATCH (m:Module)-[:DEFINES]->(s:Symbol) WHERE m.path STARTS WITH 'src/auth' AND s.exported = true RETURN m.path, s.kind, s.name, s.line"
```

Quote the whole Cypher as one shell argument. Don't try to escape `$` parameters — `query` runs the string as-is.

## Output to the user

- For `impact` and `neighbors`: paraphrase, then optionally include the raw list in a fenced block.
- For `map`: forward the mermaid block verbatim.
- For `query`: the CLI prints JSON. Format the relevant rows as a markdown table or list — never paste raw JSON unless the user asks.

## Anti-patterns

- **Running `index` instead of `update`.** A full reindex is slow and resets the recorded HEAD. Use `update` unless something is genuinely broken.
- **Querying without checking freshness.** `code-graph update` is cheap; run it before answering "what depends on X?" if the user has been editing.
- **Treating CLI output as ground truth without spot-checking.** The parser is regex-based and misses re-exports, dynamic imports through variables, and JSX edge cases. If a finding is high-stakes (security review, breaking-change estimate), open the file and confirm.
- **Asking the user to run the command.** If the CLI is installed and the repo is initialised, just run it. Only ask when a precondition fails.
- **Building an `update`/`impact` loop into a task.** This workflow is request-driven; don't poll.

## Limitations to mention if they bite

- JS/TS only. Python, Go, Rust, etc. won't be indexed — modules will appear empty or missing.
- Edge kinds: only `IMPORTS`, `IMPORTS_EXTERNAL`, `DEFINES`. No `CALLS`, `EXTENDS`, `IMPLEMENTS` yet (needs an AST parser).
- Re-exports (`export * from './x'`) are recorded as imports of `./x`, not as transitive symbol re-exports.
- TypeScript path aliases (`@/foo`) resolve as **external** packages, not as relative imports. Tell the user to grep instead, or fix the parser.

If a question runs into any of these, say so explicitly rather than producing a confidently-wrong answer.
