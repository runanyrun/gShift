# Hybrid Workforce Vision (V2)

This document defines the V2 product vision for qShift's hybrid workforce model. It is intentionally limited to product and architecture guidance. It does not require immediate implementation, does not modify the current database, and must be treated as a forward-looking reference for future planning.

## Vision Summary

qShift V2 should support a hybrid workforce operating model where a company can coordinate both internal staff scheduling and external marketplace-driven shift fulfillment through a single canonical shift framework.

The target outcome is a platform that:

- preserves internal workforce planning as the system of record for employer-managed shifts
- introduces a controlled marketplace layer for flexible worker sourcing
- allows worker mobility across employer-assigned, self-claimed, and partner-supplied labor scenarios
- avoids duplicating scheduling concepts across separate product tracks
- keeps V1 operational paths stable while enabling a clean V2 expansion path

The core design principle is separation of concerns: a shift remains the canonical operational object, while assignment source, worker classification, verification depth, and access surface are modeled as policy layers around that object.

## Canonical Shift Model

V2 should continue to treat the shift as the primary business entity. Internal scheduling and marketplace distribution should not create separate shift primitives. Instead, both should resolve to the same canonical shift model with additional routing and fulfillment metadata.

The canonical shift should conceptually include:

- shift identity: stable shift ID, tenant ownership, location, role, start and end times
- operational requirements: headcount, required skills, compliance prerequisites, pay or billing metadata
- fulfillment mode: internal-only, marketplace-eligible, or hybrid fallback
- assignment state: unassigned, reserved, assigned, confirmed, checked-in, completed, canceled
- sourcing metadata: whether the assigned worker came from internal staff, external marketplace, partner supply, or reassignment

This approach reduces future technical debt because:

- reporting can aggregate all labor demand from one source model
- conflict checking can operate against one scheduling object
- reassignment logic can move workers between sourcing channels without recreating shifts
- auditability remains centered on one timeline per shift

In V2, the canonical shift model should be extended at the application and domain layer first. Database changes, if needed later, should be introduced only after the model is validated in product and workflow design.

## Worker vs Employee Separation

V2 should explicitly separate "employment relationship" from "work eligibility."

An employee is a worker with a formal relationship to a tenant. A worker is a broader identity that can be eligible to perform shifts through one or more channels. This distinction is essential to support mobility without forcing every participant into an employee record.

Recommended conceptual separation:

- worker: portable identity representing a person who may perform labor on the platform
- employee: tenant-scoped relationship describing internal employment or direct staffing status
- assignment eligibility: policy decision that determines whether a given worker can fill a given shift for a given tenant

Expected benefits:

- internal employees remain first-class for company-owned scheduling
- marketplace workers can exist without being modeled as tenant employees
- a single person can hold different relationships with different tenants over time
- partner labor and contractor scenarios can be supported without overloading the employee construct

This separation should be treated as a domain design rule in V2 documentation, even if V1 continues to rely on a simpler tenant-scoped user model.

## Skill Ownership & Verification Levels

V2 should treat skills as portable worker attributes, while verification remains contextual and trust-based.

The recommended model is:

- skill ownership: a worker-level declaration that a person holds a capability
- tenant endorsement: a company-level validation that the worker is trusted for that skill in that tenant's context
- document-backed verification: evidence-based validation such as license, certificate, or training proof
- platform verification: a stronger trust layer created through repeatable compliance checks

Suggested verification levels:

1. Self-declared
   Worker claims the skill. Suitable for low-risk discovery and marketplace visibility, but not sufficient for regulated shifts.
2. Tenant-confirmed
   A tenant has reviewed or used the worker for the skill. Suitable for operational trust inside a known company context.
3. Document-verified
   Supporting documentation has been reviewed. Suitable for higher-risk roles requiring auditable evidence.
4. Platform-certified
   The platform or an approved integration has validated the credential lifecycle and status. Suitable for the strongest compliance paths.

This layered model prevents the system from tying skills too tightly to one tenant while still allowing tenant-specific trust decisions.

## Availability & Conflict Rules

V2 should preserve one conflict engine regardless of sourcing channel. A worker must not be double-booked simply because shifts originate from different product surfaces.

Core planning rules:

- a worker cannot hold overlapping confirmed assignments across all active shift sources
- reserved assignments should create temporary holds with explicit expiration
- internal employer-assigned shifts should have higher default priority than open marketplace invitations, unless overridden by policy
- compliance blocks must prevent assignment when required skill or verification thresholds are not met
- travel, buffer, or site transition constraints should be modeled as configurable policy rules, not hardcoded assumptions

Availability should be interpreted through layered inputs:

- declared availability: worker-entered working windows
- employment availability: employer-defined expected schedule or contract constraints
- assignment availability: current confirmed or reserved shift commitments
- policy availability: legal rest periods, location limits, or tenant restrictions

When conflicts occur, V2 should prefer deterministic resolution:

- reject lower-priority claims automatically where policy is clear
- route ambiguous conflicts into manual review
- maintain an audit trail of why an assignment was blocked, replaced, or downgraded

