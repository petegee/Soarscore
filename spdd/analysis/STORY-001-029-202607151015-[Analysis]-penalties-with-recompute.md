# SPDD Analysis: Impose Penalties with Correct Recompute

> **The behaviour layer over an already-built, already-tested scoring
> substrate.** STORY-001-007's `computeFinalAggregate` (`packages/shared/src/
> scoring.ts`) was *deliberately pre-shaped for this story*: it already accepts a
> `penaltyTotal` tracked **outside** the drop-worst `series`, retains it across a
> dropped round, and floors the aggregate at zero — with tests named
> "AC5 penalty retained through drop" and "AC8 negative floors at zero". What
> does **not** exist anywhere in the codebase is (a) any way to *record* a
> penalty (no penalty event, no impose/revoke command, no per-(competitor,round)
> penalty store), (b) any **wiring** of `computeFinalAggregate` into a service or
> route — it is a pure function with unit tests and **zero production callers** —
> and (c) any representation of **disqualification**, which the pure aggregate
> function has no concept of. This story delivers the record-and-recompute layer
> and a disqualification outcome on top of maths that is already correct.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-29]penalties-with-recompute.md`.

# [STORY-001-029] Impose Penalties with Correct Recompute

> Source: `docs/user-stories/02-contest-director.md` §5.9 ·
> `docs/requirements/high-level-requirements.md` Area 5.9 ·
> `docs/requirements/decisions.md` D1 (authority recorded, not enforced), D4
> (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §5 (final classification,
> drop-worst), §6 (penalties) · the per-class rule docs (drop-worst thresholds,
> penalty amounts) · STORY-001-016 (Contest Class Model), STORY-001-007 (scoring)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Discipline is the Contest Director's alone. Where a Scorer records **task-integral
deductions** at the line (land-outs, a model contacting a person) and the system
**derives conditions** from the raw captures (working-time overruns from the
flight timestamps, zeroed flights), the **discretionary disciplinary penalty** —
for infringements, dangerous flying, cheating or unsporting behaviour, up to
disqualification — is imposed by the Contest Director and is never entered on a
Scorer device.

This story delivers that authority and, more importantly, its **recompute
invariants**. A point penalty is recorded **against the round in which it
occurred** and is **cumulative** across the contest; but at final-classification
time it is **deducted from the final aggregate**, not from any single normalised
group score. The central, defensibility-critical invariant is that a penalty in a
round the class's drop-worst rule later **discards is still retained** — the
penalty follows the competitor to the final total even though its round is
dropped. Penalties that would take a total below zero **floor at zero** while the
penalties still stand. A **disqualification** is a distinct outcome — removal from
the classification rather than a point deduction. Every penalty imposed or revoked
is attributable and recomputes immediately (D1/D4).

The drop-worst thresholds and penalty amounts are **class properties** read from
the Contest Class Model (STORY-001-016) — F5J drops the lowest round beyond 4, F3K
beyond 6, F5K beyond 7, F5L beyond 5, F3J beyond 7, and F3B discards the lowest
partial per task beyond 5. The core applies "retain penalty across the drop"
generically and never branches on discipline.

### Business Value

- Provide the Contest Director with the authority to reflect rule-breaking in the
  result exactly as the rules require, up to disqualification.
- Support a defensible result — the penalty-survives-the-drop invariant means a
  competitor cannot escape a penalty by having its round dropped.
- Enable class-correct finalisation: drop-worst thresholds and penalty amounts
  come from the class model, so every MVP class penalises correctly with no
  discipline-specific code.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-007 (score computation and the final aggregate the
  penalty deducts from), STORY-001-016 (Contest Class Model — drop-worst
  thresholds and any class-specific penalty amounts), STORY-001-024 (lifecycle —
  penalties are imposed while Running or during the pre-Lock validation pass).
- **Data assumptions**: penalties attach to a (competitor, round) and persist
  independently of that round's group normalisation; actor identity arrives with
  the request and Contest-Director authority is **recorded, not enforced** (D1);
  the class model exposes the drop-worst threshold and rule.
- **Integration points**: the final aggregate and drop-worst come from
  STORY-001-007 / the class model; imposing or revoking a penalty triggers an
  immediate recompute along that same path; penalties feed the final
  classification consumed by Lock/finalisation (STORY-001-026) and reports.
- **Business constraints**: penalty amounts and drop-worst numbers live in the
  read-only rule docs and are authoritative; class-agnostic core (CLAUDE.md);
  offline-first (D6).

### Scope In

- **Impose a point penalty** (any magnitude up to disqualification) recorded
  **against the round in which it occurred** and **cumulative** across the
  contest.
- **Deduct penalties from the final aggregate** at classification time — not from
  a single normalised group score.
- **Retain a penalty across a dropped round**: a penalty in a round the class's
  drop-worst rule discards is still deducted from the final total.
- **Floor at zero**: penalties taking a total below zero record the total as zero
  while the penalties still stand.
- **Disqualification** as a distinct outcome — reflected in the final
  classification per the rule, not as an ordinary deduction.
- **Revoke** a penalty; immediate, consistent recompute on any impose/revoke;
  every action attributable (D1/D4).

### Scope Out

- **Task-integral deductions** a Scorer records at the line (land-outs, model
  contacting a person) — Scorer scope (STORY-001-... 5.2.3); those are part of
  scoring the flight, not a disciplinary penalty.
- **System-derived conditions** (working-time overrun from timestamps, zeroed
  flights) computed from raw captures (D9, scorer-device §1) — not this story.
- **Correcting a captured task metric** (Area 5.4 / STORY-001-012) — that fixes a
  value; this story imposes a discretionary ruling on top of correctly captured
  values.
- **The drop-worst arithmetic and final aggregate maths** — STORY-001-007 and the
  class model (STORY-001-016); this story defines penalty *behaviour* over that
  computation.
- **The precise placement of a disqualified competitor** in the final
  classification order — left to per-discipline detail (see open questions);
  this story establishes only that DQ is distinct from a point deduction.
- Enforcing that only a Contest Director may impose (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: A point penalty is recorded against its round and is cumulative
**Given** an infringement by pilot "John Brown" in round 3
**When** the Contest Director imposes a 100-point penalty
**Then** it is recorded against round 3 for John Brown and accumulates with any
other penalties he receives across the contest.

#### AC2: Penalties deduct from the final aggregate
**Given** John Brown with a summed round score of 5,200 and two penalties of 100
and 50
**When** the final result computes
**Then** his final total is 5,050 — the 150 in penalties is deducted from the
final aggregate, not from any single normalised group score.

#### AC3: A penalty survives the drop of its round
**Given** an F5J competitor (class drops the lowest round beyond 4) whose round 2
is his dropped-worst round, and a 100-point penalty was imposed in round 2
**When** the final result computes
**Then** round 2's **score** is discarded by drop-worst but the 100-point
**penalty is retained** and still deducted from the final aggregate.

#### AC4: A total driven below zero floors at zero
**Given** a competitor whose penalties exceed his summed round score
**When** the final result computes
**Then** his total is recorded as **zero** (never negative) and the penalties
still stand on the record.

#### AC5: A disqualification is distinct from a point deduction
**Given** a competitor the Contest Director disqualifies
**When** the final classification computes
**Then** the disqualification is reflected per the rule as removal from
classification, distinct from an ordinary point deduction — not merely a large
negative score.

#### AC6: Drop-worst threshold is class-driven, not discipline-branched
**Given** the same "penalty in a dropped round" situation in an F3K contest
(drops beyond 6) and an F5L contest (drops beyond 5)
**When** each final result computes
**Then** which round is dropped follows each class model's drop-worst threshold
while the penalty-retained-across-the-drop behaviour is identical, with no
discipline-specific logic in the core.

#### AC7: Impose and revoke are attributable and recompute immediately
**Given** the Contest Director imposes, then later revokes, a penalty
**When** each action is applied
**Then** results recompute immediately and consistently, and both the impose and
the revoke are recorded in the event log with the acting person and
Contest-Director authority (D1/D4).

#### Non-Functional Expectations
- Drop-worst thresholds and any class-specific penalty amounts are read from the
  Contest Class Model; the core carries no per-class penalty knowledge (CLAUDE.md
  class-model law, NFR-1/NFR-2).
- Penalty imposition and recompute operate on the base with no internet connection
  (offline-first, D6).

### INVEST Check

Independent (a penalty layer over STORY-001-007 scoring and the STORY-001-016
class model) · Valuable (the penalty-survives-the-drop invariant the result's
defensibility depends on) · Small (4 days, 3 functional points: impose/revoke +
round-attribution, final-aggregate deduction with floor-at-zero, retain-across-drop
+ disqualification) · Testable (each recompute invariant, especially
penalty-survives-drop, is observable).

### Open questions / conflicts flagged (house rule 2)

- **Disqualification placement in the final classification** is not fixed by
  `00-general-rules.md` §6 (which allows penalties "up to disqualification" but
  does not prescribe where a DQ'd competitor lands). This story keeps DQ distinct
  from a point deduction but defers the exact classification placement to
  per-discipline detail, matching the CD user-story doc's flagged item 4. Flagged,
  no rule doc changed.

---

## Domain Concept Identification

This story is the mirror image of STORY-001-028: where 028 was "the second event
STORY-001-011 was built to receive," STORY-001-029 is "the record-and-wire layer
STORY-001-007 was built to receive." The **arithmetic** is done and unit-tested;
the **facts** it consumes (penalties, disqualifications) and the **service that
assembles per-competitor round series and calls the arithmetic** do not exist
yet. Everything genuinely new is a thin, well-shaped layer around a correct core.

### Existing Concepts (from codebase)

- **`computeFinalAggregate` / `AggregateInput` / `AggregateResult`**
  (`packages/shared/src/scoring.ts`): the pure final-aggregate function. Already
  models this story's three core invariants exactly — `penaltyTotal` is tracked
  **outside** `series` so a dropped round can never discard its penalty
  (AC3/AC5-of-007); `aggregate = Math.max(0, grossBeforePenalty - penaltyApplied)`
  floors at zero while `penaltyApplied` retains the full penalty (AC4); drop-worst
  removes exactly one lowest element per series only when `s.length >
  dropWorst.threshold`. `AggregateResult` even surfaces `penaltyApplied` and
  `droppedValues` as audit intermediates. **This story does not reimplement any of
  this — it feeds it.** Its only production caller is created here.
- **`deriveRoundScore(partials, basis)`** (`scoring.ts`): turns a competitor's
  normalised partial(s) into the per-round value that becomes one element of a
  `series`. `single-group` → one partial; `separate-per-task` (F3B) → sum of
  three. The bridge between per-group recompute and the aggregate input.
- **`DropWorstRule` + `ContestClassModel.dropWorst`** (`packages/shared/src/
  class-model.ts`): the `{ threshold, unit }` the aggregate reads. Stock values
  already transcribed from the rule docs — F5J 4, F3K 5, F5K 6, F5L 5, F3J 7 (all
  `unit: "round"`), F3B 5 (`unit: "task"`). This is the single source AC6's
  "class-driven, not discipline-branched" is satisfied by; the story consumes it
  and must not reintroduce a class branch. **(See Risk R1 — the story's prose
  restates two of these thresholds incorrectly.)**
- **`PenaltyType` on each `TaskParameterSet`** (`class-model.ts`): the class's
  rule-fixed catalogue of *available* deduction types (`code`, `label`,
  `defaultDeduction`) — e.g. F3J towline-not-cleared −100, F5J access-corridor
  −1000. **Important scope nuance:** these model the *task-integral / rule-defined*
  deductions (008's "available types"), which this story's Scope Out explicitly
  excludes. The **discretionary disciplinary penalty** this story imposes is a
  free-magnitude CD ruling, *not* a pick from this catalogue — they must not be
  conflated (see Risk R4).
- **`GroupScoreView` / `ScoringService.getGroupScore`** (`apps/base/src/scoring/
  service.ts`): the on-demand, never-stored per-group recompute (which-score-counts,
  lone-pilot dummy, F3B annulment). Produces the normalised per-pilot values that
  a final-classification assembler must fold into per-(competitor, round) series
  before penalties apply. The recompute path the story's "recompute immediately"
  language flows through.
- **The immutable event log, `EventStore`, projections, `Attribution`**
  (`packages/shared/src/attribution.ts`, `apps/base/src/eventstore/`): the
  supersede-on-repeat, replay-from-log substrate (D4). Every new penalty fact and
  its revoke obey the same discipline. `Attribution` already carries `authority`;
  the CD-attributed write precedent is `DrawService.accept` and (per 028) the
  first CD-attributed scoring writes.
- **`resolveFinalisation` + `FinalisationOutcome`** (`apps/base/src/competitions/
  service.ts`, `packages/shared/src/lifecycle.ts`): STORY-001-026's Lock resolves
  `OfficialResults` vs `NoContest` from `minimumForValidContest`. The final
  classification this story's penalties feed is the same result set Lock seals and
  reports render — the downstream consumer.
- **`ResultCapturedPayload` / `ScoringEventType`** (`packages/shared/src/
  events.ts`): the per-competition, `scope = competitionId` event idiom every new
  penalty event should follow.

### New Concepts Required

- **Disciplinary penalty (the fact).** A CD-imposed, free-magnitude point
  deduction attached to a **(competitor, round)** — cumulative across the contest,
  independent of that round's group normalisation. No such concept exists today;
  the `PenaltyType` catalogue is a *menu of task-integral deductions*, not a
  record of an imposed disciplinary ruling. Needs its own event
  (e.g. `penalty.imposed`) and a per-competition projection summing to a
  `penaltyTotal` per competitor.
- **Penalty revoke (the second fact).** A superseding event
  (e.g. `penalty.revoked`) that neutralises a specific imposed penalty, so the
  projection derives the *current* penalty total from the event stream (D4,
  never a mutated payload) — the same supersede-not-mutate discipline as
  `draw.accepted` / the 028 resolution events.
- **Disqualification outcome.** A per-competitor classification state distinct
  from any point deduction — "removed from classification," not "a very large
  penalty." `computeFinalAggregate` has **no** DQ concept, so DQ lives *above*
  the aggregate: a competitor-level flag the classification assembler honours by
  removing the competitor from the ranked results rather than computing a total.
  Likely its own event (impose/revoke symmetry, AC7-style) so a DQ is as
  attributable and reversible as a penalty.
- **Final-classification assembler (the wiring).** A service path that, per
  competitor, folds the recomputed round scores into the class-model-shaped
  `series`, supplies the `penaltyTotal`, calls `computeFinalAggregate`, applies
  the DQ removal, and orders the survivors winner-first. This is the missing
  production caller of the pure aggregate. Whether it is a fresh
  `ClassificationService`/route or an extension of the scoring/competition
  service is a REASONS-Canvas decision; conceptually it is the piece that turns
  per-group recompute + penalties into a rankable result.
- **Penalty attribution as a CD write.** Like 028, penalty impose/revoke are
  CD-attributed writes; the attribution plumbing (mirroring `draw.accept`) carries
  `authority` but stays "recorded, not enforced" (D1).

### Key Business Rules

- **A penalty is recorded against the round it occurred in, and is cumulative
  (AC1, general-rules §6, rule-doc penalty rows).** Governs the penalty fact's
  shape (carries `roundNumber`) and the summing projection.
- **Penalties deduct from the final *aggregate*, never from a group score (AC2,
  general-rules §5/§6).** Governs where in the pipeline the penalty is applied —
  after normalisation and after drop-worst, exactly where `computeFinalAggregate`
  applies `penaltyTotal`. A penalty must never perturb a normalised group score
  (which would corrupt every other pilot in that group).
- **A penalty survives the drop of its round (AC3, general-rules §5, and the
  per-class docs' explicit "penalties from a dropped round are retained").** The
  invariant the result's defensibility hangs on. Already guaranteed structurally
  by tracking `penaltyTotal` outside `series`; the story must not regress it by
  ever folding a penalty into a round element.
- **Floor at zero; penalties still stand (AC4, general-rules §6 "recorded as
  zero (penalties still stand)").** `Math.max(0, gross - penalty)` for the shown
  total; the full imposed penalty is retained on the record (`penaltyApplied`),
  not clamped.
- **Disqualification is removal from classification, not a deduction (AC5,
  general-rules §6 "up to disqualification").** Governs the DQ outcome as a
  distinct competitor state above the arithmetic. Exact placement of a DQ'd
  competitor is an **open question deferred to per-discipline detail** (the story
  and the CD user-story doc both flag this; no rule doc prescribes it).
- **Drop-worst threshold and penalty amounts are class properties, read from the
  model, never branched on discipline (AC6, CLAUDE.md law, NFR-1/NFR-2, D12).**
  Governs every read of a threshold — always `model.dropWorst`, already how the
  pure function is written.
- **Every impose and revoke is attributable under CD authority (AC7, D1/D4).**
  Each is its own log event carrying actor/origin/`authority`; state is derived
  on replay, never mutated.
- **Immediate, consistent recompute on any impose/revoke (AC7).** Because the
  aggregate is composed on demand from the event-derived penalty total (never a
  stored total, D4), a recompute after an impose/revoke is automatically current —
  the same "never a stored fact" discipline as `getGroupScore`.

---

## Strategic Approach

### Solution Direction

- **Record penalties as first-class, per-competition, supersede-friendly events,
  and derive the penalty total on read — never store a total.** Mirrors the whole
  codebase's D4 idiom (`scoring.resultCaptured`, `draw.accepted`): a
  `penalty.imposed` fact carrying `{ competitionId, rosterEntryId/pilotId,
  roundNumber, points, reason }` under CD attribution, and a `penalty.revoked`
  fact that supersedes a specific imposition. A per-competition projection folds
  these into a current `penaltyTotal` per competitor. This satisfies AC1
  (round-attributed, cumulative) and AC7 (attributable, revocable, replay-derived)
  directly.
- **Model disqualification as its own attributable, reversible competitor-level
  outcome, resolved *above* `computeFinalAggregate`.** A `penalty.disqualified`
  (+ a revoke/reinstate symmetry) fact flips a competitor to "removed from
  classification." The classification assembler drops DQ'd competitors from the
  ranked list rather than feeding them to the aggregate — honouring AC5's "not
  merely a large negative score." Placement of the DQ'd competitor in the listed
  order stays the deferred open question.
- **Build the missing final-classification assembler as the first production
  caller of `computeFinalAggregate`.** Per competitor: gather each round's
  recomputed normalised score (via the existing `getGroupScore` path /
  `deriveRoundScore`), shape them into the class-model `series` (`unit: "round"`
  for the man-on-man classes, `unit: "task"` for F3B), read `model.dropWorst`,
  pass the projection's `penaltyTotal`, call the pure function, then apply DQ
  removal and order winner-first. This is the piece that makes AC2/AC3/AC4/AC6
  observable end-to-end; the arithmetic underneath is already tested.
- **Data flow (mirrors the accept/cancel and capture idioms):** CD-attributed
  REST route → penalty service `impose` / `revoke` / `disqualify` → validate
  target (competitor seated, round exists, not Locked) → append the fact → project
  → the classification read path composes recompute + penalty total + DQ on
  demand. No RNG, no stored aggregate; recompute is always current (D4/D6, works
  offline).

### Key Design Decisions

- **Where the penalty total and the classification assembler live.** *Trade-off:*
  penalties are a *scoring* concern (they feed the aggregate) but are imposed by
  CD authority (like draw accept/cancel) and consumed by finalisation/reports.
  → **Recommendation:** a dedicated penalty/classification surface (its own
  service + projection + route) rather than bolting onto `ScoringService` (whose
  every route is Organiser/system-attributed today) or `CompetitionService`. Keeps
  the first CD-attributed penalty writes cleanly separated and gives the
  final-classification assembler a natural home. Settle the exact module boundary
  in REASONS Canvas.
- **Disqualification representation: a flag on the penalty fact vs. its own
  event.** → **Recommendation:** its own event with impose/revoke symmetry (not a
  "penalty of ∞"), because AC5 is explicit that DQ is *categorically* distinct
  from a point deduction and must not degrade into a large negative that the
  floor-at-zero rule would then mask. A distinct event also keeps DQ as
  attributable and reversible as AC7 expects of penalties.
- **Reuse the pure `computeFinalAggregate`, do not re-derive the maths.** →
  **Recommendation:** treat `scoring.ts`'s aggregate as settled (STORY-001-007)
  and invest this story's effort in the *facts and wiring*. The penalty-survives-
  drop and floor-at-zero invariants are already implemented and unit-tested there;
  re-expressing them would risk divergence. The story's own Scope Out says the
  drop-worst arithmetic and final aggregate maths belong to 007/016.
- **Immediate recompute = compose on demand, never cache a total.** →
  **Recommendation:** derive `penaltyTotal` from the projection at read time so an
  impose/revoke is reflected on the next classification read with no invalidation
  step — the same "never a stored fact" rule `getGroupScore` follows (D4). "Recompute
  immediately and consistently" (AC7) then falls out for free.

### Alternatives Considered

- **Storing a running `penaltyTotal` per competitor and mutating it on
  impose/revoke:** rejected — violates D4 (write-only log, state derived from
  events) and the codebase's supersede-not-mutate discipline; a revoke must be a
  new event, and the total a projection fold.
- **Modelling DQ as a very large point penalty:** rejected — AC5 explicitly
  forbids "merely a large negative score"; the floor-at-zero rule would also make
  two different DQ'd competitors indistinguishable (both zero), destroying the
  classification's meaning. DQ must be a distinct outcome above the arithmetic.
- **Reusing the `PenaltyType` catalogue on `TaskParameterSet` for the disciplinary
  penalty:** rejected — that catalogue is the *task-integral / rule-defined*
  deduction menu (STORY-001-008), which this story's Scope Out excludes. The
  disciplinary penalty is a free-magnitude discretionary CD ruling, not a menu
  pick; conflating them would leak scoring-of-the-flight into disciplinary
  authority.
- **Applying the penalty to a normalised group score instead of the aggregate:**
  rejected — AC2/general-rules §5 are explicit that the deduction is from the
  final aggregate; perturbing a group score would corrupt every other pilot's
  normalisation in that group (best-of-group = 1000 is a shared anchor).

---

## Risk & Gap Analysis

#### Requirement Ambiguities

- **R1 — The story's prose restates two class drop-worst thresholds
  incorrectly (contradicts the read-only rule docs; house rule 2).** The Background
  and AC6 assert *"F3K … beyond 6"* and *"F5K beyond 7"*. The authoritative rule
  docs say **F3K drops once "6 or more rounds are flown"** (`f3k.md` — i.e. *more
  than 5*, and the code's `dropWorst.threshold = 5` is correct) and **F5K once "7
  or more rounds are flown"** (`f5k.md` — *more than 6*, code `threshold = 6`
  correct). Under the story's own convention — established consistently by
  **F5J "beyond 4", F5L "beyond 5", F3J "beyond 7", F3B "beyond 5"**, all of which
  match `threshold = N` — "F3K beyond 6" and "F5K beyond 7" are the two odd ones
  out and should read **"F3K beyond 5"** and **"F5K beyond 6"** (the story author
  appears to have carried the rule docs' "N or more flown" phrasing straight into
  the "beyond N" slot for these two classes). **Recommended resolution:** correct
  the two illustrative numbers in the story text (and AC6's parenthetical to
  "F3K … drops beyond 5") to match `f3k.md`/`f5k.md` and the already-correct class
  model — **fix the requirement, never the rule doc (house rule 1)**. This does
  **not** affect the design (behaviour reads `model.dropWorst`, which is right),
  but it must be settled so a test author does not hard-code "F3K drops beyond 6"
  and write a test that contradicts the authoritative model. **Flagged for a human
  decision per house rule 2.**
- **What counts as the competitor's "round score" for the series** when a round
  has multiple tasks (F3B: `unit: "task"`) or a re-flight is involved is defined by
  STORY-001-007/011, but the assembler must consume it correctly. Low risk — the
  shapes exist (`deriveRoundScore`, `getGroupScore`), but the fold from
  per-group views to a per-competitor series is new integration surface.
- **"Disqualification … per the rule" (AC5)** — the rule (`general-rules §6`)
  permits DQ but does **not** prescribe classification placement. This is the
  story's own flagged open question, correctly deferred; it is *not* a blocker for
  building "DQ is a distinct, removed-from-classification outcome," only for the
  ordering nicety.

#### Edge Cases

- **A penalty on a round the competitor never flew / has no score.** The penalty
  still stands and still deducts (AC1 cumulative, AC4 floor-at-zero handles the
  arithmetic). The assembler must attribute a penalty by `roundNumber`
  independently of whether that round produced a score for the competitor.
- **Revoking one of several penalties in the same round.** The revoke must target
  a *specific* imposition (so two −100s in round 3, one revoked, leaves −100), not
  "the round's penalty" — argues for an id-bearing impose fact the revoke
  references.
- **A penalty imposed, its round then dropped, then a later round's score
  changes so a *different* round becomes the dropped-worst.** The penalty total is
  independent of which round drops, so recompute stays correct — but this is
  exactly the invariant to test (penalty retained regardless of *which* round the
  drop lands on).
- **DQ interacting with drop-worst / penalties.** A DQ'd competitor is removed
  before the aggregate, so their penalties/drops are moot; but revoking the DQ
  (reinstate) must restore their full penalty-and-drop-correct total — argues for
  DQ being reversible and layered above, not baked into, the aggregate.
- **Lock/terminal-state guard.** Penalties and DQ are mutations; a **Locked**
  competition must reject them (CD user-story 2.2: "no … penalty … can be applied
  while it is locked"). The impose/revoke/disqualify path must consult the
  lifecycle guard, consistent with STORY-001-024/026. Not called out in this
  story's ACs but required by the lifecycle contract.
- **Floor-at-zero vs. tie-breaks.** Two competitors both floored to zero are tied
  at zero; the class tie-break (best dropped score, etc.) is out of scope here but
  the assembler must not treat "zero" as "no result."

#### Technical Risks

- **`computeFinalAggregate` has zero production callers today.** The pure function
  and its tests exist, but nothing wires it into a service, route, or read model.
  This story must build that assembler *and* the penalty facts it consumes — a
  larger integration surface than "add a penalty layer" implies, though the
  arithmetic risk is nil (already tested). Sequencing note, not a contradiction.
- **First CD-attributed penalty writes.** Like STORY-001-028, penalty impose/revoke
  are CD-attributed; the attribution/route plumbing (mirror `draw.accept`) must be
  added while keeping D1 "recorded, not enforced." If 028 lands first, this reuses
  its CD-attribution seam.
- **DQ lives above the aggregate — a layering discipline to hold.** The temptation
  to encode DQ inside `AggregateInput` must be resisted (AC5); the classification
  assembler is the correct layer. Mis-layering would either mask DQ under
  floor-at-zero or force a class branch.
- **Additive-event replay discipline (NFR-2/D4).** New `penalty.*` event types
  must default cleanly on replay of older logs that predate them (default: no
  penalties / not DQ'd), the same additive-field pattern
  `DrawAcceptedPayload.acknowledgedWarningIds` and `CompetitionLockedPayload.outcome`
  already model. Each new rejection reason ("nothing to revoke", "already DQ'd",
  "competition locked") needs its `setErrorHandler`/domain-error wiring (Safeguard 8).
- **No other FAI-rule or cross-requirement contradiction found.** Beyond R1's
  transcription error, the story is consistent with `general-rules §5/§6`, the
  per-class "penalties retained through the drop" rows (f3k.md, f5j.md, etc.),
  high-level Area 5.9 (verbatim match on cumulative / deduct-from-aggregate /
  retained-through-drop / floor-at-zero / DQ-distinct / event-logged), the CD
  user-story §5.9 (all six ACs align), users.md §2, and D1/D4/D12. DQ placement
  is a documented, rule-permitted deferral, not a conflict. No duplication: no
  existing story imposes disciplinary penalties (008 defines *available* task
  deductions; 011/028 handle re-flights/annulment; 026 handles Lock outcome).

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Penalty recorded against its round, cumulative | Yes | New `penalty.imposed` fact carrying `roundNumber`; per-competition projection sums per competitor. No such fact exists today. |
| 2 | Penalties deduct from the final aggregate | Yes | `computeFinalAggregate` already subtracts `penaltyTotal` from post-drop gross. New work is the assembler that supplies the total — the function's first production caller. |
| 3 | Penalty survives the drop of its round | Yes (arithmetic built) | Guaranteed structurally: `penaltyTotal` is tracked outside `series`; test "AC5 penalty retained through drop" already passes. This story must not regress it (never fold a penalty into a round element). |
| 4 | Total below zero floors at zero, penalties stand | Yes (arithmetic built) | `Math.max(0, gross - penalty)` + retained `penaltyApplied`; test "AC8 negative floors at zero" already passes. |
| 5 | Disqualification distinct from a point deduction | Yes (new) | New DQ outcome resolved **above** the aggregate (competitor removed from classification), not a large penalty. Exact classification *placement* deferred (open question, rule-permitted). |
| 6 | Drop-worst threshold class-driven, not branched | Yes | Reads `model.dropWorst` (already correct in the stock models); no discipline branch. **But the story's illustrative F3K/F5K thresholds are wrong (R1)** — behaviour is unaffected, wording must be corrected. |
| 7 | Impose/revoke attributable, recompute immediately | Yes | Impose + revoke as CD-attributed, supersede-friendly events; penalty total derived on read so recompute is always current (D4). First CD-attributed penalty writes — plumbing to add. |

## Summary of Key Points for REASONS Canvas

1. **The arithmetic is done — build the facts and the wiring.**
   `computeFinalAggregate` already implements penalty-survives-drop and
   floor-at-zero (tested); it has **zero production callers**. This story adds the
   penalty/DQ *events*, their projection, and the **final-classification assembler**
   that is the function's first caller. Do not re-derive the maths (Scope Out /
   STORY-001-007).
2. **Penalty = a CD-attributed, per-(competitor, round), supersede-friendly event
   with a revoke twin; the total is derived on read, never stored** (D4) — so
   "recompute immediately" (AC7) falls out for free.
3. **Disqualification is a distinct outcome layered *above* the aggregate**
   (competitor removed from classification), with its own reversible event — never
   a large point penalty (AC5), never inside `AggregateInput`. Placement of the
   DQ'd competitor is a rule-permitted **deferred open question**.
4. **Do not conflate the disciplinary penalty with `TaskParameterSet.penaltyTypes`**
   — that menu is the task-integral/rule-defined deduction catalogue (008), which
   this story's Scope Out excludes. The disciplinary penalty is a free-magnitude
   CD ruling.
5. **First CD-attributed penalty writes; must respect the Locked terminal state**
   (no penalty/DQ on a Locked competition) — reuse the `draw.accept` CD-attribution
   seam and the lifecycle guard.
6. **One requirement defect to fix before/at design (house rule 2, blocking):**
   the story's prose says **"F3K … beyond 6"** and **"F5K beyond 7"**, but
   `f3k.md`/`f5k.md` (and the correct class model) mean **F3K beyond 5** (drops once
   6+ flown) and **F5K beyond 6** (drops once 7+ flown) — the four other classes
   match the story's "beyond N" convention. Correct the **requirement** text (not
   the rule doc); the design is unaffected because it reads `model.dropWorst`.
