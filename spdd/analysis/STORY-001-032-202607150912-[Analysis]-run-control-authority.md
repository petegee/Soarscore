# SPDD Analysis: Run-Control Authority over a Running Group

> **An authority slice with no running group underneath it yet.** STORY-001-032
> is written as a decision layer — analogous to STORY-001-028, which landed
> cleanly atop STORY-001-011's already-built mechanics. But unlike 028, none of
> this story's four operational foundations exist in the codebase: the group
> phase/timer engine (STORY-001-040), the prep-confirmation gate and its
> device-sync signal (STORY-001-034/044), the no-score state (STORY-001-031),
> and the round-advance completeness gate (STORY-001-043) are all **greenfield
> — zero code** as of this analysis. What *is* fully built and directly reusable
> is the event-sourced, CD-attributed write pattern (`draw.accept`/`cancel`) and
> the `OutstandingItem`/`CompetitionNotReadyError` blocked-action shape. This
> story is therefore an authority-and-consequence **specification** that can be
> designed now, but four of its seven ACs cannot be *demonstrated end-to-end*
> until their owning prerequisite stories land — this is not a flaw in the
> requirement, it is an explicit, already-documented sequencing dependency
> (STORY-001-045's own analysis reaches the identical conclusion about this
> exact story).

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-32]run-control-authority.md`.

# [STORY-001-032] Run-Control Authority over a Running Group

> Source: `docs/user-stories/02-contest-director.md` §6.5 ·
> `docs/requirements/high-level-requirements.md` Area 6.5, Area 6.4 (round
> advance) · `docs/requirements/decisions.md` D1 (authority recorded, not
> enforced), D4 (immutable event log), D10 (operator-driven progression) ·
> `docs/requirements/rules/00-general-rules.md` §1–2 · `scorer-device.md` §4
> (prep gate vs offline device), `companion-app.md` §3.2 · relates to
> STORY-001-031 (no-score), STORY-001-028 (re-flight entitlement),
> STORY-001-026 (Lock validation pass)
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

The **operational** running of a group's clock, callouts and board is the
Announcer/Timekeeper's (Area 6.1–6.4). This story delivers the Contest Director's
**authority slice** over a running group: the holds and overrides only they may
apply. At a small contest one person may hold both hats, but the authority
actions here are the Director's, recorded as such.

The authority is deliberately bounded. It reaches **preparation** freely — the
Contest Director can **pause** prep (holding the countdown until they resume),
**fast-forward** it (each invocation removes one minute, but never below one
minute remaining) and **add time** (each invocation adds one minute) — but it may
**not** pause or shorten **working time or the landing window**, which run to
their configured durations. The one control that reaches into a running working
time is **abort**: a range hold or disruption lets the Contest Director abort the
group, which **restarts from preparation** and **annuls** any times/metrics —
raw captures **and** any facts derived from them (e.g. a resolved lone-pilot
dummy, a requested annulment override) — already recorded for that group; a
re-flight of the group starts completely clean. Abort applies **only while the
group is in working time**; once the **landing window** begins (the touchdown
phase per D5/D9), abort no longer applies and the flight runs to touchdown as
normal.

Two further authorities sit here. First, the **prep confirmation gate** (5.0.4)
is a single **group-level** hold — it pauses the countdown at one minute
whenever **any** pilot's device has not confirmed, and only releases once
**every** pilot's device has; one unconfirmed device holds the whole group's
start. For each device still blocking it, the Contest Director releases in one
of **two distinct forms** — **"device offline"** (the blocking device shows
offline on the base's group view via the companion client; the group proceeds
with **no no-score**, and the device's buffered confirmation reconciles on
sync) or **"pilot unconfirmed"** (device online, no confirmation; the group
proceeds and that pilot takes a **no-score**, STORY-001-031). The system never
converts a comms fault into a no-score on its own; the choice is the
Director's and is recorded, per blocking device. Second, the **"advance
anyway" override**: where the system has **blocked** a round advance (Area 6.4
— missing scores, unresolved no-scores or a re-flight entitlement not yet
flown, whether merely **prepared** or already **approved**), only the Contest
Director may force it through, with defined consequences — missing scores
become **flagged anomalies** for the end-of-contest validation pass
(STORY-001-026), unresolved no-scores convert to **zeros** (STORY-001-031),
and any not-yet-flown re-flight entitlement — prepared or approved — **lapses**
(the original result stands, flagged). Every action is attributable (D1/D4).

### Business Value

- Provide the Contest Director with the authority to keep the event moving —
  holding and adjusting preparation, resolving stuck confirmation gates, aborting
  a spoiled group — without breaching the fixed working-time and landing-window
  durations.
- Support an honest handling of comms faults: a device-offline hold is never
  silently turned into a pilot's no-score.
- Enable progress past a genuinely blocked round advance under explicit,
  attributable authority, with each outstanding item routed to a defined,
  recorded consequence.

### Dependencies and Assumptions

- **Prerequisites**: the Area 6 group run and phase timer (Announcer/Timekeeper —
  STORY-001-011 and Area 6 stories), the prep confirmation guard (5.0.4), the
  round-advance gate (Area 6.4), STORY-001-031 (no-score state), STORY-001-028
  (re-flight entitlement), STORY-001-026 (the end-of-contest validation pass that
  flagged anomalies feed).
- **Data assumptions**: a device's sync-state (online/offline) is shown on the
  base's group view via the companion client (companion-app §3.2); actor identity
  arrives with the request and Contest-Director authority is **recorded, not
  enforced** (D1); prep vs working-time vs landing-window phase is known from the
  running group.
- **Integration points**: pause/fast-forward/add-time act on the Area 6 prep
  timer; abort resets the group to preparation and discards its captures; the
  prep-gate release interacts with the offline device's buffered confirmation
  (scorer-device §4); "advance anyway" drives the no-score→zero (STORY-001-031),
  re-flight-lapse (STORY-001-028) and flagged-anomaly (STORY-001-026) outcomes.
- **Business constraints**: working time and the landing window are fixed
  durations, not the Director's to pause/shorten; operator-driven progression
  (D10); offline-first (D6); class-agnostic core (CLAUDE.md).

### Scope In

- **Preparation holds**: pause/resume the prep countdown; fast-forward (−1 minute
  per invocation, never below one minute remaining); add time (+1 minute per
  invocation) — all on **preparation only**.
- **The fixed-duration guard**: the Contest Director **cannot** pause or shorten
  working time or the landing window.
- **Abort**: abort a group during **working time only** (not once the landing
  window has begun) on a range hold/disruption — it restarts from preparation
  and annuls **both** raw times/metrics **and** any derived scoring facts
  (e.g. lone-pilot resolution, annulment-override requests) already recorded
  for the group; a re-flight starts clean.
- **Prep-gate release, a single group-level hold, two distinct release forms
  per blocking device**: **"device offline"** → group proceeds with **no**
  no-score (buffered confirmation reconciles on sync); **"pilot unconfirmed"**
  → group proceeds and that pilot takes a **no-score**. The gate only clears
  once every blocking device is confirmed or released. The system never
  auto-converts a comms fault to a no-score; the chosen form and the
  pilots/devices involved are recorded.
- **"Advance anyway" override** of a blocked round advance: missing scores →
  flagged anomalies for the end-of-contest validation pass; unresolved no-scores
  → zeros; any not-yet-flown re-flight entitlement — whether merely **prepared**
  or already **approved** — → lapses (original result stands, flagged). Only
  the Contest Director may issue it; it is attributed to them.
- **Audit**: every run-control authority action is attributable to the Contest
  Director (D1/D4).

### Scope Out

- **The operational start/hold of the clock, callouts and the board** — the
  Announcer/Timekeeper (Area 6.1–6.4); these authority actions are distinct from
  operating the timer.
- **The prep gate's non-Director release paths** — all Scorers confirm, or a
  Scorer marks *cannot make the group* (5.0.4); only the Director **override** is
  here.
- **What a no-score then does** (resolve via move/retire, end-of-round zero) —
  STORY-001-031; this story only *creates* a no-score via "pilot unconfirmed" and
  *converts* unresolved ones via "advance anyway".
- **The end-of-contest validation pass and Lock** that flagged anomalies feed —
  STORY-001-026.
- **The phase timer and phase sequencing** themselves (prep → working → landing) —
  Area 6 stories; this story acts on that timer's prep phase only.
- Enforcing that only a Contest Director may take these actions (authority
  recorded, not enforced, D1).

### Acceptance Criteria

#### AC1: Prep can be paused/resumed; working time and landing cannot
**Given** a group in **preparation**
**When** the Contest Director pauses it, **then** the countdown holds until they
resume; **and given** the same group later in **working time** or the **landing
window**, **when** a pause is attempted, **then** it is refused because those run
to their configured durations.

#### AC2: Fast-forward removes a minute but never below one minute remaining
**Given** a group in preparation with 4 minutes remaining and everyone ready
**When** the Contest Director fast-forwards
**Then** each invocation removes one minute (4 → 3 → 2 → 1), and a further
fast-forward at one minute remaining is refused — the countdown never drops below
one minute.

#### AC3: Add-time adds a minute to preparation
**Given** a competitor is not ready with the prep countdown running
**When** the Contest Director adds time
**Then** each invocation adds one minute to the preparation countdown.

#### AC4: A device-offline gate release applies no no-score
**Given** the prep gate has paused at one minute because one pilot's device shows
**offline** on the base's group view
**When** the Contest Director releases the gate as **"device offline"**
**Then** the group proceeds with **no** no-score for that pilot, and the device's
buffered confirmation reconciles when it next syncs (scorer-device §4).

#### AC5: A pilot-unconfirmed gate release applies a no-score
**Given** the prep gate is held because a pilot's device is **online** but has not
confirmed
**When** the Contest Director releases the gate as **"pilot unconfirmed"**
**Then** the group proceeds and that pilot takes a **no-score** (STORY-001-031);
the two release forms are distinct actions and the chosen form (with the
pilots/devices involved) is recorded — the system never converts a comms fault to
a no-score on its own.

#### AC6: Abort (working time only) restarts from preparation and annuls all captured data, raw and derived
**Given** a range hold mid-**working-time** with some times/metrics already
captured for the group, including a derived scoring fact (e.g. a resolved
lone-pilot dummy)
**When** the Contest Director aborts the group
**Then** it restarts from **preparation** and the group's already-captured
raw times/metrics **and** any derived scoring facts are **annulled**, so a
re-flight starts clean; **and given** the same group has already progressed
into the **landing window**, **when** an abort is attempted, **then** it is
refused — abort applies only during working time, and the flight runs to
touchdown as normal.

#### AC7: "Advance anyway" routes each blocked item to its defined consequence
**Given** a round advance the system has **blocked** because it lists a missing
score, an unresolved no-score and a re-flight entitlement not yet flown (Area
6.4) — whether that entitlement is merely **prepared** or already **approved**
**When** the Contest Director issues an explicit **"advance anyway"** override
**Then** the advance proceeds — the missing score becomes a **flagged anomaly**
for the end-of-contest validation pass (STORY-001-026), the unresolved no-score
converts to a **zero** (STORY-001-031), the not-yet-flown re-flight entitlement
**lapses** (prepared or approved alike) with the original result standing
(flagged) — and the override is attributed to the Contest Director; no other
role can issue it.

#### Non-Functional Expectations
- Run-control authority actions carry no knowledge of any specific competition
  class (CLAUDE.md class-model law) and operate on the base offline (D6).
- Working time and the landing window are never shortened or paused by any
  authority action — only preparation is adjustable, and only abort reaches a
  running **working time** (and only by discarding it); abort does not apply
  once the landing window has begun.
- The prep-confirmation gate is a single group-level hold: it clears only
  when every pilot's device has confirmed or been released by the Contest
  Director; one outstanding device holds the whole group's start.

### INVEST Check

Independent (an authority slice over the Area 6 group run and the Area 6.4 advance
gate) · Valuable (keeps the event moving and resolves real-world holds without
breaching fixed durations, and never silently turns a comms fault into a no-score)
· At the size limit (5 days, 3 functional points: prep holds + fixed-duration
guard + abort, the two-form prep-gate release, the "advance anyway" override) ·
Testable (each hold, each release form, abort's data annulment and each override
consequence are observable).

## Domain Concept Identification

This story's own Dependencies section names four prerequisites — the Area 6
group run/phase timer, the prep confirmation guard, the round-advance gate,
STORY-001-031 (no-score) — that, per direct codebase inspection, **do not exist
in any form**. This materially changes the shape of what "building this story"
means: it is not a decision layer over finished mechanics (as STORY-001-028
was over STORY-001-011), but an authority-and-consequence contract that must
either be co-designed with its four unbuilt foundations or built as an
interface those foundations will later satisfy.

#### Existing Concepts (from codebase)

- **`LifecycleState` / `RunningSubState`** (`packages/shared/src/lifecycle.ts`):
  `Running` carries `runningSubState: "BetweenGroups" | "GroupInProgress"` —
  the only existing notion that "a group is live." It is a coarse two-value
  substate with no concept of preparation/working/landing phase at all. This
  story's phase-conditional guard (AC1/AC5: pause is legal in preparation,
  refused in working time/landing) has nothing more granular than
  `GroupInProgress` to key off today.
- **`RoundAdvance` as a legal `LifecycleAction`** (`apps/base/src/lifecycle/
  guard.ts`): already declared admissible only from `Running/BetweenGroups`
  (same gate as Suspend/Lock), pure and class-agnostic. `competition.
  roundAdvanced` / `CompetitionRoundAdvancedPayload {competitionId,
  roundNumber}` are declared event types (`packages/shared/src/events.ts:478,
  508-511`) but **no emitter appends them yet** — the transition-legality
  guard exists; the completeness check and "advance anyway" override this
  story needs do not.
- **`CompetitionTaskConfig`** (`packages/shared/src/task-config.ts`,
  `apps/base/src/task-config/`): holds `baseTargetSeconds` +
  `roundOverrides` per task — the *configured* working-time duration source a
  phase engine would read from. No prep-duration or landing-window-duration
  field exists anywhere (Area 3.8 field-aid settings, which STORY-001-040
  depends on, are equally unbuilt) — this is pure configuration, not a
  running clock, and it does not by itself let this story determine "is this
  group currently in preparation."
- **`Attribution` / the CD-attribution pattern** (`packages/shared/src/
  attribution.ts`, `apps/base/src/routes/draw.ts`): the exact, reusable
  precedent this story needs. `draw.ts` shows two header-parsing helpers per
  route file — `attributionFromHeaders()` (default `authority: "organiser"`)
  and `cdAttributionFromHeaders()` (hardcodes `authority: "contest-director"`)
  — both reading `x-actor-name`/`x-client-id`, with CD-authority routes
  (`accept`/`cancel`) calling the CD helper explicitly and passing the result
  into the service method, which appends it straight onto the event
  (`{scope, type, payload, attribution}`). Every one of this story's seven
  actions is a CD-attributed write and should follow this exact shape.
- **The immutable, supersede-on-repeat event log** (`EventStore`, one
  projection per aggregate, `scope = competitionId` for content events): the
  substrate every new run-control event must obey (D4). `draw.
  reflightPrepared`'s single-member `ApprovalStatus` ("pending-contest-
  director-approval", `packages/shared/src/draw.ts:285`) is the established
  idiom for "recorded, not yet resolved" — directly relevant to this story's
  "advance anyway" re-flight-lapse consequence (see New Concepts).
- **`OutstandingItem` / `CompetitionNotReadyError`** (`packages/shared`,
  used by STORY-001-025's Start gate): the `{code, message}` blocked-action
  shape STORY-001-043's round-advance block (which AC7 overrides) is expected
  to reuse per the STORY-001-045 analysis. This story's "advance anyway"
  consumes whatever list STORY-001-043 produces; it does not invent its own
  outstanding-item shape.
- **`setErrorHandler` discipline** (`apps/base/src/app.ts:338-510`): one
  `instanceof` branch per domain error class, ordered by module
  (pilots → competitions → roster → task-config → draw → scoring →
  lifecycle → generic `DomainError` fallback). Every new rejection reason
  this story introduces (e.g. "group not live," "prep gate not held," "no
  round advance currently blocked") needs its own branch here.
- **`scoring.annulmentOverrideRequested` / `AnnulmentOverridePendingError`**
  (`apps/base/src/scoring/`): the closest existing precedent for a
  Director-gated override with a defined consequence branch (F3B dummy vs.
  annul) — structurally similar to, but distinct from, this story's
  abort/gate-release/advance-anyway authority, which acts on a *running
  group* rather than a *scored group*.

#### New Concepts Required

- **Group Run / Phase State (preparation / working time / landing window)**:
  the single biggest dependency this story has no code to stand on. STORY-032
  cannot express "pause is legal in preparation, refused in working time" or
  "abort restarts from preparation" without some representation of current
  phase — and that representation is explicitly STORY-001-040's scope, not
  this story's. This story must therefore be designed against an assumed
  phase-state contract (round, group, phase, remaining time) that
  STORY-001-040 will define, not build it.
- **Preparation Hold (pause/resume)**: a new run-control fact pausing/
  resuming the not-yet-existent prep countdown. Needs its own event
  (`groupRun.prepPaused` / `groupRun.prepResumed`, naming TBC in REASONS
  Canvas) and a guard rejecting the action when phase ≠ preparation (AC1).
- **Fast-forward / Add-time (bounded deltas)**: two new CD-attributed events
  mutating remaining preparation time by ∓/± one minute, with fast-forward's
  one-minute floor enforced server-side (AC2) — pure delta application over
  whatever remaining-time state STORY-001-040 exposes.
- **Abort + Annulment**: a new event restarting a group to preparation and
  annulling its captured data. "Annul" here means discarding
  `scoring.resultCaptured` facts (and any lone-pilot/annulment-override
  resolutions) already appended for the group's current run — a **new kind of
  annulment**, distinct from the existing F3B lone-pilot annulment
  (`scoring.annulmentOverrideRequested`), which annuls a *score*, not a
  *group's whole captured run*. Because the event log is append-only (D4),
  this cannot be a deletion — it needs a superseding "annulled" fact the
  scoring projection folds to exclude the annulled captures from any
  recompute, mirroring how `DrawProjection` already treats overlays as
  latest-wins without rewriting history.
- **Prep-Confirmation Gate hold + device sync-state**: entirely new
  territory. No device model, no online/offline signal, and no gate/hold
  state exist anywhere in the codebase (confirmed: `apps/base/src/eventstore`
  is a pure append-only log with no device-connectivity concept). This
  story's two release forms (AC4/AC5) both presuppose (a) the gate exists and
  is currently held (STORY-001-034's scope, itself unbuilt) and (b) a
  device's online/offline sync-state is visible on the base (scorer-device
  §4, also unbuilt). STORY-032 can define the **release actions and their
  consequences** but cannot itself build the gate or the device-sync
  visibility it releases.
- **No-score creation (via "pilot unconfirmed")**: this story is one of only
  two places (the other being the Scorer's own device action, out of scope
  here) that *creates* a no-score fact. But the no-score *state itself* —
  its distinctness from a zero, its resolution paths — is STORY-001-031's,
  which is equally unbuilt (confirmed: zero hits for "noScore"/"no-score" in
  either source tree). This story needs to append whatever no-score-creation
  event STORY-001-031 defines as its intake, without owning that state's
  shape.
- **Re-flight Lapse**: `ApprovalStatus` (`packages/shared/src/draw.ts:285`)
  is a single-member union (`"pending-contest-director-approval"`) with an
  explicit code comment that no second event exists to transition it yet
  (confirmed also true after STORY-001-028's own resolution events, which add
  `"approved"`/`"declined"` but not `"lapsed"`). AC7's re-flight-lapse
  consequence needs a **new** `ApprovalStatus` member (or a sibling lapse
  event) this story introduces — `draw.reflightLapsed` (naming TBC),
  superseding the pending fact with "the original result stands, flagged,"
  distinct from both STORY-001-028's approve/decline.
- **Flagged Anomaly (missing-score consequence)**: AC7's "missing score
  becomes a flagged anomaly for the end-of-contest validation pass" presumes
  a score-validation/anomaly concept (Area 5.6, STORY-001-012) that **also
  does not exist in the codebase** (confirmed: zero hits for "anomaly" outside
  unrelated draw-service comments). This story only needs to *produce* the
  flag; STORY-001-012/STORY-001-026 own what happens with it — but there is
  currently no event or read-model to flag it into.
- **Round-Advance Override ("advance anyway")**: consumes whatever
  outstanding-items list STORY-001-043 produces (itself unbuilt) and, on
  invocation, must atomically apply three different consequences (anomaly
  flag / no-score-to-zero / re-flight-lapse) to potentially multiple items in
  one CD-attributed action — a fan-out this codebase has no precedent for
  (every existing CD action, accept/cancel/approve/decline, resolves exactly
  one pending fact).

#### Key Business Rules

- **Preparation is the only adjustable phase; working time and the landing
  window are fixed** (AC1, Non-Functional Expectations) — governs every
  pause/fast-forward/add-time guard; must be enforced by phase, not by group
  or round, once a phase concept exists.
- **Fast-forward never drops preparation below one minute remaining** (AC2) —
  a hard floor on the delta-application logic.
- **A comms fault is never auto-converted to a no-score** (AC4/AC5,
  Background) — the two gate-release forms are deliberately distinct actions
  with different consequences; the system must never infer "device offline"
  from "pilot unconfirmed" or vice versa — the Director's explicit choice is
  the only source of truth.
- **Abort discards captured data via annulment, not deletion** (AC6, D4) — the
  event log stays append-only; already-captured times/metrics for the group
  are excluded from any subsequent recompute via a superseding fact, never
  rewritten or removed.
- **"Advance anyway" routes each outstanding item to its own defined
  consequence, not a blanket bypass** (AC7) — missing score → flagged
  anomaly (never silently dropped), unresolved no-score → zero (the same
  crossing STORY-001-031 defines for the *normal* end-of-round case, but
  forced here), unflown re-flight → lapse (original result stands, flagged,
  not discarded).
- **Every action is attributable to the Contest Director; no other role can
  issue "advance anyway"** (D1/D4, AC7) — authority recorded, not enforced,
  consistent with every other CD action in this codebase.
- **Class-agnostic**: no run-control action reads or branches on competition
  class (CLAUDE.md); durations/phases come from configuration and the shared
  clock STORY-001-040 will expose.

## Strategic Approach

#### Solution Direction

- **Design this story as a contract against its four prerequisite backends'
  concepts, not as code with a working end-to-end path.** Concretely:
  1. **Prep holds (pause/resume/fast-forward/add-time, AC1–AC3)**: a new
     CD-attributed event family (`groupRun.prepPaused/prepResumed/
     fastForwarded/timeAdded`) that STORY-001-040's phase engine must consume
     as authoritative deltas/holds on its own countdown — this story owns the
     *authority events*, STORY-001-040 owns *applying* them to the running
     clock. The two stories should agree on the event shape before either is
     implemented in full, since STORY-032's route/service can be built and
     unit-tested against a stubbed phase-state reader even before
     STORY-001-040 exists.
  2. **Abort (AC6)**: a new event that (a) requests STORY-001-040 restart the
     group's clock at preparation and (b) appends an annulment fact the
     scoring projection folds to exclude the group's captured results from
     recompute — mirroring the existing overlay/supersede pattern
     (`DrawProjection`, `ScoringProjection`) rather than inventing a new
     mutation style.
  3. **Prep-gate release (AC4/AC5)**: two distinct CD-attributed events
     (`groupRun.gateReleasedDeviceOffline` / `groupRun.gateReleasedPilot
     Unconfirmed`) that (a) unblock STORY-001-034's gate and (b), only for the
     pilot-unconfirmed form, append whatever no-score-creation event
     STORY-001-031 defines. Until STORY-001-034/031 exist, this slice is
     specifiable but not runnable.
  4. **"Advance anyway" (AC7)**: one CD-attributed event that supersedes
     STORY-001-043's block, carrying enough structure (per-item consequence
     routing) that the round-advance projection can fan out to: append a
     flagged-anomaly fact (feeds STORY-001-026/012, itself unbuilt), append
     STORY-001-031's zero-conversion event, and append this story's new
     `draw.reflightLapsed` event. This is the ripest slice for genuine
     ambiguity (see Risks) since it depends on three sibling stories' exact
     event shapes.
- **Reuse the fully-built CD-attribution and error-handling patterns
  unconditionally** (`draw.ts`'s two-helper shape, `app.ts`'s per-error
  `setErrorHandler` branch) — this part of the story has zero risk and
  should be implemented exactly as precedent dictates regardless of how the
  phase/gate/no-score sequencing question resolves.
- **Recommend surfacing the sequencing dependency to the user before REASONS
  Canvas**, since this story's Dependencies section already names
  STORY-001-031/040/043/034/026/012 as prerequisites that do not yet exist —
  this is not a new finding this analysis introduces, but it is a large
  enough gap (4 of 7 ACs partially blocked) that it should be explicit and
  decided rather than discovered mid-canvas.

#### Key Design Decisions

- **Build order: this story's events now (as a forward-looking contract) vs.
  wait for STORY-001-040/031/034/043 to land first.** *Trade-off:* building
  now risks the event/route shapes needing rework once the prerequisite
  stories fix their real contracts (exactly the risk STORY-001-045's own
  analysis flagged about depending on this story); waiting risks nothing
  being buildable on this story's own 5-day estimate. → **Recommendation**:
  split as STORY-001-011/028 did — build the CD-attributed route/event/
  error-handling plumbing for all seven actions now (low risk, high reuse of
  the `draw.ts` pattern), but explicitly mark the *runtime effect* of each
  action (what STORY-001-040's clock actually does on receiving a pause, what
  STORY-001-034's gate does on release, what STORY-001-031's zero-conversion
  looks like) as a to-be-wired integration point once those stories exist —
  confirm this scoping split in REASONS Canvas rather than silently building
  a full pipeline that has nothing to run against.
- **Event granularity for the four prep-hold actions**: one polymorphic
  `groupRun.controlApplied` event with an action-type field, vs. four
  distinct event types. → **Recommendation**: four distinct, self-describing
  events (matching this codebase's established one-payload-per-type
  discipline, e.g. `draw.groupMoved`/`draw.groupSplit` as separate types
  rather than a generic "draw edit"), each with its own `setErrorHandler`
  rejection reason.
- **Annulment shape for abort**: a single `groupRun.aborted` event whose
  projection-side effect is "exclude all captures for this group's current
  run," vs. an explicit list of which result-IDs were annulled recorded on
  the event itself. → **Recommendation**: record the explicit set of
  superseded fact references (or at minimum round/group/task keys) on the
  abort event so a later audit read can show exactly what was discarded,
  consistent with AC7's "flagged" and "recorded" emphasis elsewhere in this
  story — pure "exclude everything for this group" without an explicit list
  would be harder to audit under D4.
- **"Advance anyway" atomicity**: apply all three consequences (anomaly /
  zero / lapse) as one event with a structured payload, vs. three separate
  events appended together. → **Recommendation**: one `roundAdvance.
  overridden` event carrying the resolved list of items and their outcomes,
  which the round/scoring/draw projections each fold their own slice of —
  keeps the override a single attributable act (AC7's "the override is
  attributed to the Contest Director") rather than three independently-
  attributed facts that could theoretically be replayed out of order.
- **RESOLVED (202607160945) — `ApprovalStatus` union shape and ownership**:
  design the third ("lapsed") outcome in isolation now and let STORY-001-028
  add `"approved"`/`"declined"` later, vs. fix the **full** union in this
  story's own canvas so STORY-001-028 implements against an
  already-settled contract. → **Decision (user-confirmed)**: this story's
  REASONS Canvas now defines the complete union —
  `"pending-contest-director-approval" | "approved" | "declined" |
  "lapsed"` — in one place. STORY-001-028 must implement against this fixed
  union rather than redesigning it; this closes the cross-story-coordination
  risk previously flagged below under Technical Risks (the union is fixed
  once, not designed twice).
- **RESOLVED (202607160945) — Add-time repeat cap**: leave add-time
  uncapped (no ceiling on repeated +1-minute invocations), matching the
  literal AC3 text — Contest Director discretion governs how much
  preparation time is added. Confirmed as a deliberate scope decision, not
  an oversight; no change to the story or canvas beyond this note.

#### Alternatives Considered

- **Treating the four prerequisite gaps as blocking and refusing to analyse
  this story until they land**: rejected — the story's own event/authority
  contracts (attribution, error handling, event granularity) can be
  meaningfully designed now using the fully-built CD-attribution precedent,
  and doing so gives STORY-001-040/031/034/043 a concrete shape to satisfy
  rather than each inventing its own run-control vocabulary independently.
- **Building a minimal stand-in phase engine inside this story** to make
  AC1/AC2/AC3/AC6 demonstrably end-to-end: rejected — phase/timer state is
  explicitly STORY-001-040's scope (Scope Out: "the phase timer and phase
  sequencing themselves"); building even a minimal version here would
  duplicate or pre-empt that story's own design, the same over-scoping
  concern STORY-001-011's analysis raised about the missing capture
  aggregate.
- **Inferring "device offline" from an absence of confirmation rather than an
  explicit signal**: rejected — the requirement is explicit that "the system
  never converts a comms fault into a no-score on its own"; the two release
  forms must remain the Director's deliberate, distinct choice, never a
  system inference, so no shortcut around building the actual device-sync
  visibility (scorer-device §4) is acceptable even as a stopgap.

## Risk & Gap Analysis

#### Requirement Ambiguities — RESOLVED

The five ambiguities below were flagged during initial analysis/canvas
generation and have since been **resolved by explicit user decision**
(202607160945 canvas review). The story file and this analysis have been
updated in place to carry the resolved wording; they are retained here as a
decision record, not as open questions.

- ~~"Prep vs. working-time vs. landing-window phase is known from the
  running group" is not true of the codebase today~~ — **unchanged as a
  technical risk** (see Technical Risks): STORY-001-040 still owns building
  the actual three-way phase signal this story's guards read. Not one of the
  six resolved decisions; retained below under Technical Risks.
- ~~What "restarts from preparation" means for the shared clock is
  ambiguous~~ — **unchanged as a technical risk**: still an integration
  question for STORY-001-040/044's reset primitive, not resolved by the six
  decisions (which addressed *scope*, not *mechanism*).
- **RESOLVED — Abort's annulment scope**: abort discards **both** raw
  captures (`scoring.resultCaptured`) **and** derived scoring facts
  (`scoring.lonePilotResolved`, `scoring.annulmentOverrideRequested`) for the
  group's aborted run. A re-flight of the group starts completely clean, with
  no stale derived fact reapplied. Story AC6 and Background updated
  accordingly.
- **RESOLVED — Re-flight-lapse eligibility (AC7)**: the lapse consequence
  applies to a not-yet-flown re-flight entitlement in **either** state —
  merely **prepared** (STORY-001-028's pending-CD-approval fact) **or**
  already **approved** — not approved-only as originally guessed. Story AC7
  and Background updated accordingly; the lapse event must therefore be able
  to reference and supersede either prior state, not only the approved one.

#### Edge Cases

- **Fast-forward/add-time issued while the prep-confirmation gate is already
  held at one minute** — does fast-forward have any effect once the gate has
  paused the countdown (arguably already at its floor), and does add-time
  push the remaining time back above one minute, implicitly un-holding the
  gate before a Director release? Unaddressed by the ACs; needs a rule once
  STORY-001-034's gate exists. **Still open** — not one of the six resolved
  decisions.
- ~~Abort issued during the landing window rather than working time~~ —
  **RESOLVED**: abort applies **only** during working time; once the landing
  window begins, abort is refused and the flight runs to touchdown as
  normal. Story AC6 and the Non-Functional Expectations updated accordingly.
- ~~Two simultaneous prep-gate holds in the same group~~ — **RESOLVED**: the
  prep-confirmation gate is a single **group-level** hold, not independent
  per-pilot locks — it clears only once every blocking device is confirmed
  or Director-released. The Director still releases **per blocking device**,
  choosing a form ("device offline" / "pilot unconfirmed") for each, but the
  group does not proceed until every outstanding device is resolved. Story
  Background/Scope In/Non-Functional Expectations updated accordingly.
- **"Advance anyway" when only some outstanding items exist** (e.g. only a
  missing score, no no-score or re-flight outstanding) — AC7's example
  bundles all three; the override must still work correctly when routing
  only one or two of the three consequence types, not always the full set.
  **Still open** — not one of the six resolved decisions.
- **Concurrent Contest Directors (or a CD and the Announcer/Timekeeper role)
  acting on the same group** (D8, last-action-wins, no session lock) — e.g.
  one Director pauses prep while another simultaneously aborts. No control
  ordering is specified; needs a clean rejection or last-write-wins
  resolution once the underlying phase state exists to arbitrate.

#### Technical Risks

- **(Highest, confirmed) Four hard prerequisites do not exist in the
  codebase: STORY-001-040 (phase/timer engine), STORY-001-034 (prep-gate
  mechanics + device sync-state), STORY-001-031 (no-score state), STORY-001-
  043 (round-advance completeness gate).** Directly verified: no `timer`,
  `clock`, `phase`, `groupRun`, or device-sync module exists under
  `apps/base/src` or `packages/shared/src`; grep for "noScore"/"no-score"
  returns zero domain hits; `competition.roundAdvanced` is a declared-but-
  unemitted event type with no completeness-check service anywhere. *Impact*:
  AC1, AC2, AC3, AC6 (all phase-dependent), AC4/AC5 (gate-dependent) and AC7
  (round-advance-gate-dependent) cannot be demonstrated end-to-end within
  this story alone — only the CD-attributed authority events and their
  guards/rejections can be built and unit-tested against a stubbed
  phase/gate/no-score/advance-gate contract. *Mitigation*: as recommended
  above, build the attribution/event/error-handling slice now; sequence or
  co-design the runtime wiring with STORY-001-040/031/034/043.
- **No "flagged anomaly" concept exists anywhere (AC7's missing-score
  consequence)**: confirmed zero hits for "anomaly" in either source tree
  outside unrelated draw-service comments. AC7 cannot fully close without
  STORY-001-012 (score validation, Area 5.6) or at minimum a stand-in
  anomaly-flag event this story introduces and STORY-001-012/026 later
  consume — a second, smaller missing-foundation gap layered on top of the
  four already named in Dependencies.
- **RESOLVED (202607160945) — `ApprovalStatus` has no lapse member and no
  precedent for a third-outcome resolution event.** Previously a risk that
  STORY-001-028 and STORY-001-032 might design the union twice,
  inconsistently, if built out of sequence. **Decision**: this story's own
  REASONS Canvas now fixes the **complete** union — `"pending-contest-
  director-approval" | "approved" | "declined" | "lapsed"` — in one place;
  `"lapsed"` is applied only as a side-effect of the round-advance override,
  never by direct CD choice over the pending fact. STORY-001-028 implements
  against this already-settled union rather than redesigning it. The
  remaining technical risk is narrower: STORY-001-028's own resolution-event
  *mechanics* for `"approved"`/`"declined"` must still be built consistently
  with this fixed union, but the union's shape itself is no longer an open
  design question.
