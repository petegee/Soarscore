# SPDD Analysis: Start Proceedings — Open a Competition for Running (STORY-001-025)

## Original Business Requirement

> Preserved verbatim from
> `requirements/[User-story-25]start-proceedings.md`.

# [STORY-001-025] Start Proceedings — Open a Competition for Running

> Source: `docs/requirements/high-level-requirements.md` Area 2.2 (Start
> Proceedings), Area 2 state machine (DrawAccepted → Running), Area 3
> (Mid-contest configuration changes) · `docs/requirements/decisions.md` D4
> (immutable event log), D10 (operator-driven progression), D14 (group-size
> minima are advisory) · Areas 3.4 (roster complete), 4.3 (draw accepted)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

A competition has, until now, no explicit "we have begun" moment on the
organising side — setup simply flowed into the first group being run. Area 2.2
adds the **Start Proceedings** action: the **Contest Director** officially opens
proceedings, transitioning the competition from **Setup** to **Running**. It is
the deliberate begin-boundary that mirrors Lock's close-boundary (Area 2.3), and
is distinct from the Announcer/Timekeeper operationally starting the first
round/group (Area 6.4/6.5, D10) — nothing on the field may run until proceedings
are open.

Starting is **readiness-gated with a hard block**: the competition cannot be
started until its **roster is complete** (3.4) **and** its **draw has been
generated and accepted** (4.3) — i.e. it is in the DrawAccepted/READY state
(STORY-001-024). A blocked start **lists its outstanding items** so the Contest
Director knows exactly what is missing. The softer roster-size judgement is
already resolved upstream at draw time (a too-thin roster warns and requires
acknowledgement *there*, D14 / STORY-001-022), so once a draw is accepted the
Start gate needs no override — it is a clean pass/fail.

Starting is recorded in the event log (D4) and **marks the boundary past which
configuration changes require Contest-Director authority** (Area 3): before Start,
setup is freely mutable; after Start, any change to scoring/running configuration
(3.5–3.8) needs CD authority and is logged. The Area 3 wording changed from "once
the first round has started" to "once proceedings have started (2.2)" — this story
owns that boundary.

### Business Value

- Provide the Contest Director with a single deliberate act that opens the
  competition for running, with an unambiguous readiness check behind it.
- Support a clear "you cannot start yet, here is what is missing" message so a
  competition is never half-started with an incomplete roster or unaccepted draw.
- Enable the configuration-authority boundary (Setup vs Running) that Area 3 and
  every mid-contest config change depend on.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-024 (lifecycle state & DrawAccepted sub-state),
  STORY-001-005 (roster complete), STORY-001-017 (draw accepted). Start rides on
  the state layer; the gate is satisfied exactly when the competition is in
  DrawAccepted/READY.
- **Data assumptions**: actor identity arrives with the request (companion
  name-pick); there is no login — Contest Director authority is **recorded, not
  enforced** (D1). The too-thin-roster acknowledgement already happened at draw
  time (D14), so Start applies no size override of its own.
- **Integration points**: gates Area 6 group/round run (STORY-001-011 and Area 6
  stories) — nothing runs until Running; establishes the boundary that the
  mid-contest configuration-change rule (Area 3) keys off. Driven from the
  companion app; the base is headless.
- **Business constraints**: MVP is qualifying-round only; offline-first (D6).

### Scope In

- **Start Proceedings**: the Contest Director transitions a DrawAccepted/READY
  competition from Setup to Running, recorded in the event log with the acting
  person and Contest-Director authority.
- **Readiness gate (hard block)** with an **outstanding-items list**: a start
  attempted before the roster is complete and the draw accepted is refused and
  names each missing prerequisite (roster incomplete, draw not accepted).
- **Configuration-authority boundary**: before Start, scoring/running
  configuration (3.5–3.8) is freely editable; after Start it requires
  Contest-Director authority and is recorded in the event log. No group or round
  may run before Start.

### Scope Out

- The lifecycle state model and the generic legality of other transitions —
  STORY-001-024.
