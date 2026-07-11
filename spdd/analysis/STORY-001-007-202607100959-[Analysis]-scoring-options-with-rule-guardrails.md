> **⚠ SUPERSEDED (pre-pivot).** Written before decision D12 / STORY-001-016.
> Its config + deviation-guardrail direction (AC1–AC4) moved to the Contest
> Class Model. Use `STORY-001-007-202607101040-[Analysis]-scoring-computation-behaviours.md`
> for the narrowed computation-only scope.

# SPDD Analysis: Scoring Options with Class-Rule Guardrails

## Original Business Requirement

# [STORY-001-007] Scoring Options with Class-Rule Guardrails

> Source: `docs/user-stories/01-organiser.md` §3.6 · `docs/requirements/high-level-requirements.md` Area 3.6 · `docs/requirements/rules/00-general-rules.md` §3–§6
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

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

- **Prerequisites**: STORY-001-004 (discipline selected).
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

The codebase is a TypeScript monorepo: `packages/shared` (Zod schemas +
domain types + event payloads), `apps/base` (event-sourced Fastify-style
service — `EventStore` + per-aggregate `service` / `projection` / `errors`),
`apps/companion` (React operator client). Every aggregate follows the same
shape: a shared Zod request schema, a service that validates and appends an
event, and a projection that folds events into derived state. Configuration
already flows through `competitionConfigurationFields`
(`packages/shared/src/competition.ts`) which is composed into both the
competition and the contest-template schemas and carried verbatim on the
`competition.created` / `competition.updated` and `contestTemplate.*` event
payloads. That fields comment already names this story: *"Any field added
here must be added to the template snapshot and seed mapping in the same
change (STORY-001-007/008/009 obligation)."*

### Existing Concepts (from codebase)

- **Competition** (`packages/shared/src/competition.ts`): the configured
  event; owns `discipline` and the entry-option toggles — scoring options
  become new fields on this same configuration surface.
- **Discipline** (`DISCIPLINES` enum, six FAI classes): the *key into* the
  rule corpus (house rule 1 — a key, never a copy of a rule number). It is
  the sole input that selects every scoring default in this story.
- **`competitionConfigurationFields`**: the shared, template-mirrored
  configuration fragment. This is the natural home for a scoring-options
  block and the pre-wired obligation point for this story.
- **ContestTemplate** (`packages/shared/src/contest-template.ts`): a
  copy-on-seed configuration snapshot that mirrors the configuration fields;
  any scoring field added must appear in its snapshot and seed mapping.
- **LandingBonusTable / LandingBonusEntry** (`packages/shared/src/landing-table.ts`):
  master-data tables. Their comment explicitly defers *"ordering /
  monotonicity / rule-conformance … to STORY-001-007"* — this story owns the
  rule-conformance verdict on landing tables and the "mandated table"
  deviation check of AC4.
- **`CapturedScoresProvider` / `LockStateProvider`** (`apps/base/src/competitions/state-providers.ts`):
  injected seams the discipline-change guard already consults; the scoring
  story is named as the future supplier of the real captured-scores provider.
- **EventStore + projections + `Attribution`**: the immutable audit log (D4);
  scoring configuration and any recorded deviation must ride events so a
  later report can read them.
- **`ValidationError` + confirm-flag guards** (`CompetitionService.delete`'s
  `confirmDestroysResults`, the discipline-change guard): the established
  pattern for "reject unless explicitly acknowledged" — the deviation
  guardrail is the same shape.

### New Concepts Required

- **ScoringOptions** (per-competition): the configured group-score basis,
  rounding/precision, and drop-worst rule. Relates to Competition as another
  configuration block on the same aggregate; mirrored by ContestTemplate.
- **Class-rule defaults registry** (code, keyed by Discipline): the derived,
  in-code representation of the rule-doc numbers (drop-worst threshold + unit,
  points-per-second, group-score basis, per-class precision, mandated landing
  table identity). It is a *derivation keyed by discipline*, never an edit to
  the read-only rule docs (house rule 1). Single source of truth for both the
  default and the deviation comparison.
- **Group-score basis** (model): best-raw = 1000, others scaled; inverted for
  speed tasks; the **F3B variant** — three tasks normalised separately, round
  = sum of partials (AC2).
- **Drop-worst rule** (model): threshold + unit (round vs task for F3B),
  defaulted per class.
- **Points-per-second** (model): F5L = 2, others = 1 (AC4).
- **RuleDeviation** (record): an Organiser-acknowledged departure from a
  rule-fixed value, carrying the rule-expected value and the chosen value so
  reports can surface it as a deliberate departure. Persisted on the config
  event(s) in the audit log.
- **Aggregate/group computation behaviours** (pure functions): group
  normalisation (with all-zero and tied-best handling) and final aggregate
  (drop-worst + penalty retention + zero floor). The degenerate ACs (6/7/8)
  are shared test cases these functions must satisfy.

