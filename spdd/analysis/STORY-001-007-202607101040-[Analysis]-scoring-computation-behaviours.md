# SPDD Analysis: Scoring Computation Behaviours (narrowed post-D12)

> **Supersedes** `STORY-001-007-202607100959-[Analysis]-scoring-options-with-rule-guardrails.md`
> (pre-pivot). Under decision **D12** / STORY-001-016, scoring configuration and
> the deviation guardrail (AC1–AC4) are delivered by the Contest Class Model and
> are **out of this story's build scope**; they remain only as the behavioural
> spec the model must satisfy. This story now narrows to the discipline-agnostic
> **computation behaviours** (AC5–AC8).

## Original Business Requirement

> The story file below carries a post-D12 reshaping banner; the ACs are the
> original text, reinterpreted per that banner. AC1–AC4 are retained as the
> behavioural spec owned by STORY-001-016; **AC5–AC8 are this story's build
> scope.**

# [STORY-001-007] Scoring Options with Class-Rule Guardrails

> Source: `docs/user-stories/01-organiser.md` §3.6 · `docs/requirements/high-level-requirements.md` Area 3.6 · `docs/requirements/rules/00-general-rules.md` §3–§6
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

> **Reshaped by D12 / STORY-001-016.** Scoring configuration and the
> deviation guardrail (AC1–AC4) are **delivered by the Contest Class Model** —
> defaults are the stock model's values; a deviation is a named custom clone,
> not a per-field warning here. This story narrows to the **computation
> behaviours** that read a model and produce results: penalty retention
> through drop-worst (AC5) and the shared degenerate cases (AC6–AC8). AC1–AC4
> remain as the behavioural spec the model must satisfy, now owned by 016.
> Effort narrows accordingly (~2 days). A fresh `/spdd-analysis` supersedes the
> pre-pivot analysis file for this story.

### Background

Final results must compute correctly for the discipline without the Organiser
doing the maths. Within a group the best raw result is worth 1000 points and
others are scaled to it (inverted for speed tasks); F3B is the exception,
normalising its three tasks separately. Aggregates apply a class-specific
drop-worst rule, and penalties are deducted from the final aggregate and
retained even when their round is dropped. The class rules fix many of these
numbers, so the software's stance is: **the class rule is the default, and any
deviation requires explicit confirmation with a warning — never a silent
accept.** Deviations are surfaced in reports as deliberate departures from
the FAI rule.

### Business Value

- Provide the Organiser with correct-by-default scoring configuration for all
  six classes.
- Support deliberate club-level deviations without ever silently
  contravening a class rule.
- Enable trustworthy, defensible results the Contest Director can stand
  behind.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-004 (discipline selected), STORY-001-016
  (the Contest Class Model supplying scoring defaults and deviations).
- **Data assumptions**: class-rule numbers come from
  `docs/requirements/rules/` (authoritative, read-only): e.g. drop-worst
  thresholds — F5J more than 4 rounds, F5L more than 5, F3K from 6, F5K from
  7, F3J more than 7, F3B per task beyond 5 rounds; F5L scores 2 points per
  second where others score 1.
- **Integration points**: consumed by group/round/final score computation and
  by reports; the same guardrail pattern applies to rule-fixed values in
  per-task rules (STORY-001-008).
- **Business constraints**: house rule — no requirement may contravene the
  rule docs; deviations are scoped out of the rules, not into them.

### Scope In

- Configure group-score basis, rounding/precision and drop-worst, each
  defaulting from the discipline's class rule.
- The guardrail: any deviation from a rule-fixed value (drop-worst threshold,
  mandated landing table, points-per-second, rule-bounded landing-window
  durations) requires explicit confirmation with a warning.
- The three shared degenerate-case scoring behaviours (all-zero group, tied
  best, negative aggregate).

### Scope Out

- Per-task parameters and per-event rule constants (STORY-001-008).
- Live score capture and the computation pipeline's task-specific detail
  (per-discipline requirements).
- Penalty imposition — Contest Director authority (Area 5.9).

### Acceptance Criteria

#### AC1: Group-score basis defaults to the rule
**Given** a competition with discipline F5J
**When** the Organiser opens scoring options
**Then** the group-score basis defaults to best-raw-result = 1000 points with
others scaled proportionally, and speed tasks are marked as inverted (lower
is better).

#### AC2: F3B reflects separate per-task normalisation
**Given** a competition with discipline F3B
**When** the Organiser views scoring options
**Then** the model shows the three tasks (Duration, Distance, Speed)
normalising separately into partial scores, with the round score their sum —
not one group score.

