---
description: Privacy grill for enterprise change. Walk data inventory, classification, lawful basis, residency, retention, data subject rights, sub-processors, DPIA trigger, and breach readiness; emit a privacy impact assessment (PIA/DPIA) and ROPA-update notes with named approvers and residual risks. Use when user is touching personal/regulated data, adding a vendor that processes data, changing retention or transfers, prepares for privacy/DPO sign-off, or mentions "grill privacy".
---

# Grill Privacy

Interview the user to produce a Privacy Impact Assessment (PIA), a Data Protection Impact Assessment (DPIA) entry if triggered, and notes for the Record of Processing Activities (ROPA). This is the privacy / data-protection axis — security threats go to `/grill-security`, operational concerns go to `/grill-design`.

## Rules of engagement

- **One question at a time.** Wait for the answer.
- **Recommend a default answer.** Concrete, citing a regulatory basis where relevant.
- **Read the room first.** ROPA, existing PIAs, data classification policy, retention schedule, sub-processor list, data flow diagrams. If documented, cite — don't ask.
- **Push back on hand-waving.** "It's not really PII" → the question is whether the regulator agrees. Log as open with named owner.
- **Capture as you go.** Data inventory, lawful bases, transfers, residual risks land in the artifact during the session.
- **Personal data is broader than you think.** IP address, device ID, account ID, behavioural signals, derived inferences — in many regimes these are personal data. Don't waive a category because the data "doesn't have names".

## Triage

Classify before grilling:

1. **Personal data?** — does the change collect, store, derive, infer, or transmit data linked or linkable to a person? If no (truly), most categories collapse — but verify with category 1 first.
2. **Special category data?** — health, biometrics, genetic, racial/ethnic, religious, political, sexual orientation, children's data? GDPR Art 9 / similar. If yes, full grill is mandatory.
3. **New data subjects** — adding a new population (employees, candidates, end users in a new jurisdiction)? Triggers lawful-basis and ROPA review.
4. **Cross-border transfer** — does data leave the country / region of collection? Triggers transfer-mechanism review (SCCs, adequacy, BCRs).
5. **New processor / sub-processor** — adding a third party that handles personal data? Triggers DPA + sub-processor list update.
6. **Automated decision-making** — does this make decisions with legal or significant effect on a person (credit, hiring, pricing, content moderation enforcement)? Triggers GDPR Art 22 / similar review.

A "yes" to #2, #4, #5, or #6 generally triggers a DPIA, not just a PIA. Confirm with your DPO.

## Categories

### 1. Data inventory & classification
- **What data** — list every field/attribute being collected, derived, stored, or transmitted. Be exhaustive; this is the inventory.
- **Source** — direct from user, observed (logs, telemetry), derived (inferences, scores), purchased / received from third party?
- **Classification** — for each: public, internal, confidential, restricted; PII / sensitive PII / special category; payment / health / regulated?
- **Identifiability** — direct identifier, indirect identifier, pseudonymous (with key), anonymised (irreversibly)? Does the combination re-identify even if individual fields don't?
- **Volume & scale** — how many data subjects, how many records per subject, how often updated?

### 2. Purpose & lawful basis
For each data field or processing activity:
- **Purpose** — specific, explicit, legitimate. Not "improve product"; *which* improvement, measured how?
- **Lawful basis** (GDPR Art 6 / equivalents):
  - Consent — opt-in, granular, withdrawable, recorded, not a precondition for unrelated service?
  - Contract — necessary to perform the contract the subject entered?
  - Legal obligation — which law, which clause?
  - Vital interests — life-or-death scenarios; rarely the right basis for tech.
  - Public task — public authority context.
  - Legitimate interest — documented LIA (Legitimate Interest Assessment) showing the interest, necessity, and balance against subject rights?
- **Special category basis** — Art 9 has its own list; explicit consent, employment law, vital interest, public health, etc. Pick correctly.
- **Children's data** — under-16/13 thresholds, parental consent, age-gate?