## Hybrid Scenarios (3 examples)

### 1. Internal-first with marketplace fallback

A tenant creates a shift for a front-desk role. The shift is initially offered only to internal employees. If the shift remains unfilled within a configurable cutoff window, it becomes marketplace-eligible. The shift record remains the same; only the fulfillment mode changes.

Why it matters:

- preserves the employer's preference for internal coverage
- avoids duplicate shift creation
- enables automated escalation without changing reporting semantics

### 2. Portable worker with tenant-specific trust

A worker has self-declared barista and cashier skills. Tenant A has previously confirmed both skills, while Tenant B requires document verification for cashier work. The same worker can appear as broadly eligible in discovery, but assignment outcomes differ by tenant policy and verification threshold.

Why it matters:

- supports portable labor supply
- keeps trust decisions local to the tenant
- avoids incorrectly treating all skill assertions as universally valid

### 3. Employee by day, marketplace worker by exception

A person is an employee of Tenant A and is scheduled internally on weekdays. On weekends, that same person accepts marketplace shifts from Tenant B. The platform should treat this as one worker identity with two different participation modes. Conflict rules still apply across both contexts.

Why it matters:

- reflects realistic multi-role workforce behavior
- reduces identity fragmentation
- allows cross-tenant labor mobility without breaking internal scheduling controls

## Portal Access Strategy

V2 should expose access by role surface, not by forcing all actors into the same portal experience.

Recommended long-term access surfaces:

- employer portal: workforce planning, shift creation, internal staffing, approvals, compliance controls
- worker portal: shift discovery, availability, skill profile, claims, confirmations, schedule visibility
- marketplace operations surface: optional future layer for moderation, verification, dispute handling, and fulfillment oversight

Access strategy principles:

- users should see the surface aligned with their active relationship and permissions
- the same underlying identity may access multiple surfaces if policy allows
- surface access should be policy-driven and composable rather than implemented as isolated account silos
- V1 authentication flows should remain stable while V2 adds role-aware routing and capability gating

This reduces the risk of rebuilding auth and navigation multiple times as the product expands.

## Risks & Safeguards

Key V2 risks:

- domain overlap between employee records and portable worker identities
- inflated complexity if marketplace workflows are embedded directly into V1 internal scheduling paths
- compliance failure if skill trust is treated as binary or global
- assignment conflicts caused by fragmented visibility across internal and external scheduling channels
- permission sprawl if portal access is added without a clear capability model

Recommended safeguards:

- keep shift as the canonical unit and model sourcing as metadata, not a second scheduling entity
- define worker identity, employee relationship, and assignment eligibility as separate concepts
- adopt explicit verification levels rather than a single "verified" flag
- centralize conflict evaluation in one scheduling rules layer
- gate V2 behaviors behind feature flags or roadmap-only design boundaries until the data model is ready
- document policy decisions before schema expansion to avoid irreversible V1 shortcuts

## V1 vs V2 Scope Separation

V1 should remain focused on tenant-safe internal scheduling and core workforce management. V2 should be documented as an additive expansion, not an implicit redefinition of existing behavior.

V1 in-scope:

- tenant-owned shifts
- tenant-scoped users and employee-like scheduling behavior
- direct assignment and schedule visibility inside one employer context
- current auth, routing, and reporting assumptions

V2 roadmap-only:

- portable worker identity beyond a single tenant relationship
- marketplace discovery and claim flows
- multi-source fulfillment on the same shift
- layered skill verification and trust policies
- cross-tenant worker mobility with unified conflict checking
- role-surface expansion beyond the current internal portal

This separation is necessary to protect current delivery velocity and prevent hidden architectural rewrites under V1 features.

## Migration Considerations

If the database evolves in the future, migration should be handled as an incremental decomposition of responsibilities rather than a disruptive rewrite.

Recommended migration posture:

- preserve the current V1 schema as the operational baseline until V2 concepts are validated in product design
- introduce new entities only when they represent durable domain boundaries, not temporary UI needs
- prefer additive schema changes and compatibility layers over renaming or overloading existing tables
- maintain backward-compatible reads during transition periods
- keep auditability and tenant safety as non-negotiable constraints

Likely future migration themes:

- separating portable worker identity from tenant-specific employment records
- introducing skill evidence and verification state as independent data concerns
- capturing fulfillment source and assignment lifecycle in a way that does not break existing shift history
- expanding conflict evaluation inputs without weakening current tenant isolation guarantees

Migration should proceed in phases:

1. Domain clarification
   Finalize V2 concepts and state transitions in documentation before schema work begins.
2. Additive modeling
   Introduce new tables or relations alongside V1 structures, with adapters where needed.
3. Controlled adoption
   Enable V2-specific workflows behind flags and validate operational semantics before broad rollout.
4. Consolidation
   Retire duplicate logic only after reporting, policy, and audit paths are proven stable.

The main architectural rule is simple: future schema changes should formalize already-proven domain boundaries, not attempt to discover them mid-migration.