#### AC3: Drop-worst defaults per class and deviation warns
**Given** an F5J competition
**When** the Organiser opens drop-worst
**Then** it defaults to "discard the lowest round score once more than 4
rounds are flown"; **and when** the Organiser changes the threshold to 2,
**then** the system warns this deviates from the FAI class rule and requires
explicit confirmation before accepting it, and the deviation is flagged for
surfacing in reports.

#### AC4: Every rule-fixed parameter uses the same guardrail
**Given** an F5L competition (class rule: 2 points per flight second, a
mandated landing table)
**When** the Organiser sets points-per-second to 1 or selects a landing table
different from the class's mandated one
**Then** each deviating value triggers the explicit-confirmation warning; a
value matching the class rule is accepted without ceremony.

#### AC5: Penalties are retained through drop-worst
**Given** a pilot with a 100-point penalty imposed in round 3, and drop-worst
discarding round 3 as their lowest
**When** the final aggregate computes
**Then** round 3's score is discarded but the 100-point penalty is still
deducted from the final aggregate.

#### AC6 (degenerate): All-zero group
**Given** a group in which every raw score is zero
**When** the group score computes
**Then** every pilot in the group scores 0 — no error and no division by
zero.

#### AC7 (degenerate): Tied best raw result
**Given** a group where two pilots tie for the best raw result
**When** the group score computes
**Then** both tied pilots score 1000 and the others scale to that shared best
(the same holds for a tied best time in an inverted speed task).

#### AC8 (degenerate): Negative aggregate floors at zero
**Given** penalties totalling 900 points against a pilot whose aggregate
before penalties is 750
**When** the final results compute
**Then** the pilot's aggregate is recorded as 0 and the penalties remain
recorded in full.

### INVEST Check

Independent (configuration + computation rules, no capture dependency) ·
Valuable (correct results without maths) · Small-ish (4 days, 3 functional
points: rule-default configuration, deviation guardrail, aggregate
computation behaviours) · Testable — the degenerate ACs are deliberate shared
test cases to carry into every per-discipline scoring spec.

## Domain Concept Identification

The narrowed story is a **pure-computation** slice living in
`packages/shared` (a Zod-schema + domain-type + event-payload library with no
runtime dependency beyond `zod`, built by `tsc`). Everything to date in
`packages/shared` is data-shape and validation; there is **no computation
module and no test suite there yet** — this story introduces the first of
both. The service tier (`apps/base`) is event-sourced (append → project); the
computation functions here are stateless and are *called by* a future scoring
service/projection, not wired into events themselves. The class model
(scoring basis, drop-worst rule, points-per-second, owned landing table) is an
**injected input** produced by STORY-001-016 — this story consumes its shape,
it does not build or default it.

### Existing Concepts (from codebase)

- **Discipline** (`packages/shared/src/competition.ts`): still the key that
  selects a class model; under D12 the model, not this enum, carries the
  numbers the computation reads.
- **Contest Class Model** (`packages/shared/src/class-model.ts`, **shipped by
  STORY-001-016**): the injected, read-only input. Its concrete shape —
  `basis: "single-group" | "separate-per-task"`, `speedInverted`,
  `dropWorst: { threshold, unit: "round" | "task" }`, `landingTable`, and
  `pointsPerSecond: number | null` — is now the stable contract 007 reads.
  007 consumes `basis`, `speedInverted` and `dropWorst`; **`pointsPerSecond`
  is *not* consumed by 007** — it builds the *raw* flight score upstream
  (per-task assembly, STORY-001-008), which 007's normaliser takes as input.
  The model carries **no normalised-score rounding field** (see the rounding
  decision below).
- **Score-binding rule / pilot-keyed aggregation**
  (`apps/base/src/roster/state-providers.ts`): a pinned domain rule — every
  captured score records the occupant's `pilotId` at capture time, and
  **results aggregate per pilot**, never per seat. This fixes the aggregate
  function's grouping key.
- **Immutable event log + projections** (`apps/base`): the computation is
  derived state (D4) — reproducible from raw scores + penalties + the class
  model, never a stored mutation. Consistent with the existing
  "projections are safe to discard and rebuild" convention.
- **Penalty** (general rules §6; Area 5.9 imposes them, out of scope here):
  a per-round, cumulative deduction from the *final* aggregate — an input to
  the aggregate function, not computed here.
- **Vitest test convention** (`apps/base/test/*.test.ts`): the repo's test
  style; this story extends it to `packages/shared` with the degenerate ACs
  as the canonical cases.

