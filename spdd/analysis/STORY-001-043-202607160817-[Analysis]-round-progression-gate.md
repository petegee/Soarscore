# SPDD Analysis: Gate Round Advance on Score Completeness

> **The one place three not-yet-built stories converge, on top of a lifecycle
> action that is already legally declared but has never once fired.**
> `RoundAdvance` exists today as an admissible `LifecycleAction` in
> `apps/base/src/lifecycle/guard.ts`, gated purely on state
> (`Running/BetweenGroups`) — but no route, service method, or emitter appends
> `competition.roundAdvanced` anywhere in the codebase, so
> `LifecycleProjection.completedRoundCount()` reads 0 for every competition
> that has ever run. This story is therefore not a decision layer over
> finished mechanics (the STORY-001-028 pattern); it is the **first thing to
> actually invoke the RoundAdvance transition**, and it must do so as a
> completeness gate consuming two sibling states — score capture (built,
> `ScoringProjection`) and no-score / re-flight state (STORY-001-031 /
> STORY-001-028, both themselves not yet landed). The codebase already
> contains an exact template for this shape: `CompetitionService.start()`
> (STORY-001-025) is the "not-found → read state → readiness split
> (outstanding items) → guard assert → append → apply → return" command idiom
> this story's `advanceRound()` should mirror almost verbatim, reusing the
> existing `OutstandingItem` / `CompetitionNotReadyError` DTO shape rather than
> inventing a new one.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-43]round-progression-gate.md`.

# [STORY-001-043] Gate Round Advance on Score Completeness

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.4 · `docs/
> requirements/high-level-requirements.md` Area 6.4 · `docs/requirements/
> decisions.md` D10 (operator-driven progression) · relates to STORY-001-031
> (no-score resolution), STORY-001-028 (re-flight entitlement), STORY-001-032
> (the Contest Director's "advance anyway" override of this gate)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

The Announcer/Timekeeper advances the contest from one round to the next,
but only once the previous round is genuinely finished: every group's scores
captured, no unresolved no-score left for a pilot who could still fly, and no
granted-but-unflown re-flight entitlement stranded by moving on. This story
delivers that gate at the round boundary — checking completeness and, when
something is outstanding, listing exactly what and blocking the advance until
it clears.

The gate does **not** decide the missing scores itself, nor resolve a
no-score or re-flight — those belong to the Organiser's oversight
(chasing/validating, [5.6](../docs/requirements/high-level-requirements.md#area-5--scoring)),
STORY-001-031 and STORY-001-028 respectively. Its only job is to hold the
boundary and show what's outstanding until those are in, or until the Contest
Director issues an explicit "advance anyway" override
(STORY-001-032) — a separate story, since that override and its
consequences are the Director's authority, not this gate's own behaviour.
This gate operates only at the **round** boundary; starting each group within
a round is a separate operator action (STORY-001-044) that is not
score-gated.

### Business Value

- Guarantee no flight is left unscored when the contest moves on to the next
  round, without the Announcer/Timekeeper having to remember to check.
- Show exactly which group(s)/competitor(s) are still outstanding, so the
  Announcer/Timekeeper knows what to chase before the round can proceed.
- Keep the decision of *what to do* about a missing score, no-score or
  re-flight with the roles that actually own it (Organiser oversight,
  no-score resolution, re-flight scheduling), while this gate only holds the
  boundary.

### Dependencies and Assumptions

- **Prerequisites**: Area 5 scoring completeness data for the previous
  round; STORY-001-031 (no-score state) and STORY-001-028 (re-flight
  entitlement) exist as the sources of the outstanding-item categories this
  gate checks.
- **Data assumptions**: for a given round, the system can determine, per
  group, whether every competitor's score is captured, whether any pilot
  holds an unresolved no-score with groups remaining that they could still
  fly, and whether any granted-but-unflown re-flight is placed at the end of
  this round.
- **Integration points**: this gate is checked when the Announcer/Timekeeper
  attempts to start the next round; the Contest Director's "advance anyway"
  override (STORY-001-032) is the only path past a block this story raises.
- **Business constraints**: operator-driven progression (D10) — the round
  advance is always a deliberate action, never automatic; this gate never
  itself resolves a no-score, chases a missing score, or overrides a
  re-flight entitlement.

### Scope In

- Checking, at an attempted round advance, that every group in the previous
  round has all its scores captured.
- Checking that no pilot holds an unresolved no-score with groups remaining
  in which they could still fly.
- Checking that no granted-but-unflown re-flight entitlement is stranded by
  advancing.
- Blocking the advance and listing the specific outstanding group(s)/
  competitor(s)/item(s) when any of the above checks fail.
- Allowing the advance to proceed, and making the next round current, once
  every check passes.

### Scope Out

- Deciding or entering the missing scores themselves — Organiser oversight
  ([5.6](../docs/requirements/high-level-requirements.md#area-5--scoring)).
- Resolving a no-score (move to a later group, or converting to zero at round
  end) — STORY-001-031.
- Scheduling or flying a re-flight — STORY-001-028.
- The Contest Director's "advance anyway" override and its consequences
  (flagged anomalies, no-score-to-zero conversion, re-flight lapse) —
  STORY-001-032.
- The deliberate action that starts each group within a round, which is not
  score-gated — STORY-001-044.
- Whether Scorer self-correction is still open on a flown group (that closes
  when the next **group**, not round, starts — D11, STORY-001-036) — this
  gate does not affect that window.

### Acceptance Criteria

#### AC1: A missing score blocks the advance and lists what's outstanding
**Given** Round 3 has one group where Mary Field's flight was never captured
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and Mary Field's group/competitor is listed
as the outstanding item.

#### AC2: An unresolved no-score with remaining groups blocks the advance
**Given** Round 3 has a pilot holding an unresolved no-score and groups
remaining in Round 3 that pilot could still fly
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and that pilot's unresolved no-score is
listed as the outstanding item.

#### AC3: A granted-but-unflown re-flight placed at round end blocks the advance
**Given** a re-flight has been granted for the end of Round 3 and has not yet
been flown
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and the unflown re-flight is listed as the
outstanding item.

#### AC4: A complete round advances cleanly
**Given** every group in Round 3 has all its scores captured, no unresolved
no-score remains, and no re-flight is owed
**When** the Announcer/Timekeeper advances
**Then** Round 4 becomes the current round and its first group can be
started.

#### AC5: The gate does not resolve outstanding items itself
**Given** the advance is blocked on a missing score
**When** the Announcer/Timekeeper reviews the blocked items
**Then** the gate only lists them — it does not enter a score, resolve the
no-score, or schedule the re-flight on the Announcer/Timekeeper's behalf;
those actions belong elsewhere (Organiser oversight, STORY-001-031,
STORY-001-028).

#### AC6: Only the round boundary is gated, not each group start within it
**Given** Round 3 is still in progress with its later groups not yet run
**When** the Announcer/Timekeeper starts one of those later groups
**Then** that group start proceeds without this gate's check — the gate only
applies at the round boundary (STORY-001-044 governs group starts).

#### Non-Functional Expectations
- The gate carries no knowledge of any specific competition class — its
  completeness checks read generic scoring-completeness, no-score and
  re-flight state (CLAUDE.md class-model law).

### INVEST Check

Independent (a completeness check at one boundary, consuming but not owning
no-score/re-flight state) · Valuable (guarantees no flight is silently left
unscored as the contest proceeds) · Small (3 days, 3 functional points:
score-completeness check, no-score/re-flight outstanding-item checks, the
listing of outstanding items) · Testable (each blocking condition and the
clean-advance path are directly observable).

---

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **`RoundAdvance` as a declared `LifecycleAction`** (`apps/base/src/
  lifecycle/guard.ts`): already admissible only from `Running/BetweenGroups`
  — the same state gate as `Suspend`/`Lock`. Pure, class-agnostic, and
  currently the *only* piece of this story that exists in code. No route or
  service method calls it, and `assertAdmissible` today only checks
  lifecycle state, not completeness — this story adds the completeness
  layer the guard was never meant to hold (mirroring how Start's readiness
  ladder lives in `CompetitionService`, not `LifecycleGuard`).
- **`competition.roundAdvanced` / `CompetitionRoundAdvancedPayload`**
  (`packages/shared/src/events.ts`): declared (`{competitionId,
  roundNumber}`) but never appended. `LifecycleProjection.completedRounds`
  already folds it (returns 0 today) and exposes `completedRoundCount()` for
  STORY-001-026's Lock finalisation guard. This story is the natural owner
  of the first emitter for this event.
- **`CompetitionService.start()` command idiom** (`apps/base/src/
  competitions/service.ts:202-228`): not-found → read lifecycle state →
  readiness split (`outstandingItemsFor`, computed in the service, never the
  pure guard) → `assertAdmissible` → append exactly one event on success,
  none on rejection → return the fresh read DTO. This is a direct,
  reusable template for `advanceRound()`.
- **`OutstandingItem` / `CompetitionNotReadyError`**
  (`packages/shared/src/lifecycle.ts:59-64`, `apps/base/src/competitions/
  errors.ts`): the exact `{code, message}` blocked-action DTO STORY-001-025's
  Start gate already uses (`ROSTER_INCOMPLETE`, `DRAW_NOT_ACCEPTED`). This
  story's missing-score / no-score / re-flight outstanding items are new
  `OutstandingItemCode` members appended to the same additive union — not a
  new shape.
- **`ScoringProjection` / `ScoringService.getGroupScore`**
  (`apps/base/src/scoring/`): the source of "has this group's score been
  captured." `GroupCompositionProvider.getEffectiveGroups(competitionId,
  roundNumber, taskId)` gives the actual seated members per group (accepted
  draw plus any move/split/re-flight overlay), and
  `ScoringProjection.getResults(...)` / `hasCapturedResults(...)` give the
  per-seat capture facts to test against.
- **`ContestClassModel.tasks` and per-task grouping**
  (`packages/shared/src/draw.ts`, `AcceptedDraw.rounds[].taskGroups[]`): a
  round is not always one flat set of groups — multi-task classes (F3B) carry
  one independent group composition **per task** within the round. The
  completeness check (AC1/AC4) must therefore iterate `model.tasks ×
  getEffectiveGroups(round, taskId)`, not assume a single task per round —
  reading task count from the class model generically (class-model law).
- **The state-provider seam idiom** (`apps/base/src/competitions/
  state-providers.ts`): `LockStateProvider`, `FinalisationProgressProvider`,
  `CapturedScoresProvider` — each a small injected interface with a no-op
  stub, swapped for a real implementation via `AppOptions` with zero rework.
  This is the established, idiomatic way for `CompetitionService` to consume
  score-completeness, no-score, and re-flight state without importing the
  scoring/no-score/draw modules directly.
- **`Attribution` and the operator-attributed write pattern**
  (`apps/base/src/routes/*`): every existing lifecycle command
  (`start`/`lock`/`delete`) takes an `Attribution` and appends exactly one
  event; `RoundAdvance` should follow the same shape, attributed to the
  Announcer/Timekeeper (or whichever role's header the route parses, per
  D1's recorded-not-enforced stance).
- **The immutable event log & derive-from-events discipline**
  (`EventStore`, every projection's `rebuild`/`apply` pair): the gate's
  checks must all be pure reads over existing/injected state; the one new
  write is the single `competition.roundAdvanced` fact on success.

#### New Concepts Required

- **The completeness check itself — "every group in the round has all
  scores captured."** New logic, but composed entirely from existing reads:
  for each task in the class model, for each effective group in that round/
  task, for each seated roster entry, does a captured result exist (via
  `ScoringProjection`/`ScoringService`)? This is the one piece of genuinely
  new domain logic this story owns outright.
- **`RoundAdvance`'s outstanding-item categories.** New `OutstandingItemCode`
  members (naming TBC in REASONS Canvas, e.g. `SCORE_MISSING`,
  `NO_SCORE_UNRESOLVED`, `REFLIGHT_UNFLOWN`) extending the existing additive
  union, each carrying enough identifying detail (group/competitor) in its
  `message` to satisfy AC1/AC2/AC3's "lists the specific... item."
- **`NoScoreStateProvider`-shaped seam (consumed, not built here).**
  STORY-001-031's own analysis already names this exact provider as the
  round-advance gate's intended consumption point — this story is the
  *consumer* half of that seam (a no-op stub today, wired to the real
  no-score projection once STORY-001-031 lands), mirroring how Lock consumes
  `LockStateProvider`.
- **A re-flight-outstanding seam (consumed, not built here).** Symmetric to
  the no-score seam: a small injected interface answering "is there a
  granted-but-unflown re-flight for this round" over STORY-001-028's
  `draw.reflightPrepared`/`…Approved` facts (once that story defines the
  "approved" `ApprovalStatus` member) — needed by AC3, owned by neither
  story alone but must be agreed as a seam shape.
- **The `advanceRound()` command and its `competition.roundAdvanced`
  emitter.** The first code path to ever append this declared-but-unused
  event, closing the loop `LifecycleProjection.completedRoundCount()` and
  STORY-001-026's Lock finalisation guard have been waiting on since that
  story shipped.

#### Key Business Rules

- **The round boundary is the only gated point (AC6; Background).** Group
  starts within an in-progress round are ungated (STORY-001-044's territory)
  — this story's check fires exclusively on the `RoundAdvance` action, never
  on a group-start action.
- **The gate lists; it never resolves (AC5).** No score entry, no no-score
  resolution, no re-flight scheduling happens inside this story's code path
  — every outstanding item is a pure read surfaced to the operator.
  Violating this would blur the ownership boundary the story's whole
  Scope Out section exists to protect.
- **A no-score blocks the advance only while it is still resolvable
  (STORY-001-031, AC2).** "Groups remain for this pilot" is the precise
  predicate, not a blanket "any unresolved no-score ever blocks" — an
  unresolved no-score with genuinely no remaining group does *not* block
  (STORY-001-031 auto-zeroes it at the very round boundary this story
  guards, so the two stories' rules must compose without double-counting).
- **Only a granted (approved) re-flight blocks, and only if unflown
  (AC3).** A merely *prepared*, not-yet-approved re-flight is
  STORY-001-028's concern, not this gate's, per that story's own analysis
  reading "granted" as the approved state.
- **Class-agnostic (CLAUDE.md, NFR-1/2).** The completeness check iterates
  the class model's own task list generically; it never branches on
  discipline, and F3B's three-task-per-round shape must fall out of the same
  code path as a single-task class's.
- **Operator-driven, never automatic (D10).** The advance is attempted, not
  triggered by a timer or by the last score landing — this story only
  decides admit-or-block for a deliberate attempt.

---

## Strategic Approach

#### Solution Direction

- **Extend `CompetitionService`'s existing Start-gate pattern to a second
  command, `advanceRound()`, rather than inventing a new gating mechanism.**
  Concretely:
  1. Add an `advanceRound(id, attribution)` method following `start()`'s
     exact shape: not-found check → read `LifecycleState` → compute
     outstanding items for the *previous* round (new logic) → if any exist,
     throw `CompetitionNotReadyError` with the populated `OutstandingItem[]`
     → else `lifecycleGuard.assertAdmissible(state, "RoundAdvance")` → append
     `competition.roundAdvanced` → apply → return the fresh lifecycle DTO.
  2. The outstanding-items computation is a new private method
     (`outstandingItemsForRoundAdvance`, mirroring `outstandingItemsFor` and
     `resolveFinalisation`'s existing shape) composing three reads: (a) a
     class-agnostic score-completeness scan over
     `model.tasks × getEffectiveGroups(round, taskId) × ScoringProjection`,
     (b) an injected no-score-outstanding seam, (c) an injected
     re-flight-outstanding seam.
  3. Both no-score and re-flight reads go through new small interfaces in
     `state-providers.ts`, each with a no-op ("nothing outstanding") stub
     today — exactly the seam idiom `LockStateProvider`/
     `FinalisationProgressProvider` already establish — so this story ships
     now and STORY-001-031/028 wire in their real answers later with zero
     rework here.
  4. A new route — `POST /api/competitions/:id/round-advance` (**settled,
     user-confirmed in REASONS Canvas review**, no longer TBC) — parses
     attribution (a new `atAttributionFromHeaders()`, `authority:
     "announcer-timekeeper"`, **settled, user-confirmed**: introduced fresh
     by this story) and calls the service method, following the existing
     lifecycle route file's shape exactly.
- **Data flow (mirrors `start()`):** operator action → route parses
  attribution → `CompetitionService.advanceRound` → guard/readiness checks
  (pure reads over injected providers + `ScoringProjection`) → either throw
  with the outstanding list, or append `competition.roundAdvanced` and return
  the updated lifecycle read DTO.

#### Key Design Decisions

- **Which round does "the previous round" mean, precisely? — SETTLED.**
  Derive it server-side from `completedRoundCount(id) + 1`, the same counter
  `resolveFinalisation()` already reads. No client-supplied round number;
  removes a class of client/server round-number mismatch.
- **Score-completeness granularity: per-seat capture check vs. reusing
  `getGroupScore`'s full recompute. — SETTLED.** A lightweight, dedicated
  completeness read via a new `ScoreCompletenessProvider` seam wrapping
  `ScoringProjection.hasCapturedResults`, rather than invoking the full
  recompute pipeline per group just to test presence. `getGroupScore` is
  never called from this gate: its lone-pilot resolution fires on the
  *first* recompute that observes a singleton, and a mere readiness check
  must not become that first recompute for a group nobody has actually
  scored yet.
- **`hasCapturedResults`'s global (any-round/any-task) scoping — SETTLED,
  user-confirmed in REASONS Canvas review: acceptable as-is.** The method
  answers "has this seat ever captured a result, in any round/task,"
  rather than a check scoped to the exact round/task/group being gated.
  This does not admit a false "complete" reading here because
  `getEffectiveGroups(previousRound, taskId)` already restricts the check
  to seats actually seated in that round/task — a capture recorded
  elsewhere cannot substitute for one missing here. A test obligation is
  added (REASONS Canvas Safeguards §11) asserting a re-seated,
  previously-scored pilot still surfaces `SCORE_MISSING` for a
  not-yet-flown seat in the round being gated, closing this out as a
  verified guarantee rather than an assumption.
- **Pilot-name resolution for outstanding-item messages — SETTLED,
  user-confirmed in REASONS Canvas review.** `CompetitionService` gains a
  new constructor dependency on `RosterProjection` (not previously held)
  solely to resolve `rosterEntryId → pilotName` for AC1/AC2/AC3's
  human-facing messages. Confirmed as an accepted new dependency, not an
  open risk.
- **Seam shape for no-score and re-flight outstanding items. — SETTLED.**
  Two separate single-purpose provider interfaces
  (`NoScoreOutstandingProvider`, `ReflightOutstandingProvider`), matching the
  existing one-concept-per-provider granularity
  (`LockStateProvider`/`CapturedScoresProvider`/`FinalisationProgressProvider`
  are each single-purpose) — `CompetitionService` composes all three checks
  (score-completeness, no-score, re-flight) into one `OutstandingItem[]`
  itself, exactly as `start()`'s `outstandingItemsFor` composes roster and
  draw checks today. Each ships with a no-op ("nothing outstanding") stub
  until STORY-001-031/028 land.
- **New `OutstandingItemCode` naming. — SETTLED.** `SCORE_MISSING`,
  `NO_SCORE_UNRESOLVED`, `REFLIGHT_UNFLOWN`, extending the existing flat
  additive union — no new DTO shape.
- **Outstanding-item message detail level. — SETTLED.** Human-facing:
  each item's `message` names the pilot plus group/task (e.g. "Mary Field's
  flight in Group 3 (Task A) was not captured"), directly readable by the
  Announcer/Timekeeper without cross-referencing an id — matching AC1's own
  phrasing ("Mary Field's group/competitor is listed").
- **Auto-zero trigger at the round boundary. — SETTLED.** `advanceRound()`
  stays a pure gate: check, block, or allow and append
  `competition.roundAdvanced` on success. It does **not** invoke
  STORY-001-031's end-of-round auto-zero conversion; that story hooks its
  own conversion to fire off `competition.roundAdvanced` (or an equivalent
  seam) independently. Keeps this story's boundary exactly as scoped (Scope
  Out already excludes "resolving a no-score") and avoids a build-order
  dependency on STORY-001-031's conversion primitive existing first.
- **F3B pending-annulment as a possible fourth outstanding category. —
  SETTLED: scoped out.** A pending `scoring.annulmentOverrideRequested`
  does **not** block round advance in this story. It is a scoring-recompute
  state (`pendingAnnulmentOverride`), not a capture-completeness/no-score/
  re-flight state, and STORY-001-028 owns its resolution lifecycle in full.
  If this needs gating later, it is a follow-up story's concern, not
  silent scope creep here.

#### Alternatives Considered

- **Putting the completeness check inside `LifecycleGuard`:** rejected — the
  guard is deliberately a pure, stateless state×action table with no
  aggregate reads (its own header comment: "no branch on any competition
  class and no read of the Contest Class Model"). `Start`'s readiness split
  already establishes the precedent that a *readiness* check (as opposed to
  bare state-legality) lives in the service, not the guard; this story
  follows the same split.
- **Building the no-score/re-flight seams as hard dependencies (wait for
  STORY-001-031/028 to land first):** rejected — mirrors the same
  build-order reasoning STORY-001-032's analysis already reached for its own
  four prerequisites: build the gate's plumbing and score-completeness check
  now against injected no-op seams, so STORY-001-031/028 have a concrete
  interface to satisfy rather than inventing their own round-advance
  vocabulary independently.
- **Reusing `getGroupScore`'s full recompute as the completeness signal:**
  rejected (see Key Design Decisions) — risks accidentally triggering
  lone-pilot RNG resolution as a side effect of a mere readiness check, and
  is heavier than the presence-only question the gate actually needs to
  answer.

---

## Risk & Gap Analysis

#### Requirement Ambiguities

- **"Every group... has all its scores captured" for a multi-task class
  (F3B) is not spelled out.** The requirement's examples (AC1) are
  single-group, single-task. For F3B, a round holds three independent task
  compositions (`taskGroups`); "the round is complete" must mean every group
  in *every* task's composition is fully captured, not just one task. This
  is addressable (derive generically from `model.tasks`), but must be
  surfaced explicitly so it is not implemented as a single-task assumption.
- **What identifies "the previous round" to check — RESOLVED.** Derived
  server-side from `completedRoundCount() + 1`; no client-supplied round
  number (see Strategic Approach).
- **The precise wording/detail level of an outstanding item's `message` —
  RESOLVED.** Human-facing: pilot name plus group/task identifiers embedded
  directly in the message (see Strategic Approach).

#### Edge Cases

- **A round with zero groups yet run at all** (round advance attempted
  before the round has even started) — is that "incomplete" (blocked) or
  inapplicable (nothing to check)? The ACs assume a round already in
  progress; an attempt to advance past a round that was never started is an
  edge case the gate must handle without crashing (likely: every group's
  every seat is "missing," which correctly blocks, but this should be
  confirmed rather than assumed).
- **Advancing past the very first round vs. every subsequent round** — no
  special-casing should be needed if the completeness check is genuinely
  round-number-generic, but this should be asserted in tests rather than
  assumed.
- **Interaction with STORY-001-031's own end-of-round auto-zero — RESOLVED.**
  `advanceRound()` stays a pure gate and does not invoke STORY-001-031's
  conversion rule; that story hooks its own auto-zero off the
  `competition.roundAdvanced` event (or an equivalent seam) independently
  (see Strategic Approach). The no-score check here (AC2) still blocks
  advance only while a no-score is genuinely movable; a no-score with no
  remaining groups is not this gate's concern to resolve or block on.
- **The lone-pilot/F3B-annulment pending state
  (`scoring.annulmentOverrideRequested`, STORY-001-028) as a possible fourth
  outstanding-item category — RESOLVED: explicitly scoped out.** A pending
  F3B annulment does not block round advance in this story (see Strategic
  Approach).
- **Concurrent attempts / D8 (last-action-wins, no session lock).** Two
  operators attempting `RoundAdvance` simultaneously, or an advance racing a
  score capture landing mid-check, should resolve to a clean single success
  or a clean re-block, not a partial/corrupted outstanding-item list —
  needs a test, not new design (the read-then-append shape already handles
  this the same way `start()`/`lock()` do).

#### Technical Risks

- **Two of the three outstanding-item categories depend on unbuilt
  siblings.** STORY-001-031 (no-score state) and STORY-001-028's "approved"
  `ApprovalStatus` (re-flight granted state) do not exist in code yet. This
  story can build and unit-test the score-completeness check and the full
  command idiom now, against no-op seam stubs for the other two categories
  — but AC2 and AC3 are not demonstrable end-to-end until those land.
  Mitigation: build to the provider-seam idiom exactly as
  `LockStateProvider`/`FinalisationProgressProvider` model, so wiring the
  real answers later is zero-rework here.
- **`getGroupScore`'s lone-pilot RNG side effect must not be triggered by a
  mere completeness check.** As noted in Key Design Decisions, the
  completeness read must be a lightweight presence check, not a call into
  the full recompute pipeline — getting this wrong would make a read-only
  gate check accidentally materialise a lone-pilot dummy resolution or an
  F3B annulment request as a side effect, which would be a correctness bug,
  not just an inefficiency.
- **`competition.roundAdvanced` is the first-ever emitted instance of a
  declared-but-dormant event.** `LifecycleProjection`'s fold already exists
  and is exercised by STORY-001-026's Lock finalisation guard reading
  `completedRoundCount()` — this story activates that dormant path for the
  first time. Low risk (the fold is already written and presumably tested
  against a stubbed count), but it is the first real integration test of
  that fold against a live event.
- **Missing `setErrorHandler` branch.** `CompetitionNotReadyError` is
  already wired in `app.ts` for the Start gate; if `advanceRound()` reuses
  the same error class (recommended), no new branch is needed — but this
  should be confirmed rather than assumed, since a different error subclass
  would need its own branch (Safeguard-8-equivalent discipline already
  visible in that file).
- **No FAI-rule or cross-requirement contradiction found (house-keeping
  check).** The gate matches `00-general-rules.md`'s operator-driven
  progression expectations and Area 6.4/D10; the three outstanding-item
  categories are each independently owned and consistent with STORY-001-031
  and STORY-001-028's own analyses (both explicitly name this gate as their
  consumer and scope their own resolution mechanics out of it). The
  STORY-001-032 "advance anyway" override is a clean, mutually-scoped
  sibling — this story raises the block, that story is the only path past
  it. Clean cross-reference.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Missing score blocks advance, lists outstanding item | Yes | Buildable now in full: composes `model.tasks`, `getEffectiveGroups`, and `ScoringProjection`'s existing capture facts — no unbuilt dependency. Must generalise correctly across multi-task (F3B) rounds. |
| 2 | Unresolved no-score with remaining groups blocks advance | Partial | The gate's *consumption* of a no-score-outstanding seam is buildable now (no-op stub); the real signal depends on STORY-001-031 (unbuilt). Also depends on the "groups remain" predicate STORY-001-031 owns. |
| 3 | Granted-but-unflown re-flight blocks advance | Partial | Same shape as AC2: consumption seam buildable now; the real "approved" re-flight state depends on STORY-001-028's second event (unbuilt as of that story's own analysis, though its design is settled). |
| 4 | Complete round advances cleanly, next round becomes current | Yes | Fully buildable: mirrors `start()`'s success path exactly — append `competition.roundAdvanced`, apply, return the fresh state. First real emitter for this event. |
| 5 | Gate lists, never resolves | Yes | Structural — the service method only reads and reports; no resolution code path exists in this story's scope by design. |
| 6 | Only the round boundary is gated, not group starts | Yes | Structural — the check only fires inside `advanceRound()`, never inside any group-start action (STORY-001-044's separate territory, itself not yet built but architecturally distinct). |

---

## Summary of Key Points for REASONS Canvas

1. **This story is the first code to ever exercise `RoundAdvance`.** The
   lifecycle action, event type and projection fold already exist and are
   dormant; this story writes the first emitter. Mirror
   `CompetitionService.start()`'s exact command idiom (not-found → state →
   readiness split → guard assert → append → apply → return) for
   `advanceRound()`.
2. **Reuse the existing `OutstandingItem`/`CompetitionNotReadyError` DTO and
   error class** rather than inventing a new blocked-action shape — just add
   new `OutstandingItemCode` members.
3. **The score-completeness check (AC1/AC4) is fully buildable now** from
   existing code (`ContestClassModel.tasks`, `GroupCompositionProvider`,
   `ScoringProjection`) and must generalise across multi-task (F3B) rounds
   via the class model, never a discipline branch. Use a lightweight
   presence check, not `getGroupScore`'s full recompute, to avoid
   accidentally triggering lone-pilot RNG resolution as a side effect of a
   readiness check.
4. **AC2/AC3 depend on two unbuilt siblings** (STORY-001-031's no-score
   state, STORY-001-028's "approved" re-flight state) — build against two
   small injected seam interfaces (mirroring `LockStateProvider`/
   `FinalisationProgressProvider`) with no-op stubs today, wired to the real
   projections when those stories land.
5. **Settled: `advanceRound()` stays a pure gate.** It does not invoke
   STORY-001-031's auto-zero-conversion rule; that story hooks its own
   conversion off `competition.roundAdvanced` independently. This story's
   boundary is check/block/allow only.
6. **Settled: the F3B pending-annulment case is explicitly out of scope**
   for this story's outstanding-item checks — three categories only
   (missing score, no-score, re-flight), per the ACs as written.
7. **Also settled in interactive review:** round number derived server-side
   from `completedRoundCount() + 1`; completeness read is a lightweight
   presence check (never `getGroupScore`); no-score/re-flight consumed via
   two separate single-purpose provider seams; new codes are
   `SCORE_MISSING` / `NO_SCORE_UNRESOLVED` / `REFLIGHT_UNFLOWN`; outstanding
   messages are human-facing (pilot name + group/task).
8. **No FAI-rule or existing-requirement conflict found** — consistent with
   D10, Area 6.4, and the mutually-scoped sibling stories (STORY-001-031,
   STORY-001-028, STORY-001-032 all name this gate as their consumer and
   scope their own mechanics out of it).
