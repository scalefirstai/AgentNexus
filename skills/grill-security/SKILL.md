---
name: grill-security
description: Security grill for enterprise change. Threat-model the proposed change with STRIDE, walk authn/authz, secrets, attack surface, input handling, crypto, logging/audit, supply chain, and incident response; emit a threat model & security review artifact with named approvers, residual risks, and required mitigations. Use when user wants a security review, asks for a threat model, is touching authn/authz/crypto/data, prepares for security sign-off, or mentions "grill security".
---

# Grill Security

Interview the user to produce a threat model and security review for a proposed change. Lean on existing controls — don't invent new ones unless the threat justifies it. Cite Project CodeGuard rules where relevant; the rule files live under [./software-security/rules/](./software-security/rules/).

## Rules of engagement

- **One question at a time.** Wait for the answer.
- **Recommend a default answer.** If you can't, the question isn't ready.
- **Read the room first.** `SECURITY.md`, existing threat models, IAM policies, the codebase via `/code-graph` or `grep`. Cite, don't ask.
- **Push back on hand-waving.** "Trust me, it's safe" → log as an open question with named owner and date.
- **Capture as you go.** Threats, mitigations, residual risks land in the artifact during the session.
- **Severity is required.** Every identified threat needs a likelihood × impact rating. "Bad if exploited" is not a rating.

## Triage

Classify the change before grilling:

1. **Trust boundary** — does this code sit on a boundary (internet → internal, lower-priv → higher-priv, untrusted tenant → shared infra)? If yes, full grill. If purely internal helpers, skip to category 6.
2. **Data sensitivity** — does it process credentials, PII, payment data, regulated data, customer content? Confirms whether categories 3, 6, 7 are mandatory.
3. **Auth changes** — adding/changing authn/authz logic? If yes, category 3 is mandatory.
4. **External dependencies** — new third-party packages, services, or APIs? Category 9 mandatory.
5. **Public exposure** — new internet-facing endpoint, file upload, deserializer, eval-style API? Category 5 mandatory.

Skip categories explicitly with a stated reason. Don't drop silently.

## Categories

### 1. Threat model (STRIDE)
For each STRIDE category that's relevant to the change, ask: "Who could do this, how, and what's the impact?"

- **Spoofing** — can someone pretend to be another user / service / system?
- **Tampering** — can someone modify data, requests, configuration, or build artifacts in transit or at rest?
- **Repudiation** — can someone deny having done something? Is there an audit trail that survives them?
- **Information disclosure** — what does this leak (errors, logs, side channels, response timing, response shape)?
- **Denial of service** — can a single user, a single request, or a single payload exhaust resources?
- **Elevation of privilege** — can a low-priv actor gain higher-priv access via this code?

Pick the top 3 threats overall. Each gets a likelihood (L/M/H), impact (L/M/H), and a primary mitigation.

### 2. Authentication
- **Identity source** — who calls this? End user, internal service, batch job, third-party? How is identity established (session, OAuth, mTLS, signed JWT, API key, IAM role)?
- **Token handling** — where are tokens stored client-side? Server-side validation: signature, issuer, audience, expiry, replay protection?
- **MFA / step-up** — is this a sensitive action that needs step-up auth? See `codeguard-0-authentication-mfa.md`.
- **Session management** — fixation, idle timeout, absolute timeout, sign-out propagation? See `codeguard-0-session-management-and-cookies.md`.
- **Service-to-service** — mTLS, signed tokens, allow-list, mesh-enforced? Are credentials scoped to least-privilege?

### 3. Authorization
- **Decision point** — where is access decided (gateway, service, data layer)? Is it consistent across paths (UI vs API vs admin)?
- **Model** — RBAC, ABAC, ReBAC? New roles or scopes, or reuse existing?
- **IDOR / object access** — does the code check that the caller actually owns / can access the object, not just that they're authenticated?
- **Tenant isolation** — multi-tenant? Are queries scoped by tenant ID at every read and write? Any path that bypasses?
- **Admin / impersonation** — separate admin path? Audited? Time-bounded?
- See `codeguard-0-authorization-access-control.md`.

### 4. Secrets & credentials
- **New secrets** — what, where stored, who has access, how rotated?
- **Hardcoded check** — has the code been scanned for inline secrets? Pre-commit hook in place? See `codeguard-1-hardcoded-credentials.md`.
- **Secret distribution** — env vars, secret manager, KMS-encrypted config? Pulled at startup or rotated live?
- **Logging hygiene** — does any code path log a secret, a token, a session ID, or a PII identifier by accident?
- **Build-time secrets** — CI variables exposed to forks? Container image baked with credentials?

### 5. Attack surface
- **New endpoints** — list them. Authenticated? Rate limited? Body size limited? Documented?
- **Network exposure** — new ingress, new ports, new egress destinations? Firewall / security group updated?
- **File uploads / downloads** — content-type validation, size limits, virus scan, storage isolation, signed URL expiry? See `codeguard-0-file-handling-and-uploads.md`.
- **Deserialization** — any path that accepts serialized data (XML, YAML, pickle, Java/PHP serialize)? See `codeguard-0-xml-and-serialization.md`.
- **Eval-style** — any dynamic code execution, template rendering with untrusted input, shell-out with interpolated args?

