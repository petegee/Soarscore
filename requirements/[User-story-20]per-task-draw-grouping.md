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
