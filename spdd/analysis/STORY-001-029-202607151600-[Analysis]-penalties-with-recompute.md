# SPDD Analysis: STORY-001-029 — Impose Penalties with Correct Recompute

> Analysis produced after the drop-worst threshold prose in the story was
> corrected (F3K → "beyond 5", F5K → "beyond 6") to match the FAI rule docs.
> House-keeping verification of that correction is recorded under Risk & Gap
> Analysis → FAI-rule conformance.

## Original Business Requirement

_Verbatim from `requirements/[User-story-29]penalties-with-recompute.md`._

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
beyond 5, F5K beyond 6, F5L beyond 5, F3J beyond 7, and F3B discards the lowest
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
(drops beyond 5) and an F5L contest (drops beyond 5)
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

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Contest Class Model** (`packages/shared/src/class-model.ts`,
  `ContestClassModel`): the single authoritative definition of a class's scoring
  shape. Already carries `dropWorst: { threshold, unit }` (`DropWorstRule`). The
  six stock models already encode the exact thresholds the corrected story cites
  — F3J `{7, round}`, F3K `{5, round}`, F5J `{4, round}`, F5K `{6, round}`, F5L
  `{5, round}`, F3B `{5, task}`. This story reads that threshold; it does not add
  a penalty-amount field to the model (class-specific *task* deduction types
  already exist as `PenaltyType` on each `TaskParameterSet`, but those are the
  Scorer-line/derived deductions, not this story's discretionary penalty).
- **Final-aggregate computation** (`packages/shared/src/scoring.ts`,
  `computeFinalAggregate` / `AggregateInput` / `AggregateResult`): a pure,
  discipline-agnostic function that **already implements every arithmetic
  invariant this story asserts** — `penaltyTotal` is tracked *outside* the
  `series`, drop-worst removes exactly one lowest element per series only when
  `length > threshold`, and the aggregate is `max(0, gross − penalty)` with the
  full `penaltyApplied` retained even when it exceeds the gross. Its own comments
  cite the retain-across-drop and floor-at-zero rules. This story's arithmetic is
  therefore largely a matter of *feeding* this function correctly, not writing new
  maths.
- **Round-score derivation & normalisation** (`normaliseGroup`,
  `deriveRoundScore`, `CapturedFlightResult`, `selectOfficialResult`): produce the
  per-round normalised scores that become the `series` input. Penalties never
  touch these — the story's "not from a single normalised group score" rule is
  structurally guaranteed by keeping penalties outside the series.
- **Immutable event log** (`packages/shared/src/events.ts`): the append-only
  mutation record backing every aggregate (D4). Today it defines capture and
  class-model events but **no penalty or disqualification event** — that is the
  new write surface.
- **Scoring service / projection** (`apps/base/src/scoring/service.ts`,
  `projection.ts`): the base-side aggregate that replays capture events into group
  score views. `computeFinalAggregate` is **not yet wired here** (it is presently
  exercised only by `scoring.test.ts`); there is no per-pilot final-classification
  projection assembling round-score series across rounds and producing an ordered
  result. That connective layer is where this story lands.

### New Concepts Required

- **Disciplinary Penalty**: a (competitor, round, magnitude, actor, reason,
  timestamp) fact imposed by the Contest Director, cumulative across the contest,
  independent of that round's normalisation. Relates to the existing competitor /
  round identity and is summed into the `penaltyTotal` scalar that
  `computeFinalAggregate` already consumes. Represented as immutable event(s) in
  the log (D4), not a mutable stored total.
- **Penalty revocation**: an event that withdraws a previously-imposed penalty so
  the recomputed `penaltyTotal` drops it. Attributable like the imposition.
- **Disqualification outcome**: a distinct competitor-level classification state
  (removed from ranking) — **not** a penalty magnitude. Relates to the final
  classification as a filter/flag, orthogonal to the point-deduction path.
- **Final classification (per-pilot) projection**: assembles each competitor's
  round-score series + summed penaltyTotal, invokes `computeFinalAggregate`, and
  produces the ordered result with DQ competitors handled distinctly. This is the
  consumer Lock/finalisation (STORY-001-026) triggers.

### Key Business Rules

- **Round attribution & cumulativeness** (AC1): a penalty binds to (competitor,
  round) and multiple penalties sum — governs Disciplinary Penalty.
- **Deduct from aggregate, never from a group score** (AC2): penalties live
  outside `series` — governs the Final classification projection / `AggregateInput`.
- **Retain across drop** (AC3, AC6): dropping a round's *score* never drops its
  *penalty* — structurally guaranteed by penaltyTotal-outside-series; governs the
  projection's series/penalty split.
- **Floor at zero, penalties still stand** (AC4): aggregate `max(0, …)` while the
  full penalty is recorded — governs `AggregateResult` interpretation and the
  record/report.
- **DQ is distinct from deduction** (AC5): removal from classification, not a
  negative score — governs the Disqualification outcome and ordering.
- **Class-driven, discipline-agnostic** (AC6): drop-worst threshold read from the
  model; identical retain behaviour for all classes — governs the projection
  (no `switch (discipline)`).
- **Attributable, immediate, consistent recompute** (AC7): every impose/revoke is
  an event carrying actor + CD authority (D1/D4) and recompute is deterministic
  replay — governs the event types and the projection.

## Strategic Approach

### Solution Direction

Add a thin **disciplinary-penalty write layer** (impose / revoke as immutable
events carrying competitor, round, magnitude, actor, CD-authority marker, reason)
plus a **final-classification read projection** that assembles each competitor's
round-score `series` and summed `penaltyTotal` and delegates to the already-built
`computeFinalAggregate`. The data flow mirrors the existing scoring aggregate:
append event → replay/project → derive current result (never a stored total, D4).
Disqualification is a **separate competitor-outcome event/flag** the projection
reads to remove the competitor from ranking, kept orthogonal to the deduction
path. Because `computeFinalAggregate` already tracks penalties outside the series,
floors at zero, and reads drop-worst generically, the arithmetic invariants
(AC2–AC4, AC6) fall out of correct wiring rather than new computation; the new
work is the write surface (AC1, AC7), the DQ outcome (AC5), and the
series-assembly projection that connects captures + penalties + the class model's
`dropWorst` into a per-pilot ordered result.

### Key Design Decisions

- **Penalty as event vs. stored total**: → record impose/revoke as immutable
  events and derive `penaltyTotal` on read (D4, and consistent with how group
  scores are already projected). Trade-off: recompute cost on every read vs.
  auditability and replay-correctness; the ≤20-pilot / ≤8-round scale (CLAUDE.md)
  makes recompute cost negligible, so auditability wins.
- **DQ as distinct outcome vs. large deduction**: → model DQ as a separate
  competitor-classification state the projection filters on, **not** as a penalty
  magnitude (AC5 is explicit). Trade-off: a second outcome path to maintain vs.
  correctly expressing "removed from classification"; the rule (§6) and AC5
  require the distinction, so a large negative deduction is rejected.
- **Where the series-assembly / final-classification projection lives**: → new
  read projection in the base scoring layer that reuses `computeFinalAggregate`,
  keeping the pure maths in `packages/shared`. Trade-off: some overlap with
  STORY-001-026's "trigger the final aggregate" responsibility; boundary is that
  026 *triggers/consumes* and gates on lifecycle, 029 *defines penalty behaviour
  over* the computation and 007 owns the maths — verify the seam during REASONS
  Canvas so the projection is built once and shared.
- **penaltyTotal is a scalar into the aggregate, per-round attribution lives in
  the event/record**: → the class-agnostic aggregate only needs the sum, while
  AC1's "recorded against its round" and reporting live in the event stream. This
  keeps `AggregateInput` unchanged and the core free of round-level penalty
  bookkeeping.

### Alternatives Considered

- **Store a running penalty total on the competitor**: rejected — contradicts D4
  (immutable event log as the source of truth) and would desync from revocations.
- **Model DQ as a −∞ / very-large penalty**: rejected — AC5 explicitly forbids
  "merely a large negative score"; DQ must be removal from classification.
- **Deduct the penalty from the offending round's normalised score before
  drop-worst**: rejected — violates AC2/AC3 (deduction is from the final
  aggregate; a deducted round could then be dropped, escaping the penalty), the
  exact defect the story exists to prevent.

## Risk & Gap Analysis

### FAI-rule conformance (house rule 1) — verification of the corrected prose

The corrected drop-worst thresholds were checked field-by-field against
`docs/requirements/rules/` and the seeded stock models. All six match, and none
contravene the rule docs:

| Class | Story prose (corrected) | Rule doc | Stock model `dropWorst` |
|-------|-------------------------|----------|-------------------------|
| F5J | beyond 4 | f5-general "beyond 4 rounds"; f5j.md | `{4, round}` |
| F3K | **beyond 5** | f3k.md "if 6 or more rounds… lowest dropped" / "drop-worst from 6 rounds" = beyond 5 | `{5, round}` |
| F5K | **beyond 6** | f5k.md "if 7 or more rounds… lowest dropped" / "drop-worst from 7 rounds" = beyond 6 | `{6, round}` |
| F5L | beyond 5 | f5l.md "beyond 5 rounds" | `{5, round}` |
| F3J | beyond 7 | f3j.md "beyond 7 qualification rounds" | `{7, round}` |
| F3B | lowest partial per task beyond 5 | f3-general/f3b.md "lowest partial per task beyond 5 rounds" | `{5, task}` |

"from N rounds" / "N or more rounds flown" in the rule docs is equivalent to
"beyond N−1", which is exactly how `computeFinalAggregate` applies it
(`series.length > threshold`). The correction brings the prose into line with both
the rule docs and the already-seeded models. **No FAI-rule contradiction.** AC6's
worked pairing (F3K "drops beyond 5", F5L "drops beyond 5") is internally
consistent and correct.

### Cross-reference against existing requirements (house rule 2)

- **high-level-requirements Area 5.9** states the same behaviour (CD imposes point
  penalties up to disqualification against pilot+round, cumulative, deducted from
  the final aggregate not a group score, retained across a dropped round, floor at
  zero, every impose/revoke logged). **Consistent — no contradiction, no
  duplication beyond intended traceability.**
- **general-rules §5/§6** (final classification; penalties per round, cumulative,
  subtracted from final, negative→zero, retained across dropped round, up to
  disqualification): the story conforms exactly.
- **STORY-001-026 (Lock & Finalisation)** *triggers/consumes* the final aggregate
  and reads drop-worst; STORY-001-007 owns the maths; **029 defines penalty
  behaviour over** that computation. Responsibilities are complementary, not
  duplicated — the only overlap risk is *where* the per-pilot final-classification
  projection is built (see technical risks); flag for the REASONS Canvas seam, not
  a requirements conflict.
- **STORY-001-008 `PenaltyType` (task deduction catalogue)** is a *different*
  concept from this story's discretionary penalty (the story's Scope Out is
  explicit). No duplication — 029 must not reuse the task `PenaltyType` slots for
  disciplinary penalties.

