# Walkthrough — JIRA + GitLab + SonarQube MCP

A developer picks up `PROD-4521` — *"Add user data export endpoint for GDPR Art 15"* — and ships it through to merge. Touches all three grill axes naturally. Should take 1.5–2 hours of dev+agent time end-to-end on a regulated-data ticket like this. For a CSS bug, this entire flow is overkill — invoke just the axis you need or skip straight to TDD.

## Setup (assumed)

Windsurf has the three MCPs configured (see [mcp-integration.md](./mcp-integration.md)) plus the AgentNexus workflows:

```
~/.codeium/windsurf/mcp_config.json   →  jira, gitlab, sonarqube
.windsurf/workflows/                   →  grill-me, grill-design, grill-security,
                                          grill-privacy, code-graph, security-review,
                                          software-security, code-knowledge-graph
```

Project has the `code-graph` CLI installed (`npm link`'d) and `.codegraph/` initialised. SonarQube is wired into the GitLab pipeline as a quality gate. JIRA tickets carry approver fields for Architecture, AppSec, and DPO sign-off.

---

## Phase 1 — Pick up the ticket (JIRA)

Dev opens Windsurf and types:

> `Pull PROD-4521 from JIRA and summarise it for me.`

Agent calls the JIRA MCP and surfaces:

- **Title**, description, acceptance criteria
- **Linked epic** (`PRIV-87 — GDPR rights tooling`)
- **Approvers required**: Architecture, AppSec, DPO
- **Labels**: `regulatory`, `customer-facing`, `epic-priv-87`

The agent flags: *"This ticket has three approver fields — you'll need a design review, a threat model, and a PIA. Recommend running `/grill-me` before writing code."*

Dev: `yes, /grill-me`.

---

## Phase 2 — Orient before grilling (`code-graph`)

The orchestrator's pre-grill triage asks four questions. Before answering, the agent invokes `/code-graph` to ground itself:

```
code-graph update
code-graph neighbors src/api/users.ts
code-graph query "MATCH (m:Module) WHERE m.path STARTS WITH 'src/export' RETURN m.path"
```

Output: there's no existing `src/export/` module, but `src/api/users.ts` already imports `auth`, `audit-log`, and `rate-limit`. The agent uses this in its triage recommendations rather than asking the dev cold.

Triage answers (one round):

1. Scope: **customer-facing API**
2. Personal data: **yes** (whole user record)
3. Trust boundary / authn: **yes**
4. Operational footprint: **yes** (new endpoint + async export job)

→ orchestrator queues all three axis grills, in order: design → security → privacy.

---

## Phase 3 — Grill, axis by axis

### `/grill-design` (≈30 min)

Agent walks the seven categories. Notable moves:

- **Architecture fit** — agent runs `code-graph query` for similar export endpoints, finds `src/admin/billing-export.ts` already implements an async-job export pattern. Recommends reusing it. Logs as a decision.
- **Reliability** — recommends presigned S3 URL with 24h expiry rather than streaming the response (export is large, sync would blow the SLO). Asks for an SLO commitment; dev gives p99 < 30s for the *request* (the export itself is async).
- **Cost** — the agent calculates rough S3 + egress at expected DSAR volume (~50/month) — negligible. Logs as decision.
- **Risks**: (1) export job stuck → user keeps polling, (2) S3 bucket misconfig → leak, (3) auth bypass on the download URL.

Artifact written: `docs/design-reviews/2026-04-30-user-data-export.md`. Agent posts a JIRA comment: `Design review: <link>`.

### `/grill-security` (≈45 min — the hot one)

Pre-grill, the agent pulls SonarQube findings on the touched modules:

```
sonarqube__get_issues(project="acme-api", componentKeys=["src/api/users.ts","src/auth"])
sonarqube__get_hotspots(project="acme-api", status="TO_REVIEW")
```

Three relevant existing findings:

- **High**: missing rate-limit on `/api/users/me` (already a hotspot)
- **Medium**: `auth.verifyToken` log line includes `userId` (low-sev PII in logs)
- **Info**: deprecated crypto in unrelated `legacy/` module

The agent uses these to seed the threat model — *"we're adding an endpoint adjacent to a known unrated rate-limit hotspot."*

Walking STRIDE:

- **Spoofing** — endpoint must be authenticated *and* the export must be tied to the caller's identity (no `?userId=` parameter; trust only the session/JWT). Mitigation logged.
- **Information disclosure** — biggest threat. Three sub-threats:
  1. Export URL leaks → mitigated by short-lived signed URL + audit log on download
  2. Race condition: export started before auth check → mitigated by middleware order
  3. Wrong user's data exported → enforce IDOR guard at query layer, not just controller
- **DoS** — large user can trigger massive export → throttle: 1 export request per user per 24h; queue-based, not synchronous.
- **Tampering** — minimal (read-only).
- **EoP** — admin impersonation export needs separate audit channel; out of scope for this ticket, logged as follow-up `PROD-4530`.

Sonar findings folded in:

- Existing rate-limit hotspot becomes a **prerequisite** — agent flags that without rate limiting, this endpoint inherits the same vulnerability. Adds it as a blocker risk.
- PII-in-log finding becomes a **must-fix-in-this-MR** since the export endpoint will likely re-emit user IDs.

Artifact written: `docs/security/threat-models/2026-04-30-user-data-export.md`. JIRA comment posted.

### `/grill-privacy` (≈45 min)

This one's the keystone for the ticket — Art 15 *is* a privacy right. The agent walks data inventory:

- Pulls every field from `User`, `UserProfile`, `Subscription`, `LoginHistory`, `AuditLog` via `code-graph query` for `MATCH (s:Symbol) WHERE s.module STARTS WITH 'src/models/user'`.
- For each field: classification, whether it's the user's own data, derived inferences (do we include the ML risk score?), third-party data (do we include data received from a payment processor?).

Decisions captured:

- **Scope of export** — direct user data + derived inferences; **excludes** internal annotations (Art 15 doesn't require trade secrets / internal scoring rationale). Flag as a contested decision; needs DPO sign-off.
- **Format** — JSON (machine-readable for portability under Art 20) + human-readable PDF summary.
- **Identifiability across stores** — backups age out independently; export only covers live stores. Disclosed in user-facing copy.
- **Response time** — 30 days statutory; SLO is 7 days; alert if any export sits in the queue >48h.

Artifact: `docs/privacy/pia/2026-04-30-user-data-export.md`. JIRA comment: `PIA: <link>. DPIA not triggered — confirmed with DPO during session.`

### Cross-axis reconciliation

Orchestrator runs the reconciliation pass:

- ✅ Privacy "wrong user's data exported" matches security IDOR threat
- ⚠ **Retention vs backup** — privacy says "export covers live stores only"; design grill said backups retain 90 days. Agent surfaces: *"Should the disclosure mention 90-day backup retention so users know data persists there?"* — dev decides yes; design-review artifact updated.
- ✅ Audit-log entry for download wired across all three artifacts
- ✅ Approvers: Architecture (design), AppSec (threat model), DPO (PIA) — all named

Combined brief written: `docs/reviews/2026-04-30-user-data-export.md`. Agent transitions JIRA: `In Progress`.

---

## Phase 4 — Implement (TDD + GitLab + local Sonar)

Dev: `let's start with the export-job worker, TDD style`.

Agent creates a branch via GitLab MCP:

```
gitlab__create_branch(project="acme/api", branch="PROD-4521-user-data-export", ref="main")
```

TDD loop runs. After each meaningful commit, the post-commit git hook fires `code-graph update` so the local index stays in sync.

Before pushing, dev runs:

```
code-graph impact src/export/data-export-worker.ts
```

Output shows `src/api/users.ts` and two queue consumers will be affected. Dev reads, agreed it's expected — no surprises.

Local Sonar scan via MCP:

```
sonarqube__get_issues(branch="PROD-4521-user-data-export")
```

One new finding: the export worker logs `request.body` which contains `userId`. Cross-references the threat model's "PII in logs" mitigation. Dev fixes before pushing.

---

## Phase 5 — MR, gate, security review on the diff

Dev: `Open the MR.`

```
gitlab__create_merge_request(
  source="PROD-4521-user-data-export",
  target="main",
  title="PROD-4521: GDPR Art 15 user data export",
  description="<links to design-review, threat-model, PIA, combined brief>"
)
```

GitLab pipeline runs. Sonar quality gate checks:

```
sonarqube__get_quality_gate_status(branch="PROD-4521-user-data-export")
```

Status: ✅ passed (no new high/critical, coverage on new code 87%).

Pre-push hook had already printed `code-graph impact` to the dev's terminal. The MR description includes the impact list so reviewers don't have to re-run it.

Dev runs `/security-review` on the diff:

- Re-reads the 23 CodeGuard rule files most relevant to the diff (input-validation-injection, file-handling-and-uploads, authorization-access-control, hardcoded-credentials).
- Generates a per-finding markdown report. Posts as a single GitLab MR comment via the GitLab MCP.

AppSec reviewer is paged via JIRA approver workflow. They review the threat model + the security-review comment. Approves with one ask: *"Add a unit test that asserts the IDOR guard in `getExportForUser`."* Dev does so.

DPO reviews the PIA. Approves with no changes.

Architecture reviewer reviews the design-review. Approves.

Three approvals → MR mergeable.

---

## Phase 6 — Merge, close, follow-up

Dev merges via GitLab. Post-merge automation:

- `code-graph update` runs on `main`, picks up the new module.
- JIRA: `transition_issue(PROD-4521, Done)`.
- Combined brief is closed out — status flipped to `Approved`, merged commit SHA stamped.

Two follow-ups land naturally:

- A new JIRA ticket `PROD-4530` opens for the admin-impersonation export hardening (the EoP threat punted from the security grill).
- The agent offers: *"Want me to schedule a background agent in 30 days to verify the export queue SLO is holding and post results to PROD-4521?"* — dev says yes.

---

## What each MCP earned its keep doing

| MCP | High-leverage use |
|---|---|
| **JIRA** | Ticket pickup, approver-field driven sign-off, comment-stream of artifact links, transitions, follow-up ticket creation |
| **GitLab** | Branch + MR creation, pipeline status, posting the security-review report as an MR note, merge action |
| **SonarQube** | Pre-grill seeding (existing hotspots feed the threat model), pre-push local scan, MR quality gate, post-merge baseline |

## What the workflows earned

- **`/code-graph`** — grounds every agent decision in actual code structure rather than guesses; powers impact analysis at three points (orient, pre-push, MR description).
- **Three grill axes** — produce the three artifacts the three approvers actually need; each artifact stands alone for its reviewer.
- **`/grill-me` orchestrator** — reconciles cross-axis findings (the retention-vs-backup catch was the kind of thing that gets missed when axes are siloed).
- **`/security-review`** — runs on the diff, not the whole codebase; produces a focused per-finding comment for the MR.

## Honest caveats

- **MCP tool names are illustrative.** The actual names depend on which JIRA / GitLab / Sonar MCP server you're running. Substitute as needed.
- **Three grills + an MR review on a single ticket is ~2 hours of dev+agent time.** That's right for a regulatory-touching ticket like PROD-4521. For a CSS bug, it's overkill.
- **Cross-axis reconciliation is where I see the most miss in real usage.** Agents tend to declare the orchestrator "done" after the third axis. The closing-conditions in `grill-me.md` are the only thing keeping that honest — review them when adapting.
- **Sonar findings as threat-model seeds is opinionated.** If your team treats Sonar as advisory-only, don't let it block the grill — but do let it inform.
