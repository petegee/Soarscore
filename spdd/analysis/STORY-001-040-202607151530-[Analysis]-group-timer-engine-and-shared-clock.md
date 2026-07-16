# SPDD Analysis: Group Timer Engine and Shared Clock

> **This is the foundational Area 6 engine every run-control and display story
> is already written against.** STORY-001-032's own analysis (run-control
> authority) names this story as the single biggest unbuilt dependency behind
> four of its seven ACs, and expects it to expose "round, group, phase,
> remaining time" as a read contract. STORY-001-042 (board), STORY-001-041
> (audio) and STORY-001-038 (Scorer device mirror) are all pure read-only
> consumers waiting on the same contract. This story is where that contract —
> and the engine that drives it — actually gets built. It is confirmed
> **100% greenfield**: no timer, clock, phase, or groupRun module exists
> anywhere in `apps/base/src` or `packages/shared/src` today.

> **Resolution addendum (post-REASONS-Canvas, 2026-07-16):** three
> ambiguities this analysis raised have since been resolved by the user and
> are now settled decisions, reflected in
> `spdd/prompt/STORY-001-040-202607161530-[Prompt]-group-timer-engine-and-shared-clock.md`.
> The rest of this analysis is retained unchanged as the historical record of
> the reasoning that led there; where it still poses these three points as
> open questions, the resolution below supersedes it.
> 1. **Clock keying and the "idle" question (§ Requirement Ambiguities,
>    "What 'the clock' actually is as a data shape")**: resolved in
>    STORY-001-032's favour. `GroupRunPhase` is keyed on `(competitionId,
>    roundNumber, groupFlyingOrder)` and its `phase` field is **always** one
>    of the three fixed values (`Preparation`/`WorkingTime`/`Landing`) — there
>    is no fourth "idle"/"between groups" phase value, and this story's
>    `GroupRunPhaseProvider` is a partial function only ever consulted while a
>    run is active. Whether a run is active at all is `RunningSubState`
>    territory (`BetweenGroups`/`GroupInProgress`), owned by STORY-001-044,
>    not this story's read model to represent.
> 2. **`group.opened`/`group.scored` emission ownership (§ Technical Risks,
>    the item naming this ambiguity explicitly)**: resolved as
>    STORY-001-044 alone — not this story's timer engine, and not
>    STORY-001-032's run-control service. This engine only reacts to those
>    lifecycle facts (STORY-001-044 triggers this engine's scheduler after
>    appending `group.opened`); it never appends them itself.
> 3. **`prepGateHeld`'s three-way split (§ New Concepts Required and
>    § Key Design Decisions, "Attribution on system-emitted events" / gate
>    ownership)**: confirmed correct as originally reasoned — STORY-001-034
>    owns device-confirmation mechanics, STORY-001-044 owns displaying the
>    hold state, STORY-001-032 owns the gate's release, and this story's
>    projection only folds whatever events those three emit into one
>    pass-through boolean it does not interpret. This was a deliberate design
>    choice, confirmed by the user, not an oversight requiring further
>    changes.
> 4. **`isDurationShaped` field ownership (§ Key Design Decisions,
>    "Duration-shaped vs. manual-run classification's owner," and § Technical
>    Risks, "No duration-shaped/manual-run classification field exists")**:
>    resolved as STORY-001-044's sole ownership — it adds and owns the
>    `isDurationShaped` field on `TaskParameterSet` (it must branch on it to
>    choose between the phased sequence this story drives and its own
>    reactive manual-run completion handling). This story is a **consumer
>    only**, reading the field through its `TaskShapeProvider` seam; the
>    prior "whichever story's canvas lands first adds it" framing is
>    superseded.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-40]group-timer-engine-and-shared-clock.md`.