- **Annulment-on-abort touches the scoring projection's replay discipline.**
  Any new "exclude these captures" fact must be folded correctly on replay
  (older logs won't have it — default to "not annulled") and must not
  conflict with the existing lone-pilot/annulment-override folding logic
  already in `ScoringProjection` — a real but contained piece of new
  projection logic, not a rewrite.
- **Fan-out atomicity for "advance anyway"**: no existing event in this
  codebase drives three different projections' state in one attributable
  act (every current CD action resolves exactly one pending fact in one
  aggregate). Designing `roundAdvance.overridden`'s payload and each
  projection's fold needs care to keep the action genuinely atomic from an
  audit-read perspective, even though the underlying event log has no
  cross-aggregate transactions.
- **Missing `setErrorHandler` branches**: every new rejection this story
  introduces ("group not currently in preparation," "prep gate not
  currently held," "no round advance is currently blocked," "re-flight not
  currently granted") needs its own domain-error subclass and `app.ts`
  branch, per the existing Safeguard-8-equivalent discipline already visible
  in that file's ~170-line `setErrorHandler`.
- **No FAI-rule or cross-requirement contradiction found.** The story is
  consistent with D1 (recorded, not enforced), D4 (immutable log), D5/D9
  (device stopwatch not stopped at end of working time — this story does not
  touch device timing at all, only the base's own phase clock), D10
  (operator-driven progression — no action here is automatic), and the
  general-rules §1–2 cross-references cited in its header. No conflict with
  `docs/requirements/rules/` was found; this is a clean cross-reference.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Prep pause/resume legal; working time/landing refuse it | **Partial — blocked** | The CD-attributed pause/resume events and the phase guard's *logic* are buildable now; the guard has no real phase signal to read until STORY-001-040 exists. |
| 2 | Fast-forward removes a minute, floor at one minute | **Partial — blocked** | Delta-application logic is pure and buildable; nothing to apply it to until STORY-001-040's remaining-time state exists. |
| 3 | Add-time adds a minute to preparation | **Partial — blocked** | Same as AC2 — logic buildable, no runtime target yet. |
| 4 | Device-offline release applies no no-score | **Partial — blocked** | Needs STORY-001-034's gate/hold state and a device online/offline signal (scorer-device §4) — neither exists. The "no no-score" consequence itself is trivial (a no-op) once the gate exists. |
| 5 | Pilot-unconfirmed release applies a no-score | **Partial — blocked** | Needs STORY-001-034's gate plus STORY-001-031's no-score-creation event, neither of which exists; this story can define the release event and its intent to create a no-score, but not the no-score state itself. |
| 6 | Abort restarts from preparation, annuls captured data | **Partial — blocked** | The annulment-fact/event-log side (excluding captures from recompute) is buildable against the existing `ScoringProjection` pattern; "restarts from preparation" depends on STORY-001-040/044's reset primitive, which does not exist. |
| 7 | "Advance anyway" routes each item to its consequence | **Partial — blocked** | Needs STORY-001-043's outstanding-items list, STORY-001-031's zero-conversion, a new re-flight-lapse event (buildable, extending `ApprovalStatus`), and a flagged-anomaly concept (STORY-001-012, unbuilt). The override event's shape and attribution are buildable now; full consequence routing cannot be demonstrated until its three sibling stories land. |

## Summary of Key Points for REASONS Canvas

1. **Four hard prerequisites are confirmed 100% greenfield**: STORY-001-040
   (phase/timer engine), STORY-001-034 (prep-gate + device sync-state),
   STORY-001-031 (no-score state), STORY-001-043 (round-advance completeness
   gate). None have a route, event type, or projection in the codebase today.
   A fifth, smaller gap (STORY-001-012's "flagged anomaly" concept, feeding
   AC7's missing-score consequence) is equally unbuilt. This mirrors, and
   should be flagged to the user in the same way as, STORY-001-045's own
   analysis, which reached the identical conclusion about this exact story.
2. **What is fully built and directly reusable**: the CD-attribution pattern
   (`draw.ts`'s two-helper, header-driven shape), the append-only,
   supersede-on-repeat event log discipline, the `OutstandingItem`/
   `CompetitionNotReadyError` blocked-action shape, and the per-error
   `setErrorHandler` convention in `app.ts`. Every one of this story's seven
   actions should be built against these precedents exactly, regardless of
   how the prerequisite-sequencing question resolves.
3. **Recommended scoping split for REASONS Canvas**: build the CD-attributed
   route/event/error-handling plumbing for all seven actions now (low risk,
   proven pattern), but explicitly treat each action's *runtime effect* (what
   the phase engine does on pause, what the gate does on release, what the
   no-score state looks like, what the round-advance gate lists) as an
   integration point to be wired once STORY-001-040/031/034/043 land —
   confirm this split with the user rather than silently building against
   assumed contracts.
4. **RESOLVED — `ApprovalStatus`'s final shape is now fixed in this story's
   canvas.** The complete union — `"pending-contest-director-approval" |
   "approved" | "declined" | "lapsed"` — is defined once, here, rather than
   split across two stories' canvases; STORY-001-028 implements against it
   rather than designing its own `"approved"`/`"declined"` members
   independently. `"lapsed"` applies as a side-effect of "advance anyway" to
   either a **prepared** or an **approved** not-yet-flown re-flight
   (resolved decision, see Requirement Ambiguities).
5. **Abort's annulment must use a superseding fact, never a deletion or
   rewrite** (D4) — extends the existing overlay/supersede idiom already used
   by `DrawProjection` and `ScoringProjection`, and (resolved decision) must
   exclude **both** raw captures **and** any lone-pilot/annulment-override
   resolutions already recorded for the group's aborted run, and applies
   **only** while the group is in working time (not once landing has begun).
6. **RESOLVED — the prep-confirmation gate is a single group-level hold**,
   not independent per-pilot locks: it clears only once every blocking
   device is confirmed or Director-released, though each device is still
   released individually with its own chosen form.
7. **No FAI-rule or existing-requirement conflict found** — the story is
   consistent with D1/D4/D5/D9/D10 and the cited general-rules sections;
   class behaviour is untouched throughout (no discipline branch anywhere in
   this story's own logic).
