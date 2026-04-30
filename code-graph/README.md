# code-graph

A minimal local code knowledge graph for windsurf workflows. Stores a structural graph of your repo (modules, symbols, imports) in a Kuzu embedded database under `.codegraph/`, and exposes a tiny CLI that windsurf workflows orchestrate.

This is **workflow-driven**, not MCP-driven. Windsurf workflows decide when to call `code-graph index`, `code-graph impact`, etc. Git hooks keep the index roughly fresh.

## Status: scaffold

- ✅ Schema + Kuzu wiring
- ✅ JS/TS regex parser (extracts modules, imports, top-level symbols)
- ✅ CLI: `init` / `index` / `update` / `impact` / `map` / `neighbors` / `query` / `install-hooks`
- ✅ Git hooks: `post-commit` (incremental) + `pre-push` (impact warning)
- ✅ Windsurf workflow at `.windsurf/workflows/code-graph.md`
- ❌ Real AST parser (regex misses re-exports, dynamic imports, JSX edge cases) — swap in tree-sitter when ready
- ❌ Symbol-level CALLS / EXTENDS edges — needs AST
- ❌ Languages other than JS/TS

## Install

```sh
cd /path/to/code-graph
npm install
npm link            # makes `code-graph` available globally; or invoke via `node bin/code-graph.js`
```

Verify the Kuzu version pinned in `package.json` matches your platform; the JS API has shifted between minor versions, so if `init` blows up the first thing to check is `npm view kuzu version` and update accordingly.

## Use it on a repo

```sh
cd /your/project
code-graph init                      # creates .codegraph/ + schema
code-graph index                     # full index of tracked JS/TS files
code-graph install-hooks             # symlinks post-commit + pre-push
code-graph impact src/foo.ts         # files transitively importing foo.ts
code-graph map src/auth              # mermaid diagram of nodes near src/auth
code-graph neighbors src/foo.ts      # 1-hop neighborhood of foo.ts
code-graph query 'MATCH (m:Module) RETURN m.path LIMIT 10'
```

`.codegraph/` should be gitignored (the index rebuilds locally; don't commit it).

## How it ties to git

- `code-graph index` records `HEAD` SHA in a `Meta` row.
- `code-graph update` reads the recorded SHA, runs `git diff --name-only <sha>..HEAD`, and reindexes only changed files.
- `post-commit` hook calls `update` so the graph follows your commits without thinking about it.
- `pre-push` hook computes impact for the symbols in your push range and prints downstream files. It does not block — it warns.

## How it ties to windsurf

The agent never writes Cypher itself. The workflow at `.windsurf/workflows/code-graph.md` tells the agent when to shell out to `code-graph <subcommand>` and how to interpret the output. If you're not using windsurf, the CLI works fine standalone.

## Schema (current)

```
(:Module {path, name, ext})
(:External {name})
(:Symbol {id, name, kind, module, line, exported})
(:Meta {key, value})

(:Module)-[:IMPORTS {line}]->(:Module)
(:Module)-[:IMPORTS_EXTERNAL {line}]->(:External)
(:Module)-[:DEFINES]->(:Symbol)
```

`kind` on Symbol: `function | class | interface | type | const | enum`.

When you outgrow this, add `(:Symbol)-[:CALLS]->(:Symbol)` and `(:Symbol)-[:EXTENDS]->(:Symbol)` — but that needs a real parser.
