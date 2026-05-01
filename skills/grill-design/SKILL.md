---
name: grill-design
description: Design grill for enterprise change. Interview the user across scope, architecture fit, reliability/ops, change management & rollout, cost, dependencies, and documentation; emit a design-review artifact (RFC) capturing decisions, open questions, named approvers, and risks. Use when user wants to stress-test the design and operational plan for a change, prepare for ARB review, or mentions "grill design".
---

# Grill Design

Interview the user about the design and operational fitness of a proposed change. This grill assumes security and privacy are handled separately — invoke `/grill-security` and `/grill-privacy` for those axes. Stay focused here: *should we build this, how, and how will we operate it?*

## Rules of engagement

- **One question at a time.** Wait for the answer before moving on.
- **Always recommend a default answer.** Concrete, defensible. "I don't know" is not a question.
- **Read the room before asking.** Codebase, `CONTEXT.md`, ADRs, `KNOWLEDGE-GRAPH.md`, runbooks, on-call playbooks. If documented, cite — don't ask.
- **Skip categories explicitly.** State the reason and move on. Don't drop silently.
- **Push back on hand-waving.** "We'll handle it later" → logged as an open question with named owner and target date.
- **Capture as you go.** Decisions, open questions, risks land in the artifact during the session.

## Triage

Before grilling, classify so you grill at the right depth:

1. **Scope** — internal tool, customer-facing feature, infra change, data pipeline, public API?
2. **Blast radius** — single team, multi-team, whole org, external partners, end users?
3. **Reversibility** — flag rollback, schema migration with backfill, irreversible (data deletion, contract change)?
4. **Time pressure** — can we phase, or is this a hard deadline?

The triage output goes into the artifact header and decides which categories below get full grilling vs. quick skip.

## Categories

### 1. Scope & stakeholders
- **Problem statement** — one sentence, in business terms. Whose problem?
- **Success metric** — what measurable signal proves this worked? Pick one.
- **Non-goals** — what are we explicitly *not* doing? Name at least two.
- **Stakeholders (RACI)** — Responsible (builds), Accountable (decides), Consulted (weighs in), Informed (told).
- **Sign-offs required** — architecture review board? SRE? finance? data governance? List the gates by name, not just teams.

### 2. Architecture fit
- **Tech radar alignment** — is the chosen tech on the approved list, on probation, or off it? if off, what's the exception process and who approves it?
- **Reuse vs. build** — is there an existing platform service that does this? if yes, why not use it?
- **ADR needed?** — non-trivial architectural decision that future devs will second-guess? Write an ADR. Format: see [./grill-with-docs/ADR-FORMAT.md](./grill-with-docs/ADR-FORMAT.md).
- **Glossary alignment** — do new terms conflict with `CONTEXT.md`? See [./grill-with-docs/CONTEXT-FORMAT.md](./grill-with-docs/CONTEXT-FORMAT.md).
- **Tech-debt ledger** — does this add a known shortcut? Log it explicitly with a removal trigger.
- **OSS license review** — any new dependencies? Approved list, or legal review (GPL/AGPL/SSPL/source-available)?

### 3. Reliability & operations
- **SLO / SLA** — target availability and latency. Does this fit existing SLOs or change them?
- **Error budget** — does this consume budget? Coordinated with the SRE/owning team?
- **Failure modes** — what happens when the dependency is down, slow, returning bad data? Graceful degradation or hard failure? Are timeouts and retries explicit?
- **Observability** — what metrics, logs, traces are emitted? Are dashboards and alerts in place *before* rollout, not after? Are SLO burn alerts wired up?
- **On-call & runbook** — who pages on this? Is the runbook written? Has the on-call team been briefed?
- **Capacity** — peak QPS, burst behavior, sustained load? Is upstream/downstream capacity sufficient or do we need to pre-warm?
- **Disaster recovery** — RPO and RTO targets? In the DR plan? Survives a region outage?
- **Backups** — is data in this system backed up? Has restore been tested in the last 6 months?
- **Performance budget** — added latency at p50/p99? Memory/CPU footprint?