- The mechanics of roster completion (STORY-001-005) and draw generation /
  acceptance (STORY-001-009 / STORY-001-017); Start only *reads* their result.
- The too-thin-roster warning and its acknowledgement — resolved upstream at
  draw time (STORY-001-022 / STORY-001-023, D14); Start adds no override.
- Operationally running the first group/round — Announcer/Timekeeper, Area 6.4/6.5
  (STORY-001-011 and Area 6 stories).
- The detailed content of each mid-contest configuration change (which fields,
  what confirmation) — the owning configuration stories; this story establishes
  only that the Start boundary is what flips those changes into
  authority-required, logged changes.
- Enforcing that only a Contest Director may start (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: Starting a ready competition opens proceedings
**Given** a competition in DrawAccepted/READY — roster complete and draw
accepted
**When** the Contest Director starts proceedings
**Then** the competition transitions to Running (BetweenGroups), the start is
recorded in the event log with who started it and the Contest-Director authority,
and the field may now run its first group.

#### AC2: A start with nothing ready is blocked and lists everything missing
**Given** a competition still in Draft — roster not complete and no draw
**When** a start is attempted
**Then** the system refuses and lists both outstanding items: the roster is not
complete and the draw has not been accepted; the competition stays in Setup.

#### AC3: A start with a generated-but-unaccepted draw is blocked on that item
**Given** a competition whose roster is complete and whose draw has been
generated into a candidate but **not** accepted (DrawGenerated)
**When** a start is attempted
**Then** the system refuses and the outstanding-items list names the one missing
item — the draw has not been accepted — and nothing else.

#### AC4: An accepted draw needs no size override to start
**Given** a competition in DrawAccepted/READY whose roster was flagged as thin at
draw time and acknowledged there (D14)
**When** the Contest Director starts proceedings
**Then** the start succeeds with no further size warning or override — the Start
gate is a clean pass because the judgement was already resolved upstream.

#### AC5: Nothing may run before proceedings are open
**Given** a competition in Setup (not yet started)
**When** an operator attempts to start the first group or advance a round
(Area 6)
**Then** the system refuses because proceedings are not open, and directs that
the Contest Director must start proceedings first.

#### AC6: Starting marks the configuration-authority boundary
**Given** a scoring/running configuration item (e.g. a task's working time,
3.7) that is freely editable while the competition is in Setup
**When** the competition is started and the same item is changed afterward
**Then** the change now requires Contest-Director authority and is recorded in
the event log, whereas the identical change before Start required neither.

#### AC7: A competition cannot be started twice or from a non-ready state
**Given** a competition that is already Running (or Suspended, or Locked)
**When** a start is attempted
**Then** the system rejects it because proceedings are already open (or the
competition is not in a startable state) and no second start is recorded.

#### Non-Functional Expectations
- Start operates entirely on the base with no internet connection (offline-first,
  D6).
- The readiness check and the Setup/Running boundary carry no knowledge of any
  specific competition class (CLAUDE.md class-model law).

### INVEST Check

Independent (a single action over the STORY-001-024 state layer) · Valuable (the
deliberate begin-boundary and the config-authority line the whole running phase
depends on) · Small (3 days, 3 functional points: start transition, readiness
gate + outstanding-items list, config-authority boundary) · Testable (start,
each blocked-start reason, and the before/after config behaviour are observable).

## Resolved Clarifications (user, 2026-07-14)

The four open items from the Risk & Gap Analysis below were put to the user and
resolved as follows. **These decisions are authoritative for the REASONS Canvas
and generation stages** and supersede the "recommended" readings in the design
notes further down.

1. **AC6 "requires CD authority" → RECORD-ONLY (not the middle/enforce reading).**
   After Start, a scoring/running-config edit is **never rejected**. The Start
   boundary flips the *recorded authority attribution*: before Start the edit is
   stamped `authority: "organiser"` (as today); after Start the identical edit is
   stamped `authority: "contest-director"` and logged. The observable AC6
   before/after difference is the recorded attribution — the base verifies
   nothing and refuses nothing (purest D1 trust-model reading). The config
   command consults the shared "past-Start" predicate to decide which authority
   context to stamp; there is no 4xx path for AC6.
2. **"Roster complete" for the Start gate ≡ the existing `RosterComplete`
   sub-state rung (≥1 roster entry)** in `deriveSetupSubState`. Start inherits
   this definition; no stricter/minimum-size rule. Thin-roster judgement stays
   upstream at draw time (D14).
3. **AC6 config-surface scope: wire the boundary into the task-config (3.7) path
   only** for this story, and establish the shared past-Start predicate the
   remaining 3.5–3.8 config commands adopt as they are built. A durable follow-up
   note is recorded so the remaining-surface wiring is not lost (see project
   memory `config-authority-boundary-deferred`).
4. **Outstanding-items list carries stable machine codes + human text.** At
   minimum `ROSTER_INCOMPLETE` and `DRAW_NOT_ACCEPTED`, each with a
   human-readable message, so the companion can switch on / localise the item
   identity rather than parsing prose.

## Domain Concept Identification

The prior story (STORY-001-024) deliberately shipped the lifecycle *vocabulary*
and *derivation* while leaving the individual transition commands to their
owning stories. That groundwork is why this story is small: the
`competition.started` event type and `CompetitionStartedPayload` already exist
in the shared events contract, and `LifecycleProjection` already folds
`competition.started` into a `Running` state. What is missing is the *command*
that emits it, its readiness gate, and the config-authority boundary it defines.

### Existing Concepts (from codebase)

- **Competition**: the aggregate being started — `CompetitionProjection`
  (`apps/base/src/competitions/`). Already carries create/update/delete
  commands; Start is the next command on it, but its subject is the derived
  lifecycle state, not the competition row itself.
- **Lifecycle State** (`LifecycleStateName` + `SetupSubState` /
  `RunningSubState`, `packages/shared/src/lifecycle.ts`): the single
  authoritative state derived by `LifecycleProjection`
  (`apps/base/src/lifecycle/projection.ts`). Start reads it as its gate
  (`DrawAccepted` sub-state ⇒ startable) and its result is a transition
  `Setup → Running (BetweenGroups)`.
- **Setup readiness ladder** (`Draft → RosterComplete → DrawSpecified →
  DrawGenerated → DrawAccepted`, derived in
  `LifecycleProjection.deriveSetupSubState`): already computes exactly the
  facts AC2/AC3 need to enumerate missing prerequisites — roster present
  (≥1 entry) and draw accepted vs. merely generated. The outstanding-items
  list is a *presentation* of this existing derivation, not a new computation.
- **LifecycleGuard** (`apps/base/src/lifecycle/guard.ts`): the single generic
  (state, action) legality table. Currently handles Delete / Suspend / Resume /
  Lock / RoundAdvance. Start is a new action to add to this table — admissible
  only from `Setup` with sub-state `DrawAccepted`. AC7 (no double-start, not
  from Running/Suspended/Locked) falls out of the table for free.
- **`LifecycleAction`** union (`packages/shared/src/lifecycle.ts`): currently
  `Delete | Suspend | Resume | Lock | RoundAdvance`. A new `Start` member is
  the additive-only extension (NFR-2). Adding it also surfaces Start in the
  `admissibleActions` read set the lifecycle DTO already exposes.
- **`competition.started` event + `CompetitionStartedPayload`**
  (`packages/shared/src/events.ts`): already declared (by STORY-001-024) under
  the registry scope `"competitions"`, carrying `competitionId`. This story is
  the declared *owner-emitter*. `LifecycleProjection.apply` already consumes it.
- **Attribution / authority** (`packages/shared/src/attribution.ts`): the
  `authority` free-string field ("organiser" | "contest-director" | "system").
  The draw routes already model a CD-authority variant
  (`cdAttributionFromHeaders` in `apps/base/src/routes/draw.ts`) — the exact
  idiom Start's route should reuse to stamp contest-director authority.
- **EventStore + per-service projection apply** (`apps/base/src/eventstore/`):
  the append-then-apply write idiom every command follows; the cross-cutting
  `LifecycleProjection` additionally receives every append via the `onEvent`
  hook wired in `app.ts`.
- **Task-config command** (`CompetitionTaskConfigService.update`,
  `apps/base/src/task-config/service.ts`): the concrete 3.7 "task working time"
  config path AC6 names. Today it appends `taskConfig.updated` with no lifecycle
  check and hard-coded organiser authority — the exact call site AC6's boundary
  must newly gate.

### New Concepts Required

- **Start Proceedings command**: a new `CompetitionService.start(id,
  attribution)` (or a lifecycle-owned equivalent) that asserts Start
  admissibility, and on success appends `competition.started` under scope
  `"competitions"` and applies it. Relates to Competition (its subject),
  LifecycleGuard (its gate), and the event log (its record).
- **Outstanding-items (readiness) result**: a structured list of unmet
  prerequisites returned when Start is blocked — at minimum "roster not
  complete" and "draw not accepted", each independently present/absent so AC2
  lists both and AC3 lists only the draw item. Derived from the existing Setup
  sub-state ladder; needs a richer error/response shape than the current
  single-string `TransitionNotAllowedError` carries.
- **Configuration-authority boundary rule**: a shared, class-agnostic predicate
  — "is this competition past Start?" — that scoring/running-config commands
  (3.5–3.8) consult to decide whether an edit is free (Setup) or
  authority-required-and-logged (Running+). New as an enforced rule; the state
  it reads (`LifecycleProjection.getState`) already exists. Relates every
  config command to the lifecycle state.
- **Start route** (`POST /api/competitions/:id/start` or similar): the
  companion-facing entry point, stamping CD authority via the existing
  `cdAttributionFromHeaders` idiom.

### Key Business Rules

- **Start is admissible only from `Setup` / `DrawAccepted`** (AC1): governs the
  Competition lifecycle transition. Encoded in LifecycleGuard, class-agnostic.
- **Blocked start enumerates every missing prerequisite** (AC2/AC3): governs the
  readiness result. Roster-complete ≡ ≥1 roster entry (the class-agnostic
  definition already fixed in `deriveSetupSubState`); draw-accepted ≡
  `DrawProjection.hasAccepted`. Both facts are read, never recomputed.
- **Start is idempotent-blocking, never idempotent-succeeding** (AC7): a second
  start from Running/Suspended/Locked is rejected and appends nothing. Falls out
  of the guard table.
- **Start requires no size override** (AC4): the gate is a clean pass/fail; the
  too-thin acknowledgement lives on the accepted draw
  (`DrawAcceptedPayload.acknowledgedWarningIds`), not on Start.
- **The Start boundary flips config mutability** (AC6): before the
  `competition.started` fact exists, 3.5–3.8 edits are free; after it, they
  require CD authority and are logged. Governs every config command.
- **No field run before Running** (AC5): group-open / round-advance actions are
  inadmissible from Setup. `RoundAdvance` is already gated to
  `Running/BetweenGroups` in the guard; a group-open command does not yet exist
  in the codebase (Area 6 territory) — see Risks.
- **Class-agnostic law** (CLAUDE.md, NFR): neither the readiness gate nor the
  Setup/Running boundary may read the Contest Class Model or branch on
  discipline. The existing lifecycle layer already honours this; Start must not
  regress it.

## Strategic Approach

### Solution Direction

Add Start as one more command over the existing STORY-001-024 lifecycle layer,
reusing every seam that story built rather than introducing a parallel
mechanism:

1. **Extend the guard table, not the code paths.** Add `Start` to the
   `LifecycleAction` union (shared) and a single `Start` branch to
   `LifecycleGuard` — admissible iff `state === "Setup" && setupSubState ===
   "DrawAccepted"`. AC7 and "not from a non-ready state" then require no bespoke
   code; they are table lookups. The read-side `admissibleActions` set surfaces
   Start automatically for the companion.
2. **Command → assert → append → apply.** A new service command asserts Start
   admissibility against the derived state, then appends the already-declared
   `competition.started` (scope `"competitions"`, payload `{ competitionId }`)
   under CD authority and applies it. Data flow:
   `POST /:id/start → CompetitionService.start → LifecycleGuard.assertAdmissible
   → EventStore.append(competition.started) → projections`. This mirrors the
   existing `delete` command, which already asserts a lifecycle action before
   appending.
3. **Derive the outstanding-items list from the Setup sub-state.** Because
   `deriveSetupSubState` already distinguishes Draft / RosterComplete /
   DrawGenerated / DrawAccepted, the blocked-start response can map sub-state →
   list of unmet items (roster-not-complete when below RosterComplete;
   draw-not-accepted when below DrawAccepted). No new roster/draw reads.
4. **Enforce the config-authority boundary at the config command(s).** Introduce
   a small shared, class-agnostic predicate (competition is past Start) that the
   scoring/running-config commands consult; before Start they proceed freely,
   after Start they require the request to carry CD authority (and, as ever, log
   the change). This story wires it into the one concrete 3.7 path that exists
   today (task-config) to make AC6 observable, and establishes the pattern the
   remaining 3.5–3.8 stories adopt.
5. **Companion**: a Start action on the competition/lifecycle view, disabled
   unless `admissibleActions` includes Start, and a blocked-start surface that
   renders the outstanding-items list. (Presentation only; the gate is
   authoritative on the base.)

### Key Design Decisions

- **Where does `start()` live — CompetitionService or a new lifecycle service?**
  Trade-off: CompetitionService already owns the competition aggregate, already
  injects `LifecycleProjection` + `LifecycleGuard`, and already hosts the `delete`
  command that asserts a lifecycle action — so adding `start` there is the
  lowest-friction, most consistent choice. A dedicated lifecycle-transition
  service would centralise all transitions but is premature while only
  delete/start exist. → **Recommend adding `start` to CompetitionService**,
  matching the established delete idiom.

- **Shape of the blocked-start result: reuse `TransitionNotAllowedError` or a
  richer error?** `TransitionNotAllowedError` carries a single reason string —
  insufficient for AC2's *list* of items. Trade-off: overloading it loses the
  enumeration; a new readiness-specific error (a `DomainError` subclass carrying
  `outstandingItems: string[]` in its `details`) fits the existing centralised
  `setErrorHandler` pattern (each error → coded 4xx with `details`) and gives
  AC2/AC3 an observable list. → **Recommend a new readiness error** (e.g. 409
  `COMPETITION_NOT_READY` with `details.outstandingItems`), surfaced through the
  existing error handler, rather than stretching `TransitionNotAllowedError`.
  Open question: should the guard itself produce the list, or should the service
  compute it from sub-state after the guard says "no"? Leaning service-side so
  the guard stays a pure boolean table (see Risks).

- **How is CD authority represented on Start?** Trade-off: D1 says authority is
  *recorded, not enforced*, and the story explicitly scopes out enforcing
  "only a CD may start". The draw module already has `cdAttributionFromHeaders`.
  → **Recommend reusing that idiom**: the Start route stamps
  `authority: "contest-director"` from headers and records it; the base does not
  reject a non-CD caller. This keeps AC1's "recorded with CD authority" true
  without contradicting D1.

- **Config-authority boundary: enforce vs. record.** Tension (see Risks): D1 says
  authority is recorded-not-enforced, yet AC6 says the post-Start change
  "requires Contest-Director authority". Trade-off: hard-enforcing (reject a
  non-CD edit) contradicts D1's trust model; pure recording makes AC6
  indistinguishable before/after Start. → **Recommend the middle reading the AC
  actually states**: after Start, a config edit *must be accompanied by CD
  authority attribution and is logged*, and the boundary is what changes — i.e.
  the base gates on "past Start ⇒ this command is an authority-bearing, logged
  mutation" while the *identity* remains recorded-not-verified (D1). This makes
  the before/after behaviour observably different (AC6) without introducing real
  authentication. **RESOLVED (2026-07-14): user chose RECORD-ONLY — nothing is
  rejected; the boundary only flips the stamped authority attribution
  (organiser → contest-director). Disregard this "middle reading"; see Resolved
  Clarifications §1.**

- **AC5 scope: enforce at which action?** `RoundAdvance` is already guarded to
  `Running/BetweenGroups`, so advancing a round from Setup is already refused.
  A **group-open command does not yet exist** in the codebase. → **Recommend**
  this story cover the part that exists (round-advance already inadmissible;
  ensure any Area-6 group-open command, when built, consults the same guard) and
  treat the group-open half as forward-establishing the gate rather than
  implementing a command that isn't there. **Flag as a coverage gap.**

### Alternatives Considered

- **A dedicated `competition.startAttempted`/readiness projection**: rejected —
  the Setup sub-state ladder already encodes readiness; a second projection would
  duplicate `deriveSetupSubState` and risk drift.
- **Putting the outstanding-items computation in `LifecycleGuard`**: rejected as
  the primary path — it would make the guard non-pure (it currently returns a
  bare boolean/typed error) and couple legality to presentation. Keep the guard
  a boolean table; compute the list in the service from the derived sub-state.
- **Enforcing CD-only start on the base**: rejected — contradicts D1 and the
  story's explicit Scope Out ("Enforcing that only a Contest Director may
  start"). Authority is recorded, not enforced.
- **A generic "config edit" guard wrapper around every write endpoint**:
  deferred — over-engineering for MVP; wire the boundary into the one concrete
  3.7 path now and let the remaining 3.5–3.8 stories adopt the shared predicate.

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Roster complete" definition**: the story leans on 3.4, but the codebase
  already fixes a concrete, class-agnostic definition — *≥1 roster entry* —
  inside `deriveSetupSubState`. If 3.4's intended meaning is stricter (e.g. all
  seats filled, minimum size), the Start gate would silently inherit the looser
  definition. Needs confirmation that "roster complete" for Start ≡ the existing
  `RosterComplete` sub-state rung. **RESOLVED (2026-07-14): yes — Start inherits
  the existing ≥1-entry `RosterComplete` rung; no stricter definition.**