No unresolved contradiction or duplication found.

### Requirement Ambiguities

- **Revocation granularity**: AC7 revokes "a penalty" — presumably a specific
  prior imposition (by identity), not "all penalties for a round". The event model
  should target a specific penalty; reasonable default, not blocking.
- **DQ scope / reversibility**: whether a DQ can itself be revoked (mis-ruling) is
  not stated. By parity with impose/revoke and the immutable-log model, treating
  DQ as a reversible outcome event is the natural default; note for REASONS Canvas,
  not blocking.
- **"Immediately recompute"**: means the derived result reflects the new event on
  next read/replay (D4), not a push/notification guarantee — consistent with the
  existing projection model.

### Edge Cases

- **Penalty in a round that is *not* dropped**: ordinary deduction — the
  retain-across-drop path and the normal path must agree (both just sum into
  `penaltyTotal`). Already handled by the pure function.
- **Fewer rounds than the drop-worst threshold** (e.g. F5J with ≤4 rounds): no
  drop occurs; penalty still deducted. `computeFinalAggregate` handles this
  (`length > threshold` false → sum all).
- **Multiple penalties in one round, and penalties in already-dropped and
  surviving rounds**: all sum; none escape (the defensibility invariant). Worth an
  explicit test.
- **Revoke then re-impose; revoke a non-existent/already-revoked penalty**:
  idempotency / ordering of the event replay must be defined.
