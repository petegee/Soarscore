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