### 3. Data minimisation
- **Need everything?** — for each field, is it strictly necessary for the stated purpose? Drop, hash, tokenise, or aggregate anything you can?
- **Granularity** — can date-of-birth be a year? Can IP be truncated? Can geolocation be city-level instead of GPS?
- **Synthetic / sample data** — for non-prod environments, are we using prod data? If yes, why, and is it scrubbed/synthesised?

### 4. Residency & cross-border transfer
- **Where stored** — primary, replica, backup, cache, log destination, monitoring tool, support tool? Each is a location.
- **Where processed** — compute regions, employee access geographies, sub-processor regions?
- **Transfer mechanism** — for each cross-border path: adequacy decision, SCCs (with TIA — Transfer Impact Assessment), BCRs, derogation, explicit consent?
- **Government access risk** — TIA covers third-country government access (post-Schrems II)? Encryption-at-rest with keys held outside that jurisdiction?

### 5. Retention & deletion
- **Retention period** — how long, justified by which purpose / legal obligation?
- **Trigger** — what event starts the clock (collection, last activity, account closure, contract end)?
- **Deletion mechanism** — actual hard delete, soft delete with purge job, anonymisation? Across all stores (primary, replica, backup, archive, log, search index, cache, third party)?
- **Backup retention** — backups age out independently? Does the deletion request reach backup or only forward state?
- **Legal hold override** — process for pausing deletion under litigation hold, regulatory request?

### 6. Data subject rights
For each right that applies in the relevant regime (GDPR, CCPA/CPRA, LGPD, etc.):
- **Access** — can the user export their data? Is the export complete (across systems) and human-readable?
- **Rectification** — can they correct data? Does correction propagate to derived data?
- **Erasure / deletion** — supported in the existing DSAR flow, or new tooling needed?
- **Restriction** — can processing be paused without deletion?
- **Portability** — machine-readable export?
- **Objection** — opt-out for legitimate-interest processing, marketing, profiling?
- **Automated decision rights** — Art 22: right to human review, explanation, contest?
- **Sale / sharing opt-out** — CCPA/CPRA "Do Not Sell or Share" honoured?
- **Response time** — within statutory window (e.g. 1 month under GDPR, 45 days CPRA)?

### 7. Third parties, processors, sub-processors
- **Roles** — for each third party: controller, joint controller, processor, sub-processor? Document the role (it determines liability and obligations).
- **Contracts** — DPA / Art 28 clauses in place? Sub-processor consent flow if your contract with the customer requires advance notice?
- **Sub-processor list** — public list updated? Customers notified per contract?
- **Onward transfers** — sub-processor transfers data further? Are those covered?
- **Audit rights** — can you actually exercise them? Have they been exercised?

### 8. DPIA trigger check (GDPR Art 35 and equivalents)
A DPIA is required when processing is "likely to result in a high risk to the rights and freedoms of natural persons". Triggers include:
- Systematic and extensive profiling with legal/significant effect
- Large-scale processing of special category or criminal data
- Systematic monitoring of publicly accessible area
- New tech use that hasn't been assessed before
- Processing children's data at scale
- Cross-border transfer with elevated risk

If any trigger fires, this PIA escalates to a DPIA and the DPO must sign off. Document the trigger and the escalation in the artifact.

### 9. Security of processing
Lean on `/grill-security` for depth, but confirm the privacy-relevant controls are in place:
- **Encryption** — at rest, in transit, key management?
- **Access controls** — least privilege, role-based, audited?
- **Audit logs** — access to personal data logged, monitored, retained per policy?
- **Pseudonymisation** — applied where it reduces risk without breaking functionality?
- **Resilience** — backup + restore tested, incident response plan covers data?

### 10. Breach readiness
- **Detection** — can we detect a personal-data breach within hours, not weeks?
- **Notification clock** — GDPR 72h to supervisory authority; awareness of state/regional clocks (US states, India, etc.)?
- **Subject notification** — trigger threshold, template, comms channel?
- **Breach register** — internal log of incidents (notifiable or not) maintained?
- **Insurance / vendor coverage** — cyber policy aware of this processing scope?

