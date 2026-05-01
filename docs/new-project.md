# Starting a brand new project with AgentNexus

You have a requirements spec — a PRD, a customer email, a one-paragraph idea — and an empty directory. This guide takes you from there to a scaffolded project with design / security / privacy artifacts, an intended-structure knowledge graph, a first working slice, and CI green.

If you already have a working repo and you're picking up a ticket, read [walkthrough.md](./walkthrough.md) instead — it covers the steady-state flow.

## Prerequisites

- [Windsurf](https://windsurf.com) installed and signed in
- AgentNexus cloned somewhere (`git clone https://github.com/scalefirstai/AgentNexus.git`)
- Git, Node 18+ (for the `code-graph` CLI later), and your normal toolchain
- The requirements spec, in any form (file, Slack thread, email, napkin sketch). Hold off on any other setup until Phase 1.

A useful frame for the rest of this guide: **the grills bootstrap the project's documentation, not just review it.** In greenfield, "read the room before asking" shifts to "build the room as you go" — every grill output becomes a foundation document the next grill cites.

---

## Running example

Throughout, we'll scaffold a small service: **a customer feedback collector** — authenticated users submit short feedback, admins view it in a dashboard. Small enough to walk through, real enough to hit all three grill axes (auth, PII in messages, retention).

If your real spec is bigger, the steps don't change — just expect Phase 3 to take longer.

---

## Phase 1 — Capture the spec, then commit it

Resist the urge to start coding. The grills you're about to run will produce artifacts that **cite the spec**. If the spec lives in a Slack thread, those citations rot. Lock it down first.

```bash
mkdir feedback-service && cd feedback-service
git init
mkdir -p docs/requirements
$EDITOR docs/requirements/feedback-service.md
git add . && git commit -m "docs: initial requirements spec"
```

Minimum content for the spec — don't over-engineer:

```md
# Feedback Service — Requirements

## Goal
Authenticated users submit short feedback messages (≤500 chars). Admins
review them in a dashboard.

## Users
- End users: any logged-in customer
- Admins: support team (existing role)

## Functional
- POST /feedback (auth required, rate-limited)
- GET /admin/feedback (admin only, paginated)
- Submission stores: user id, timestamp, message, optional category

## Non-functional
- p99 < 300ms for submit
- 99.9% availability target
- 90-day retention
- GDPR: subject access export must include feedback history

## Out of scope
- Email notifications
- Sentiment analysis
- Bulk export
```

That's it. Do **not** decide tech stack, infra, or detailed schema yet — that's what `/grill-design` is for.

---

## Phase 2 — Scaffold the project shell

Install the AgentNexus workflows so the agent has the slash commands available, and create the directory layout the grill artifacts will land in.

```bash
# From inside feedback-service/
/path/to/AgentNexus/scripts/install.sh .

# Where the artifacts will land. Creating these directories now means
# the agent doesn't have to fight with mkdir during the grill.
mkdir -p docs/design-reviews docs/security/threat-models docs/privacy/pia docs/adr docs/reviews

# Seed CONTEXT.md so the grills have somewhere to write glossary terms.
cat > CONTEXT.md <<'EOF'
# Feedback Service

A service for collecting and reviewing customer feedback.

## Language
_(populated as terms are decided in grills)_

## Relationships
_(populated as relationships emerge)_

## Flagged ambiguities
_(populated when terms are used inconsistently)_
EOF

# .gitignore for whatever stack you'll pick later
cat > .gitignore <<'EOF'
node_modules/
.codegraph/
.env*
*.log
.DS_Store
EOF

git add . && git commit -m "chore: scaffold project + install AgentNexus workflows"
```

You don't have a stack yet, so don't `npm init` / `cargo init` / `mvn` anything. That comes after Phase 3.

Open the project in Windsurf. Type `/` in chat — you should see the eight AgentNexus workflows.

---

## Phase 3 — `/grill-design` first (with the spec)

This is the keystone. The design grill is where you decide stack, architecture, SLOs, rollout. **In greenfield, it also produces ADR-0001 for the tech stack** — don't skip it; future you will second-guess every choice if there's no documented rationale.

In Windsurf chat:

> `/grill-design — here is docs/requirements/feedback-service.md`

The agent walks the seven categories. **Greenfield-specific differences from the standard grill:**

| Category | Greenfield twist |
|---|---|
| Scope & stakeholders | RACI is mostly empty; the question becomes "who *should* be on it?" |
| Architecture fit | "What stack" — there's no incumbent. ADR territory. |
| Reliability | SLO targets are aspirational, not bound by existing budgets. |
| Cost | Estimates are speculative until stack is chosen — first grill produces a range. |
| Dependencies | "We'll need an auth service" is fine; identify candidates. |
| Documentation | Tell the agent it's writing CONTEXT.md and ADR-0001 in this session. |

Expect this grill to take 30–60 minutes for a real spec. Useful prompts during the session:

- **"Recommend two stack options with trade-offs."** Gets you a concrete comparison instead of an open-ended search.
- **"What's the smallest viable first slice?"** Defines what Phase 7 will actually build.
- **"Which decisions need ADRs vs. can stay in the design-review doc?"** Separates "permanent" from "subject to revision".

### Outputs from Phase 3

- `docs/design-reviews/2026-05-01-feedback-service.md` — full design review with decisions, open questions, risks, operational readiness checklist
- `docs/adr/0001-tech-stack.md` — chosen stack + rejected alternatives + why
- `CONTEXT.md` — gains terms like **Feedback**, **Submission**, **Admin Reviewer** with crisp definitions
- Maybe `docs/adr/0002-async-export-pattern.md` etc. for other material decisions

For the running example, assume the grill landed on **Node 20 + TypeScript + Fastify + Postgres + an existing internal auth service**.

Commit:

```bash
git add . && git commit -m "docs: design review, ADR-0001 tech stack, CONTEXT.md seeded"
```

---

## Phase 4 — Scaffold the codebase

Now that the stack is decided, scaffold for real. Do the *minimum* to support the first slice — no premature folder structure.

```bash
npm init -y
npm install fastify pg zod
npm install -D typescript tsx vitest @types/node @types/pg

mkdir -p src/{api,domain,infra,db}
$EDITOR tsconfig.json   # standard strict TS config

# Stub the entry point so things compile.
cat > src/index.ts <<'EOF'
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

app.listen({ port: 3000, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
EOF

git add . && git commit -m "chore: scaffold Node/TS service with Fastify + Postgres"
```

This is also when you write a one-paragraph `README.md` for the new project so the next person who finds it can boot. The AgentNexus README stays in the AgentNexus repo; this is your project's README.

---

## Phase 5 — `/grill-security` against the now-concrete design

The design is concrete enough to threat-model. STRIDE walks here will surface real, fixable threats — not abstract ones.

> `/grill-security — context: docs/design-reviews/2026-05-01-feedback-service.md and docs/requirements/feedback-service.md`

For the feedback service, expect the grill to flag at least:

- **Spoofing** — admin endpoint must check the *admin* role, not just authenticated. (Mitigation: middleware + tests.)
- **Information disclosure** — feedback messages may contain PII; logs must not echo bodies. (Mitigation: redaction layer + ADR.)
- **DoS** — submission endpoint is unauthenticated until JWT verifies; pre-auth body parse is the attack surface. (Mitigation: body size limit before parse.)
- **EoP** — admin role check at the gateway *and* the handler. Belt-and-braces because greenfield.

### Greenfield-specific notes

- **Many controls don't exist yet.** No SIEM, no WAF rules for this service, no IAM bindings. The grill surfaces these as **foundation items** in the residual-risk register, not as gaps in this change. Each becomes a follow-up ticket.
- **Audit-log destination** — the grill will ask where audit events go. If your org has a central log store, name it; if not, decide now (per-service stdout → eventual aggregator is acceptable for MVP, but **log it as ADR-0003**).

Output: `docs/security/threat-models/2026-05-01-feedback-service.md` with ranked threats, mitigations, residual risks, security checklist.

---

## Phase 6 — `/grill-privacy`

Spec mentions GDPR subject-access — Phase 6 is where that gets concrete.

> `/grill-privacy — context: requirements + design review + threat model`

For the feedback service:

- **Data inventory** — message text (free-form, may contain PII), user id, timestamp, optional category. Source: direct from user.
- **Lawful basis** — likely **legitimate interest** (improving the product); document the LIA inline.
- **Retention** — 90 days per spec; deletion mechanism: nightly purge job + on-demand DSAR erasure path.
- **Subject rights** — access (export must include feedback history per spec), erasure (purge job + ad-hoc), rectification (probably not — feedback is point-in-time; document that decision).
- **Sub-processors** — none yet (storing in our own Postgres). If a managed DB is chosen, that vendor goes into the sub-processor list.
- **DPIA trigger** — likely **no** (small scale, not special category, no automated decisions). Document the negative outcome explicitly so it survives audit.

Output: `docs/privacy/pia/2026-05-01-feedback-service.md` plus a ROPA-update note saying "new processing activity: feedback collection — add to ROPA on next quarterly review".

---

## Phase 7 — Draft the *intended* knowledge graph

You have no real code yet (just the Fastify stub). The Kuzu-backed `code-graph` CLI would index empty modules. **This is when `/code-knowledge-graph` (the markdown variant) earns its keep** — capture intent before code.

> `/code-knowledge-graph — based on the design review, draft KNOWLEDGE-GRAPH.md for the intended modules and edges`

Expect the agent to produce something like:

```md
# Code Knowledge Graph

**Scope**: whole-repo (intended structure pre-implementation)
**Last updated**: 2026-05-01

## Nodes
| id | kind | location | purpose |
|---|---|---|---|
| FeedbackController | module | src/api/feedback.ts | HTTP layer for /feedback |
| AdminController | module | src/api/admin-feedback.ts | HTTP layer for /admin/feedback |
| FeedbackService | module | src/domain/feedback-service.ts | Validates and stores submissions |
| FeedbackRepo | module | src/db/feedback-repo.ts | Postgres persistence |
| AuthClient | external | — | Internal auth service |
| Postgres | external | — | Primary datastore |

## Edges
| from | to | kind | note |
|---|---|---|---|
| FeedbackController | FeedbackService | calls | |
| FeedbackController | AuthClient | calls | verify JWT |
| FeedbackService | FeedbackRepo | calls | |
| FeedbackRepo | Postgres | reads, writes | table: feedback |

## Hot paths
- Submission: `FeedbackController → AuthClient (verify) → FeedbackService → FeedbackRepo → Postgres`
- Admin read: `AdminController → AuthClient (admin role) → FeedbackService → FeedbackRepo → Postgres`

## Open questions
- Should `FeedbackService` enforce category whitelist or accept arbitrary strings?
- Audit-log emitter: separate module or inline in service?
```

Commit it. Update it when implementation diverges from intent — the diff is *the* signal that you're drifting from the design.

---

## Phase 8 — First slice with TDD

Pick the **smallest end-to-end vertical** — for the feedback service, that's "POST /feedback writes to Postgres" — and TDD it.

Outline:

1. Write a failing integration test that POSTs `{message: "hi"}` with a fake JWT and asserts a row appears.
2. Wire `FeedbackController → FeedbackService → FeedbackRepo` minimally.
3. Make the test pass.
4. Commit. Update `KNOWLEDGE-GRAPH.md` if module names diverged from the draft.
5. Repeat for the next slice (admin endpoint, rate limit, validation, retention job, …).

Each commit is small; each lands a real capability; each updates one file (or three) in the docs/ tree.

---

## Phase 9 — Bootstrap the `code-graph` CLI

When you have ~10 source files of real code, the markdown graph stops scaling. Switch to the Kuzu CLI for machine queries while keeping `KNOWLEDGE-GRAPH.md` as the human narrative.

```bash
# Install once globally
cd /path/to/AgentNexus/code-graph
npm install && npm link

# In your project
cd /path/to/feedback-service
code-graph init
code-graph index
code-graph install-hooks    # post-commit + pre-push

# Try it
code-graph impact src/domain/feedback-service.ts
code-graph map src/api 20
```

From now on, the post-commit hook keeps the index fresh. The `/code-graph` workflow gives the agent live impact analysis during planning and reviews.

---

## Phase 10 — CI + first MR

If this is going to a remote (GitLab/GitHub), set up CI before the first push:

- Lint (`eslint`, `prettier --check`)
- Typecheck (`tsc --noEmit`)
- Test (`vitest run`)
- Optional: SonarQube quality gate (see [mcp-integration.md](./mcp-integration.md))

Open the first MR with the design-review, threat-model, and PIA linked in the description. Reviewers don't have to redo the grilling — the artifacts are the record.

```
Title: feat: feedback submission endpoint (POST /feedback)

Linked artifacts:
- Design review: docs/design-reviews/2026-05-01-feedback-service.md
- Threat model: docs/security/threat-models/2026-05-01-feedback-service.md
- PIA: docs/privacy/pia/2026-05-01-feedback-service.md
- KG:  KNOWLEDGE-GRAPH.md
```

---

## What you have at this point

```
feedback-service/
├── README.md
├── CONTEXT.md
├── KNOWLEDGE-GRAPH.md
├── .codegraph/                          ← Kuzu live index
├── .windsurf/workflows/                 ← AgentNexus workflows (symlinked)
├── docs/
│   ├── requirements/feedback-service.md
│   ├── design-reviews/2026-05-01-feedback-service.md
│   ├── security/threat-models/2026-05-01-feedback-service.md
│   ├── privacy/pia/2026-05-01-feedback-service.md
│   └── adr/
│       ├── 0001-tech-stack.md
│       └── 0002-...md
├── src/
│   ├── api/
│   ├── domain/
│   ├── infra/
│   └── db/
└── package.json
```

Three artifacts pre-approved by Architecture / AppSec / DPO conceptually (still need real human approvers). A first vertical slice. CI green. The graph (markdown + DB) reflects intent and reality.

---

## Common greenfield gotchas

- **Grilling before locking the spec.** Artifacts cite the spec; if the spec moves mid-grill, you re-grill. Spend 15 minutes on Phase 1, not 5.
- **Skipping ADR-0001 for tech stack.** Without it, every future PR re-litigates "should we have used X". Write it.
- **`code-graph init` before there's code.** It works but the CLI's outputs are empty. Use the markdown variant (`/code-knowledge-graph`) until ~10 modules exist, then switch.
- **Faking answers in privacy/security grills because controls don't exist yet.** No DPA? No SIEM? No central log store? Log them as **foundation items** in residual risks with named owners and a target date — don't pretend they're solved.
- **One giant first slice.** "Build the whole feedback service" is not a TDD slice. "POST /feedback writes a row" is.
- **Treating `KNOWLEDGE-GRAPH.md` as set in stone.** It's intent on day one, reality by day thirty. Update on divergence — drift detection is its main value.

---

## After you ship the first slice

- The [walkthrough](./walkthrough.md) takes over: it's the steady-state flow for tickets, MRs, and reviews against an established repo.
- Wire MCP servers (JIRA, GitLab/GitHub, SonarQube) per [mcp-integration.md](./mcp-integration.md) once project tooling exists.
- Schedule the first retro after a month: which artifacts proved load-bearing? Which were never reread? Adjust the workflow defaults for next time.