### New Concepts Required

- **Group normalisation function**: raw group results → normalised scores
  (best = 1000, others scaled; inverted ratio for speed tasks). Pure;
  parameterised by the class model's basis. Governs AC6, AC7.
- **Round score derivation**: for man-on-man classes the round score = the
  normalised group score; for F3B the round score = sum of three
  separately-normalised per-task partials. Governs AC2's computational half.
- **Final aggregate function**: sum of round scores, apply drop-worst
  (threshold + unit from the model), then deduct retained penalties, then
  floor at zero. Governs AC5, AC8.
- **Drop-worst application**: discards the lowest counting unit (round, or
  per-task for F3B) once the class threshold is exceeded, while **penalties
  from a dropped round survive**. Governs AC5.
- **Degenerate-case contract**: all-zero group → all zero (no divide-by-zero);
  tied best → all tied at 1000; negative aggregate → 0 with penalties intact.
  The shared test cases (AC6–AC8) other per-discipline specs reuse.

### Key Business Rules

- **Best raw = 1000, others scaled; inverted for speed** — group normalisation.
- **F3B normalises three tasks separately, round = sum of partials** — round
  derivation; F3B drop-worst unit is per task.
- **Drop-worst discards the lowest unit past the class threshold** — aggregate.
- **Penalties are deducted from the final aggregate and retained even when
  their round is dropped** (AC5) — aggregate.
- **Negative aggregate floors at zero; penalties remain recorded in full**
  (AC8) — aggregate.
- **All-zero group scores all zero with no division by zero** (AC6);
  **tied best all score 1000** (AC7), symmetric for inverted speed tasks.
- **Results aggregate per pilot** (score-binding rule), not per seat.
- **All numbers are read from the class model** (D12) — no per-class branching
  in the computation code (NFR-1: nothing outside the model hard-codes
  per-class behaviour).

## Strategic Approach

### Solution Direction

- **Pure functions in `packages/shared`**, no I/O, no event coupling: a group
  normaliser, a round-score deriver, and a final-aggregate function, each
  taking raw inputs plus the relevant slice of the class model and returning
  computed scores. Data flow: *raw group results + class-model basis → group
  normaliser → round scores → (round scores + penalties + drop-worst rule) →
  final aggregate*. The eventual scoring service/projection in `apps/base`
  calls these; this story delivers the functions and their tests.
- **Model-driven, not discipline-branched**: the functions read basis /
  drop-worst / points-per-second off the injected model, so F5J vs F5L vs F3B
  differ by *data*, not by `switch(discipline)` — the NFR-1 acceptance test.
