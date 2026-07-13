# SPDD Analysis: Competition Lifecycle — Authoritative State & Transition Legality (STORY-001-024)

## Original Business Requirement

> Preserved verbatim from `requirements/[User-story-24]competition-lifecycle-state-machine.md`.

# Story Decomposition: Competition Lifecycle State Machine & Start Proceedings

## INVEST Analysis

### Abstract Task: "Authoritative Competition Lifecycle"

**Analysis Dimensions**:
- **Core Responsibility**: make a competition's **lifecycle state** a single,
  authoritative, readable fact and make the **legality of every 2.1–2.4 action**
  a property of that state — so the core system permits Create, Delete, Start
  Proceedings, Suspend, Resume, Lock and round-advance only from the states the
  [state machine](../docs/requirements/high-level-requirements.md#competition-lifecycle-state-machine)
  allows, and rejects them everywhere else with a clear reason. This is the new
  authoritative model added to Area 2, plus the new **2.2 Start Proceedings**
  action.
- **Primary Operations**: report current lifecycle state (incl. Setup readiness
  sub-state); admit or reject each lifecycle transition against its guard; open
  proceedings (Setup → Running); enforce the settled boundary rules (delete only
  from Setup; suspend / lock / advance only from BetweenGroups).
- **Key Constraints**: the state machine is **authoritative** for *when* each
  action is legal; the core system must interpret it generically and never
  branch on discipline (CLAUDE.md class-model law); every accepted transition is
  an immutable event-log mutation (D4); Setup readiness reuses existing roster
  (STORY-001-005) and draw-acceptance (STORY-001-017) facts, not new ones;
  in-phase behaviour inside a running group belongs to Area 6, not here.
- **Technical Complexity**: Medium (a lifecycle aggregate with composite Setup /
  Running states layered over existing roster, draw and run-control facts).
- **Business Complexity**: Medium (a well-defined but broad state machine with
  two guard branches and several "only from this state" rules).

### INVEST Evaluation
- ✅ **Independent**: the state/legality layer sits over facts other stories
  already produce (roster, draw acceptance, group run); Start builds directly on
  the state layer.
- ✅ **Negotiable**: how the state is surfaced and how the readiness sub-state is
  derived are open.
- ✅ **Valuable**: turns "when is this action legal?" from scattered ad-hoc
  guards into one authoritative model — the requirement's whole point.
- ✅ **Estimable**: bounded set of states and edges.
- ✅ **Small**: splits into two 3-day stories.
- ✅ **Testable**: state readouts and admitted/rejected transitions are
  observable facts.

**Conclusion**: **Split into two stories** along the boundary the requirement
itself draws — the *state model + transition legality* (this story), and the new
*Start Proceedings* action that rides on it (STORY-001-025). Start depends on the
state layer but nothing else new; the dependency is linear, not tangled.

### Split Strategy
- **STORY-001-024 (this file)** — authoritative lifecycle state and transition
  legality: the readable state, the Setup readiness sub-states, and the settled
  "only from state X" rules for Delete / Suspend / Lock / round-advance.
- **STORY-001-025** — the new **2.2 Start Proceedings** action: the readiness
  gate and its outstanding-items list, the Setup → Running transition, and the
  configuration-authority boundary it marks.

---

# [STORY-001-024] Competition Lifecycle — Authoritative State & Transition Legality

> Source: `docs/requirements/high-level-requirements.md` Area 2 (Competition
> Lifecycle State Machine — states, transitions, guards) · Areas 2.1, 2.3, 2.4 ·
> `docs/requirements/decisions.md` D4 (immutable event log), D10 (operator-driven
> progression), D11 (device scope is the current group)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Area 2 now carries an **authoritative state machine** that is the single source
of truth for a competition's states and the legal transitions between them.
Until now, "is this action allowed right now?" was answered piecemeal inside
individual stories (delete is guarded against a locked competition in
STORY-001-003; suspend is group-boundary-only in STORY-001-013; draw acceptance
status lives in STORY-001-017). The state machine unifies these into one model:
a **Setup** composite (Draft → RosterComplete → DrawSpecified → DrawGenerated →
DrawAccepted/READY), a **Running** composite (BetweenGroups ↔ GroupInProgress),
plus **Suspended**, **Locked** (terminal) and **Deleted** (terminal).

This story delivers that model as an enforced, readable fact: the current
lifecycle state (including which Setup readiness sub-state a competition sits in),
and the settled legality rules that fall directly out of the diagram —
**Delete is legal only from Setup**; **Suspend, Lock and round-advance leave only
from BetweenGroups**, never mid-group. Editing the roster or draw specification
inside Setup **falls back toward the left** (a draw cannot survive a change to its
inputs). Every admitted transition is recorded in the immutable event log (D4);
every rejected one leaves the state untouched and explains why.

The new **Start Proceedings** action (Setup → Running) rides on this state layer
and is specified separately in STORY-001-025. The behaviour *inside* a running
group — Preparation / Working Time / Landing Window phases, manual-run tasks — is
owned by Area 6 and is out of scope here; this story owns only the
BetweenGroups ↔ GroupInProgress boundary at the lifecycle level.

### Business Value

- Provide every client and downstream capability with one authoritative answer
  to "what state is this competition in, and what may be done to it now?".
- Support safe operation by rejecting out-of-state actions (deleting a running
  contest, suspending mid-group) instead of leaving each caller to guard itself.
- Enable the new Start Proceedings action (STORY-001-025) and give the
  configuration-authority boundary a well-defined "Setup vs Running" line to
  hang off.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (competition exists, Create/Open/Delete),
  STORY-001-005 (roster complete fact), STORY-001-009 / STORY-001-017 (draw
  generated / accepted facts). This story consumes those facts to derive the
  Setup readiness sub-state; it does not re-implement them.
- **Data assumptions**: current lifecycle state is derivable from the immutable
  event log (D4); Scorer self-correction is group-bounded (D11), so the
  "BetweenGroups only" rule for suspend/lock/advance never truncates it.
- **Integration points**: exposes the lifecycle state to the companion app and
  all downstream stories; reuses STORY-001-017's draw acceptance status as the
  DrawGenerated/DrawAccepted sub-states rather than inventing a parallel status.
  The Running composite's group boundary is where Area 6 group run-control
  (STORY-001-011 and the Area 6 stories) attaches.
- **Business constraints**: the state machine is **class-agnostic** — the core
  interprets it generically and never branches on discipline (CLAUDE.md). MVP
  covers qualifying-round competitions only.

### Scope In

- A single **authoritative lifecycle state** readable by any client,
  distinguishing **Setup** (with its readiness sub-state), **Running** (with
  BetweenGroups vs GroupInProgress), **Suspended**, **Locked** and **Deleted**.
- Derivation of the **Setup readiness sub-state** — Draft, RosterComplete,
  DrawSpecified, DrawGenerated, DrawAccepted/READY — from existing roster and
  draw facts, and the **left-fallback**: editing the roster or draw spec drops
  the competition back to the earliest affected sub-state (any generated draw is
  discarded).
- **Transition legality** for the settled edges: Delete admitted only from
  Setup; Suspend, Lock and round-advance admitted only from BetweenGroups;
  Resume only from Suspended. An illegal action is rejected with a clear reason
  and no state change; every admitted transition is recorded in the event log.

### Scope Out

- The **Start Proceedings** action, its readiness gate and outstanding-items
  list, and the configuration-authority boundary — STORY-001-025.
- **In-phase behaviour** inside GroupInProgress (Preparation / Working Time /
  Landing Window sequencing, manual-run tasks, abort/restart) — Area 6
  (STORY-001-011 and Area 6 stories); this story owns only the group boundary.
- The mechanics behind the facts it reads — roster completion (STORY-001-005),
  draw generation/acceptance (STORY-001-009 / STORY-001-017), suspend/resume
  and crash recovery (STORY-001-013), the Lock validation pass and the
  minimum-rounds OfficialResults/NoContest resolution (Area 2.3, presently
  unstoried — see open questions). This story enforces *when* Lock and Suspend
  may fire, not what they compute.

### Acceptance Criteria

#### AC1: Lifecycle state is readable and unambiguous
**Given** a competition at any point in its life
**When** a client reads its lifecycle state
**Then** exactly one state is reported — Setup, Running, Suspended, Locked or
Deleted — and for Setup the readiness sub-state (Draft, RosterComplete,
DrawSpecified, DrawGenerated or DrawAccepted/READY) and for Running whether it is
BetweenGroups or GroupInProgress.

#### AC2: Setup readiness advances with roster and draw progress
**Given** a freshly created competition (Draft) with no roster and no draw
**When** the roster is completed, then a draw spec is set, then a draw is
generated, then the Contest Director accepts it
**Then** the readiness sub-state moves Draft → RosterComplete → DrawSpecified →
DrawGenerated → DrawAccepted/READY in step, reflecting the existing roster and
draw-acceptance facts rather than a separate parallel status.

#### AC3: Editing an input falls the state back to the left
**Given** a competition in DrawGenerated (a candidate draw exists)
**When** the Organiser edits the roster
**Then** the competition falls back to RosterComplete, the generated draw is
discarded, and the state readout reflects that no draw exists — matching the
"replace entrants after the draw" rule (STORY-001-005).

#### AC4: Delete is legal only from Setup
**Given** a competition that has been started (Running) or Suspended
**When** deletion is attempted
**Then** the system rejects it, explains that a competition can be deleted only
during Setup, and the competition is unchanged. (A Setup-state competition
deletes as specified in STORY-001-003.)

#### AC5: Suspend, Lock and round-advance leave only from BetweenGroups
**Given** a running competition with a group in progress (GroupInProgress)
**When** Suspend, Lock or round-advance is attempted
**Then** each is rejected because it is not at a group boundary; the same actions
are admitted once the group is scored and the competition is BetweenGroups.

#### AC6: Resume is legal only from Suspended
**Given** a Running competition that is not suspended
**When** Resume is attempted
**Then** the system rejects it as not-suspended; from the Suspended state, Resume
returns the competition to BetweenGroups.

#### AC7: Rejected transitions change nothing; admitted transitions are logged
**Given** any lifecycle action
**When** it is admitted
**Then** the state changes accordingly and the transition is recorded in the
immutable event log (D4); **when** it is rejected as illegal, the state is
unchanged and no mutation is recorded.

#### Non-Functional Expectations
- The state model is interpreted generically by the core system and carries no
  knowledge of any specific competition class (CLAUDE.md class-model law).
- State reads and legality checks operate entirely on the base with no internet
  connection (offline-first, D6).

### INVEST Check

Independent (a state/legality layer over facts other stories already produce) ·
Valuable (the requirement's central model — one authoritative answer to legality)
· Small (3 days, 3 functional points: readable state, Setup readiness derivation
+ left-fallback, settled-edge legality) · Testable (each state and each
admit/reject outcome is observable).

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Competition** (`packages/shared/src/competition.ts`, `apps/base/src/competitions/`):
  the aggregate this story annotates with a lifecycle state. Today it is a flat
  identity/config record (`id, name, date, venue, classModelId, pilotNumbers…`).
  Created/updated/deleted via `CompetitionService`, projected by
  `CompetitionProjection`. It carries **no lifecycle/state field today** — the
  only lifecycle notion in code is the `competition.deleted` tombstone (which
  removes the entry from the projection) and the class-change/delete guards in
  `CompetitionService`. This story introduces the *state* concept over it.

- **Event log / EventStore** (`apps/base/src/eventstore/event-store.ts`): the
  single append-only table (D4); every mutation files as `{scope, type, payload,
  attribution}`. Registry/lifecycle events use `scope="competitions"`; content
  events (roster, draw) file under `scope=competitionId`. This is the substrate
  from which lifecycle state must be **derived**, and where admitted transitions
  must be **recorded** (AC7).

- **Projection pattern** (`*/projection.ts`): every module derives read-state by
  replaying the log; projections are pure loaders (no RNG, no side effects),
  rebuildable at will (D4/D7). The lifecycle state is naturally a new projection
  of the same shape.

- **Roster fact** (`apps/base/src/roster/projection.ts`, `RosterProjection`):
  per-competition set of entries. There is **no explicit "roster complete"
  event or flag** — completeness is not marked anywhere today (see risks). The
  RosterComplete sub-state must be defined against this projection.

- **Draw facts** (`apps/base/src/draw/projection.ts`, `DrawProjection`): exposes
  exactly the three draw sub-states this story needs — `getSpec()` →
  DrawSpecified, `getCandidate()` → DrawGenerated, `getAccepted()`/`hasAccepted()`
  → DrawAccepted. STORY-001-017's tri-valued status (`no-draw` /
  `awaiting-decision` / `accepted`) is the readiness signal to reuse, not
  re-invent. `draw.cancelled` already discards an unaccepted candidate — the
  mechanical basis for the left-fallback's "draw discarded".

- **Lock / captured-scores state providers**
  (`apps/base/src/competitions/state-providers.ts`): today both are **no-op
  stubs** (`AlwaysUnlockedProvider`, `NoScoresYetProvider`) — Lock never
  actually fires and no lock/suspend/run-control events exist. The existing
  Delete guard (`CompetitionService.delete`) already rejects a *locked*
  competition; this story generalises that ad-hoc guard into a state-driven one.

- **Attribution** (`packages/shared/src/attribution.ts`): actor/origin/authority
  stamped on every event; lifecycle transitions inherit the same audit trail.

### New Concepts Required

- **Lifecycle State (aggregate-level)**: a single derived, readable fact per
  competition — one of `Setup | Running | Suspended | Locked | Deleted`, with a
  Setup readiness **sub-state** (`Draft | RosterComplete | DrawSpecified |
  DrawGenerated | DrawAccepted`) and a Running **sub-state** (`BetweenGroups |
  GroupInProgress`). This is a projection over the existing roster + draw +
  (future) run-control/suspend/lock events. Relates to Competition 1:1.

- **Transition Legality (guard layer)**: a generic predicate — "is action X
  admissible from the current state?" — governing Delete (Setup only), Suspend /
  Lock / round-advance (BetweenGroups only), Resume (Suspended only). Replaces
  the scattered per-service guards with one authoritative interpreter. Class-
  agnostic by construction (CLAUDE.md).

- **Lifecycle transition events (new event types)**: this story must at minimum
  admit and **record** Suspend, Resume, and (as a boundary it owns) round-advance
  and Lock *timing*. None of these event types exist yet (`grep` of `events.ts`
  shows only competition/roster/draw/pilot/scoring events). Whether this story
  *originates* these events or only *reads/guards* them is the central design
  question (see Strategic Approach).

- **Left-fallback trigger**: the derivation (or explicit event) by which a roster
  or draw-spec edit while a candidate exists invalidates the generated draw and
  drops the readiness sub-state to the earliest affected level. A cascade rule,
  not a stored field.

### Key Business Rules

- **Exactly one state** is reported at any time (AC1) — states are mutually
  exclusive; sub-states are reported only within their composite.
- **Monotonic readiness within Setup, with left-fallback**: readiness advances
  Draft → … → DrawAccepted as facts accumulate, but editing an *input* (roster or
  draw spec) collapses it back to the earliest affected sub-state and discards
  any generated draw (AC2/AC3) — a draw cannot survive a change to its inputs.
- **Delete only from Setup** (AC4) — governs Competition + Delete action.
- **Suspend / Lock / round-advance only from BetweenGroups** (AC5) — never
  mid-group; the group boundary is the sole exit point. Governs Running
  sub-states + those three actions.
- **Resume only from Suspended** (AC6).
- **Admitted ⇒ logged; rejected ⇒ no state change, no mutation** (AC7, D4) — the
  event log is the sole record of state change; rejections are inert.
- **Class-agnostic interpretation** (CLAUDE.md / NFR) — no branch on discipline
  anywhere in the state or guard logic.
- **Offline-first** (D6) — all derivation and guarding is base-local, no network.

## Strategic Approach

### Solution Direction

- Introduce a **LifecycleProjection** (new module, mirroring the existing
  `*/projection.ts` idiom) that derives a competition's `{ state, subState }`
  purely by replaying the log: it reads competition existence/tombstone, roster
  presence, and `DrawProjection`'s spec/candidate/accepted facts to compute the
  Setup readiness ladder, and reads the new lifecycle transition events
  (started/suspended/resumed/locked/group-run-boundary) to place a started
  competition in Running/Suspended/Locked. Absent any "started" fact, a
  competition is in Setup — this makes the story shippable before STORY-001-025
  (Start) and STORY-001-011 (group run) land.
- Introduce a **generic transition-legality guard** — a single table/function
  keyed on `(currentState, action) → admissible?` — that the relevant services
  consult before appending. Refactor the existing ad-hoc Delete-locked guard in
  `CompetitionService` to defer to this layer, so legality lives in one place.
- Expose lifecycle state through a **read endpoint** on the competition surface
  (companion consumes it), following the existing `routes/competitions.ts`
  pattern. Data flow: `HTTP GET → LifecycleProjection.getState(id) → {state,
  subState}`; `HTTP action → guard.assertAdmissible → EventStore.append →
  projection.apply`.
- **Recording** admitted transitions reuses `EventStore.append` with new
  lifecycle event types under `scope="competitions"` (or `=competitionId`,
  matching the content-event convention); rejections throw a domain error
  (existing `DomainError` → `VALIDATION`/domain-code handler) and append nothing.

### Key Design Decisions

- **Derived state vs. stored state field**: → **Recommendation: derived
  projection**, consistent with D4/D7 and every other module here (no state
  column on Competition). Trade-off: derivation must fold several event sources
  (roster, draw, run-control, suspend, lock) into one ladder, which is more
  logic than a stored enum; but a stored enum would duplicate facts already in
  the log and risk drift. The codebase's uniform projection pattern makes
  derivation the low-friction, law-abiding choice.

- **Does this story originate Suspend/Resume/round-advance/Lock events, or only
  guard them?** → The AC set (AC5/AC6/AC7) demands that Suspend/Resume be
  *admitted and logged* here, yet the mechanics of Suspend/Resume (STORY-001-013)
  and Lock (unstoried) are scoped out. **Recommendation**: this story owns the
  **legality guard + the transition event append** for Suspend/Resume (the
  simplest edges, whose "mechanics" are just state carry-over that the log
  already provides), and owns the **guard only** for Lock and round-advance,
  which have real downstream computation (validation pass, minimum-rounds
  resolution; round completion) owned elsewhere. This must be confirmed — the
  boundary between "enforce when it may fire" and "compute what it does" is thin
  for Suspend/Resume. (See Risk: AC5/AC6 testability.)

- **Reading the Running sub-state (BetweenGroups vs GroupInProgress)**: there is
  **no group run-control event in the codebase** (STORY-001-011 analysis states
  the "start group / group scored" world "has no implementation anywhere"). →
  **Recommendation**: define the lifecycle read to treat "no open-group fact" as
  BetweenGroups, and consume a group-open/group-scored event *when it exists*
  (STORY-001-011 / Area 6). Until then, GroupInProgress is unreachable and
  AC5's GroupInProgress rejection is verifiable only via a seeded/stub event.
  This keeps the state model complete on paper and forward-compatible without
  inventing Area-6-owned events here.

- **Left-fallback mechanics (AC3)**: → **Recommendation: reuse the existing
  `draw.cancelled` discard path** — when roster/draw-spec is edited while a
  candidate exists, the appropriate service appends `draw.cancelled` (or the
  derivation simply treats a candidate whose inputs changed as stale). Prefer an
  explicit invalidation event over silent staleness-by-timestamp, so the log
  records *why* the draw vanished and replay is deterministic (the DrawProjection
  is a strict pure loader — no implicit recomputation). Whether the roster/draw
  services emit that cascade, or this story does, needs confirming (the cascade
  currently does **not** exist — roster edits don't touch the draw).

- **Refactor existing guards vs. add a parallel layer**: → **Recommendation:
  refactor** `CompetitionService.delete`'s locked-guard and the class-change
  guard to consult the new legality layer, so "one authoritative model" is真
  true and not a second opinion. Trade-off: touches an already-tested service;
  mitigated by the existing test suite.

### Alternatives Considered

- **Store an explicit `lifecycleState` column on the Competition aggregate**,
  mutated by each action. Rejected: violates the derive-from-log convention
  (D4/D7), duplicates facts, and invites projection/column drift.
- **Let each caller keep its own guard, and add lifecycle state as read-only
  reporting**. Rejected: defeats the requirement's central purpose ("one
  authoritative answer to legality" vs. scattered ad-hoc guards).
- **Model the state machine with a class-specific hook** (e.g. per-discipline
  minimum-rounds affecting Locked resolution inline). Rejected: violates the
  class-model law; minimum-rounds/NoContest is a class-model-driven concern for
  the Lock story, not a branch in the core state machine.

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Roster complete" is undefined and unmarked**: the codebase has **no
  roster-complete event or flag** (`RosterProjection` only holds entries). AC2's
  Draft → RosterComplete transition needs a concrete definition of "complete"
  (≥1 entry? ≥ min group size? an explicit Organiser "mark complete" action?).
  The requirement says "roster built" but no upstream story appears to emit the
  fact. Must be clarified before derivation can be written.
- **Which events does this story originate vs. merely guard?** AC7 says admitted
  transitions are logged, but Suspend/Resume mechanics (STORY-001-013) and Lock
  (unstoried) are scoped out. The admit-and-append responsibility split for
  Suspend/Resume/Lock/round-advance is not pinned down.
- **"Round-advance" as a lifecycle edge**: the state machine shows
  `BetweenGroups → BetweenGroups: advance round`, guarded by round-complete or a
  CD override. No round/round-advance concept exists in code yet. Whether this
  story guards a not-yet-existing action, or defers it entirely, is unclear.
- **DrawAccepted/READY vs. roster completeness coupling**: the requirement notes
  READY = "draw accepted *with roster complete*". If a draw can be accepted while
  roster is (by whatever definition) incomplete, is the sub-state DrawAccepted or
  a lower rung? The interaction of the two ladders needs a rule.

### Edge Cases

- **Candidate draw exists but is stale after a roster edit** (AC3): today no
  cascade fires — the DrawProjection keeps the candidate. Needs an explicit
  invalidation path or a derivation that recognises staleness deterministically.
- **Draw-spec edit (not roster) while a candidate exists**: same left-fallback,
  but drops to DrawSpecified rather than RosterComplete — two fallback depths to
  distinguish.
- **Deleted is terminal**: reading state of a tombstoned competition — should it
  report `Deleted`, or 404 (the projection currently *removes* the entry, so it
  is indistinguishable from never-existed)? AC1 implies `Deleted` is a reportable
  state, but the current tombstone drops the row.
- **Locked is terminal**: no `Locked`/unlock event exists; `AlwaysUnlockedProvider`
  makes Locked unreachable today. Any test of "delete rejected because Locked"
  (AC4 boundary) needs a seeded lock fact.
- **GroupInProgress unreachable without Area 6**: AC5's mid-group rejection
  cannot be exercised end-to-end until group run-control events exist.
- **Suspend requested while already Suspended, or Resume while Running**: idempotency
  / double-transition handling not specified.
- **Concurrency**: `better-sqlite3` is synchronous and single-connection, so
  appends serialise naturally — low risk, but a read-then-append legality check
  is still a check-then-act; acceptable given single-writer base station.

### Technical Risks

- **Foundational facts missing (biggest risk)**: three of the states/edges this
  story enforces depend on events that **do not exist yet** — roster-complete,
  group start/scored (GroupInProgress), suspend/resume, and lock. The story is
  buildable as a *state model + guard skeleton* that reads existing draw facts
  and gracefully treats missing facts as "Setup / BetweenGroups", but several ACs
  (AC4 Locked/Running boundary, AC5 GroupInProgress, AC6 Suspended) are only
  fully testable once STORY-001-025 (Start), STORY-001-011 (group run),
  STORY-001-013 (suspend) land. Mitigation: build the generic guard + projection
  now, seed/stub the missing facts for tests, and let real events swap in via the
  existing provider-injection seam (`state-providers.ts`).
- **Left-fallback cascade doesn't exist**: roster/draw-spec edits currently have
  no effect on a generated candidate. Implementing AC3 may require touching the
  roster and draw services (outside this story's nominal surface) or a
  staleness-derivation in the new projection. Cross-story coupling risk.
- **Refactoring tested guards**: folding `CompetitionService`'s delete/class
  guards into the new legality layer risks regressing STORY-001-003 behaviour;
  mitigated by existing tests.
- **Deleted-state observability**: reporting `Deleted` (AC1) conflicts with the
  current tombstone-removes-row behaviour; may need the projection to retain a
  terminal marker rather than delete outright.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | One unambiguous state + sub-state readable | Partial | Setup sub-states derivable from draw facts today; Running/Suspended/Locked need events that don't exist yet; `Deleted` conflicts with tombstone-removes-row. Reads fine for Setup path now. |
| AC2 | Readiness advances with roster/draw progress | Partial | Draw rungs (Specified/Generated/Accepted) map cleanly to `DrawProjection`; **RosterComplete rung undefined** (no roster-complete fact). |
| AC3 | Editing an input falls state back to left | Partial | No draw-invalidation cascade exists on roster/draw-spec edit; needs new event or staleness derivation, likely touching roster/draw services. |
| AC4 | Delete legal only from Setup | Partial | Setup-side works (existing delete). Running/Suspended rejection needs a "started"/suspend fact (STORY-001-025/013) to reach non-Setup; Locked case needs a lock fact. |
| AC5 | Suspend/Lock/advance only from BetweenGroups | Partial | Guard is buildable generically, but GroupInProgress (to reject from) and round-advance/lock actions have no events yet — testable only via seeded/stub facts. |
| AC6 | Resume only from Suspended | Partial | Depends on Suspend/Resume events this story may need to originate; mechanics scoped to STORY-001-013 — responsibility split unresolved. |
| AC7 | Rejected → no change; admitted → logged | Yes | Fits the EventStore append / throw-domain-error idiom directly; the cleanest AC. |

---

### Analysis summary
- Project type: fullstack (Node 22 / TypeScript monorepo — `apps/base` event-
  sourced service + SQLite event store, `apps/companion` client, `packages/shared`).
- Existing concepts identified: 7 (Competition, EventStore, Projection pattern,
  Roster fact, Draw facts, Lock/scores stub providers, Attribution).
- New concepts required: 4 (Lifecycle State, Transition Legality guard, lifecycle
  transition events, left-fallback trigger).
- Key design decisions: 5.
- Acceptance Criteria coverage: 1 fully addressable now (AC7), 6 partial —
  gated on foundational facts (roster-complete, group run-control, suspend, lock).
- Open questions/risks: several — see Risk & Gap Analysis (foundational facts
  missing is the dominant one).