### 11. Marketing & cookies (only if relevant)
- **Cookie banner / consent management** — granular, blocking-by-default for non-essential, evidence retained?
- **Marketing opt-in / opt-out** — separate from service consent, double-opt-in where required?
- **Analytics provider** — first-party vs third-party, anonymised, IP-truncated, transfer story clean?

### 12. Residual risk register
Privacy residual risks: where is rights/freedom of subjects still at risk after mitigations? Each: description, likelihood, impact on subjects (not on the business), mitigation, owner, review date, acceptance rationale.

If empty, you haven't grilled hard enough. Common residuals: re-identification risk in published aggregates, vendor government-access risk, retention misalignment in backups, profiling with weak human-review path.

## Output: PIA / DPIA artifact

Write to `docs/privacy/pia/<YYYY-MM-DD>-<slug>.md` (or DPIA if triggered; match repo convention). Update through the session.

```md
# {PIA | DPIA}: {Title}

**Status**: Draft | Under review | Approved | Rejected
**Author**: {name}
**Date**: {YYYY-MM-DD}
**Approvers required**: DPO · Privacy Counsel · {AppSec, Eng leadership as needed}
**Linked**: design review (from grill-design), threat model (from grill-security), ROPA entry, DPA(s), sub-processor list, tickets

## Triage outcome
- Personal data: yes/no — {summary}
- Special category: yes/no
- Cross-border: yes/no
- New processor/sub-processor: yes/no
- Automated decision-making: yes/no
- DPIA trigger fired: yes/no — {which}

## Data inventory
| Field / attribute | Source | Classification | Identifiability | Volume |
|---|---|---|---|---|

## Purpose & lawful basis
| Purpose | Lawful basis | Notes (LIA, consent flow, Art 9 basis) |
|---|---|---|

## Data flow
{Sketch or describe: collection → processing → storage → transfer → deletion}

## Transfers
| From | To | Mechanism (SCC/adequacy/etc) | TIA needed? | TIA result |
|---|---|---|---|---|

## Retention
| Data | Retention period | Trigger | Deletion mechanism |
|---|---|---|---|

## Data subject rights
| Right | Supported? | Mechanism / ticket |
|---|---|---|

## Third parties
| Party | Role | DPA in place | Sub-processor list updated |
|---|---|---|---|

## Residual risks
| Risk to subjects | Likelihood | Impact | Mitigation | Acceptance rationale | Owner | Review date |
|---|---|---|---|---|---|---|

## Privacy checklist
- [ ] Data inventory complete
- [ ] Lawful basis documented for every purpose
- [ ] Special category basis documented (if applicable)
- [ ] Data minimisation applied
- [ ] Residency confirmed; transfers covered by mechanism
- [ ] Retention defined and enforceable across all stores (incl. backups)
- [ ] Data subject rights mechanisms tested
- [ ] DPA / sub-processor list updated
- [ ] DPIA escalation documented (if triggered)
- [ ] Breach detection / notification path defined
- [ ] ROPA entry created or updated

## Open questions
- {Question} — owner: {name} — needed by: {date}

## Out of scope
- Security threats / mitigations → grill-security artifact
- Operational / cost questions → grill-design artifact
- {other explicit non-goals}
```

Also: if the change requires it, prepare the ROPA delta — fields, purposes, recipients, retention, transfers, security measures.

## Ending the session

Close only when:

1. Data inventory is complete and classified.
2. Every purpose has a documented lawful basis (and Art 9 basis if special category).
3. Every transfer is covered by a transfer mechanism.
4. Retention and deletion are defined and enforceable.
5. Data subject rights mechanisms are confirmed (or new tickets raised).
6. DPIA trigger check is documented; if triggered, DPO is named and notified.
7. Residual risk register is non-empty.
8. ROPA entry is queued for update.
9. The user has agreed the artifact reflects reality.

If the change touches operations or security, point the user at `/grill-design` and/or `/grill-security` before declaring done.
