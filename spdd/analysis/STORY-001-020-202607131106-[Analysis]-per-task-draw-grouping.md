# SPDD Analysis: Per-Task Draw Grouping and Generation

## Original Business Requirement

# Story Decomposition: Per-Task Draw Grouping for Multi-Task Classes

## INVEST Analysis

### Abstract Task: "Per-Task Draw Grouping and Generation"

**Analysis Dimensions**:
- **Core Responsibility**: let a multi-task class (F3B: Duration, Distance,
  Speed) draw an **independent group composition per task within a round**,
  instead of one shared grouping reused across every task — so each task's
  own rule-fixed group-size minimum governs its own groups, not the largest
  minimum among the class's tasks.
- **Primary Operations**: generate a group composition per task per round
  (not one composition for the whole round); validate each task's composition
  against its own minimum (and, where the rule allows it, the "or all
  competitors" escape) independently of the other tasks in the same round;
  expose per-task fairness evidence so a task with a materially different
  group size (e.g. Speed's 8-or-all vs Duration's 5) doesn't skew the
  matchup-distribution metric for the others.
- **Key Constraints**: task minima are already rule-fixed per task on the
  class model (`TaskParameterSet.minGroupSize`,
  `minGroupSizeAllCompetitorsFallback`); a round's tasks are flown by the same
  roster but need not be flown by the same subgroups; single-task classes
  (F3J, F3K, F5J, F5K, F5L) must be completely unaffected — this is additive
  for classes with more than one task (NFR: additive-only extensibility, no
  branch on discipline elsewhere in the draw pipeline).
- **Technical Complexity**: High — the domain model (`RoundDraw`,
  `FlightGroup`, `GeneratedDraw`) and the generation/fairness algorithm
  (`DrawService`) are currently built around one grouping per round; this
  reshapes both without breaking the single-task path.
- **Business Complexity**: Medium — the business rule itself (F3B.1.8b) is
  settled and unambiguous about the three minima; the complexity is in
  presenting three per-task compositions coherently, not in the rule content.

### INVEST Evaluation
- ✅ **Independent**: purely a domain-model and generation-algorithm change
  behind the existing save/generate/accept endpoints; no other unfinished
  story blocks it.
- ✅ **Negotiable**: how per-task fairness is scored jointly (e.g. worst-task
  metric vs summed metric) is open for design in analysis/Canvas.
- ✅ **Valuable**: without this, every F3B round is drawn as if Duration and
  Distance also needed groups of ≥ 8 (Speed's minimum) — a real
  over-constraint that silently narrows the fair draws F3B could otherwise
  produce, and Task C can never be given the independently-drawn composition
  F3B.1.8b's wording implies.
- ✅ **Estimable**: the shape of the change (add a task dimension to the
  draw's group structure) is concrete even though the algorithm work is
  substantial.
- ✅ **Small**: scoped to the domain model, generation and validation only —
  UI presentation is carved out as STORY-001-021 to keep this to 2–3
  functional points.
- ✅ **Testable**: each per-task minimum, the Speed "or all" escape acting
  independently of Duration/Distance, and single-task-class non-regression
  are all directly observable.

**Conclusion**: Ready as-is — single backend story, with UI presentation split
out to STORY-001-021 (see that story for the reasoning) to respect the 1–5
day / 2–3 functional-point sizing rule.

**Split strategy**: split by technical dependency — this story (the domain
model and generation engine multiple downstream surfaces will read from) must
land before STORY-001-021 (the operator-facing presentation of what this
story produces) can be built against real per-task data.

---

## [STORY-001-020] Per-Task Draw Grouping and Generation

> Source: `docs/requirements/rules/f3b.md` §1 (F3B.1.8b — per-task group-size
> minima: Duration ≥ 5, Distance ≥ 3, Speed ≥ 8 or all competitors) ·
> `docs/requirements/high-level-requirements.md` Area 4.1 (draw specification
> and groups-per-round bounds — **see Open Question** below, this story
> supersedes the single-bound framing there for multi-task classes) ·
> `docs/requirements/decisions.md` (no existing decision covers per-task vs
> per-round draw granularity — this story should add one) · STORY-001-022
> (warn-and-override policy for rule-fixed group-size minima, which this
> story's AC4 relies on)
> Module: 001 (Organiser MVP) · Estimated effort: **4–5 days**

### Background

STORY-001-009 built the draw as one shared group composition per round,
reused for every task the round covers. That is correct for the five
single-task classes, but F3B flies three tasks per round (Duration, Distance,
Speed) with three *different* rule-fixed per-group minima (F3B.1.8b: 5, 3, and
8-or-all-competitors respectively). The current implementation resolves this
by taking the largest of the three minima (8, from Speed) and applying it as
the one bound for the round's single shared grouping — meaning Duration and
Distance are currently always drawn as if they too required groups of at
least 8, which is stricter than F3B.1.8b actually requires and forecloses
smaller or differently-composed Duration/Distance groups. It also means Task
C (Speed) can never be given its own independently-drawn composition, even
though F3B.1.8b's differing minimum for Speed, and its allowance for Task C's
starting order to derive from cumulative results-so-far, both imply Speed's
grouping is a distinct decision from Duration/Distance's. This story gives
each task in a multi-task round its own group composition, generated and
validated against its own rule-fixed minimum.

### Business Value

- Provide the Organiser with F3B draws that use each task's actual rule-fixed
  minimum, not an inflated one borrowed from whichever task needs the most
  competitors per group.
- Support F3B contest practice, where Duration/Distance and Speed groupings
  are commonly composed differently.
- Enable a future Speed-specific starting order (F3B.1.8b) that depends on
  interim results, which is impossible while Speed shares Duration/Distance's
  fixed composition.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw specification, storage and the
  single-task generation/fairness engine — **done**); the class-model layer
  already carries per-task minima and the "or all competitors" escape
  (`TaskParameterSet.minGroupSize`, `minGroupSizeAllCompetitorsFallback` —
  **done**, added during the STORY-001-019 bugfix); STORY-001-022
  (warn-and-override for rule-fixed group-size minima), which this story's
  AC4 depends on for *how* a task that can't meet its own minimum is
  surfaced. STORY-001-022 should land before or alongside this story — its
  number is higher only because the need for it was identified while
  reviewing this story's draft, not because it is less foundational.
- **Data assumptions**: a competition's roster and round count are unchanged
  by this story; only the *shape* of what a round's draw contains changes for
  multi-task classes.
- **Integration points**: the accepted draw's shape change is a breaking
  change for any downstream consumer that assumes one grouping per round —
  draw acceptance (STORY-001-017), group management (STORY-001-011) and draw
  reports (STORY-001-015) will need to read per-task groupings for F3B once
  this lands; updating those consumers is out of scope here (see Scope Out)
  but must be tracked as follow-on work before F3B contests can run
  end-to-end.
- **Business constraints**: single-task classes (F3J, F3K, F5J, F5K, F5L)
  must produce byte-for-byte the same draws as before this story — this is
  purely additive for classes with more than one task.

### Scope In

- Extending the draw's domain model so a round can hold one group composition
  **per task**, not one shared composition for the whole round.
- Generating each task's composition independently, honouring that task's own
  rule-fixed minimum (and the "or all competitors" escape where the rule
  grants it) without being constrained by another task's minimum in the same
  round.
- Validating each task's composition independently at save and generate time,
  with a rejection that names which task's minimum is violated.
- Fairness evidence that remains meaningful when tasks in the same round have
  differently sized groups (e.g. a per-task or worst-task fairness view).
- Single-task classes continue to generate exactly as they do today (one
  composition, reused as "the round's grouping" — this story does not change
  their observable behaviour).

### Scope Out

- Presenting per-task groupings to the Organiser/Contest Director in the
  companion app — STORY-001-021.
- Updating draw acceptance, group management or draw reports to read
  per-task groupings — tracked as follow-on work, not built here.
- Per-task flying order / starting-order sequencing (F3B.1.8d) — this story
  only addresses group *composition*; a task-specific order is a further
  extension the requirements docs do not yet describe, and F3B cannot be
  fully modelled until it exists, but it is not part of this story.
- Frequency and team-separation constraints — remain Future Enhancements
  per STORY-001-009.

### Acceptance Criteria

#### AC1: A multi-task round draws independent group compositions per task
**Given** an F3B competition with a 12-pilot roster and a draw specification
of 2 groups per round
**When** the Organiser generates a round's draw
**Then** Duration, Distance and Speed each have their own group composition
for that round, and the three compositions are not required to be identical.

#### AC2: Each task's own minimum governs its own groups, not the largest among them
**Given** the same 12-pilot F3B roster (Duration min 5, Distance min 3, Speed
min 8-or-all)
**When** the draw generates 2 groups per round
**Then** Duration's and Distance's groups are validated against their own
minimums (5 and 3), not inflated to Speed's minimum of 8, so Duration and
Distance may validly form 2 groups of 6 while Speed cannot.

#### AC3: Speed's "or all competitors" escape applies to Speed alone
**Given** the same 12-pilot F3B roster, where 2 groups of 6 would satisfy
Duration and Distance but not Speed (which needs 8 or all 12)
**When** the Organiser generates the round
**Then** Speed is drawn as a single group of all 12 competitors while
Duration and Distance keep their 2 groups of 6, because Speed's escape is
resolved independently of the other two tasks' compositions.

#### AC4: A task that cannot meet its own minimum warns rather than blocking the whole round
**Given** an F3B roster of 6 pilots and a draw specification requesting 2
groups per round
**When** the Organiser generates the round
**Then** Duration and Distance generate normally (their minimums of 5 and 3
are unaffected), Speed generates the closest compliant grouping available (a
single group of all 6, since neither "≥ 8" nor a 2-group split of 6 is
possible) *and* is flagged with a warning naming Speed and citing that this
roster cannot meet F3B.1.8b's minimum-8 requirement even under the "or all
competitors" escape, per STORY-001-022's warn-and-override policy — the round
is still generated, not rejected outright.

#### AC5: Single-task classes are unaffected
**Given** an F5J competition (a single-task class) with a saved draw
specification identical to one used before this story shipped
**When** the Organiser generates a draw
**Then** the resulting group composition for each round is unchanged from
the pre-existing single-grouping behaviour — this story introduces no
observable difference for single-task classes.

#### AC6: Fairness evidence remains interpretable across differently-sized per-task groups
**Given** an F3B draw where Speed's groups are larger than Duration's and
Distance's groups in the same round
**When** the Organiser reviews the generated draw's fairness evidence
**Then** the evidence clearly attributes matchup counts and fairness metric
values to each task separately, so the Contest Director can judge fairness
per task rather than seeing one blended figure that hides a task-specific
imbalance.

#### Non-Functional Expectations
- Draw generation for F3B must still complete within the same practical time
  budget as today's single-grouping generation (the existing 200-attempt
  budget, Decision #7), even though it now searches three per-task
  compositions per round instead of one.

### INVEST Check

Independent (a domain-model and generation-engine change behind existing
endpoints) · Valuable (removes a real over-constraint on F3B draws and
unblocks F3B.1.8b's independently-orderable Speed task) · Small enough for
its complexity (4–5 days, 3 functional points: per-task domain model,
per-task generation/validation, per-task fairness evidence) · Testable (each
per-task minimum, the Speed escape acting independently, and single-task
non-regression are all directly observable).

## Domain Concept Identification

#### Existing Concepts (from codebase)
- `TaskParameterSet` (`packages/shared/src/class-model.ts`): the rule-fixed
  per-task parameter bundle already on `ContestClassModel.tasks`, already
  carrying `minGroupSize` and `minGroupSizeAllCompetitorsFallback` per task —
  the exact per-task minima this story needs are already modelled and
  populated for the F3B stock model (5 / 3 / 8-with-fallback). Nothing to add
  here; this story only needs to *consume* it per task instead of collapsing
  it via `resolveMin`'s `Math.max(...mins)`.
- `RoundDraw` / `FlightGroup` (`packages/shared/src/draw.ts`): currently one
  flat `groups: FlightGroup[]` per round, with no task dimension at all — this
  is the concept that must gain a per-task axis.
- `GeneratedDraw` / `MatchupDistribution` (`packages/shared/src/draw.ts`):
  the materialised outcome and its one shared fairness figure
  (`maxMeets`/`totalExcessMeets`/`variance`/`pairs`) computed once across the
  whole draw — currently blind to the idea that different tasks in the same
  round could have entirely different group memberships and thus entirely
  different matchup sets.
- `ConstraintWarning` (`packages/shared/src/draw.ts`) and the
  `resolveGroupPlan`/`computeWarnings` machinery in `DrawService`
  (`apps/base/src/draw/service.ts`): STORY-001-022 (done, confirmed in code)
  already implements the single-minimum warn-and-fallback path this story's
  AC4 needs, including an `id`-gated warning threaded through
  `accept()`'s acknowledgement check. The code comment at
  `service.ts:483-484` explicitly anticipates this story: *"STORY-001-020
  (per-task warnings, deferred) will let multiple group-size warnings
  co-occur on one candidate — at that point this literal id must become
  task-qualified."* This is a concrete, already-flagged seam to extend, not
  a new mechanism to invent.
- `DrawService.resolveMin` (`apps/base/src/draw/service.ts:373-378`): the
  exact over-constraint this story removes — it reduces a class's several
  per-task minima to one `Math.max(...)` value applied uniformly to the
  round's single grouping. This function (and the single `effectiveG`
  threaded through `generate()`) is the crux of the "one grouping per round"
  design this story must replace with a per-task resolution.
- `DrawService.runAttempt` / `globalRefine` / `computeDistribution`
  (`apps/base/src/draw/service.ts`): the RNG-based generation and the
  anti-repeat/fairness algorithm, both currently parameterised by a single
  `groupsPerRound` (`effectiveG`) per round and a single meet-count matrix
  per draw. These must become per-task in some form (see Strategic Approach).
- `modelAllowsAllCompetitorsFallback` (`packages/shared/src/class-model.ts`):
  a model-level helper (`model.tasks.some(...)`) already used for the
  single-group consent gate; this story needs a *per-task* version of the
  same check (currently only the model-wide "does any task have the escape"
  question is asked).
- Downstream consumers reading `RoundDraw.groups` directly: `DrawProjection`
  (pure loader/copier, `apps/base/src/draw/projection.ts`),
  `apps/base/src/routes/draw.ts` (API surface, thin pass-through), and
  `apps/companion/src/draw/DrawView.tsx` (renders `round.groups` by
  `flyingOrder`). All three currently assume the flat one-grouping-per-round
  shape and will need updating for F3B once the shape changes (explicitly
  scoped out here per the story's Scope Out and D13's consequences).

#### New Concepts Required
- **Per-task group composition**: a named/keyed grouping of `FlightGroup[]`
  attributed to one of the class's tasks (by `TaskParameterSet.id`), so a
  `RoundDraw` for a multi-task class can hold several such compositions
  instead of one flat `groups` array. Relates to `RoundDraw` as its new
  internal structure, and to `TaskParameterSet` as the key it's attributed by.
- **Per-task fairness evidence**: a `MatchupDistribution`-shaped figure
  (or equivalent) computed per task rather than once per draw, since each
  task's grouping produces its own distinct set of pairings. Relates to
  `GeneratedDraw.distribution`, which currently assumes one distribution per
  draw; also relates to `GeneratedDraw.metricValue`, which likewise assumes
  one scalar per draw and per AC6 must become attributable per task.
- **Per-task group-size warning identity**: the existing single
  `id: "group-size-minimum"` warning literal (service.ts:485) must become
  task-qualified (e.g. embed the task id/name) so multiple simultaneous
  per-task warnings on one candidate (AC4, e.g. Speed warns while Duration/
  Distance don't) remain individually addressable by `accept()`'s
  by-id acknowledgement filter. This is additive to `ConstraintWarning`
  (already has an optional `id`), not a new interface.
- **Single-task-class backward-compatible view**: whatever new per-task shape
  is chosen, the five single-task classes (F3J/F3K/F5J/F5K/F5L) must still
  read/behave exactly as `RoundDraw.groups` does today (AC5) — either by
  collapsing a one-task "per-task" structure back to the flat shape for
  those classes, or by giving every class exactly one implicit task-slot
  so the two shapes are structurally unified. This is a design decision for
  the Canvas phase (see Strategic Approach), not a new business concept, but
  it is a concept the codebase does not yet have a name for.

#### Key Business Rules
- **Per-task minimum governs only its own task's groups** (F3B.1.8b): governs
  the new per-task group composition concept — Duration's groups check only
  `minGroupSize=5`, Distance's only `minGroupSize=3`, Speed's only
  `minGroupSize=8` (with its escape), each independently of the others in the
  same round.
- **Speed's "or all competitors" escape resolves per task, not per model**
  (F3B.1.8b Task C, `minGroupSizeAllCompetitorsFallback`): governs the
  per-task group composition and the per-task warning; today
  `modelAllowsAllCompetitorsFallback` only answers "does *any* task in this
  model carry the escape" at the whole-draw single-group gate — this story
  needs the escape checked against the *specific* task being resolved, since
  in a 3-task class only Speed carries it.
  - **`sourceClass` heuristic collides with "any" semantics if applied naively
    on a per-task basis** — see Risk & Gap Analysis; `resolveGroupPlan`'s
    fallback-warning-suppression check (`effectiveG === 1 &&
    modelAllowsAllCompetitorsFallback(model)`, service.ts:472) is written at
    model granularity and must be re-derived at task granularity for this
    story, not reused as-is.
- **A round's task-level draws are decided as one unit for acceptance**
  (D13's third consequence, already recorded in decisions.md): the CD accepts
  or re-draws the whole round's per-task compositions together, never
  task-by-task — governs how `accept()`/`cancel()` continue to operate on
  one `GeneratedDraw` id even though its internal shape now spans several
  task compositions per round.
- **Single-task classes are unaffected byte-for-byte** (AC5, D13's first
  consequence): governs the compatibility/collapsing rule for the new
  per-task structure — whatever shape is chosen must reduce to the current
  observable behaviour for F3J/F3K/F5J/F5K/F5L.
- **Anti-repeat fairness is scoped to a task's own pairings, not the whole
  round** (implicit in AC6, not explicit in the source rule but demanded by
  the fairness-evidence requirement): governs `computeDistribution` and the
  attempt-scoring `scoreKey`/`metricValueOf` functions, which today assume
  one meet-count matrix per whole draw; a Duration pairing and a Speed
  pairing between the same two pilots are today the same "meet" — this story
  implies they may need to be counted separately per task, since the two
  tasks' groupings are independent draws over the same roster.

## Strategic Approach

#### Solution Direction

The generation/fairness algorithm already treats "one round's grouping" as
an independent unit of work inside `runAttempt`/`globalRefine`/
`computeDistribution`, parameterised by a single `groupsPerRound` value and a
single meet-count matrix. The natural extension is to make that same unit of
work run **once per task** instead of once per round: for a multi-task class,
`generate()` resolves an `effectiveG` and runs the attempt/refine/distribution
pipeline independently for each `TaskParameterSet` on the model, keeping a
*separate* meet-count matrix per task (since Duration pairings and Speed
pairings are different draws over the same roster and must not interfere with
each other's fairness accounting). For a single-task class, this degenerates
to exactly one task-iteration of the existing pipeline — the same code path,
run once, which is how AC5's byte-for-byte non-regression is most naturally
guaranteed (no discipline branch, per NFR-2; the "one task" vs "three tasks"
difference falls out of `model.tasks.length`, never a `switch (sourceClass)`).

Data flow: `DrawService.generate()` reads `model.tasks`, resolves each task's
own minimum/escape/effectiveG via a task-scoped version of today's
`resolveGroupPlan`, runs `ATTEMPTS` randomised placements *per task* (or
reuses one combined attempt loop that produces all tasks' placements
together per attempt — an open trade-off, see below), and materialises a
`RoundDraw` whose groups are now keyed by task. The `GeneratedDraw`'s
distribution/metricValue become a collection keyed by task (or a task-keyed
list alongside a retained whole-draw rollup for backward-compatible
single-task callers). Acceptance, warning-acknowledgement and the
projection's replay-only copy logic are structurally unaffected (they treat
`GeneratedDraw` as an opaque materialised blob already) but their copy
functions must be extended to deep-copy the new per-task fields.

#### Key Design Decisions

- **Domain-model shape for a task-keyed `RoundDraw`**: (a) add a
  `taskId`-keyed array of group-sets inside `RoundDraw`, keeping the existing
  flat `groups: FlightGroup[]` field *only* for single-task classes as a
  populated convenience/back-compat view; vs (b) always store a task-keyed
  structure (even single-task classes get one entry keyed by their sole
  task) and change every consumer (`DrawProjection`, `routes/draw.ts`,
  `DrawView.tsx`) to read through the task key, accepting that this is a
  breaking shape change absorbed now rather than deferred.
  → Recommend (a) for this story specifically, because Scope Out explicitly
  defers updating draw acceptance/group management/reports, and AC5 demands
  zero observable difference for single-task classes — a dual shape (flat
  field always populated, task-keyed field additionally populated only when
  `model.tasks.length > 1`) satisfies both without forcing every downstream
  consumer to change in this story. The cost is a temporary duplication
  (single-task classes populate both the flat and the one-entry task-keyed
  view) that the follow-on work (draw acceptance/group management/reports)
  resolves when those consumers migrate to reading the task-keyed shape
  exclusively — tracked as the already-identified follow-on debt in D13's
  consequences, not new debt this story invents.

- **Per-task vs combined-attempt generation loop**: (a) run the existing
  `ATTEMPTS`-budget attempt loop independently per task (3× the work for
  F3B, each task's `ATTEMPTS=200` search fully independent); vs (b) run one
  combined attempt that places all of a round's tasks' groupings together
  per iteration, scoring a joint key across tasks.
  → Recommend (a): the tasks' compositions are independent decisions per
  D13 (different minima, potentially different group counts, e.g. AC3's
  Speed-as-one-group vs Duration/Distance's two groups) — there is no shared
  constraint an attempt needs to jointly satisfy across tasks, so a combined
  loop adds coupling for no benefit and would complicate the
  avoid-consecutive-flights bar (which is already round-to-round, not
  task-to-task). Running three independent 200-attempt searches instead of
  one is the direct reason the Non-Functional Expectation calls out time
  budget — worth flagging explicitly to Canvas as a risk (see below), not
  silently assumed fine.

- **Fairness evidence granularity**: (a) one `MatchupDistribution` per task,
  replacing the single whole-draw one for multi-task classes (with a
  single-task class still reporting the one it always did, effectively
  "per task" trivially); vs (b) keep one whole-draw distribution as today
  *and* add supplementary per-task ones alongside it.
  → Recommend (a) as the model, mirroring the group-composition decision
  above: a whole-draw blended distribution across tasks with different
  group sizes is exactly the misleading figure AC6 says must not exist, so
  there's no value in still computing/storing it for multi-task classes.
  `GeneratedDraw.metricValue`/`distribution` become task-keyed for
  multi-task classes (paralleling whatever shape is chosen for `groups`
  above), while single-task classes' `metricValue`/`distribution` remain
  exactly the single scalar/object they are today (AC5).

- **Per-task minimum resolution replacing `resolveMin`'s `Math.max`**:
  straightforward — `resolveMin(model)` (service.ts:373-378) is no longer
  called to produce one whole-model minimum for generation; instead each
  task's own `minGroupSize`/`minGroupSizeAllCompetitorsFallback` feeds a
  task-scoped version of `resolveGroupPlan`. `resolveMin`'s existing
  whole-model `Math.max` reduction may still be useful for `getEvidence`'s
  `computeWarnings` at *save* time (which today only warns about anti-repeat/
  consecutive-flight feasibility against one `groupsPerRound`, not
  group-size minima at all — group-size warnings are currently a
  *generate*-time-only concept via `resolveGroupPlan`) — Canvas should
  confirm whether save-time warnings need a per-task view too, or can stay
  as-is since AC4's warning is generate-time.

#### Alternatives Considered

- **Separate top-level aggregate per task (a `TaskDraw` sibling to
  `GeneratedDraw`)**: rejected — this fragments the "one accepted draw per
  round" invariant D13 explicitly preserves (acceptance stays one decision
  for the whole round), and would require `accept()`/`cancel()` to
  coordinate across multiple aggregate ids atomically, a much larger change
  than the story's 4-5 day / 3-point estimate implies.
- **Always task-keyed shape with immediate consumer migration (option (b)
  above)**: rejected for *this* story specifically — it would pull
  STORY-001-017/011/015's follow-on work into this story's scope, directly
  contradicting the story's own Scope Out and D13's explicit sequencing.
  Worth re-raising when the follow-on work is scoped, since the dual-shape
  compromise is a deliberate, acknowledged interim state, not a permanent
  design.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **"Fairness evidence... per-task or worst-task view" (Scope In) is left
  open by the story itself** ("Negotiable" in the INVEST section explicitly
  flags this): the story does not commit to whether AC6's per-task
  attribution replaces the whole-draw metric outright or supplements it.
  Strategic Approach recommends full replacement for multi-task classes, but
  Canvas should confirm this against how STORY-001-021 (not yet built) and
  STORY-001-017's acceptance evidence intend to consume it, since a design
  choice here constrains what those stories can build against.
- **Whether save-time (`saveSpec`/`computeWarnings`) needs any per-task
  awareness at all, or whether all per-task resolution is generate-time
  only**: the story's ACs (AC2-AC4) are all phrased "when the Organiser
  generates the round" — none exercise `saveSpec`. The current
  `assertGroupBound`/`resolveMin` hard-rejection at save time already
  collapses to a whole-model minimum today; whether that collapsed
  save-time check remains acceptable (a task-specific shortfall would only
  surface at generate time under the current D14 warn-and-generate design
  anyway) needs an explicit decision, not an assumption.
- **How `avoidConsecutiveFlights` interacts across independent per-task
  groupings**: the existing rule bars a seat's last group in round *r* from
  its first group in round *r+1*, keyed on `prevGroupIndex` from the
  *previous round's* placement. With three independent per-task placements
  per round, it's unclear whether "consecutive" should be evaluated per
  task (Duration round *r* → Duration round *r+1*) or across the whole
  round's flying sequence (which now includes three tasks' worth of
  groups) — the story and Area 4.1 are both silent on this, and it directly
  affects `runAttempt`'s `prevGroupIndex` bookkeeping if generation moves to
  independent per-task attempt loops.

#### Edge Cases
- **AC4's roster of 6 with Speed's own minimum unmeetable while Duration/
  Distance succeed** exercises the case where different tasks in the *same*
  round land on genuinely different `effectiveG` values (Duration/Distance
  at 2 groups, Speed at 1 group of all 6) — this is the crux the whole
  domain-model reshape exists for, and the per-task warning-id
  disambiguation (already flagged as future work in service.ts:483-484)
  must be implemented correctly here, not left as the single hardcoded
  `"group-size-minimum"` literal id.
- **A roster shrinking between save and generate for a multi-task class**:
  `generate()` already re-checks `assertGroupBound` against the *current*
  roster (Safeguard 6) using the whole-model `resolveMin`; once minima are
  resolved per task, this re-check and its `singleGroupPermitted` gate need
  the same per-task treatment, or a roster that's fine for Duration/Distance
  but has shrunk below Speed's floor could either wrongly hard-reject the
  whole round or wrongly let Speed silently skip its own bound check.
- **Two-task or four-task classes in the future** (not in MVP's roster, but
  the domain model is meant to be additive per class per NFR-2): the design
  should not hardcode "three tasks" anywhere — `model.tasks.length` must
  drive the per-task iteration generically, which the Strategic Approach's
  degenerate-to-one-task framing already satisfies, but Canvas should keep
  this in the Norms/Safeguards section explicitly (mirroring
  `groupSizeMinimumClauseFor`'s existing per-class switch, which is the one
  place a genuinely new class still requires a one-line addition — NFR-2
  compliant, not a violation, since it is metadata, not draw logic).

#### Technical Risks
- **Generation time budget**: running `ATTEMPTS=200` independently per task
  means F3B now runs roughly 3× the randomised-attempt work per round
  compared to today's single shared grouping (per the Non-Functional
  Expectations' own callout). At MVP scale (≤ 20 pilots, ≤ 8 rounds) this is
  very likely still fast in absolute terms, but it should be measured, not
  assumed, since the story explicitly commits to "the same practical time
  budget as today."
- **Deep-copy/replay correctness in `DrawProjection`**: `copyDraw`
  (projection.ts:114-140) and `generatedDrawToPayload`/`drawSpecToPayload`
  (draw.ts:213-256) are hand-written field-by-field deep copies with an
  explicit precedent for tolerating older payload shapes on replay
  (`groupSizeWarnings ?? []`, projection.ts:138, added for STORY-001-022).
  Any new per-task fields on `RoundDraw`/`GeneratedDraw` must follow the
  same defensive-default pattern so events logged before this story ships
  still replay without throwing (D4) — this is a real, easy-to-miss risk
  given how many places in this codebase hand-roll deep copies of these two
  types (at least three: `draw.ts`, `projection.ts`, and any test fixtures
  in `draw.service.test.ts`/`draw.acceptance.test.ts`).
- **Downstream consumers left un-migrated (explicit Scope Out) still read
  the flat `groups` field**: `DrawView.tsx` renders `round.groups` directly;
  if the dual-shape approach (flat field for back-compat) is adopted, F3B's
  flat `groups` needs a defined fallback value (e.g. one of the three tasks'
  compositions, or empty) so the companion app doesn't silently render a
  stale/wrong/empty grouping for F3B rounds until STORY-001-021 ships — the
  story's Scope Out defers *building* the new presentation, but doesn't
  say what the *old* presentation should show in the interim, which is a
  real gap Canvas needs to close explicitly (e.g. "flat `groups` is left
  empty/undefined for multi-task classes and the companion app is expected
  to show nothing meaningful until 021" vs "flat `groups` mirrors task[0]
  as a stopgap").

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Independent per-task compositions, not required identical | Yes | Directly addressed by the task-keyed domain-model reshape. |
| AC2 | Each task's own minimum governs its own groups | Yes | Directly addressed by replacing `resolveMin`'s `Math.max` with per-task resolution in generation. |
| AC3 | Speed's "or all competitors" escape applies to Speed alone | Yes | Requires the per-task version of `modelAllowsAllCompetitorsFallback`/`resolveGroupPlan`'s escape check (currently model-wide) — a real code change, not just data already present. |
| AC4 | Unmeetable task warns, round still generates | Partial | The warn-and-generate mechanism (STORY-001-022) is done and reusable; the gap is the warning `id` needing to become task-qualified so multiple co-occurring per-task warnings stay individually acknowledgeable — flagged in code already, not yet implemented. |
| AC5 | Single-task classes byte-for-byte unaffected | Yes | Achievable via the degenerate-to-one-task framing in Strategic Approach; must be verified with a regression test fixture, since it's an absence-of-change claim. |
| AC6 | Per-task fairness evidence stays interpretable | Yes | Requires the distribution/metricValue to become task-keyed for multi-task classes (open design question on exact shape, see Ambiguities). |
| NFR (time budget) | Same practical generation time as today | Partial | Plausible at MVP scale but unverified; needs a measured check, not an assumption, given the ~3× attempt-loop multiplication this design implies. |