- **AC6 "requires Contest-Director authority" vs. D1 "recorded, not enforced"**:
  genuine tension. Does "requires" mean the base *rejects* an edit lacking CD
  authority (enforcement), or that the edit is *recorded as* an
  authority-bearing, logged change while the identity stays unverified? The
  recommended reading is the latter; this must be confirmed before design.
  **RESOLVED (2026-07-14): neither — user chose RECORD-ONLY. The base rejects
  nothing; after Start the edit is simply stamped `contest-director` (vs
  `organiser` before Start) and logged. See Resolved Clarifications §1.**
- **Which config surfaces are in AC6's scope now?** The AC names 3.7 (task
  working time). 3.5–3.8 span several config areas, most of whose commands don't
  exist yet. Is wiring the boundary into task-config (the one that exists)
  sufficient for this story, with the rest deferred to their owning stories?
  **RESOLVED (2026-07-14): task-config (3.7) only for this story; the shared
  past-Start predicate is established and remaining 3.5–3.8 surfaces adopt it as
  they are built. Deferral captured in memory `config-authority-boundary-deferred`.**
- **Outstanding-items wording/identity**: AC2/AC3 require *named* items but do
  not fix machine identifiers. Are stable item codes needed (for the companion
  to localise/render), or is a human-readable string list sufficient?
  **RESOLVED (2026-07-14): stable machine codes + human text — at minimum
  `ROSTER_INCOMPLETE` and `DRAW_NOT_ACCEPTED`, each with a message.**

