# SPDD Analysis: Authorise a Mid-Contest Configuration Change (STORY-001-027)

## Original Business Requirement

> Source: `docs/user-stories/02-contest-director.md` §3 (mid-contest) ·
> `docs/requirements/high-level-requirements.md` Area 3 (Competition Setup &
> Configuration, 3.5–3.8) · `docs/requirements/decisions.md` D1 (authority
> recorded, not enforced), D4 (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §3–5 (normalisation, final
> classification) · builds on STORY-001-025 (Start Proceedings — the
> configuration-authority boundary) and STORY-001-024 (lifecycle state)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

STORY-001-025 established **where** the configuration-authority boundary sits:
before Start Proceedings, scoring/running configuration (3.5–3.8) is freely
editable; after Start, any such change requires Contest-Director authority and is
recorded in the event log. STORY-001-025 wired that boundary into task
configuration (3.7) only, and its scope-out explicitly deferred **what a
post-Start change actually does** to the owning stories. This story delivers that
behaviour for the general case: the **authorisation flow** a mid-contest
configuration change runs through, and the **recompute consequences** stated
before it applies.

The problem it solves is silent rescoring. If a wrong target time is discovered
in round 3 and simply corrected, every already-flown round could be re-normalised
underneath the field without anyone deciding that should happen. This story makes
that impossible: after Start, a change to draw options, scoring options, task
rules or field-aid timings (3.5–3.8) does **not take effect without the Contest
Director's authorisation**, and before it applies the system **states which
rounds' scores would recompute**. The default is forward-only — the change
applies **from the next round onward**; recomputing already-flown rounds happens
only on the Contest Director's **explicit opt-in**, never silently. Every change,
authorisation and refusal lands in the immutable event log (D4) so the result
stays defensible, and a change that would **contravene a class rule** warns before
it is authorised (the same guardrail as the Organiser's setup-time
STORY-001-007).

This is distinct from a **manual score override** (Area 5.8), which corrects a
captured value rather than the rules it was scored under; and from **roster
changes** after the draw, which are handled by retirement (STORY-001-030), not
here.

### Business Value

- Provide the Contest Director with a single gate through which every mid-contest
  configuration change passes, so already-flown rounds are never silently
  rescored.
- Support an informed decision: the recompute consequences are stated *before*
  anything applies, so the Contest Director sees exactly which rounds are at risk.
- Enable a defensible result — every mid-contest change, and the authority under
  which it was made or refused, is on the immutable record.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-025 (Start Proceedings and the past-Start
  configuration-authority predicate this story shares), STORY-001-024 (lifecycle
  state — the change flow runs only in Running), STORY-001-007 (scoring
  computation and its class-rule guardrails), the owning configuration stories for
  each 3.5–3.8 area (which fields exist to change).
- **Data assumptions**: which rounds are already flown is derivable from the event
  log (D4); actor identity arrives with the request (companion name-pick) and
  Contest-Director authority is **recorded, not enforced** (D1); the class model
  (STORY-001-016) supplies the rule constraints a change is checked against.
- **Integration points**: shares STORY-001-025's past-Start predicate; a
  recompute of flown rounds invokes the same normalisation/aggregation path as any
  other recompute (STORY-001-007); driven from the companion app, base is
  headless.
- **Business constraints**: the rule docs under `docs/requirements/rules/` are
  authoritative and read-only — a change that contravenes them is wrong, not the
  rule; class-agnostic core (CLAUDE.md); offline-first (D6).

### Scope In

- **The authorisation gate**: after Start, any change to scoring/running
  configuration (draw options, scoring options, task rules, field-aid timings —
  3.5–3.8) is held pending Contest-Director authorisation and does not take effect
  without it.
- **The recompute-consequences statement**: before a proposed change applies, the
  system states **which rounds' scores would recompute** as a consequence.
- **Forward-default with explicit opt-in**: an authorised change applies from the
  **next round onward** by default; recomputing **already-flown rounds** happens
  only on the Contest Director's explicit opt-in, and when opted in the affected
  groups re-normalise and round/final scores update consistently.
- **Class-rule guardrail**: a proposed change that would contravene a class rule
  warns before it can be authorised.
- **Audit**: every mid-contest change, authorisation and refusal is recorded in
  the immutable event log with the acting person and authority.

### Scope Out

- **The location of the boundary** (Setup vs Running) and the Start action itself
  — STORY-001-025; this story assumes the boundary and only defines what a change
  past it does.
- **The specific fields and validation of each configuration area** (which draw
  options, which task rules) — the owning 3.5–3.8 configuration stories; this
  story is the authorisation/recompute wrapper around them.
- **The normalisation and aggregation arithmetic** a recompute triggers —
  STORY-001-007 and the class model (STORY-001-016); this story decides *whether
  and which* rounds recompute, not the maths.
- **Manual score override** (Area 5.8) and **roster/retirement** changes
  (STORY-001-030) — different mutation classes, not configuration changes.
- Enforcing that only a Contest Director may authorise (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: A post-Start configuration change is held pending authorisation
**Given** a Running F5J competition in which round 3 has been flown, and a wrong
target working time is discovered on a task
**When** anyone attempts to change that task's working time (3.7)
**Then** the change does **not** take effect on its own — it is held pending the
Contest Director's authorisation, and the same change made before Start would have
required no authorisation.

#### AC2: The recompute consequences are stated before anything applies
**Given** a proposed change to a scoring option after 3 rounds have been flown
**When** the Contest Director reviews it
**Then** the system states which rounds' scores would recompute as a consequence
(e.g. "rounds 1–3 would re-normalise if applied to flown rounds") **before**
anything is applied, so the decision is made with the consequence in view.

#### AC3: An authorised change applies forward-only by default
**Given** the Contest Director authorises a change without opting in to recompute
flown rounds
**When** the change applies
**Then** it takes effect **from the next round onward** (round 4 in a
3-rounds-flown contest) and the already-flown rounds' scores are **unchanged**.

#### AC4: Recomputing flown rounds happens only on explicit opt-in
**Given** the Contest Director authorises the same change **and** explicitly opts
in to recompute the already-flown rounds
**When** the change applies
**Then** the affected groups in the flown rounds re-normalise (best raw result =
1000) and the affected pilots' round and final scores update consistently — and
absent that explicit opt-in, no flown round is ever recomputed silently.

#### AC5: Every mid-contest change is recorded and attributable
**Given** any mid-contest change — whether authorised (forward-only or with
flown-round recompute) or refused
**When** the event log is examined
**Then** the change, the decision and the acting person with Contest-Director
authority are recorded, so the result stays defensible (D4).

#### AC6: A change that contravenes a class rule is warned
**Given** a proposed mid-contest change that would set a value outside what the
class rule permits (e.g. a landing-bonus table the class does not allow)
**When** the Contest Director reviews it
**Then** the system warns that the change would contravene the class rule before
it can be authorised — the rule docs are authoritative (same guardrail as
STORY-001-007).

#### Non-Functional Expectations
- The gate, the consequence statement and any recompute carry no knowledge of any
  specific competition class — the rule constraints and normalisation come from
  the class model (CLAUDE.md class-model law, NFR-1/NFR-2).
- The change flow operates entirely on the base with no internet connection
  (offline-first, D6).

### INVEST Check

Independent (an authorisation/recompute wrapper over STORY-001-025's boundary and
STORY-001-007's scoring) · Valuable (guarantees no silent rescoring of flown
rounds — the whole point of gating mid-contest change) · Small (4 days, 3
functional points: the authorisation gate, the recompute-consequence statement +
forward-default/opt-in, the class-rule guardrail + audit) · Testable (held
change, stated consequence, forward-vs-opt-in outcomes and the logged record are
all observable).

---

## Domain Concept Identification

The codebase is a TypeScript npm-workspaces monorepo (Node ≥ 22): a headless
Fastify **base** (`apps/base`, authoritative, event-sourced), a Vite **companion**
client (`apps/companion`), and a shared vocabulary package (`packages/shared`).
Persistence is an **append-only event store** with in-memory **projections** that
fold events into read models — there is no mutable relational schema; "tables" are
event types and their derived projections. This story lives almost entirely in the
base, layered over the STORY-001-025 config-authority boundary and the
STORY-001-007/011 scoring recompute.

The single most consequential codebase fact for this story: **group scores are
computed purely on demand** (`ScoringService.getGroupScore`) from the *current*
class model + saved config overlay, and are **never stored** (D4 — "never a stored
fact"). Nothing pins the config a flown round was scored under. This is what makes
"silent rescoring" the real hazard the story names, and it is the pivot around
which the forward-only-default behaviour (AC3/AC4) must be designed.

### Existing Concepts (from codebase)

- **Config-authority boundary / `StartStateProvider`** (`competitions/
  state-providers.ts`, `task-config/service.ts`): the injected, class-agnostic
  `isStarted(competitionId)` predicate. Today the task-config `update` consults it
  purely to *stamp* `authority: "contest-director"` on the appended
  `taskConfig.updated` event — **record-only**: the base applies the change
  immediately and rejects nothing (D1). This story replaces "immediately apply,
  stamp authority" with "hold pending authorisation, then apply" — the deferred
  behaviour STORY-001-025 handed off.
- **Task-config surface (3.7)** (`task-config/service.ts`, `projection.ts`): the
  one 3.5–3.8 config surface that exists today (base target times, per-round
  overrides, NLH). The concrete witness for AC1/AC6. Note it already carries a
  **per-round override** notion (`roundOverrides` keyed by round) — an existing
  precedent for round-scoped configuration values.
- **Scoring recompute** (`scoring/service.ts`): `getGroupScore` composes captured
  results + effective group composition + class model, then which-score-counts and
  normalisation — pure, on-demand, class-agnostic. The recompute path AC4 re-runs;
  this story decides *whether/which* rounds feed it, not the maths.
- **Class-rule guardrail** (`task-config/service.ts` cross-aggregate validation;
  STORY-001-007 analysis): the established pattern of validating a proposed config
  value against the sibling class model (`PerRoundOverrideNotAllowedError`,
  `NlhNotApplicableError`, `TaskNotFoundError`). AC6 is the mid-contest
  reincarnation of exactly this guardrail.
- **Contest Class Model** (`class-models/projection.ts`, `packages/shared/
  class-model.ts`, D12): the read-only source of rule constraints a change is
  checked against and the normalisation basis a recompute reads. Class-agnostic
  law: the gate never branches on discipline.
- **Event log / EventStore + Attribution** (`eventstore/event-store.ts`,
  `packages/shared/attribution.ts`, D4/D1): append-only source of truth; every
  event carries `actorName`, `originClient`, `authority`. AC5's audit vehicle,
  already in place.
- **Lifecycle state / guard** (`lifecycle/projection.ts`, `guard.ts`, D10): the
  change flow runs only in `Running`; "which rounds are already flown" derives
  from `competition.roundAdvanced` folded in the lifecycle projection
  (`completedRoundCount`) — though note the round-advance emitter is not yet built
  (see Technical Risks).
- **Approval-pending precedent** (`scoring/service.ts`
  `scoring.annulmentOverrideRequested`, `approvalStatus:
  "pending-contest-director-approval"`; STORY-001-028): an existing "held pending
  Contest-Director approval" fact shape and the decision layer over it — a direct
  structural analogue for this story's hold-then-authorise flow.

### New Concepts Required

- **Proposed configuration change (held/pending)**: a mid-contest config edit that
  is *recorded as proposed* but not yet effective — the gate that makes AC1 true.
  Distinct from today's immediately-applied `taskConfig.updated`. Relates to the
  existing config surfaces (it wraps them) and to the pending-approval precedent
  above.
- **Recompute-consequence statement**: a pre-authorisation, read-only projection
  of "which flown rounds would re-normalise if this change were applied to them" —
  computed from the set of flown rounds and the change's scope, stated *before*
  anything mutates (AC2). A pure query, not a stored fact.
- **Authorisation decision (with recompute scope)**: the Contest-Director act that
  resolves a pending change — authorise-forward-only (default) or
  authorise-with-flown-round-recompute (explicit opt-in) or refuse — each an
  attributed event (AC3/AC4/AC5).
- **Effective-from / round-scoped applicability of a config value**: the mechanism
  by which an authorised change takes effect "from the next round onward" without
  disturbing flown rounds (AC3). Because scores are recomputed on demand from
  current config, honouring forward-only *requires* the config a round is scored
  under to be resolvable per round (effective-dating), not a single mutable current
  value. The existing `roundOverrides` notion is a partial precedent; this
  generalises it to "the config in force as of round N".

### Key Business Rules

- **Post-Start config change is held, not auto-applied** (AC1): the mutation does
  not take effect until an authorisation decision resolves it. Pre-Start, the same
  edit applies freely (the STORY-001-025 boundary).
- **Consequences are stated before mutation** (AC2): the flown-rounds-affected set
  is presented before any event that changes scoring is appended.
- **Forward-only is the default; flown-round recompute is opt-in only** (AC3/AC4):
  an authorised change applies from the next round; flown rounds re-normalise only
  on explicit opt-in — *never* silently. This is the invariant the whole story
  exists to guarantee.
- **A change that contravenes a class rule warns before authorisation** (AC6): the
  rule docs / class model are authoritative; the guardrail is the same one
  STORY-001-007 applies at setup time, re-run at mid-contest.
- **Every change, decision and refusal is attributable** (AC5): recorded with the
  acting person and contest-director authority (D4/D1).
- **Class-agnostic** (CLAUDE.md law): the gate, the consequence statement and the
  recompute read the class model for constraints/normalisation but never branch on
  discipline.
- **CD authority is recorded, not enforced** (D1): the "hold pending
  authorisation" is a two-step *workflow* (propose → authorise), not access
  control — the base does not verify the authoriser is a CD.

---

## Strategic Approach

### Solution Direction

- Build this story as an **authorisation/recompute wrapper** that sits over the
  existing config surfaces rather than inside each one: a proposed change is
  recorded as a pending fact, the consequence statement is a pure query over the
  flown-rounds set and the change scope, and an authorisation decision event
  resolves the pending fact into an effective change (forward-only) or an effective
  change plus flown-round recompute (opt-in). This mirrors the existing
  **propose → pending-CD-approval → decide** shape already used for the F3B
  annulment override (STORY-001-028), reusing a proven idiom.
- Realise forward-only default by **making a config value's applicability
  round-scoped** — the config in force "as of round N" is resolvable, so an
  authorised-forward change becomes effective from `nextRound` and flown rounds
  keep recomputing under the value they were flown with. Generalise the existing
  `roundOverrides` precedent rather than inventing a parallel mechanism. The
  opt-in path simply extends the change's effective range back over the named
  flown rounds, after which the *existing* on-demand recompute (`getGroupScore`)
  naturally reflects it — no separate recompute engine.
- Keep the boundary/authority decision in the **shared `StartStateProvider` seam**
  (no lifecycle import), and keep the class-rule guardrail as the **same
  cross-aggregate validation** STORY-001-007 established, invoked at proposal
  review time.

### Key Design Decisions

- **Config values become effective-dated (round-scoped) vs. a single mutable
  current value**: trade-off is added modelling complexity (a config read must
  resolve "as of round N") against the fact that the current single-current-value +
  on-demand recompute design *cannot* express "flown rounds unchanged" at all — any
  edit would silently re-normalise every round on the next read, which is precisely
  the hazard AC3 forbids. **Recommended**: effective-dating is effectively mandatory
  to satisfy AC3/AC4; the `roundOverrides` precedent shows the model already leans
  this way.
- **Hold-then-authorise as a workflow, not enforcement** (AC1 vs D1): trade-off is
  that the gate does not *prevent* a non-CD from authorising (D1: authority
  recorded, not enforced) — it only ensures a distinct authorisation *act* exists
  and is logged. **Recommended and correct** for the club trust model; matches the
  explicit Scope Out and the STORY-001-028 precedent.
- **Consequence statement as a pure pre-mutation query** (AC2): trade-off is it
  must stay perfectly consistent with what the opt-in recompute actually touches.
  **Recommended**: derive both from one "affected flown rounds" function so the
  stated consequence can never disagree with the applied effect (same
  single-source discipline STORY-001-025 used for its outstanding-items list).
- **Wrapper over config surfaces, not per-surface reimplementation**: trade-off is
  each 3.5–3.8 surface must route its post-Start edits through the wrapper as it is
  built (only 3.7 exists today). **Recommended**: additive-only (NFR-2), avoids
  duplicating the gate in every surface, and matches how STORY-001-025 left the
  seam to be adopted incrementally.
- **Reuse the on-demand recompute rather than a stored recompute** (AC4): trade-off
  is none material — the existing `getGroupScore` already re-derives from current
  config, so opt-in recompute is achieved by widening a change's effective range,
  not by re-running and persisting scores. **Recommended**: stays faithful to D4
  ("never a stored fact").

### Alternatives Considered

- **Keep the STORY-001-025 record-only model (apply immediately, stamp CD
  authority)**: rejected — it applies the change to *all* rounds instantly via
  on-demand recompute, which is exactly the silent rescoring this story exists to
  prevent. STORY-001-025 itself deferred this to the owning story precisely because
  record-only is insufficient once flown rounds exist.
- **Snapshot/store each round's scores at flight time so a later config edit leaves
  them frozen**: rejected — it contradicts D4's on-demand ("never a stored fact")
  scoring model and would fork the scoring pipeline; effective-dating the *config*
  achieves the same "flown rounds unchanged" guarantee while keeping one recompute
  path.
- **Enforce CD-only authorisation at the endpoint**: rejected — contradicts D1 and
  the explicit Scope Out.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **What "recompute consequences" enumerates**: AC2's example ("rounds 1–3 would
  re-normalise") implies whole flown rounds, but a config change may only touch
  some tasks/groups (e.g. one task's working time). Whether the statement is at
  round granularity or task/group granularity is underspecified — round-level is
  the safe reading and matches the AC wording, with finer detail a possible
  refinement. Not blocking; a reasonable default (round-level) exists.
- **Scope of "affected" for a given change type**: a change to a *draw* option
  (3.5) vs a *scoring* option (3.6) vs a *task rule* (3.7) vs *field-aid timings*
  (3.8) affects different things — field-aid timings (3.8) may not change any
  *score* at all, so its "recompute consequences" could legitimately be "none".
  The per-change-type affected-set mapping is a design detail for the owning
  surfaces; the wrapper only needs a per-surface "does this change scoring, and if
  so which rounds" contract. Addressable, not blocking.
- **Concurrency of proposals under D8 last-action-wins**: multiple companion
  clients may act concurrently with no session lock (D8). Whether two overlapping
  pending proposals are allowed, or the second supersedes, is not specified. At MVP
  scale (one CD at the flight line) a simple last-proposal-wins/latest-pending is a
  reasonable default; worth a design note, not a blocker.

### Edge Cases

- **On-demand recompute silently rewrites flown rounds if effective-dating is
  missed**: the dominant edge — because `getGroupScore` reads current config, any
  path that mutates config without round-scoping it will re-normalise flown rounds
  on the next read. The design must route *every* post-Start config mutation
  through the effective-dated wrapper; a surface that edits config directly would
  breach AC3. This is the single most important implementation constraint.
- **Opt-in recompute crossing a drop-worst boundary**: re-normalising a flown round
  can change which round is the "worst" that drop-worst discards, shifting final
  aggregates for many pilots (general-rules §5). Correct per AC4 ("round and final
  scores update consistently") but the blast radius is large and the recompute must
  cascade to the final classification, not just the group. Worth explicit tests.
- **Change proposed after Lock / while Suspended**: the flow is specified for
  Running; a proposal attempted in Suspended or after Lock must be refused by the
  lifecycle guard. Locked is terminal in the MVP (memory: unlock deferred), so
  post-Lock config change is simply not available — consistent, but the boundary
  should be asserted.
- **A pending change never authorised**: if a proposal is left unresolved, no round
  should be scored under it (it is not effective). The pending fact must not leak
  into `getGroupScore`. Straightforward given the hold semantics, but must be
  guarded.
- **Field-aid-only change (3.8) with zero score impact**: consequence statement is
  "no rounds recompute"; forward/opt-in distinction is moot. The flow should handle
  a null recompute set gracefully.

### Technical Risks

- **"Flown rounds" depends on a not-yet-emitted fact**: which rounds are flown
  derives from `competition.roundAdvanced` (lifecycle `completedRoundCount`), but
  no emitter appends that event today (per STORY-001-026 analysis — the same LIVE
  DEPENDENCY). Until the Area 6 round story ships, the flown-rounds set reads empty
  and AC2/AC3/AC4 cannot be exercised end-to-end. This story can build the wrapper
  and effective-dating against the seam, but full verification is a forward
  obligation on the round-advance emitter. **Highest-attention item for a reviewer.**
- **Effective-dating touches the scoring read path**: introducing "config as of
  round N" changes how `getGroupScore` resolves config, a load-bearing path. Must
  stay class-agnostic and must not regress the pure/on-demand contract (D4).
  Mitigation: resolve config through a single "effective config for round N"
  accessor that the recompute calls, keeping the change localised.
- **Consequence statement / opt-in recompute drift**: if the "affected rounds"
  shown and the rounds actually recomputed are computed by different code, AC2 and
  AC4 could disagree. Mitigation: one shared affected-set function feeds both.
- **Wrapper adoption is per-surface**: like STORY-001-025's boundary, the gate is
  only witnessed where a config surface routes through it (3.7 today). A new 3.5/
  3.6/3.8 surface that forgets the wrapper would bypass the gate. Additive by
  design but a standing discipline, not a structural guarantee.

### House-Keeping Cross-Reference (CLAUDE.md rules 1 & 2)

- **No FAI-rule contravention (rule 1)**: this story is governance/workflow over
  configuration — it does not alter normalisation (§3), round score (§4) or final
  classification (§5); it *defers* to them for any recompute. AC6 actively
  *reinforces* the rule docs (a change contravening a class rule is warned before
  authorisation), consistent with the STORY-001-007 guardrail and D12 (models are a
  derived encoding, never authoritative over the rule docs). No conflict.
- **No contradiction / duplication with existing requirements (rule 2)**: checked
  against Area 3 (3.5–3.8 boundary — this story *fills in* the deferred behaviour
  STORY-001-025/Area 3 pointed to, not a duplicate), the state machine (change flow
  runs in Running only — consistent), D1 (hold-then-authorise is workflow, not
  enforcement — consistent), D4 (audit reused), and the three neighbouring
  "authority + recompute" stories. It is a **distinct mutation class** from each and
  the story delineates them explicitly:
  - STORY-001-028 (re-flights, group moves, dummy override) — decisions over
    *running-order/group* mechanics; recompute via which-score-counts. Different
    subject.
  - STORY-001-029 (penalties with recompute) — *penalty* deductions from the final
    aggregate with drop-worst retention. Different subject.
  - STORY-001-030 (retire/reinstate) — *roster* changes that re-draw. Explicitly
    scoped out here.
  - Area 5.8 manual score override — corrects a *captured value*, not the *rules*.
    Explicitly scoped out here.
  All four share a *recompute* need but no requirement is duplicated; a shared
  recompute/effective-config utility is an implementation convergence, not a
  requirements overlap. No unresolved contradiction surfaced.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Post-Start config change held pending authorisation | Yes | Replaces STORY-001-025's record-only immediate-apply with a hold-then-authorise flow over the `StartStateProvider` seam; propose→pending precedent exists (STORY-001-028). |
| AC2 | Recompute consequences stated before anything applies | Yes | Pure pre-mutation query over the flown-rounds set × change scope; derive with the same function the opt-in recompute uses. Depends on `completedRoundCount` (see AC3 note). |
| AC3 | Authorised change applies forward-only by default | Yes (design-gated) | Requires config values to be effective-dated / round-scoped so flown rounds recompute under their original value; the single-current-value + on-demand recompute model cannot express this otherwise. `roundOverrides` is a precedent. |
| AC4 | Flown-round recompute only on explicit opt-in | Yes | Opt-in widens the change's effective range back over named flown rounds; existing on-demand `getGroupScore` then reflects it, cascading to round/final scores. Blast radius (drop-worst) needs tests. |
| AC5 | Every change recorded and attributable | Yes | Reuses the append-only event log + attribution (D4/D1); each of propose/authorise-forward/authorise-with-recompute/refuse is an attributed event. |
| AC6 | Change contravening a class rule is warned | Yes | Re-runs the STORY-001-007 cross-aggregate class-model validation at proposal-review time; same guardrail pattern already in `task-config` service. |

**Overall**: all 6 ACs are addressable with no blocking issue. Two forward
dependencies bound end-to-end *verification* (not addressability): (a) the flown-
rounds set depends on the not-yet-emitted `competition.roundAdvanced` (shared LIVE
DEPENDENCY with STORY-001-026), and (b) the gate is witnessed only where a 3.5–3.8
surface routes through the wrapper (3.7 today). The one genuine design decision the
REASONS Canvas must resolve is **effective-dating config per round** — without it,
AC3's "flown rounds unchanged" is unachievable against the on-demand recompute.
This is a normal, well-scoped design decision, not an unresolved requirement
ambiguity.