### 6. Input handling & injection
- **Input boundaries** — list the trust boundaries where untrusted data enters.
- **Validation strategy** — allow-list at the boundary, type-strict parsing, length/format/range checks?
- **Output encoding** — HTML, SQL, shell, LDAP, NoSQL, JSON: is each sink encoding-aware?
- **SQL** — parameterized queries everywhere? Any string concatenation into queries? See `codeguard-0-input-validation-injection.md`, `codeguard-0-data-storage.md`.
- **Command injection** — any `exec` / `spawn` / `system` with user input?
- **SSRF** — any code that fetches URLs based on user input? URL allow-list, IP/host filter, metadata-endpoint protection?
- **Path traversal** — any file path constructed from user input?

### 7. Cryptography
- **Algorithms** — modern, not custom? See `codeguard-1-crypto-algorithms.md`.
- **Library** — using vetted library, not rolling crypto?
- **Key management** — KMS, HSM, or app-managed? Rotation? Wrap keys with KEKs?
- **Certificate validation** — TLS verification on by default, pinning where required, expiry monitoring? See `codeguard-1-digital-certificates.md`.
- **Hashing passwords** — Argon2 / bcrypt / scrypt with appropriate cost? Never SHA / MD5?
- **Randomness** — cryptographic RNG (`crypto.randomBytes`, `secrets`), not `Math.random`?
- **Post-quantum** — long-lived secrets that need PQ-safe primitives? See `codeguard-0-additional-cryptography.md`.

### 8. Logging, audit, monitoring
- **Audit events** — security-relevant actions (auth success/failure, privilege change, data export, admin action)? Logged with actor, target, time, source IP?
- **Tamper-evident** — audit logs sent to write-once / SIEM, not local-only? See `codeguard-0-logging.md`.
- **PII in logs** — what sensitive data could be logged accidentally? Redaction in place?
- **Detection** — does this generate signals SOC can alert on (failed auth bursts, privilege escalation, anomalous data export)?
- **Retention** — log retention meets compliance requirement (e.g. SOX 7 years, PCI 1 year)?

### 9. Supply chain & dependencies
- **New dependencies** — provenance, maintainership, last release, known CVEs?
- **Lockfile / pinning** — are versions pinned? Hash-pinned for sensitive deps?
- **SBOM** — generated and stored? See `codeguard-0-supply-chain-security.md`.
- **Build pipeline** — CI runs in trusted environment, secrets scoped, artifacts signed?
- **Container base image** — minimal, patched, scanned? See `codeguard-0-devops-ci-cd-containers.md`.
- **Vendor / SaaS** — security review on file? SOC 2 / ISO report reviewed? Sub-processor list updated?

### 10. Incident response & disclosure
- **Detection-to-page path** — if this fails maliciously, who gets paged, in what time, with what signal?
- **Containment** — kill switch, feature flag, IAM revoke, network isolate? Documented in the runbook?
- **Forensics** — can we reconstruct the actor's actions from logs? For how long?
- **External disclosure** — if this leaks, is the comms / legal / customer-notification path defined? Aligns with regulatory clocks (GDPR 72h, others)?
- **Vulnerability reporting** — `SECURITY.md` / disclosure policy in place for this surface? Bug bounty in scope?

### 11. Residual risk register
At the end, list residual risks the change still carries after mitigations. Each: description, likelihood, impact, why it's accepted (or not), owner, review date.

If the residual risk list is empty, you've either fixed everything (rare) or you haven't grilled hard enough. Push back.

## Output: threat model & security review artifact

Write to `docs/security/threat-models/<YYYY-MM-DD>-<slug>.md` (or match repo convention). Update through the session.

```md
# Threat Model: {Title}

**Status**: Draft | Under review | Approved | Rejected
**Author**: {name}
**Date**: {YYYY-MM-DD}
**Reviewers required**: AppSec · {others}
**Linked**: design review (from grill-design), PIA (from grill-privacy), tickets, ADRs

## System under review
- Components: {…}
- Trust boundaries: {…}
- Data sensitivity: {…}

## Threats (top, ranked)
| # | Category (STRIDE) | Threat | Likelihood | Impact | Primary mitigation | Status |
|---|---|---|---|---|---|---|
| 1 | … | … | L/M/H | L/M/H | … | mitigated / accepted / open |

## Mitigations applied
- {Control} — {threats it addresses} — {evidence link}

## Open questions
- {Question} — owner: {name} — needed by: {date}

## Residual risks
| Risk | Likelihood | Impact | Acceptance rationale | Owner | Review date |
|---|---|---|---|---|---|

## Security checklist
- [ ] STRIDE walked for in-scope components
- [ ] AuthN reviewed
- [ ] AuthZ reviewed (incl. IDOR / tenant isolation)
- [ ] No hardcoded secrets (codeguard-1-hardcoded-credentials)
- [ ] Secrets storage & rotation defined
- [ ] Input validation & output encoding at boundaries
- [ ] Crypto uses approved algorithms (codeguard-1-crypto-algorithms)
- [ ] TLS / certificate handling reviewed (codeguard-1-digital-certificates)
- [ ] Audit logging in place for security-relevant actions
- [ ] Logs scrubbed of secrets / PII
- [ ] New dependencies vulnerability-scanned & SBOM updated
- [ ] Incident response path documented
- [ ] Detection signals wired to SOC / SIEM

## Out of scope
- Operational/cost questions → grill-design artifact
- Privacy / lawful-basis questions → grill-privacy artifact
- {other explicit non-goals}
```

## Ending the session

Close only when:

1. Every in-scope category is walked or explicitly skipped with reason.
2. STRIDE produced at least 3 ranked threats with mitigations.
3. The residual risk register is non-empty.
4. The security checklist is worked through.
5. AppSec / security review approvers are named.
6. The user has agreed the artifact reflects reality.

If the change touches privacy or operations, point the user at `/grill-privacy` and/or `/grill-design` before declaring done.
