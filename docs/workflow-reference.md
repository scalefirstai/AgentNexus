# Workflow reference

Every workflow in `workflows/`, what it does, when to invoke it, and what it produces.

## The grill suite

Four workflows for design / security / privacy review. Use the orchestrator when scope is unclear; invoke individual axes when only one applies.

### `/grill-me` — orchestrator

**Use when**: a change touches more than one axis (design + security, design + privacy, all three) or you want a single combined ARB/CAB brief.

**Triage** (asks 4 questions): scope, personal/regulated data, trust boundary, operational footprint.

**Order** (when running multiple): design → security → privacy. Earlier axes feed later ones.

**Produces**: a top-level `docs/reviews/<date>-<slug>.md` brief that links to the per-axis artifacts. Cross-axis reconciliation pass: threats vs privacy residuals, retention vs backup, sub-processor vs vendor pick, audit-logging consistency.

### `/grill-design`

**Use when**: stress-testing the design and operational plan for a change. ARB prep. Before anything goes into a roadmap.

**Categories**: scope & stakeholders (RACI, sign-offs); architecture fit (tech radar, ADR, glossary, OSS license); reliability & operations (SLO, error budget, failure modes, observability, on-call, capacity, DR, backups); change management & rollout (strategy, rollback, feature flag, migration, BC, change window); cost (infra delta, license, FinOps tagging, budget threshold); dependencies & integrations (upstream/downstream, sync vs async, contract testing); documentation & enablement.

**Produces**: `docs/design-reviews/<date>-<slug>.md` with status, approvers, decisions, open questions, risk table, operational readiness checklist.

**Closing conditions**: every category walked or explicitly skipped, ≥3 risks logged, checklist worked through, named approvers, user agreement.

### `/grill-security`

**Use when**: any change touching authn/authz, secrets, crypto, external input, or a trust boundary. AppSec sign-off. Before adding a public endpoint.

**Categories**: STRIDE threat model (top 3 threats with L/M/H × L/M/H rating); authentication; authorization (incl. IDOR, tenant isolation); secrets & credentials; attack surface; input handling & injection; cryptography; logging, audit, monitoring; supply chain & dependencies; incident response & disclosure; residual risk register.

**Cross-references**: cites Project CodeGuard rules under `workflows/software-security/rules/` for each category — e.g. `codeguard-1-hardcoded-credentials.md`, `codeguard-0-input-validation-injection.md`.

**Produces**: `docs/security/threat-models/<date>-<slug>.md` with system-under-review, ranked threats table, applied mitigations, open questions, residual risks, security checklist.

**Closing conditions**: STRIDE produced ≥3 ranked threats, residual risk register non-empty, checklist worked through, AppSec approver named.

### `/grill-privacy`

**Use when**: any change touching personal or regulated data, adding a vendor that processes data, changing retention or transfers, automated decision-making.

**Categories**: data inventory & classification; purpose & lawful basis (GDPR Art 6 / equivalents); data minimisation; residency & cross-border transfer (SCCs / TIA / adequacy); retention & deletion (across all stores incl. backups); data subject rights (access/rectification/erasure/portability/objection/Art 22 / CCPA opt-out); third parties (controller vs processor, DPAs, sub-processor list); DPIA trigger check (GDPR Art 35); security of processing; breach readiness; marketing & cookies; residual risk register.

**Produces**: `docs/privacy/pia/<date>-<slug>.md` (or DPIA if triggered) with data inventory, lawful basis table, transfers table, retention table, DSR mechanism table, third-party table, privacy checklist, ROPA-update notes.

**Closing conditions**: data inventory complete, every purpose has a lawful basis, every transfer covered, retention enforceable, DSR mechanisms confirmed, DPIA trigger check documented, residual risk register non-empty, ROPA delta queued.

## Code intelligence

### `/code-graph`

**Use when**: you have the [code-graph CLI](../code-graph/README.md) installed and indexed in the project, and want to run impact analysis or neighbourhood queries.

**Subcommands the workflow drives**:
- `code-graph impact <files>` — files transitively importing target(s)
- `code-graph neighbors <file>` — 1-hop neighbourhood
- `code-graph map <prefix> [maxNodes]` — Mermaid diagram for an area
- `code-graph query '<cypher>'` — raw Cypher

