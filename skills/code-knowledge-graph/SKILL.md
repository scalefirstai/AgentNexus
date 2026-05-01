---
name: code-knowledge-graph
description: Build and maintain a knowledge graph of the codebase — modules, symbols, and the relationships between them — so future planning, impact analysis, and onboarding queries can be answered from a structured map instead of re-reading files. Use when user wants to "map this codebase", "build a code graph / knowledge graph", "understand how X connects to Y", "see the dependency graph", or before a large refactor where blast radius matters.
---

# Code Knowledge Graph

A persistent, text-based map of the code: what exists, how it connects, and which pieces matter. The graph is for *navigation and impact analysis*, not exhaustive documentation. Build it lazily, expand on demand, and keep it under version control alongside the code.

## When to build vs. expand

- **Build** when no `KNOWLEDGE-GRAPH.md` exists and the user asks to map a codebase, plan a non-trivial refactor, or onboard to unfamiliar code.
- **Expand** when one already exists and the current task touches an unmapped area. Don't rebuild from scratch — extend the existing graph.
- **Skip** for one-file changes, bug fixes, or small features in already-mapped areas. The graph earns its keep on cross-cutting work.

## Output file

Single graph: `KNOWLEDGE-GRAPH.md` at the repo root.

Multi-context repos (a `CONTEXT-MAP.md` exists per [grill-with-docs](./grill-with-docs.md)): one `KNOWLEDGE-GRAPH.md` per context, alongside its `CONTEXT.md`.

Format spec: [./code-knowledge-graph/GRAPH-FORMAT.md](./code-knowledge-graph/GRAPH-FORMAT.md).

## Workflow

### Phase 1 — Scope

Decide what to map. **Don't try to map everything.** Ask the user if scope is unclear.

- **Whole repo** — only for small/medium codebases (<500 source files) or true onboarding.
- **Feature area / module** — most common; e.g. "the auth module and what it touches".
- **Blast radius** — given a target symbol or file, map everything that depends on it (1–2 hops out).

Write the chosen scope into the graph header so future expansions stay consistent.

### Phase 2 — Discover

Build the node set before edges. Work top-down:

1. **Entry points** — `main`, server bootstraps, CLI commands, public API exports, route handlers, scheduled jobs, message consumers.
2. **Module boundaries** — top-level packages/directories. Each becomes a node.
3. **Key symbols** — for each in-scope module, list exported types, classes, and functions that other modules use. Skip purely internal helpers.
4. **External dependencies** — third-party packages and runtime services (DBs, queues, external APIs). One node each, marked `external`.

Tools that help (use what's available):

- `rg` / `grep` for import statements (`^import`, `^from`, `require(`, `use `).
- Language LSP / tree-sitter / ast-grep when you need symbol-precision over text matching.
- Build tool output (`go list`, `cargo metadata`, `pnpm why`, `mvn dependency:tree`) for external deps.

If domain documentation exists (`CONTEXT.md`), pull domain terms from it — node names should match the glossary, not invent new ones.

### Phase 3 — Extract edges

For each in-scope node, record relationships to other nodes. Edge types to capture:

- `imports` — A imports/requires B
- `calls` — A invokes a function/method on B
- `extends` / `implements` — inheritance, interface satisfaction
- `reads` / `writes` — A touches B's persistent state (DB table, file, queue)
- `emits` / `consumes` — A publishes events that B listens for
- `configures` — A sets up B (DI wiring, route registration)

Skip edges that are purely transitive (A → B → C: don't add A → C unless the direct relationship exists). Skip edges to language built-ins and trivial utilities.

**Stop conditions** (avoid infinite expansion):

- Don't follow edges into `external` nodes.
- Don't follow edges into out-of-scope modules; record the edge but stop expanding from the other side.
- Cap depth at 2 hops from any seed node unless the user asks for more.

### Phase 4 — Render

Write `KNOWLEDGE-GRAPH.md` per [GRAPH-FORMAT.md](./code-knowledge-graph/GRAPH-FORMAT.md). Include:

- Header (scope, last-updated date, source commit SHA if in a git repo).
- **Nodes** table — one row per node with id, kind, location, one-line purpose.
- **Edges** table — one row per edge with from, to, kind, optional note.
- **Mermaid diagram** for module-level overview (omit if >40 nodes — diagram becomes unreadable; keep tables only).
- **Hot paths** — 2–5 narrative bullets describing the most important traversals (e.g. "request lifecycle: `Router → AuthMiddleware → Handler → UserService → UserRepo → Postgres`").
- **Open questions** — anything you couldn't resolve during exploration. Don't paper over gaps; flag them.

### Phase 5 — Verify

Before finishing:

- **Spot-check 3 random edges** by opening the source and confirming the relationship exists. Mis-stated edges are worse than missing ones.
- **Check for orphans** — every in-scope node should have at least one inbound or outbound edge. Orphans usually mean dead code or that you missed an edge.
- **Re-read the Hot paths** — if a hot path references a node not in the table, fix it.

### Phase 6 — Maintain

The graph is only useful if it stays roughly current. Two update triggers:

1. **Touched in this PR** — when a change adds/removes a node or edge in a mapped area, update the graph in the same PR.
2. **Stale-detection on next use** — when expanding, sample 5 nodes; if 2+ have moved/renamed/disappeared, the graph is stale. Either refresh the affected slice or, if rot is widespread, mark the file `STALE` at the top and rebuild.

Don't try to keep it perfectly synced via automation — that's a losing battle. Keep it as a living artifact that's updated when humans touch related code.

## Anti-patterns

- **Mapping the whole repo when only a slice is needed.** Big graphs nobody reads.
- **Listing every internal helper.** Noise drowns out the structurally important nodes.
- **One giant Mermaid diagram.** Past ~40 nodes it's a hairball; tables scale better.
- **Inventing node names that don't match the code or glossary.** The graph must be greppable — `UserService` (matches the class) not "User Management Service".
- **Hand-wavy edges** like "depends on" without specifying kind. If you can't pick a kind, the edge probably isn't worth recording.
- **Building the graph and never linking to it.** Reference it from PR descriptions, ADRs, and onboarding docs so it gets used.

## Quick start

If the user just says "map this" with no further scope:

1. Run a top-level directory listing and ask: "Map the whole thing, or pick a feature area?"
2. If small repo, proceed to Phase 2 with whole-repo scope.
3. If medium/large, ask the user to name 1–3 entry points or modules to seed from.