### Key Business Rules

- **Rule-is-default, deviation-must-be-confirmed**: any value differing from
  the class-rule default is rejected unless an explicit acknowledgment
  accompanies it; a matching value passes without ceremony (AC3, AC4). Governs
  ScoringOptions and the class-rule defaults registry.
- **Deviations are recorded for reports**: an accepted deviation is flagged
  and persisted so reports can present it as a deliberate departure (AC3).
- **Penalty retention through drop-worst**: the dropped round's score is
  discarded but its penalty is still deducted from the final aggregate (AC5).
- **Negative aggregate floors at zero, penalties still recorded** (AC8;
  general rules §6). Governs final aggregate computation.
- **All-zero group → all zero, no division by zero** (AC6). Governs group
  normalisation.
- **Tied best → all tied score 1000, others scale to the shared best** (AC7),
  symmetric for inverted speed tasks.
- **F3B exception**: three tasks normalised separately, round = sum of
  partials, discard is per-task (AC2). Governs the group-score basis model.
- **House rule 1**: rule numbers are keyed from `docs/requirements/rules/`,
  never copied in; the rule docs stay read-only.

## Strategic Approach

### Solution Direction

- **Extend the existing configuration surface, don't invent a parallel one.**
  Add a scoring-options block to `competitionConfigurationFields` so it
  automatically rides the `competition.created` / `competition.updated`
  events, folds through the competition projection, and mirrors into the
  contest-template snapshot + seed mapping — exactly the obligation the fields
  comment already records. Data flow matches the house pattern: shared Zod
  schema → `CompetitionService` validate/append → projection fold.
- **Introduce a single class-rule defaults module in `packages/shared`**,
  keyed by `Discipline`, encoding the rule-doc numbers as derived code. Both
  the default seeding *and* the deviation comparison read this one module, so
  "default" and "deviates from default" can never drift apart.
- **Reuse the confirm-flag guardrail pattern.** The service compares each
  submitted rule-fixed value against the class-rule default; a mismatch
  without an accompanying acknowledgment throws a typed
  needs-confirmation error (like `CompetitionDeleteNeedsConfirmationError`),
  and the companion re-submits with the acknowledgment + records the
  deviation. A matching value is accepted silently.
- **Model computation behaviours as pure functions in `packages/shared`**
  (group normalisation, final aggregate with drop-worst/penalty/zero-floor),
  independent of capture. The degenerate ACs become shared unit tests these
  functions carry into every per-discipline scoring spec.

### Key Design Decisions

- **Where scoring config lives — competition aggregate vs. a separate scoring
  aggregate**: extending `competitionConfigurationFields` inherits templating,
  seeding, the discipline-change guard, and the audit event for free, at the
  cost of a growing config payload. → **Recommend extending the competition
  configuration surface**; it is the pre-wired obligation point and keeps
  one config event per competition. Revisit only if per-task config
  (STORY-001-008) makes the payload unwieldy.
- **Defaults & deviation detection — one registry vs. scattered constants**:
  a single Discipline-keyed defaults module vs. per-field literals. →
  **Recommend one registry**; it is the only way to guarantee the default and
  the deviation check use the same number (house rule 1 compliance) and gives
  reports a stable "rule-expected" value to show.
- **Deviation representation — boolean flag vs. expected+chosen record**: a
  bare "deviates" boolean loses the information reports need. → **Recommend
  recording the rule-expected value alongside the chosen value** so a report
  can render "points-per-second 1 (FAI rule: 2)" without re-deriving.
- **How much computation to build now**: the pipeline's task-specific detail
  is scoped out, but the shared behaviours (group normalisation, aggregate,
  penalty retention, zero floor, degenerate cases) are in scope. → **Recommend
  building the discipline-agnostic pure functions + their AC6–AC8 tests now**,
  leaving task-specific raw-score assembly to the per-discipline stories.
- **Acknowledgment transport**: a request-level `confirmDeviations` style flag
  (mirrors `confirmDestroysResults`) vs. per-field acknowledgments. →
  **Recommend per-deviation acknowledgment** (each rule-fixed field the
  Organiser changed is individually confirmed) so the warning names the
  specific value and the recorded deviation is precise — matching AC4's "each
  deviating value triggers" wording.

### Alternatives Considered

- **A dedicated `scoringConfig.*` event stream** separate from the competition
  aggregate: rejected — it duplicates the templating/seeding/lifecycle
  machinery the competition aggregate already provides and contradicts the
  fields comment that pre-commits this story to the shared config surface.
- **Copying rule numbers into per-competition seed data / the rule docs**:
  rejected — violates house rule 1 (rule docs are read-only; discipline is a
  key, not a copy). The defaults registry is a derivation, not an edit.