# [STORY-001-040] Drive the Group's Phased Countdown from One Shared Clock

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.1.1, §6.1.2 ·
> `docs/requirements/high-level-requirements.md` Area 6.1 · `docs/requirements/
> decisions.md` D5 (end of working time does not stop the device stopwatch),
> D9 (per-flight timestamps on the base clock), D10 (operator-driven
> progression) · `docs/requirements/rules/00-general-rules.md` §2 · relates to
> STORY-001-032 (Contest Director's authority over this timer's preparation
> phase), STORY-001-038 (the Scorer device's read-only mirror of this clock),
> STORY-001-044 (the group-start action that begins this sequence)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Once a group is started ([STORY-001-044](%5BUser-story-44%5Dgroup-start-control-and-manual-run-tasks.md)),
its **duration-shaped** tasks run an automatic three-phase sequence —
**preparation**, **working time**, **landing window** — advancing from one
phase to the next with no Announcer/Timekeeper action in between. This story
delivers that phased-countdown engine and the **single shared clock** it runs
on: the same clock the field board ([STORY-001-042](%5BUser-story-42%5Dfield-display-board.md)),
the audio callouts ([STORY-001-041](%5BUser-story-41%5Daudio-callout-sequence.md))
and every Scorer device ([STORY-001-038](%5BUser-story-38%5Dscorer-device-phase-and-clock-mirror.md))
read from, so what the field sees, hears and captures on can never drift
apart.

Preparation and the landing window take their durations from the
per-competition field-aid settings ([3.8](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration));
working time takes its duration from the **current round's task**
([3.7](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
which may differ round to round. When working time reaches zero the engine
marks the end-of-working-time boundary the class rules cap countable flight
time against — it does **not** stop a Scorer's device stopwatch (D5); the
Scorer keeps timing to the model's first ground contact, and the engine's own
per-flight timestamps on this same clock (D9) let the system derive any
overfly later, downstream of this story.

### Business Value

- Let a duration-shaped group fly to one automatic, visible timeline instead
  of the Announcer/Timekeeper driving each phase transition by hand.
- Guarantee the board, the audio and every Scorer device can never show a
  different phase or time from one another, because all three read the same
  clock.
- Feed the per-flight, base-clock timestamps the downstream overfly/cap
  derivation (D5/D9) depends on, without the timer itself judging or scoring
  anything.

### Dependencies and Assumptions

- **Prerequisites**: a group has been started ([STORY-001-044](%5BUser-story-44%5Dgroup-start-control-and-manual-run-tasks.md));
  the current round's task and its working-time duration, and the
  per-competition preparation/landing-window durations ([3.7](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)/[3.8](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  are already configured.
- **Data assumptions**: whether a task is duration-shaped (runs this sequence)
  or manual-run (does not) derives from the task type, not configuration
  (D10) — a manual-run group's handling is STORY-001-044's, not this story's.
- **Integration points**: the Contest Director's preparation-only
  pause/fast-forward/add-time/abort authority (STORY-001-032) acts directly on
  this engine's preparation phase; the board, audio and Scorer devices are
  read-only consumers of the clock this story produces.
- **Business constraints**: working time and the landing window run to their
  configured durations and are never paused or shortened by this story (only
  the Contest Director's abort reaches them, STORY-001-032); the core stays
  class-agnostic (CLAUDE.md) — durations are read from configuration, never
  hard-coded per class.

### Scope In

- Advancing a duration-shaped group automatically through preparation →
  working time → landing window with no manual trigger between phases.
- Reading preparation and landing-window durations from the per-competition
  field-aid settings, and working-time duration from the current round's
  task.
- Marking the end-of-working-time boundary at zero without stopping Scorer
  device timing.
- Stamping each phase transition and each flight's start/stop on the shared
  clock (D9), for downstream cap/overfly derivation to consume.
- Exposing one shared clock (round, group, phase, remaining time) that the
  board, audio and Scorer devices all read from.
- Resetting the clock cleanly for each new group with no leftover state from
  the previous group's run.

### Scope Out

- The board's presentation of the clock — STORY-001-042.
- The audio callouts fired on phase/time changes — STORY-001-041.
- The Scorer device's mirror of the clock — STORY-001-038.
- The Contest Director's pause/fast-forward/add-time/abort authority over
  preparation, and the prep confirmation gate's release — STORY-001-032.
- The deliberate action that starts a group, and manual-run task handling —
  STORY-001-044.
- Deriving overflies, caps or bonus conversions from the stamped
  timestamps — downstream scoring (Area 5), not this timer.

### Acceptance Criteria

#### AC1: The phases advance automatically in order
**Given** a duration-shaped group has been started
**When** its sequence runs
**Then** it counts down preparation, then working time, then the landing
window, each flowing into the next with no manual trigger between them.

#### AC2: Durations come from configuration, not a fixed value
**Given** round 3's task specifies an 8-minute working time and the
competition's field-aid settings specify a 5-minute preparation and a
3-minute landing window
**When** round 3's group runs its sequence
**Then** preparation counts down 5 minutes, working time counts down 8
minutes, and the landing window counts down 3 minutes — and a later round
with a 10-minute working-time task uses 10 minutes without any manual
retiming.

#### AC3: End of working time is marked without stopping device timing
**Given** working time reaches zero while a competitor's model is still
airborne
**When** the boundary is reached
**Then** the engine marks the end-of-working-time boundary and stamps it on
the shared clock, while the Scorer's device continues timing to first ground
contact unaffected.

#### AC4: Phase transitions and flight events are timestamped on the shared clock
**Given** a flight starts and later ends during working time
**When** each event occurs
**Then** it is stamped against the same shared clock as the phase
transitions, so downstream cap/overfly derivation has a single consistent
timeline to work from.

#### AC5: One clock feeds the board, audio and devices identically
**Given** a group is running
**When** the phase or remaining time changes
**Then** the board, the audio callouts and every Scorer device all reflect
the same phase and remaining time, because all three read this one clock.

#### AC6: The clock resets cleanly between groups
**Given** a group's landing window has ended
**When** the next group is started
**Then** the clock resets with no leftover phase, time or flight state from
the previous group's run.

#### Non-Functional Expectations
- The timer engine carries no knowledge of any specific competition class —
  it reads whatever durations the current round's task and the
  per-competition field-aid settings declare (CLAUDE.md class-model law).
- The engine runs entirely on the Base Station, offline (D6).

### INVEST Check

Independent (a self-contained clock/phase engine consumed by, but separable
from, the board, audio and device mirror) · Valuable (the one automatic
timeline every field surface depends on) · Small (4 days, 3 functional
points: automatic phase advance with configured durations, end-of-working-time
marking + timestamping, the shared-clock reset between groups) · Testable
(phase order and durations, the end-of-working-time boundary, and the clean
reset are all directly observable).

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **`LifecycleState` / `RunningSubState`** (`packages/shared/src/lifecycle.ts`):
  `Running` carries `runningSubState: "BetweenGroups" | "GroupInProgress"` —
  the coarsest existing notion that "a group is live," folded by
  `LifecycleProjection` from the declared-but-unemitted `group.opened` /
  `group.scored` event types (`packages/shared/src/events.ts:479-480`,
  `apps/base/src/lifecycle/projection.ts:80-89`). This story owns turning
  `GroupInProgress` into something with actual phase granularity
  (preparation/working/landing) — today it is a single boolean-shaped flag
  with no concept of *which* phase.
- **`group.opened` / `group.scored`** (`packages/shared/src/events.ts:479-480`):
  scoped `competitionId`, explicitly documented as owned by "STORY-001-011 /
  Area 6" for emission — i.e. this story (or its sibling STORY-001-044) is
  one of the intended emitters. No emitter exists yet; the type declarations
  are the only artifact.
- **`CompetitionTaskConfig` / `TaskConfigEntry`** (`packages/shared/src/
  task-config.ts`, `apps/base/src/task-config/service.ts`): the merged
  overlay-on-model view that already supplies `baseTargetSeconds` per task
  per round (with `roundOverrides`) — the concrete, already-built source this
  story reads working-time duration from (AC2's "round 3's task specifies an
  8-minute working time"). `CompetitionTaskConfigService.get()` returns this
  merged view keyed by `competitionId`; this story's engine is a natural new
  consumer of that same service/projection, not a new duration store.
- **`TaskParameterSet`** (`packages/shared/src/class-model.ts:98-136`): the
  rule-fixed per-task bundle (`perRoundOverrideAllowed`, `timingPrecision`,
  etc.) that task-config overlays against. Notably, **it carries no field
  distinguishing a duration-shaped task from a manual-run one** — see New
  Concepts / Risks.
- **Field-aid settings (Area 3.8)**: named in this story's own Dependencies
  as the source of preparation/landing-window durations. Confirmed absent
  from the codebase — no route, service, projection, or shared type for
  "field-aid," "prep duration," or "landing window duration" exists anywhere
  (`apps/base/src/competitions/state-providers.ts:91`'s own comment names
  "the remaining 3.5–3.8 config surfaces" as not yet built). This story's
  landing/prep durations therefore have **no configuration surface to read
  from today** and either this story or a co-requisite slice must define one.
- **The event-sourced projection pattern** (`EventStore` append + one
  projection per aggregate, `rebuild()` from the full log, `scope =
  competitionId` for content events): the substrate this story's clock state
  must be built on, mirroring `CompetitionTaskConfigProjection` and
  `LifecycleProjection` exactly — derived, discardable, rebuildable state
  (D4/D7), never a bespoke persistence path.
- **`Attribution` pattern** (`apps/base/src/routes/draw.ts`): the two-helper,
  header-driven shape (`attributionFromHeaders()` /
  `cdAttributionFromHeaders()`) every other story in this codebase uses to
  stamp who acted. This story's own transitions (phase advance, boundary
  marking) are system-driven, not operator actions, so they likely need no
  operator `Attribution` at all — a genuine departure from every other
  story's event shape, worth confirming explicitly in REASONS Canvas.
- **`setErrorHandler` per-module branch discipline** (`apps/base/src/app.ts`):
  the existing convention this story's own domain errors (e.g. "no
  duration-shaped task configured for this round") should follow.

#### New Concepts Required

- **Group Phase State (preparation / working time / landing window /
  idle-between-groups)**: the central new concept this story introduces. No
  representation of "which of three phases is a running group currently in"
  exists anywhere — `RunningSubState` only distinguishes "some group is open"
  from "none is." This needs its own projection (or an extension consulted by
  `LifecycleProjection`) that folds phase-transition facts into a current
  `{round, group, phase, remainingSeconds}` read model.
- **Shared Clock read contract**: the `{round, group, phase, remaining time}`
  shape STORY-001-032, STORY-001-042, STORY-001-041 and STORY-001-038 are all
  already written against as a given. This is this story's primary deliverable
  and needs to be specified once, precisely, since four sibling stories
  consume it verbatim.
- **Phase-transition events** (naming TBC in REASONS Canvas, e.g.
  `groupRun.phaseAdvanced` or per-phase events
  `groupRun.preparationStarted`/`workingTimeStarted`/`landingWindowStarted`/
  `groupCompleted`): system-emitted facts advancing the phase state, distinct
  from every existing event in this codebase in that they are **not**
  operator-attributed writes but the product of a running countdown reaching
  zero (or the group-start trigger from STORY-001-044).
- **End-of-working-time boundary marker + per-flight timestamp stamping
  (D9)**: a new fact type recording, on the shared clock's own timeline, the
  moment working time reaches zero and the start/stop instants of each
  flight — feeding downstream overfly/cap derivation (Area 5, explicitly out
  of this story's scope) but owned here as the timestamp source of record.
- **Duration-shaped vs. manual-run task classification**: this story's own
  Data Assumptions state this "derives from the task type, not
  configuration" — but `TaskParameterSet` (`class-model.ts`) has **no field**
  encoding this today. Either this story or STORY-001-044 (which is
  explicitly the one that branches on it, per this story's own Scope Out)
  must introduce this classification; it is a shared prerequisite concept
  neither story currently owns in code.
- **Field-Aid Settings (Area 3.8: preparation duration, landing-window
  duration)**: confirmed unbuilt configuration surface this story depends on
  for two of its three phase durations. Needs its own event/projection/route
  slice (mirroring `CompetitionTaskConfigService`'s shape) unless this story
  chooses to bundle a minimal read-only stand-in and treat the full
  configuration UI as a co-requisite.
- **Clock reset-per-group semantics (AC6)**: a new "this group's run is
  closed out, next start begins from a clean slate" rule — likely the
  natural product of scoping all phase/timestamp state under a `(round,
  group)` key rather than a single mutable global, so no explicit "reset"
  mutation is needed at all, only correct key scoping. Needs to be decided
  explicitly rather than left as an implicit assumption.

#### Key Business Rules

- **Phases advance automatically, no manual trigger between them** (AC1,
  D10) — governs the core sequencing logic; D10 restricts *manual* operator
  action to starting/aborting a group, never to driving intermediate phase
  transitions.
- **Durations are read from configuration, never hard-coded** (AC2,
  CLAUDE.md) — preparation/landing from field-aid settings (3.8), working
  time from the current round's task (3.7); a class-agnostic core reads both,
  branches on neither.
- **End of working time marks a boundary; it does not stop device timing**
  (AC3, D5) — the engine's own clock state changes at zero, but this story
  must not emit or imply any signal a Scorer device would interpret as "stop
  the stopwatch."
- **Every phase transition and flight start/stop is timestamped on the same
  clock** (AC4, D9) — the single-timeline guarantee downstream overfly/cap
  derivation depends on; two different clocks (e.g. device-local time vs.
  base time) would break this invariant.
- **One clock, three identical consumers** (AC5) — the board, audio and every
  Scorer device must be unable to observe a different phase/time from one
  another; this rules out per-consumer derived/cached copies of phase state
  that could drift, and argues for a single read model all three poll or
  subscribe to.
- **Clean reset between groups, no leftover state** (AC6) — the previous
  group's phase/timestamps must not bleed into the next group's run.

## Strategic Approach

#### Solution Direction

- **Follow the established event-sourced/projection pattern exactly**: a new
  `group-run` (or `timer`) module under `apps/base/src`, structured like
  `task-config/` or `lifecycle/` — a service that appends phase-transition
  events, a projection that folds them into the current clock read model, and
  a route exposing that read model. This is a "new module in an established
  shape," not an architectural departure.
- **Treat this story as the producer half of a producer/consumer split
  already implied by the four sibling stories.** STORY-001-032, -038, -041,
  -042 all consume "round, group, phase, remaining time" as a given; this
  story's primary deliverable is *defining that shape precisely* (field
  names, phase enum values, how remaining time is computed/exposed) so the
  four consumers can be built against a stable contract, mirroring how
  `LifecycleState`/`RunningSubState` already serve as a shared read contract
  between base and companion.
- **General data flow**: STORY-001-044's group-start action → this engine
  reads working-time duration from `CompetitionTaskConfigService` and
  preparation/landing durations from the (currently unbuilt) field-aid
  settings → engine emits phase-transition + timestamp events on its own
  timeline → its projection folds them into the shared clock state → board /
  audio / device routes (siblings' scope) read that state.

#### Key Design Decisions

- **Where "remaining time" lives**: an event-sourced *countdown* is unusual —
  most events in this codebase are discrete facts, not a continuously
  ticking value. *Trade-off*: modelling remaining time as a stored,
  periodically-updated value (a live server-side timer/interval) vs.
  computing it on read from a stored "phase started at T, duration D" fact
  plus current wall-clock time. → **Recommendation**: derive remaining time
  from `{phaseStartedAt, durationSeconds}` on read, mirroring the append-only,
  no-hidden-mutable-state discipline this codebase uses everywhere else (no
  ticking background job needed for the *read* path); a lightweight
  server-side scheduler is still needed to *emit* phase-transition events
  when a phase's duration elapses, but the read model itself stays a pure
  function of stored data ("phase started at T" + duration) and current
  time, matching D7 (derived, rebuildable state).
- **Field-aid settings as a co-requisite vs. this story's own slice**: this
  story explicitly assumes 3.8 configuration already exists (Dependencies:
  "already configured"), yet it is confirmed unbuilt. *Trade-off*: build a
  minimal field-aid settings read surface as part of this story (small, but
  scope creep beyond the story's stated boundary) vs. treat it as a hard
  external prerequisite and stub it (risks an undemonstrable AC2 until the
  real config lands, mirroring STORY-001-032's documented situation). →
  **Recommendation**: surface this explicitly to the user before REASONS
  Canvas rather than silently choosing; the story's own Scope In/Out is
  silent on which side of the boundary 3.8 falls.
- **Duration-shaped vs. manual-run classification's owner**: this story's
  Data Assumptions state the classification exists and derives from "task
  type," but no code owns it (`TaskParameterSet` has no such field) and
  Scope Out attributes manual-run *handling* to STORY-001-044. →
  **Recommendation**: this story consumes the classification (does not run
  its sequence for a manual-run task) but does not introduce the
  classification field itself; confirm with STORY-001-044's REASONS Canvas
  which story adds the field to `TaskParameterSet` (or a task-config
  extension) so it is not designed twice.
- **Event granularity for phase transitions**: one generic
  `groupRun.phaseAdvanced` event carrying a `phase` field, vs. one distinct
  event per phase (`preparationStarted`/`workingTimeStarted`/
  `landingWindowStarted`/`groupCompleted`). → **Recommendation**: distinct
  events, matching this codebase's established one-payload-per-fact
  discipline (e.g. `draw.groupMoved`/`draw.groupSplit` rather than a generic
  "draw edit"), each independently foldable and each a clean hook point for
  STORY-001-041's audio callouts (which fire per-phase-start) and
  STORY-001-032's phase guard (which checks "is the current phase
  preparation?").
- **Attribution on system-emitted events**: every existing writable event in
  this codebase carries an operator `Attribution`; this story's phase
  transitions are clock-driven, not operator actions. → **Recommendation**:
  omit `Attribution` on these events (or record a fixed system actor) rather
  than forcing an artificial operator attribution — confirm this
  intentional departure explicitly in REASONS Canvas since it breaks an
  otherwise-universal pattern.

#### Alternatives Considered

- **Modelling the clock as a single mutable "current state" row updated in
  place** (not event-sourced): rejected — breaks D4 (immutable event log)
  and D7 (derived, rebuildable projections), and would leave the timestamped
  audit trail AC4/D9 explicitly requires unrecoverable after a restart.
- **A generic polymorphic `timer.event` with a discriminant field** instead
  of distinct phase-transition events: rejected for the same reason
  `draw.groupMoved`/`draw.groupSplit` are kept distinct in the existing
  codebase — a discriminated union event is harder to fold correctly and
  harder for each of the four consumer stories to subscribe to selectively.
- **Building this story's engine with a hard-coded field-aid duration
  default** (bypassing the missing 3.8 configuration) to make AC2
  demonstrable without waiting: rejected outright — CLAUDE.md's class-model
  law and this story's own Non-Functional Expectations explicitly forbid any
  hard-coded duration; a stub must be an explicit, temporary, clearly-labelled
  seam (mirroring `AlwaysUnlockedProvider`/`NotStartedProvider`), never a
  silent hard-coded number.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Field-aid settings (Area 3.8) are assumed pre-configured but do not exist
  in the codebase.** This story's Dependencies section states preparation and
  landing-window durations "are already configured," but no route, service,
  projection, or shared type for field-aid settings exists anywhere. Either
  this story must define a minimal configuration read surface, or the
  dependency needs to be sequenced as a co-requisite slice — this is not
  addressed by the ACs and needs explicit resolution before REASONS Canvas.
- **How "remaining time" is transmitted/exposed to three different consumer
  surfaces (board, audio, devices)** is unstated — polling, push/subscribe,
  or a plain read endpoint the companion/board queries. AC5 requires
  identical values across all three but does not constrain the transport,
  which matters for offline-first devices (D6) that may not maintain a live
  connection.
- **The duration-shaped/manual-run task classification's home** is assumed
  to exist ("derives from the task type") but has no field in
  `TaskParameterSet` or anywhere else today. This story and STORY-001-044
  both consume this classification; neither's requirement text says who
  defines it.
- **What "the clock" actually is as a data shape** (a single row per
  competition? per round? per group?) is unstated beyond "round, group,
  phase, remaining time" — since a competition can only have one group
  "in progress" at a time (per `LifecycleProjection`'s `openGroups` count
  logic), this likely keys on `competitionId` alone, but this should be
  confirmed since STORY-001-032's abort (which "restarts from preparation")
  and this story's own reset (AC6) both depend on the exact keying.

#### Edge Cases

- **A competition suspended (STORY-001-013) mid-phase** — does the clock
  pause, does remaining time keep elapsing against wall-clock time while
  suspended, or is suspension only legal `BetweenGroups` (per
  `LifecycleGuard`, which currently only admits Suspend from
  `Running/BetweenGroups`)? If the guard already forbids suspending
  mid-group, this edge case may already be structurally excluded — worth
  confirming as a design constraint this story can rely on rather than
  re-litigating.
- **The Base Station process restarting mid-phase** (D6 offline-first, no
  external clock dependency assumed) — since remaining time is recommended
  to derive from `{phaseStartedAt, duration}` plus wall-clock time (not an
  in-memory countdown), a restart should recover correctly by re-deriving
  from the event log; this should be an explicit design goal, not an
  incidental property.
- **A round whose task is manual-run following one whose task was
  duration-shaped** (or vice versa) — the shared clock's phase state must
  cleanly reflect "no automated sequence is running" for a manual-run
  group without stale phase/remaining-time values from a prior
  duration-shaped group leaking through the same read contract STORY-001-038
  polls.
- **Working time's duration changing between rounds mid-competition** (AC2's
  own example) — since `CompetitionTaskConfig` overlays can, per its own
  service code, be edited even after Start (with contest-director
  attribution, STORY-001-025), does an in-flight group ever re-read a
  changed duration, or is the duration snapshotted at phase-start? Not
  addressed by the ACs; a snapshot-at-phase-start is almost certainly
  intended (a group already running should not have its working time change
  under it) but should be stated explicitly.

#### Technical Risks

- **(Highest, confirmed) Field-aid settings (Area 3.8) do not exist.** Zero
  hits for "fieldAid"/"field-aid"/"preparation duration"/"landing window
  duration" as a configuration concept anywhere in `apps/base/src` or
  `packages/shared/src` (the only "preparation" hits are the unrelated
  re-flight-preparation concept in `draw/`). *Impact*: AC2 cannot be fully
  demonstrated without a configuration source for two of the three phase
  durations. *Mitigation*: as recommended above, surface this explicitly and
  agree the sequencing/scope split before design.
- **(Confirmed) No duration-shaped/manual-run classification field exists.**
  `TaskParameterSet` (`class-model.ts:98-136`) has fields for timing
  precision, points-per-second, landing scoring, NLH, penalties and
  per-round-override permission — no field for "does this task run the
  phased timer sequence." *Impact*: this story cannot determine, from
  existing data, whether to run its sequence at all for a given task.
  *Mitigation*: coordinate with STORY-001-044's REASONS Canvas on which
  story adds this field.
- **A continuously-elapsing "remaining time" is a new kind of read model for
  this codebase.** Every existing projection (`CompetitionTaskConfigProjection`,
  `LifecycleProjection`, `DrawProjection`) computes a value purely from
  folded discrete events with no dependency on "the current wall-clock
  instant." This story's clock is the first read model whose correct value
  depends on *when* it is read, not just *what has been logged* — this is a
  new category of derived state (still D7-compliant if built as
  event-time-plus-now, but genuinely novel) and needs a scheduler/mechanism
  to actually *emit* the phase-advance events when a duration elapses (the
  read side can be pure, but something must drive the automatic transitions
  of AC1 — polling, a timer/interval, or a lazy "compute current phase on
  every read, emit the transition event on the read that first observes the
  boundary crossed" design). This mechanism choice is unaddressed by the
  requirement and materially affects implementation.
- **`group.opened`/`group.scored` are declared as the fact source for
  `RunningSubState`, but no emitter exists (owned by "STORY-001-011 / Area
  6").** This story is plausibly one of the emitters (a group entering
  preparation is the moment `group.opened` should fire) but the requirement
  attributes "the deliberate action that starts a group" to STORY-001-044,
  not here. *Impact*: which story actually appends `group.opened` is
  currently ambiguous between STORY-001-040 and STORY-001-044. *Mitigation*:
  resolve explicitly — likely STORY-001-044 appends `group.opened` as the
  trigger, and this story's phase-transition events are a distinct,
  finer-grained fact stream layered on top, but this needs confirming since
  `LifecycleProjection` already hard-codes `group.opened`/`group.scored` as
  the *only* facts it folds for `GroupInProgress`.
- **No existing precedent for a Contest-Director-mutated countdown
  (STORY-001-032's pause/fast-forward/add-time) over this story's own
  phase state.** Every existing mutable-overlay pattern in this codebase
  (`CompetitionTaskConfig`, draw overlays) is a full-replace-on-edit shape;
  STORY-001-032 needs incremental deltas (±1 minute) applied to a live
  countdown. This story's event/projection shape needs to anticipate that
  consumption pattern (e.g. storing `phaseStartedAt` + `durationSeconds`
  separately so a delta can adjust `durationSeconds` without recomputing
  `phaseStartedAt`) even though applying those deltas is explicitly out of
  this story's own scope.
- **No FAI-rule or cross-requirement contradiction found.** The story is
  consistent with D5 (device stopwatch not stopped at end of working time),
  D9 (per-flight base-clock timestamps), D10 (operator-driven progression —
  only start/abort are manual, per Scope Out), D6 (offline, on the Base
  Station) and general-rules §2 (the timer/helper data the class rules cap
  against). No conflict with `docs/requirements/rules/` was found.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Phases advance automatically, no manual trigger between them | Yes | Buildable against the established event/projection pattern; needs a scheduler/emission mechanism decision (see Technical Risks) but no external blocker. |
| 2 | Durations come from configuration (task-config for working time; field-aid for prep/landing) | **Partial** | Working-time duration source (`CompetitionTaskConfigService`) is fully built and directly usable; preparation/landing-window duration source (field-aid settings, Area 3.8) does not exist in the codebase — this half of AC2 cannot be demonstrated until that configuration surface is defined. |
| 3 | End-of-working-time boundary marked, device timing unaffected | Yes | Purely an event-emission/timestamp concern on this story's own clock; no device-side behaviour is touched (correctly out of scope), so no external blocker. |
| 4 | Phase transitions and flight events timestamped on one shared clock | **Partial** | Phase-transition timestamping is this story's own concern and fully addressable; flight start/stop timestamping depends on how Scorer-device flight events reach the base (STORY-001-038's scope) — this story can define the timestamp *slot* but not originate the flight-event trigger itself. |
| 5 | Board, audio and devices all read one identical clock | Yes | Addressable by this story defining a single, precise read contract; actual consumption is the three sibling stories' scope, correctly excluded here. |
| 6 | Clock resets cleanly between groups | Yes | Addressable via correct `(round, group)` keying of all phase/timestamp state, as recommended above — no external blocker, though the exact keying needs to be decided explicitly (see Ambiguities). |

## Summary of Key Points for REASONS Canvas

1. **This is the foundational Area 6 story** — STORY-001-032, -038, -041 and
   -042 are all written as consumers of the shared-clock contract this story
   defines. Get the read contract's shape (round, group, phase, remaining
   time, and how remaining time is derived) right once here, since four
   sibling stories depend on it verbatim.
2. **Two concrete gaps outside this story's own text block full AC2/AC4
   demonstration**: Area 3.8 field-aid settings (preparation/landing-window
   duration configuration) and the duration-shaped/manual-run task
   classification both do not exist in the codebase and are not clearly
   owned by this story or its siblings (STORY-001-044 in the classification
   case). Resolve ownership explicitly before design.
3. **Recommended technical direction**: derive "remaining time" from stored
   `{phaseStartedAt, durationSeconds}` plus current time (a pure, D7-compliant
   read), with distinct per-phase transition events (not a generic
   discriminated event) emitted via a small scheduler/interval mechanism —
   matching this codebase's established one-fact-per-event-type discipline
   while accommodating the genuinely new "value changes with wall-clock time"
   read-model category.
4. **System-emitted events likely carry no operator `Attribution`** — an
   intentional, explicit departure from every other writable event in this
   codebase, worth confirming rather than silently designing around.
5. **Coordinate with STORY-001-044 on `group.opened` ownership**: STORY-001-044
   most plausibly appends `group.opened` (the deliberate start action) while
   this story layers finer-grained phase-transition events on top, but the
   requirement text does not make this split explicit and
   `LifecycleProjection` already hard-codes `group.opened`/`group.scored` as
   its only fact sources for `GroupInProgress`.
6. **No FAI-rule or existing-requirement conflict found** — consistent with
   D5/D6/D9/D10 and general-rules §2; no discipline branch anywhere in this
   story's own logic (CLAUDE.md class-model law upheld throughout).