### 4. Change management & rollout
- **Rollout strategy** — flag-gated, ringed (1% → 10% → 100%), shadow traffic, dual-write, blue-green?
- **Rollback plan** — concrete, tested, time-bounded. "Revert and redeploy" is insufficient for stateful changes.
- **Feature flag** — name, owner, removal target date? Logged in the flag registry?
- **Migration / backfill** — schema or data migration? Online or offline? Idempotent? Duration? Lock impact? Resumable on failure?
- **Backwards compatibility** — old clients still work? Deprecation window? Communication plan?
- **Change window** — needs a CAB-approved window? Conflicts with a freeze (peak season, financial close, on-call rotation gaps)?
- **Validation in prod** — synthetic tests, canary metrics, manual smoke-test checklist, sign-off criterion to advance the ring?

### 5. Cost
- **Infra delta** — new compute, storage, egress, third-party API spend. Estimate per month at expected scale.
- **License cost** — new commercial license or seat increase?
- **FinOps tagging** — does the new infra carry the cost-allocation tags (team, product, environment, cost-center)?
- **Threshold approval** — does projected spend cross a budget gate that requires CFO/finance sign-off?
- **Cost at peak vs. steady state** — sized for steady and surprised at peak, or vice-versa? What's the autoscaling story?
- **Wind-down** — if this is replacing something, when does the old system get turned off (and its cost reclaimed)?

### 6. Dependencies & integrations
- **Upstream teams** — whose APIs do we consume? Have they been told? Do interface contracts (rate limits, versioning, schemas) need updating?
- **Downstream teams** — who consumes us? Deprecation window? Migration support?
- **Synchronous vs. async coupling** — adding sync coupling where async would isolate failure?
- **Contract testing** — consumer-driven contract tests in place? Wired into both sides' CI?
- **Vendor / SaaS** — new third-party service? Procurement reviewed? Is there a sub-processor entry to update? (Privacy implications → `/grill-privacy`.)

### 7. Documentation & enablement
- **User-facing docs** — internal docs, customer docs, API reference, change-log entry?
- **Internal training** — does support / CS / sales / SRE need a brief?
- **Knowledge transfer** — is this concentrated in one engineer's head? Bus-factor mitigation?

### 8. Risk register
At the end, force a top-3 risks list. Each: description, likelihood (L/M/H), impact (L/M/H), mitigation, owner, review date.

If the user can't name 3 design risks, the grill hasn't gone deep enough. Common categories: capacity miss, rollback infeasibility, integration drift, on-call burden, cost overrun, vendor lock-in.

## Output: design-review artifact

Write decisions to `docs/design-reviews/<YYYY-MM-DD>-<slug>.md` (or match repo convention — `docs/rfcs/`, Confluence, Notion). Update through the session.

```md
# {Title}

**Status**: Draft | Under review | Approved | Rejected | Superseded
**Author**: {name}
**Date**: {YYYY-MM-DD}
**Approvers required**: Architecture · SRE · Finance · {others as needed}
**Linked**: ADRs, runbook, flag registry, ticket, threat model (from /grill-security), PIA (from /grill-privacy)

## Triage
- Scope: {…}
- Blast radius: {…}
- Reversibility: {…}
- Time pressure: {…}

## Summary
One paragraph. Problem, proposal, expected outcome.

## Decisions
- {Decision} — {rationale} — {date}

## Open questions
- {Question} — owner: {name} — needed by: {date}

## Risks
| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|

## Operational readiness checklist
- [ ] SLO impact assessed
- [ ] Dashboards & alerts in place
- [ ] Runbook drafted
- [ ] On-call briefed
- [ ] Rollback plan documented & tested
- [ ] Capacity verified
- [ ] DR / backup story confirmed
- [ ] Cost estimate attached
- [ ] ADR written (if architectural)
- [ ] OSS license review (if new deps)

## Out of scope
- Security questions → see /grill-security artifact
- Privacy / data questions → see /grill-privacy artifact
- {other explicit non-goals}
```

## Ending the session

Close only when:

1. Every in-scope category is walked or explicitly skipped with reason.
2. The risk register has at least 3 entries.
3. The operational readiness checklist is worked through (ticked or N/A with one-line reason).
4. The required-approvers list is concrete (named teams or individuals).
5. The user has agreed the artifact reflects reality.
6. If security/privacy were tagged in scope, point the user at `/grill-security` and/or `/grill-privacy` before declaring done.