- **Client-side-only deviation warnings**: rejected — the base is
  authoritative (physical architecture) and deviations must be recorded in the
  immutable log for reports; the guard must live in the service, with the UI
  warning as an aid.

## Risk & Gap Analysis

### Requirement Ambiguities

- **Boundary between configuration (AC1–AC4) and computation (AC5–AC8)**: the
  computation *pipeline's task-specific detail* is scoped out, yet penalty
  retention, drop-worst and the degenerate cases are in scope. Needs a clear
  line: this story delivers the discipline-agnostic pure functions and their
  tests, not per-discipline raw-score assembly.
- **Depth of the F3B model (AC2)**: AC2 asks only that the model *shows* three
  tasks normalising separately with round = sum. How much F3B task structure
  to model here vs. STORY-001-008 (per-task parameters) is unstated — risk of
  building the same F3B shape twice.
- **"Rounding/precision" defaults**: the general rules say rounding differs by
  class but the numbers live in per-class docs; the story does not enumerate
  them. The defaults registry must source each class's precision from the
  per-class rule docs, not guess.
- **"Mandated landing table" identity (AC4)**: landing tables are user-created
  master data with no class tag. Determining whether a selected table "differs
  from the class's mandated one" requires a code representation of each class's
  mandated table (values or a canonical identity) to compare against — the
  story assumes this comparison exists but does not define how a table is
  matched to the rule.

### Edge Cases

- **Discipline change after scoring options are customised**: an existing
  competition with deviations whose discipline is changed would carry stale
  defaults/deviations. The existing discipline-change guard blocks changes
  only once scores are captured — a pre-capture discipline change needs a
  defined re-default/re-validate behaviour for scoring options.
- **Applicability of a rule-fixed field to a class**: points-per-second is
  meaningful for flight-time classes (F5L=2, others=1) but the concept does
  not apply uniformly; the defaults registry must express "not applicable"
  cleanly so no spurious deviation is raised.
- **Seeding a template that carries a deviation**: does a seeded competition
  inherit the deviation acknowledgment silently, or must it be re-confirmed?
  The copy-on-seed model needs a stated stance.
- **Tied best in an inverted speed task (AC7)** and **all-zero in an inverted
  task (AC6)**: the inverted ratio must handle a zero/absent winner time
  without dividing by zero — symmetric to the non-inverted degenerate cases.
- **Penalty exceeding aggregate with a dropped round (AC5 + AC8 combined)**: a
  penalty in a dropped round that also drives the aggregate negative must both
  be retained and floor at zero.

### Technical Risks

- **Config-payload growth and the three-place obligation**: every scoring
  field must be added to the competition schema, the contest-template
  snapshot, and the seed mapping in one change (per the fields comment) — an
  easy place to introduce drift. Mitigation: compose scoring options as one
  named fragment reused by all three, like the existing pilot-classes fragment.
- **Default/deviation drift (house rule 1)**: if defaults and deviation checks
  read different constants, the guardrail silently mis-fires. Mitigation:
  single Discipline-keyed defaults module consumed by both paths.
- **Deviation persistence for a report surface that does not exist yet**:
  reports are a later story, but the deviation record must be captured in the
  event now or it is lost. Mitigation: persist rule-expected + chosen values
  on the config event payload.
- **Mandated-landing-table comparison**: comparing a user table to a class's
  mandated table by value is brittle (entry ordering, precision). Mitigation:
  define a canonical comparison (or a mandated-table identity in the defaults
  registry) as an explicit design decision in REASONS Canvas.
- **Floating-point in normalisation and aggregates**: ratio scaling and
  per-class rounding risk off-by-one at rule boundaries; the degenerate ACs
  plus rule-boundary tests must pin the rounding contract.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Group-score basis defaults (best=1000, scaled, speed inverted) | Yes | Default seeded from the Discipline-keyed registry via the config surface. |
| 2 | F3B three-task separate normalisation, round = sum | Partial | Depth of F3B task modelling vs. STORY-001-008 must be bounded to avoid duplication. |
| 3 | Drop-worst default per class + deviation warns + flagged for reports | Yes | Needs the confirm-flag guard + persisted deviation record; report surface itself is a later story. |
| 4 | Every rule-fixed parameter uses the same guardrail (pts/sec, landing table) | Partial | Points-per-second is straightforward; "mandated landing table" deviation needs a defined table-matching representation. |
| 5 | Penalties retained through drop-worst | Yes | Pure final-aggregate function; combine with AC8 for the negative-and-dropped case. |
| 6 | All-zero group → all zero, no div-by-zero | Yes | Group-normalisation pure function; include inverted-task variant. |
| 7 | Tied best → all 1000, others scale to shared best | Yes | Include inverted (tied best time) variant. |
| 8 | Negative aggregate floors at 0, penalties recorded in full | Yes | Zero floor in the aggregate function; penalties remain in the audit record. |
