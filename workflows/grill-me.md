---
description: Orchestrator for the enterprise grill triplet (design / security / privacy). Use when the user wants a full enterprise-grade grilling but isn't sure which axis applies, says "grill me", or is preparing for a multi-axis review (ARB + AppSec + DPO). Picks the relevant axis grills, runs them in the right order, and reconciles their artifacts.
---

# Grill Me (Orchestrator)

Three single-axis grills are available. **Pick what's in scope, run them, then reconcile.**

- [`/grill-design`](./grill-design.md) — scope, architecture fit, reliability/ops, change management, cost, dependencies, documentation. Output: design-review / RFC artifact.
- [`/grill-security`](./grill-security.md) — STRIDE threat model, authn/authz, secrets, attack surface, input handling, crypto, logging/audit, supply chain, incident response. Output: threat model & security review.
- [`/grill-privacy`](./grill-privacy.md) — data inventory, lawful basis, residency, retention, data subject rights, sub-processors, DPIA trigger, breach readiness. Output: PIA (or DPIA if triggered) and ROPA-update notes.

Each emits its own artifact and stands alone. If the user wants a single combined doc, this orchestrator stitches the three together at the end.

## Pre-grill triage

Ask in one round (don't drag it out):

1. **Scope** — internal tool, customer-facing feature, infra change, data pipeline, public API?
2. **Touches personal/regulated data?** — yes / no / not sure (treat "not sure" as yes).
3. **Touches a trust boundary or auth/secrets/crypto/external input?** — yes / no.
4. **Operational footprint** — new SLO, new on-call, schema migration, new vendor cost?

From the answers:

| If yes to… | Run |
|---|---|
| #4 (almost always) | `/grill-design` |
| #3 | `/grill-security` |
| #2 | `/grill-privacy` |

If only one axis is in scope, just invoke that one workflow directly and skip the orchestrator overhead. The orchestrator earns its keep when ≥2 axes are in scope.

## Order

When running multiple, do them in this order — earlier axes feed the later ones:

1. **`/grill-design` first.** It establishes scope, stakeholders, blast radius, and the operational shape. Security and privacy grilling needs that context.
2. **`/grill-security` second.** Threats often surface privacy implications (logged tokens, data exposure paths) that Privacy then has to address.
3. **`/grill-privacy` third.** Privacy mitigations frequently lean on security controls already chosen in step 2.

Don't run them in parallel — the cross-references won't line up.

## Cross-axis reconciliation

After all in-scope grills are done, check for inconsistencies before declaring complete:

- **Threats vs privacy risks** — every privacy residual that involves an attacker should appear (or be ruled out) in the threat model.
- **Retention vs backup story** — privacy retention period must be enforceable given the backup retention from the design grill. Mismatch is a finding, not a footnote.
- **Sub-processor list vs vendor design choice** — if `/grill-design` picked a SaaS vendor, `/grill-privacy` must have updated the sub-processor entry and DPA list.
- **Audit logging** — `/grill-security` defines what's logged; `/grill-privacy` needs to confirm logs that contain personal data have a retention story; `/grill-design` needs the runbook to point at where they live.
- **Approvers** — combined approver list dedup'd: Architecture, SRE, AppSec, DPO, Privacy Counsel, Finance, etc. Each named.

## Optional: combined artifact

If the user wants one document for an ARB / CAB packet, write a top-level brief at `docs/reviews/<YYYY-MM-DD>-<slug>.md` that links to (not duplicates) the three axis artifacts:

```md
# {Title} — Combined Review

**Status**: Draft | Under review | Approved
**Date**: {YYYY-MM-DD}
**Combined approvers**: Architecture · SRE · AppSec · DPO · {others}

## TL;DR
One paragraph. Problem, proposal, key trade-offs, status by axis.

## Scope (from triage)
- {…}

## Axis artifacts
- Design review: [link]
- Threat model: [link] (or "N/A — see triage")
- PIA / DPIA: [link] (or "N/A — see triage")

## Cross-axis findings
- {Finding that emerged from reconciliation}

## Combined risks (top 5)
| Axis | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|

## Combined approvals
| Approver | Axis | Status | Date |
|---|---|---|---|
```

Don't duplicate content from the axis artifacts; link to them. The combined doc is the index, not the source of truth.

## Closing

The orchestrator is done when:

1. Each in-scope axis grill closed cleanly per its own ending criteria.
2. Cross-axis reconciliation is documented (no orphan threats, retention vs backup aligned, sub-processor / vendor / DPA consistent).
3. Combined approver list is named.
4. Either three artifacts or one combined brief exists, per user preference.