- **DQ competitor with penalties and with a floored-zero total**: DQ removes from
  ranking regardless of the numeric total — the two outcomes must not interact.
- **F3B (`unit: "task"`) penalty**: a disciplinary penalty is deducted from the
  final *aggregate* (sum across tasks), not from a per-task partial — confirm the
  projection sums F3B's per-task series into one aggregate before applying
  penaltyTotal (the pure function already sums all series into `grossBeforePenalty`
  before subtracting the single penaltyTotal, so this holds).

### Technical Risks

- **`computeFinalAggregate` is not yet wired into the base** (only unit-tested).
  There is no per-pilot final-classification projection that assembles round-score
  series across rounds. This story must build that connective layer (or share it
  with STORY-001-026). Impact: the bulk of the 4-day effort is this assembly + the
  penalty/DQ write path, not the arithmetic. Mitigation: reuse the pure function;
  coordinate the projection ownership with 026 in the REASONS Canvas.
- **No penalty/DQ event types exist** in `events.ts` — greenfield write surface.
  Mitigation: follow the existing capture-event idiom (append-only, actor-stamped).
- **Actor / CD-authority recording** (D1): authority is recorded, not enforced, so
  the event payload must carry the acting person + CD-authority marker without a
  permission gate. Low risk; mirrors other 001 stories.
