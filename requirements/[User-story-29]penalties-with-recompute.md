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