### Edge Cases

- **Stale-candidate collapse**: `deriveSetupSubState` treats a draw whose inputs
  changed after generation as *stale* and collapses it below `DrawGenerated`. A
  competition that *was* DrawAccepted but then had a roster edit is no longer
  `DrawAccepted` and must block Start — the outstanding-items list must reflect
  the collapsed rung, not a memory of the earlier acceptance. This is already
  handled by the projection but must be exercised by Start's gate/tests.
- **Deleted / non-existent competition**: Start on a tombstoned or never-existed
  id — should return the same not-found behaviour the other commands use
  (`getLifecycleState` already distinguishes 404 vs. Deleted 200); Start should
  reject a Deleted competition as non-startable.
- **Empty roster + accepted draw is impossible**: acceptance implies a generated
  draw over a non-empty roster, so AC2's "roster not complete AND draw not
  accepted" is the coherent Draft case; ensure the list logic can't emit
  "draw not accepted" alone while roster is empty (it can't, given the ladder,
  but assert it).
- **Concurrent double-start**: two near-simultaneous start requests. The append
  log serialises writes and the second sees `Running`, so it is rejected —
  but confirm the guard is re-evaluated against freshly-derived state on each
  command, not a cached snapshot.
- **AC5 with no group-open command**: attempting to "start the first group" has
  no endpoint today, so the refusal AC5 describes cannot be exercised end-to-end
  for the group case yet.

