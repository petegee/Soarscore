# SPDD Analysis: Start Every Group with One Deliberate Action

> **The trigger both sibling stories are already written against — and the
> most buildable piece of Area 6.5's greenfield.** STORY-001-040's own
> analysis names this story as the source of `group.opened`; STORY-001-032's
> own analysis names this story's start action as the precondition for every
> one of its seven authority actions; STORY-001-045's own analysis names this
> story's endpoint as what the companion console's "Start Group" button calls.
> Unlike those three siblings, three of this story's five ACs (AC2, AC3, AC4)
> depend on nothing unbuilt — they are addressable with code that exists
> today (`GroupCompositionProvider`, the event-sourced projection pattern,
> `LifecycleGuard`). Only AC5 (the held prep-confirmation gate's visibility)
> is genuinely blocked, on STORY-001-034 (prep-gate mechanics, confirmed
> zero code) and indirectly STORY-001-032 (release authority, also zero
> code). AC1's duration-shaped hand-off is buildable on this story's own
> side but its *visible outcome* (the sequence actually running) is
> co-dependent on STORY-001-040, which is itself greenfield.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-44]group-start-control-and-manual-run-tasks.md`.

# [STORY-001-044] Start Every Group with One Deliberate Action

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.5.1 ·
> `docs/requirements/high-level-requirements.md` Area 6.5 · `docs/requirements/
> decisions.md` D10 (operator-driven progression) · `docs/requirements/rules/
> 00-general-rules.md` §1 · relates to STORY-001-040 (the phased sequence this
> starts), STORY-001-032 (the Contest Director's authority once a group is
> running), STORY-001-034 (the prep confirmation gate this exposes as a hold)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Every group — whether its task runs the automatic phased sequence
([STORY-001-040](%5BUser-story-40%5Dgroup-timer-engine-and-shared-clock.md))
or is manual-run (e.g. F3B Distance/Speed, F3K all-up) — begins with the same
single, deliberate action from the Announcer/Timekeeper: nothing starts
itself (D10). This story delivers that start action and its two outcomes,
which the Announcer/Timekeeper triggers identically either way, since
whether a task is sequence-driven or manual-run derives from the task type,
not from anything the operator chooses.

For a duration-shaped task, starting the group hands off to the phased
sequence (STORY-001-040): announce round/group → announce pilots →
preparation. For a manual-run task, starting the group marks it current and
gives Scorer devices their group context for normal capture, but runs no
automated countdown, callouts or prep-gate hold — the Announcer/Timekeeper
runs that field by hand. Either way, when the preparation phase's confirmation
gate is holding at one minute remaining because not every pilot has a
confirming device, that hold must be visible to the Announcer/Timekeeper —
so they know why the group hasn't progressed and who is outstanding — even
though only the Contest Director can release it (STORY-001-032).

### Business Value

- Let the Announcer/Timekeeper move the field only when they judge it ready,
  with one unambiguous action, matching the "hands busy, eyes on the field"
  need.
- Remove any decision burden about *how* to start a group — the same single
  action works whether the task is sequence-driven or manual-run.
- Make a stuck prep confirmation gate visible immediately, so the
  Announcer/Timekeeper isn't left wondering why a group hasn't moved.

### Dependencies and Assumptions

- **Prerequisites**: the previous group (if any) has ended its landing
  window or, for a manual-run task, its field-run is complete; the phased
  sequence engine exists to hand off to (STORY-001-040); the prep
  confirmation gate exists to expose as a hold ([5.0.4](../docs/user-stories/03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)).
- **Data assumptions**: whether the current group's task is duration-shaped
  or manual-run derives from the task type/configuration, not an operator
  choice (D10); the prep confirmation gate's hold state and the outstanding
  pilot(s)/device(s) are available to display.
- **Integration points**: for duration-shaped tasks, this action hands off
  to STORY-001-040's sequence; for manual-run tasks, it marks the group
  current and pushes group context to Scorer devices with no automated
  clock; the Contest Director's pause/fast-forward/add-time/abort/gate-
  release authority (STORY-001-032) acts on a group only after this start
  action.
- **Business constraints**: no group crosses its start boundary
  automatically (D10); the start action itself must require minimal,
  unambiguous interaction — a stated field need.

### Scope In

- One single, deliberate start action per group, usable identically
  regardless of whether the task is duration-shaped or manual-run.
- For a duration-shaped task: handing off to the automatic phased sequence
  (announce round/group → announce pilots → preparation) on start.
- For a manual-run task: marking the group current and giving Scorer devices
  their group context, with no automated countdown, callouts or prep-gate
  hold.
- Requiring the same repeated single action to start each subsequent group —
  no group, sequence-driven or manual-run, starts itself after the previous
  one ends.
- Displaying the prep confirmation gate's hold (which pilot(s)/device(s) are
  outstanding) when it is active, so the Announcer/Timekeeper can see why a
  group hasn't progressed.

### Scope Out

- The phased sequence's internal countdown/phase logic — STORY-001-040.
- The audio callouts and field board — STORY-001-041, STORY-001-042.
- Releasing the prep confirmation gate, pausing/fast-forwarding/adding time
  to preparation, and aborting a group — all Contest Director authority,
  STORY-001-032.
- The round-boundary score-completeness gate — STORY-001-043 (this story's
  group start is never score-gated; only the round advance is).
- The prep confirmation gate's own mechanics (device confirmation, exclusive
  claim per pilot) — STORY-001-034.

### Acceptance Criteria

#### AC1: A duration-shaped group starts its sequence with one action
**Given** a duration-shaped group (e.g. an F3J flight-time task) is ready
**When** the Announcer/Timekeeper starts it with the single start action
**Then** the sequence begins — announce round/group, announce pilots, then
preparation — with no further action needed to reach preparation.

#### AC2: A manual-run group starts with the same single action, no automation
**Given** the current group's task is manual-run (e.g. F3B Speed)
**When** the Announcer/Timekeeper starts it with the same single start action
**Then** the group is marked current and Scorer devices receive their group
context for normal capture, but no automated countdown, callouts or
prep-gate hold run.

#### AC3: The next group never starts itself
**Given** a duration-shaped group has finished its landing window (or a
manual-run group's field-run is complete)
**When** the next group is due
**Then** it does not begin on its own — the Announcer/Timekeeper starts it
with the same single action, whenever the field is ready.

#### AC4: The start action requires minimal, unambiguous interaction
**Given** a group is ready to start
**When** the Announcer/Timekeeper triggers the start action
**Then** it requires only one deliberate, unambiguous interaction — no
multi-step confirmation sequence — consistent with hands-busy, eyes-on-the-
field use.

#### AC5: A held prep confirmation gate is visible to the operator
**Given** the preparation countdown has paused at one minute remaining
because one pilot's device has not confirmed
**When** the Announcer/Timekeeper looks at the field aids
**Then** the hold is visibly shown, along with which pilot/device is
outstanding, even though only the Contest Director can release it
(STORY-001-032).

#### Non-Functional Expectations
- The start action carries no knowledge of any specific competition class —
  whether a group runs the automated sequence or is manual-run derives
  generically from the task's declared shape (CLAUDE.md class-model law).

### INVEST Check

Independent (a single start action and its two outcomes, distinct from the
sequence engine, authority actions and round gate it touches) · Valuable
(the zero-fuss, single-action control the field-side role fundamentally
needs) · Small (3 days, 3 functional points: duration-shaped start hand-off,
manual-run start with no automation, prep-gate hold visibility) · Testable
(both start outcomes, the never-auto-starts behaviour, and the hold's
visibility are all directly observable).

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **`LifecycleState` / `RunningSubState`** (`packages/shared/src/lifecycle.ts`,
  `apps/base/src/lifecycle/projection.ts`): `Running` already carries
  `runningSubState: "BetweenGroups" | "GroupInProgress"`, folded from
  `group.opened`/`group.scored` counts (`openGroups` map). This story's start
  action is the natural, and currently only plausible, emitter of
  `group.opened` — the exact fact that flips `BetweenGroups` →
  `GroupInProgress`. No emitter exists today; the projection's fold logic is
  already correct and waiting.
- **`GroupOpenedPayload`** (`packages/shared/src/events.ts:513-517`): already
  declared as `{competitionId, roundNumber, groupFlyingOrder}` — exactly the
  identifying triple this story's start action needs to carry. This is a
  ready-made target shape, not something to redesign.
- **`GroupCompositionProvider` / `DrawServiceGroupCompositionProvider`**
  (`apps/base/src/draw/group-composition-provider.ts`): already returns the
  effective (accepted-draw-plus-overlay) pilot list for a given
  `(competitionId, roundNumber, taskId)` — the concrete source this story
  reads "which pilots are in the group about to start" from, both to push
  Scorer-device group context (AC2) and to identify the group being started.
  Built and reusable as-is.
- **`CompetitionTaskConfig` / `CompetitionTaskConfigService`**
  (`packages/shared/src/task-config.ts`, `apps/base/src/task-config/`): the
  merged per-round task view this story's classification check (duration-
  shaped vs. manual-run) would sit alongside, and the eventual source of
  STORY-001-040's working-time duration once hand-off occurs. Fully built.
- **`TaskParameterSet`** (`packages/shared/src/class-model.ts:98-136`): the
  rule-fixed per-task bundle (`timingPrecision`, `pointsPerSecond`,
  `perRoundOverrideAllowed`, etc.). Confirmed: **no field distinguishing a
  duration-shaped task from a manual-run one exists**. This is the natural
  home for that classification (see New Concepts) since Area 3.8's own text
  states it "derives from the task type, not from configuration" — i.e. a
  class-model-fixed attribute, not a per-competition override.
- **`LifecycleGuard`** (`apps/base/src/lifecycle/guard.ts`): the single
  source of transition legality, a pure table keyed on `(state, action)`
  with a fixed `ALL_ACTIONS` list (`Delete`, `Suspend`, `Resume`, `Lock`,
  `RoundAdvance`, `Start`). Note the existing `"Start"` action is the Contest
  Director's *Start Proceedings* (STORY-001-025, Setup → Running) — a
  **different action** from this story's per-group start. This story's
  action needs its own admissibility entry (e.g. `GroupStart`), gated to
  `Running/BetweenGroups`, matching the existing `Suspend`/`Lock`/
  `RoundAdvance` shape exactly. Naming collision is worth flagging explicitly
  so `GroupStart` is never confused with lifecycle `Start` in code or copy.
- **`Attribution` pattern** (`apps/base/src/routes/draw.ts`): the two-helper,
  header-driven shape (`attributionFromHeaders()` default-authority /
  `cdAttributionFromHeaders()` CD-hardcoded) every writable event in this
  codebase uses. This story's action is the **Announcer/Timekeeper's**, not
  the Contest Director's — the first action in the codebase attributed to
  that role specifically, though D1 (authority recorded, not enforced) means
  this is a labelling/attribution choice, not an access-control one; likely
  reuses `attributionFromHeaders()`'s default shape unmodified.
- **The event-sourced projection pattern** (`EventStore` append + one
  projection per aggregate, `rebuild()` from the log, `scope =
  competitionId`): the substrate this story's own new module (a "current
  group" pointer, or the fold that answers "is a group open, and if so
  which one") must be built on, mirroring `LifecycleProjection`,
  `CompetitionTaskConfigProjection` and `DrawProjection` exactly.
- **`setErrorHandler` per-module branch discipline** (`apps/base/src/
  app.ts`): the existing convention this story's own domain errors (e.g.
  "a group is already in progress," "competition is not running") should
  follow, ordered alongside the other module branches.

#### New Concepts Required

- **Duration-shaped vs. manual-run task classification**: the field this
  story's own Non-Functional Expectations and Data Assumptions presuppose
  ("derives from the task type") but which does not exist on
  `TaskParameterSet` or anywhere else. STORY-001-040's own analysis leaves
  ownership of this field explicitly open between the two stories; this
  story's own Scope Out ("manual-run task handling... STORY-001-044," per
  STORY-040's text) and its Scope In ("for a manual-run task: marking the
  group current... with no automated countdown") make this story the one
  that actually *branches* on the classification — the strongest signal
  that this story should introduce the field, with STORY-001-040 consuming
  it read-only.
- **Group Start action / `group.opened` emission**: the deliberate,
  single-interaction trigger this story delivers. No route, service, or
  event emitter exists; `GroupOpenedPayload`'s shape is already declared and
  ready to be appended.
- **"Current group" identification**: given `GroupCompositionProvider`
  answers "who is in round N group M" but nothing today answers "which
  round/group is *next* to start," this story needs some way to identify the
  group about to be started — either the Announcer/Timekeeper names it
  explicitly (round + group flying order) or the system derives "the next
  ungrouped group in flying order" from the accepted draw and prior
  `group.opened`/`group.scored` facts. Not stated by the ACs; a genuinely
  new piece of state/logic.
- **Scorer-device group-context push (manual-run path)**: AC2's "Scorer
  devices receive their group context for normal capture" is this story's
  read-side responsibility — feeding STORY-001-034's device-side
  round/group binding (which assumes "the device has received its
  round/group context from the base station" as a prerequisite it does not
  itself deliver). This story is the producer of that context signal;
  STORY-001-034 is the consumer.
- **Prep-Confirmation Gate hold visibility (read-only)**: AC5's "hold is
  visibly shown, along with which pilot/device is outstanding" needs a read
  model this story exposes but does not own the mechanics of — the hold
  state and outstanding-pilot list are STORY-001-034's (gate) and
  STORY-001-032's (release) to define; this story only renders/surfaces
  whatever they produce. Entirely unbuilt today (confirmed: no gate, hold,
  or device-sync-state concept exists anywhere in the codebase).

#### Key Business Rules

- **One deliberate action starts every group, sequence-driven or
  manual-run, with identical operator interaction** (AC1/AC2/AC4, D10) —
  the action itself carries no class-specific branch; only its *outcome*
  differs, and that outcome derives from the task's own declared shape.
- **No group ever starts itself, including the group immediately following
  one that just finished** (AC3, D10) — governs that this story never emits
  `group.opened` except in direct response to the operator's action; no
  background scheduler, no auto-advance.
- **A manual-run start runs no automation whatsoever** (AC2) — no countdown,
  no callouts, no prep-gate hold; the distinction between "marks current +
  pushes context" and "hands off to the phased sequence" is a hard branch on
  the classification, not a partial/degraded version of the automated path.
- **This story's group start is never score-gated** (Scope Out) — completeness
  of the *previous* round's scores is STORY-001-043's round-advance concern,
  not a precondition this story enforces on a group start.
- **The held prep-confirmation gate is visible but not actionable here**
  (AC5) — display-only; only the Contest Director can release it
  (STORY-001-032), and this story must not offer any release control itself.
- **Class-agnostic**: the start action's own logic must not read or branch
  on the Contest Class Model directly — it reads a generic classification
  flag (whatever `TaskParameterSet` field this story introduces), never a
  discipline name (CLAUDE.md class-model law, Non-Functional Expectations).

## Strategic Approach

#### Solution Direction

- **Follow the established event-sourced/projection pattern**: a new
  `apps/base/src/group-run/` module (or similarly scoped), structured like
  `task-config/` or `lifecycle/` — a service that appends `group.opened` on
  the start action, a projection folding it (extending or sitting alongside
  `LifecycleProjection`'s existing `openGroups` fold) into a "which group is
  current, and is it duration-shaped or manual-run" read model, and a route
  exposing both the start action and the prep-gate hold read (once
  STORY-001-034 exists to source it from).
- **Treat this story as the producer half of the producer/consumer split
  STORY-001-040 and STORY-001-034 are already written against**: this
  story's `group.opened` (carrying the classification) is the trigger
  STORY-001-040's phase engine reacts to for duration-shaped tasks and
  ignores for manual-run ones; the same event is what STORY-001-034's
  device-side binding waits for to receive its round/group context.
  Defining this event's exact shape here, once, avoids STORY-001-040 and
  STORY-001-034 each inventing their own "group started" signal.
- **General data flow**: Announcer/Timekeeper triggers the single start
  action → this story resolves "the next group" via
  `GroupCompositionProvider`/accepted draw and the classification read from
  `TaskParameterSet` → appends `group.opened` (carrying
  `competitionId, roundNumber, groupFlyingOrder`, and the classification) →
  `LifecycleProjection`-style fold flips `BetweenGroups` → `GroupInProgress`
  → for duration-shaped tasks, STORY-001-040's engine (a separate consumer,
  out of this story's scope) begins its own phase sequence on observing the
  event; for manual-run tasks, nothing further happens automatically →
  Scorer devices (STORY-001-034, separate consumer) pick up their group
  context from the same fact.

#### Key Design Decisions

All five decisions below were open questions at analysis time and have since
been **resolved interactively with the user** — see Decisions above. Recorded
here for traceability of the reasoning behind each:

- **Where the duration-shaped/manual-run classification lives**: `TaskParameterSet`
  field (not a per-competition task-config override) — Area 3.8's own
  requirement text is explicit ("derives from the task type, not from
  configuration"), so this is a rule-fixed class-model attribute, matching
  the shape of every other rule-fixed `TaskParameterSet` field
  (`timingPrecision`, `landingScored`, etc.). **Decided: STORY-044 owns it.**
- **Which story owns adding this field and its first read**: this story adds
  and reads the field (it is the one that structurally branches on it —
  Scope In explicitly splits into "duration-shaped hand-off" vs. "manual-run
  marking"), while STORY-001-040 consumes the same field read-only.
  **Decided: STORY-044.**
- **`group.opened` emission ownership**: this story owns emission — it is
  literally "the deliberate action that starts a group" per both stories'
  own cross-references, and STORY-001-040's Scope Out already excludes it.
  STORY-001-040 layers its own finer-grained phase-transition events on top,
  triggered by observing this event. **Decided: STORY-044.**
- **Attribution**: reuse `attributionFromHeaders()`'s default (non-CD) shape
  — D1 records authority without enforcing it, and there is no functional
  difference between "organiser" and "announcer/timekeeper" as recorded
  actor roles today. **Decided: reuse the default helper unmodified.**
- **"Current group" resolution**: the system deterministically derives "the
  next one in flying order" from the accepted draw plus prior
  `group.opened`/`group.scored` facts — matches AC4's "minimal, unambiguous
  interaction" most literally (a bare trigger, no group picker).
  **Decided: system-derived; `POST .../group-run/start` takes no body.**
- **`LifecycleGuard` action naming**: a new `GroupStart` action distinct
  from the existing lifecycle `Start` (STORY-001-025's Setup → Running
  transition), admissible only from `Running/BetweenGroups` — mirroring
  `Suspend`/`Lock`/`RoundAdvance`'s existing admissibility exactly, covering
  both the double-start and pre-proceedings-start edge cases for free.
  **Decided: `GroupStart`.**

#### Alternatives Considered

- **Building a minimal stand-in phase engine inside this story** to make
  AC1's duration-shaped hand-off demonstrably end-to-end without waiting for
  STORY-001-040: rejected — the phased sequence's internal logic is
  explicitly STORY-001-040's scope (Scope Out); building even a minimal
  version here would duplicate or pre-empt that story's own design, the
  same over-scoping risk STORY-001-040's own analysis flags for itself.
- **Making the duration-shaped/manual-run classification a per-competition
  configuration toggle** rather than a class-model-fixed field: rejected —
  Area 3.8's own requirement text and this story's Non-Functional
  Expectations both state the classification derives from the task type,
  not configuration; a toggle would let an operator accidentally run the
  wrong mode for a class whose rules fix it (e.g. F3B Speed is always
  manual-run), violating the class-model law by moving a rule-fixed fact
  into mutable configuration.
- **Building the prep-gate hold visibility (AC5) as a fully working read
  model now, stubbing STORY-001-034's gate mechanics**: rejected outright —
  mirrors STORY-001-032's own explicit rejection of building a stand-in
  phase engine; the hold's actual state (which pilot/device, whether held at
  all) is STORY-001-034's fact to produce, and a hard-coded or fabricated
  stub would not be demonstrable against real behaviour, only against
  fiction.

## Decisions (resolved interactively, 2026-07-16)

The open questions below were worked through with the user before REASONS
Canvas. Resolutions:

1. **`group.opened` emission**: **STORY-044 owns it.** This story's start
   action is the emitter; STORY-001-040 reacts to the event for
   duration-shaped tasks only and does not emit it itself.
2. **Duration-shaped/manual-run classification field**: **STORY-044 adds
   it** to `TaskParameterSet` (class-model, additive-only per NFR-2).
   STORY-001-040 consumes it read-only.
3. **"Current group" identification**: **system-derived.** The start route
   takes no target — the server derives "the next group in flying order"
   from the accepted draw plus prior `group.opened`/`group.scored` facts.
   `POST /competitions/:id/group-run/start` with no body.
4. **Attribution**: **reuse `attributionFromHeaders()`'s existing default**
   shape unmodified — no new Announcer/Timekeeper-specific attribution
   helper.
5. **`LifecycleGuard` action name**: **`GroupStart`** — distinct from the
   existing `"Start"` (STORY-001-025, Setup → Running). Admissible only from
   `Running/BetweenGroups`, mirroring `Suspend`/`Lock`/`RoundAdvance`
   exactly.
6. **Manual-run group's "field-run complete" / `group.scored` emission —
   superseded, final resolution below (post-REASONS-Canvas correction,
   2026-07-16 second pass).** This decision originally read "left to Area 5
   scoring... not this story's to define." That framing turned out to
   conflict with STORY-001-040's own shipped canvas, which states STORY-044
   is the sole emitter of *both* `group.opened` and `group.scored`. The
   conflict is resolved by splitting **mechanism** from **trigger**, not by
   picking one text over the other: STORY-044 owns the `group.scored`
   **append mechanism** for both task shapes; the **trigger** differs —
   STORY-001-040's phase engine calls it for duration-shaped groups (landing
   window elapsed), and STORY-044's own reactive listener calls it for
   manual-run groups, re-running STORY-001-043's completeness definition
   (resolved-inclusive: a resolved no-score/lone-pilot fact counts as
   accounted-for, not blocking) every time a capture-shaped fact arrives for
   that group's seated pilots. **There is no operator-facing "close group"
   action** — neither path involves a human click; `group.scored` is always
   system-emitted, with a system attribution sentinel, never an operator's
   `Attribution`. See `spdd/prompt/STORY-001-044-...md` Approach §3 and
   Safeguard 7 for the settled design.
7. **AC5 (prep-gate hold visibility)**: **build the read contract now,
   stub the source.** Define the DTO/endpoint shape for "hold visible,
   outstanding pilot/device" against a stub (mirroring
   `AlwaysUnlockedProvider`/`NotStartedProvider`), wired to real state once
   STORY-001-034 lands.
8. **Double-start and pre-Start guards**: **both covered by the single
   `GroupStart` admissibility entry** (`Running/BetweenGroups` only) — no
   separate logic needed. A group already in progress (`GroupInProgress`)
   and a still-`Setup` competition are both naturally rejected by the same
   gate that already shapes `Suspend`/`Lock`/`RoundAdvance`.

## Risk & Gap Analysis

#### Requirement Ambiguities

All ambiguities originally identified here (event/classification ownership,
current-group selection, manual-run closure) were resolved above — see
Decisions. None remain open ahead of REASONS Canvas.

#### Edge Cases

- **A second start attempt while a group is already in progress** and
  **starting before the competition itself has started** — both **resolved**
  (see Decisions #8): the single `GroupStart` admissibility entry
  (`Running/BetweenGroups` only) rejects both for free, mirroring how
  `Suspend`/`Lock`/`RoundAdvance` already require `BetweenGroups`. Worth an
  explicit rejection AC in REASONS Canvas for each, given the "wrong device,
  wrong pilot" failure-mode pattern this codebase is already careful about
  elsewhere (STORY-001-034).
- **A stale prep-gate hold display from the previous group bleeding into
  the next group's start** — AC5's hold-visibility read model needs to be
  scoped per-group (or reset on a fresh `group.opened`) so a Director's
  earlier release, or a group that finished normally, doesn't leave a phantom
  hold showing on the next group. Depends on STORY-001-034's own keying,
  which is undecided (that story is unbuilt).
- **The very first group of the very first round** vs. **a group following
  a suspend/resume (D7, two-day events)** — both should behave identically
  to "the next group is due" (AC3), but the requirement's examples only
  cover the ordinary mid-competition case; suspend/resume already re-enters
  at `BetweenGroups` per the lifecycle state machine, so this is likely
  already structurally handled, but worth confirming as a design constraint
  rather than an untested assumption.

#### Technical Risks

- **(Contained) Two greenfield pieces this story itself must introduce**:
  the duration-shaped/manual-run classification field and the `group.opened`
  emitter. Unlike STORY-001-032 and STORY-001-040 (which each depend on
  *multiple* unbuilt sibling foundations), this story's own core path
  (AC1–AC4) depends on nothing outside itself and code that already exists
  (`GroupCompositionProvider`, the projection pattern, `LifecycleGuard`'s
  established shape) — the classification field and the emitter are new but
  self-contained additions, not blocked integration points.
- **(Confirmed, blocking only AC5) STORY-001-034's prep-confirmation gate
  and device sync-state do not exist.** Zero hits for "gate," "hold," or
  device-online/offline concepts anywhere in `apps/base/src` or
  `packages/shared/src`. *Impact*: AC5 cannot be demonstrated end-to-end —
  this story can define the read contract/DTO shape for "hold visible,
  outstanding pilot/device" now, but has no real state to source it from.
  *Decided (see Decisions #7)*: build the read endpoint against a stub
  (mirroring `AlwaysUnlockedProvider`/`NotStartedProvider`-style seams
  elsewhere in this codebase) and wire it once STORY-001-034 lands.
- **AC1's visible outcome depends on STORY-001-040, which is itself
  greenfield.** This story's own responsibility (emit `group.opened` with
  the correct classification) is fully buildable and unit-testable in
  isolation, but "the sequence begins... with no further action needed to
  reach preparation" as an *observed* end-to-end behaviour cannot be
  demonstrated until STORY-001-040's phase engine exists to react to the
  event. *Mitigation*: test this story's own emission and classification
  read in isolation (contract-level); treat full AC1 demonstration as
  co-dependent, matching how STORY-001-040's own analysis frames the split.
- **`LifecycleGuard`'s `ALL_ACTIONS` table has no group-start entry today**
  and the existing `"Start"` action name is already taken by a different,
  unrelated transition (STORY-001-025's Setup → Running). Introducing a
  same-named or confusingly-similar action risks a genuine naming collision
  in code, error messages, and any shared `LifecycleAction` union type.
  *Mitigation*: pick a clearly distinct name (e.g. `GroupStart`) in REASONS
  Canvas and confirm it against `packages/shared/src/lifecycle.ts`'s
  existing `LifecycleAction` union.
- **No FAI-rule or cross-requirement contradiction found.** The story is
  consistent with D10 (operator-driven progression; automation runs only
  inside a group, never crossing a boundary) and Area 3.8's own text
  (classification derives from task type, not configuration). No conflict
  with `docs/requirements/rules/` was found; general-rules §1 (cited in the
  story header) concerns draw/timing/scoring fundamentals this story does
  not touch directly.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Duration-shaped group starts its sequence with one action | **Partial** | This story's own responsibility — emitting `group.opened` with the duration-shaped classification — is fully buildable now against existing code (`GroupCompositionProvider`, `CompetitionTaskConfigService`). The *visible* "sequence begins... reaches preparation" outcome is co-dependent on STORY-001-040's phase engine, which is itself greenfield; that half cannot be demonstrated end-to-end within this story alone. |
| 2 | Manual-run group starts with the same action, no automation | Yes | Fully addressable within this story alone: mark the group current (`group.opened`), push group context via `GroupCompositionProvider`, and simply build no countdown/callout/gate logic — nothing else to depend on since "no automation" means nothing further is invoked. |
| 3 | The next group never starts itself | Yes | A design discipline fully within this story's control — never emit `group.opened` except from the explicit start action; no scheduler, no auto-advance anywhere in this story's own code. |
| 4 | The start action requires minimal, unambiguous interaction | Yes | An API/UI design constraint (one call, no multi-step flow) entirely addressable by this story and its companion-app consumer (STORY-001-045); no external blocker. |
| 5 | A held prep confirmation gate is visible to the operator | **Partial — blocked** | The read contract/DTO shape is definable now, but the actual hold state (STORY-001-034, confirmed zero code) and the Director's release forms it references (STORY-001-032, also zero code) do not exist. Cannot be demonstrated end-to-end until those land; this story can only specify and stub it. |

## Summary of Key Points for REASONS Canvas

1. **This story is the least-blocked piece of Area 6.5's greenfield.** Three
   of five ACs (AC2, AC3, AC4) depend on nothing outside this story and code
   that already exists. Only AC5 is genuinely blocked (on STORY-001-034/032,
   both confirmed zero code, mitigated via a stubbed read contract); AC1 is
   buildable on this story's own side but its visible outcome is
   co-dependent on STORY-001-040.
2. **All ownership and design questions are resolved** (see Decisions):
   STORY-044 emits `group.opened` **and** `group.scored`, and owns the
   duration-shaped/manual-run classification field on `TaskParameterSet`;
   the start route is a bare, system-derived trigger (`POST
   .../group-run/start`, no body); attribution reuses the existing default
   (non-CD) helper; the new `LifecycleGuard` action is named `GroupStart`,
   gated to `Running/BetweenGroups` (covering the double-start and
   pre-proceedings-start edge cases for free); **`group.scored` is emitted
   reactively on both task shapes — never via an operator "close" action**
   (STORY-001-040's phase engine drives the duration-shaped path;
   STORY-044's own listener, reusing STORY-001-043's completeness
   definition resolved-inclusive, drives the manual-run path) — see
   Decision #6's superseding note.
3. **`GroupOpenedPayload`/`GroupScoredPayload`'s shapes are already
   declared and mostly ready to use** (`{competitionId, roundNumber,
   groupFlyingOrder}`), with one necessary additive correction identified
   during REASONS Canvas: both payloads gain a `taskId: string` field,
   since `groupFlyingOrder` alone cannot disambiguate F3B's three
   concurrently-scheduled, independently-numbered per-task group
   sequences — `GroupCompositionProvider.getEffectiveGroups` already keys
   on `(competitionId, roundNumber, taskId)`, and the event payload needed
   to match that key. The classification (`isDurationShaped`) is read from
   `TaskParameterSet` at consumption time by each consumer, never carried
   on the event itself.
4. **No FAI-rule or existing-requirement conflict found** — consistent with
   D10 and Area 3.8's own text on classification; no discipline branch
   anywhere in this story's own logic (CLAUDE.md class-model law upheld).
5. **A concrete, non-asserted algorithm for "which task-group opens next"
   under F3B's multi-task shape** is now specified (REASONS Canvas Approach
   §6): iterate `model.tasks` in declared order, then each task's groups in
   flying order, returning the first `(taskId, groupFlyingOrder)` with no
   prior `group.opened` fact for that round — degenerating to "next
   unopened group in flying order" for every single-task class.