- **Determinism of recompute**: derived-on-read totals must be stable across
  replays (no reliance on event arrival order beyond impose-before-revoke). Define
  the reduction explicitly.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Penalty recorded against its round, cumulative | Yes | New impose event with (competitor, round, magnitude); sum on read. |
| AC2 | Penalties deduct from final aggregate (5,200 − 150 = 5,050) | Yes | Feed summed penaltyTotal to `computeFinalAggregate`; already floors/subtracts correctly. |
| AC3 | Penalty survives drop of its round (F5J beyond 4) | Yes | Structurally guaranteed — penaltyTotal is outside `series`. Add explicit test. |
| AC4 | Total below zero floors at zero, penalties still stand | Yes | `computeFinalAggregate` returns `max(0,…)` with full `penaltyApplied`. |
| AC5 | DQ distinct from a point deduction | Partial | Distinct-outcome modelling is addressable now (separate DQ state); exact **placement** in classification order is deferred to per-discipline detail by design (flagged, house rule 2) — not a blocker. |
| AC6 | Drop-worst class-driven, no discipline branch (F3K/F5L both beyond 5) | Yes | Threshold read from model `dropWorst`; pure function already discipline-agnostic; thresholds verified against rule docs. |
| AC7 | Impose & revoke attributable, immediate recompute | Yes | New impose + revoke events carry actor + CD-authority (D1/D4); recompute is replay. |

**Overall**: all 7 ACs are addressable. AC5 is "Partial" only because DQ ordering
placement is deliberately deferred (per-discipline, flagged) — the story's own
scope. No AC requires a human decision before design; no FAI-rule contradiction;
no unresolved contradiction or duplication against existing requirements.
