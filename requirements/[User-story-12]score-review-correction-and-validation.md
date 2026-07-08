# [STORY-001-012] Score Review, Correction and Validation

> Source: `docs/user-stories/01-organiser.md` §5.4, §5.6 · `docs/requirements/high-level-requirements.md` Areas 5.4, 5.6
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Live capture happens on Scorer devices in the field; mistakes surface later.
The Organiser needs one place to review a single pilot's results across all
rounds, correct capture errors, and fill gaps — with every correction
attributable so the result stays defensible. Alongside the manual review, the
system flags suspicious data automatically: values outside configurable
limits (outliers) and pilots in flown groups with no score (gaps). Validation
is advisory — it flags for human judgement and never silently alters a score.
Corrections are post-hoc administration, distinct from the Scorer's live
capture and from the Contest Director's penalty rulings.

### Business Value

- Provide the Organiser with a single cross-round view per pilot to find and
  fix capture errors in one place.
- Support automatic surfacing of outliers and missing scores before results
  are trusted.
- Enable defensible results — every correction attributable, locked
  competitions immune.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-007 (score computation to recompute against);
  captured or manually entered scores exist.
- **Data assumptions**: attribution means the audit record carries the
  originating client, the authority exercised, and the operator identity
  (event log, decisions.md D4).
- **Integration points**: corrections trigger recomputation of the affected
  group and final aggregate; flags clear via the correction path; lock state
  is the Contest Director's.
- **Business constraints**: the Organiser corrects captured task metrics —
  penalty rulings remain the Contest Director's.

### Scope In

- Per-pilot view of results across all rounds; correct a captured score;
  enter a missing result against the correct pilot and round.
- Outlier flagging against configurable limits, per pilot or overall;
  missing-score flagging for flown groups.
- Flag review: correct or confirm-genuine, clearing the flag; corrections
  blocked on a locked competition.

### Scope Out

- Live capture and the Scorer's on-device correction window (device scope).
- Penalty imposition (Contest Director, Area 5.9); lock itself (Area 2.2).
- Bulk manual entry / paper-fallback reconciliation (Area 5.8, separate
  operator function).

### Acceptance Criteria

#### AC1: Cross-round view per pilot
**Given** a competition with 6 flown rounds
**When** the Organiser opens pilot "Jane Smith"'s scores
**Then** her results across all 6 rounds are shown in one view.

#### AC2: Correction recomputes affected results
**Given** Jane Smith's round 2 flight time was captured as 540 s but should
be 450 s
**When** the Organiser corrects it
**Then** the change is recorded and results recompute for round 2's group and
for her final aggregate.

#### AC3: Missing result entered in place
**Given** round 4 has no result for pilot "John Brown" though his group flew
**When** the Organiser enters his result in the per-pilot view
**Then** it is stored against John Brown and round 4 and enters scoring
normally.

#### AC4: Corrections are attributable
**Given** any correction applied here
**When** the audit record is examined
**Then** it shows who changed what, under what authority, and from which
client, so the result remains defensible.

#### AC5: Locked competitions reject corrections
**Given** the Contest Director has locked the competition
**When** the Organiser attempts a correction
**Then** the system prevents it and says the competition is locked.

#### AC6: Outliers are flagged against configurable limits
**Given** an overall limit flagging flight times above 660 s, and a captured
time of 3 600 s (a stopwatch left running)
**When** scores are captured
**Then** the 3 600 s value is flagged as an outlier for review; **and given**
a per-pilot limit scope is chosen instead, **then** flagging honours that
scope.

#### AC7: Gaps are flagged
**Given** a flown group in which one pilot has no score
**When** the round is in progress or complete
**Then** the gap is flagged as missing.

#### AC8: Flags clear by correction or confirmation
**Given** a flagged outlier
**When** the Organiser corrects the value or confirms it is genuine
**Then** the flag clears; the system never alters the score on its own.

### INVEST Check

Independent (post-hoc administration over stored results) · Valuable
(trustworthy results before publication) · Small-ish (4 days, 3 functional
points: per-pilot review/correct, outlier+gap flagging, flag lifecycle) ·
Testable.