- **Degenerate ACs as a shared, reusable test suite** in `packages/shared`
  (the repo's first), authored to be imported/echoed by every per-discipline
  scoring spec, exactly as the story's INVEST note intends.

### Key Design Decisions

- **Where the functions live — `packages/shared` vs `apps/base`**: shared has
  no runtime deps and is imported by both base and companion; putting pure
  scoring maths there makes it reusable and trivially unit-testable. →
  **Recommend `packages/shared`**; reserve `apps/base` for the
  event-sourced service that *calls* them.
- **Function granularity — one monolith vs three composable functions**
  (group-normalise, round-derive, final-aggregate): three small pure functions
  compose cleanly, isolate the F3B round-derivation difference, and let AC6/AC7
  test the normaliser directly and AC5/AC8 test the aggregate directly. →
  **Recommend three composable functions.**
- **Model contract coupling — now resolved**: STORY-001-016 shipped the
  concrete `ContestClassModel`. 007's functions consume it structurally
  (`basis`, `speedInverted`, `dropWorst`); no separate contract needs
  inventing. `pointsPerSecond` stays out of 007 (upstream raw-score assembly).
- **Rounding/precision placement — DECISION (carried into the canvas as a
  noted constraint)**: general rules §3 says normalised-score rounding differs
  by class, but the shipped model carries **no rounding field**. Rather than
  reopen 016 to add one the six MVP classes barely differ on, **007 rounds to
  whole points as the shared default and accepts an *optional* caller-supplied
  precision**; any genuine per-class rounding refinement is deferred to the
  per-discipline stories (and, if ever needed, added to the model additively
  per NFR-2). Rule-boundary tests pin the default contract.
- **Number representation**: ratio scaling risks float drift at boundaries. →
  **Recommend explicit rounding at defined points + boundary tests**; decide
  integer-cents-style vs rounded-float in REASONS Canvas.

### Alternatives Considered

- **Build the computation inside a base-side scoring service now**: rejected —
  couples pure maths to the event/projection tier and to capture (explicitly
  out of scope), and blocks reuse by companion/report code.
- **Keep per-discipline branches in the computation**: rejected — violates
  NFR-1/D12 (only the class model may encode per-class behaviour).
- **Defer the degenerate cases to per-discipline stories**: rejected — the
  story deliberately makes them shared cases so every discipline inherits the
  same guaranteed behaviour.

## Risk & Gap Analysis

### Requirement Ambiguities

- **Class-model input contract — RESOLVED**: STORY-001-016 shipped
  `ContestClassModel` (`basis`, `speedInverted`, `pointsPerSecond | null`,
  `dropWorst { threshold, unit }`, `landingTable | null`). 007 consumes
  `basis` / `speedInverted` / `dropWorst`; `pointsPerSecond` is upstream
  (008). No churn risk remains. The one residual gap — normalised-score
  rounding is not modelled — is settled by the rounding decision above.
- **F3B computational depth vs STORY-001-008**: AC2's model-display half is
  016's; the *computational* half (three separate normalisations summed) is
  007's, but the per-task raw-score assembly is 008's. The boundary — 007
  normalises given three raw task results; 008 supplies how each raw result is
  built — should be stated explicitly.
- **"Rounding/precision"**: the exact per-class rounding is in the per-class
  rule docs and not enumerated in the story; the function must take it from
  the model rather than assume whole points.

### Edge Cases

- **Inverted (speed) degenerate cases**: all-zero and tied-best must be
  handled for the inverted ratio too (zero/absent winner time must not divide
  by zero) — AC6/AC7 name the inverted variant explicitly.
- **Penalty in a dropped round that also drives the aggregate negative**
  (AC5 + AC8 combined): the penalty must both survive the drop and floor the
  result at zero.
- **Fewer rounds than the drop-worst threshold**: no round is dropped (e.g.
  F5J with exactly 4 rounds keeps all four) — the threshold is
  *more-than-N*, an off-by-one boundary worth a test.
- **All rounds equal / multiple lowest rounds**: which single unit drops when
  several tie for lowest must be defined (drop exactly one).
- **F3B per-task drop unit**: drop-worst discards the lowest *per-task
  partial* beyond 5 rounds, not a whole round — different unit from the
  man-on-man classes.
- **Pilot with missing/zero rounds**: aggregation is per pilot across the
  rounds they have; interaction with the D10 "advance anyway → zero" path is
  an input, not computed here, but the function must handle a zero round
  cleanly.

### Technical Risks

- **Floating-point drift** in ratio scaling and per-class rounding at rule
  boundaries: mitigation — explicit rounding at defined boundaries plus
  boundary-value tests.
- **Contract drift with STORY-001-016 — closed**: 016's `ContestClassModel` is
  shipped and stable; 007 consumes it directly. Residual coupling is only the
  unmodelled rounding precision, settled by the rounding decision.
- **First test suite in `packages/shared`**: no precedent there (tests live in
  `apps/base/test`); mitigation — follow the existing vitest style, colocate a
  `*.test.ts` the root `vitest run` already globs.
- **Reuse discipline**: the degenerate suite must be structured so
  per-discipline specs genuinely reuse it rather than re-implement — a shared
  exported fixture/case set, not copy-paste.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Group-score basis defaults (best=1000, inverted speed) | Spec-only | **Build owned by STORY-001-016.** 007 consumes the basis as a model input; retained here as behavioural spec. |
| 2 | F3B separate per-task normalisation, round = sum | Partial | Model-display half is 016; the *computational* sum-of-partials is 007's; per-task raw assembly is 008's. Boundary to state. |
| 3 | Drop-worst default per class + deviation warns | Spec-only | **Defaulting/warning owned by 016.** 007 consumes the resulting threshold + unit to apply the drop. |
| 4 | Every rule-fixed parameter uses the guardrail | Spec-only | **Owned by 016** (clone-and-edit). points-per-second/landing table are model inputs to 007's maths. |
| 5 | Penalties retained through drop-worst | Yes | Core 007 aggregate function; pair with AC8 for the negative-and-dropped case. |
| 6 | All-zero group → all zero, no div-by-zero | Yes | Group normaliser; include the inverted variant. |
| 7 | Tied best → all 1000, others scale to shared best | Yes | Group normaliser; include the tied-best-time inverted variant. |
| 8 | Negative aggregate floors at 0, penalties recorded | Yes | Aggregate function zero-floor; penalties remain in the audit record. |