**Workflow rules**: never invent Cypher inline — shell out to the CLI; run `update` (cheap) before queries instead of full `index` (slow); flag wide blast radius (>30 files importing) as a finding worth surfacing.

**Output**: structured CLI text → translated by the agent into 3–5 most important findings.

### `/code-knowledge-graph`

**Use when**: you don't have the CLI, or you want a hand-curated narrative graph that lives in version control next to the code.

**Output**: `KNOWLEDGE-GRAPH.md` at repo root (or per-context if `CONTEXT-MAP.md` exists). Six phases: Scope → Discover → Edges → Render → Verify → Maintain.

**Format spec**: `workflows/code-knowledge-graph/GRAPH-FORMAT.md` — defines node/edge tables, optional Mermaid diagram (for ≤40 nodes), Hot paths section, Open questions section.

**Trade-off vs `/code-graph`**: markdown is git-diffable and human-readable; the Kuzu-backed CLI scales further and supports machine queries. Many projects end up using both.

## Security workflows

### `/software-security`

**Use when**: writing or reviewing code in any language. Always-on guidance.

**Always-apply rules** (every code operation):
- `codeguard-1-hardcoded-credentials.md` — no hardcoded secrets
- `codeguard-1-crypto-algorithms.md` — modern, vetted crypto only
- `codeguard-1-digital-certificates.md` — proper cert validation

**Context-specific rules**: a language → rules table covering apex, c, cpp, docker, go, html, java, javascript, kotlin, matlab, perl, php, powershell, python, ruby, rust, shell, sql, swift, typescript, vlang, xml, yaml. The workflow points the agent at the relevant rule files for whatever language it's editing.

**Source**: Project CodeGuard ([cosai-oasis/project-codeguard](https://github.com/cosai-oasis/project-codeguard)), CC BY 4.0.

### `/security-review`

**Use when**: doing a full security review of a target repo and producing a formal report with prioritised findings.

**Inputs**: target repo path. If missing, the agent asks before proceeding.

**Workflow**: load CodeGuard rules → select OWASP rules matching the detected stack → review code line-by-line → focus on injection, authn/authz, secrets, crypto misuse, SSRF, traversal, RCE, XSS/CSRF, deserialisation, insecure config, supply chain → produce a markdown report.

**Output**: `security_report/sec_review_<repo>_<YYYY-MM-DD_HH-mm-ss>.md` with executive summary, detailed findings (with severity, code snippet, remediation), findings by category, recommendations, appendix.

## Composition patterns

The workflows compose. Common combinations:

- **Regulated-data feature**: `/grill-me` → triggers all three axes → `/security-review` runs against the diff in the MR → `/code-graph impact` posted to the MR description.
- **Refactor with wide blast radius**: `/code-graph impact` first → if ≥30 importers, run `/grill-design` (architecture fit + rollout) → split the change into smaller PRs.
- **New endpoint**: `/grill-security` (mandatory) → `/grill-design` if it changes SLOs or capacity → `/grill-privacy` only if personal data is in the request/response.
- **Vendor onboarding**: `/grill-design` (procurement, OSS license, architecture fit) → `/grill-privacy` (DPA, sub-processor list, transfers) → `/grill-security` only if the vendor processes credentials or sensitive data.
- **Building knowledge for new team members**: `/code-knowledge-graph` for a narrative `KNOWLEDGE-GRAPH.md` → `/code-graph` for ad-hoc queries against the live Kuzu DB.

## What's deliberately out of scope

- **Frontend/accessibility grills.** Add `/grill-a11y` if WCAG sign-off is part of your stack.
- **Performance grills.** Performance budgets are mentioned in `/grill-design` but a deeper SRE-style perf review isn't here.
- **FinOps depth.** Cost is in `/grill-design` but a real FinOps review (unit-economics, RI/SP planning, anomaly investigation) needs more.

These are reasonable additions — see [Roadmap](../README.md#roadmap) and [CONTRIBUTING.md](../CONTRIBUTING.md).