### Technical Risks

- **Config-authority boundary is cross-cutting**: enforcing AC6 touches config
  services (task-config now; 3.5–3.8 later) that currently perform unconditional
  appends with hard-coded organiser authority. Introducing a lifecycle-aware
  predicate there risks scattering lifecycle reads across modules. Mitigation:
  a single shared, injected predicate (competition-past-Start) mirroring the
  existing provider-seam pattern (`DrawStateProvider`, `LockStateProvider`), so
  config modules never import the lifecycle module directly.
- **Guard purity regression**: adding readiness-list logic into `LifecycleGuard`
  would break its "pure boolean table" contract that STORY-001-024 was careful
  to establish (and that keeps it class-agnostic). Mitigation: keep the guard a
  boolean; compute the list in the service.
- **Authority plumbing**: the Start route must actually carry CD authority; the
  companion `useActor` name-pick supplies identity but the authority string is
  currently hard-coded per route. Low risk (draw already does this) but the
  companion must send the right headers.
- **Class-agnostic law**: any temptation to read the class model for
  "readiness" (e.g. minimum group size) would violate CLAUDE.md. Mitigation: the
  gate reads only roster count + draw acceptance, both already class-agnostic;
  size judgement stays upstream at draw time (D14).

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Start a ready (DrawAccepted) competition → Running/BetweenGroups, logged with CD authority | Yes | Reuses declared `competition.started` event + existing projection; add guard `Start` branch, service command, CD-authority route. |
| AC2 | Blocked start from Draft lists both missing items | Yes | Derive list from `Draft` sub-state; needs new readiness-error/result shape (not the single-string `TransitionNotAllowedError`). |
| AC3 | Blocked start from DrawGenerated lists only "draw not accepted" | Yes | Sub-state ladder already distinguishes RosterComplete/DrawGenerated; list logic must emit exactly one item. |
| AC4 | Accepted (thin-but-acknowledged) draw starts with no override | Yes | Gate reads only roster+acceptance; size ack lives on `DrawAcceptedPayload`. Clean pass. |
| AC5 | Nothing runs before Running | Partial | Round-advance already inadmissible from Setup; **no group-open command exists yet** (Area 6). Group case forward-establishes the gate rather than implementing a missing command. |
| AC6 | Start marks the config-authority boundary | Yes (record-only) | RESOLVED: record-only — after Start the task-config edit is stamped `authority: contest-director` (vs `organiser` before Start), never rejected. Wired into the 3.7 task-config path only; remaining 3.5–3.8 surfaces deferred (memory `config-authority-boundary-deferred`). |
| AC7 | No double-start / not from non-ready state | Yes | Falls out of the guard table (Start admissible only from Setup/DrawAccepted); Running/Suspended/Locked reject, append nothing. |
| NFR | Offline-first; no class knowledge in gate/boundary | Yes | All reads are local log-derived facts; gate uses roster count + draw acceptance only, never the class model. |
