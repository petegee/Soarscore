# [STORY-001-015] Draw Reports and Blank Scoring Sheets

> Source: `docs/user-stories/01-organiser.md` §7.3 · `docs/requirements/high-level-requirements.md` Area 7.3 · `docs/requirements/decisions.md` D3
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Once the draw is accepted, the flying order must be clear on the field:
pilots read who flies when, in which group and lane. The Organiser produces
draw reports in multiple layouts and sort orders, and printable scoring
sheets. Although MVP capture is device-based, blank scoring sheets remain a
first-class output: they are the standing **pen-and-paper fallback kit**
(decisions.md D3) and must be printable in advance of any round so a device
or system failure never leaves the field without a way to record results.

### Business Value

- Provide the Organiser with field-ready flying-order output in the layout
  each audience needs.
- Support the pen-and-paper failure policy with scoring sheets printable
  before any round.
- Enable reprints that always reflect the current lane allocations.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (accepted draw), STORY-001-010 (lane
  adjustments to reflect), STORY-001-008 (task fields for scoring sheets).
- **Data assumptions**: printing happens from an operator machine; the
  system itself needs no internet.
- **Integration points**: sheets double as the manual-entry source after a
  paper fallback (Area 5.8); pilots consume the draw report on the field.
- **Business constraints**: offline-first.

### Scope In

- Draw reports over the accepted draw in multiple layouts and sort orders
  (by group, by pilot, by lane).
- Blank scoring sheets per group/round showing pilots and the task fields to
  be recorded, printable in advance of any round.
- Reprints reflecting current lane allocations.

### Scope Out

- Results reports and score cards (STORY-001-014).
- Manual entry of paper results (Area 5.8, operator function).
- Output channels beyond print-from-operator-machine — Future Enhancements.

### Acceptance Criteria

#### AC1: Multiple layouts and sort orders
**Given** an accepted draw for 6 rounds
**When** the Organiser produces a draw report
**Then** they can choose among layouts/sort orders including by group, by
pilot and by lane, and the output matches the accepted draw.

#### AC2: Scoring sheets carry the task's fields
**Given** an F5J competition (flight time, launch height, landing) and round
3, group B
**When** the Organiser produces scoring sheets
**Then** each sheet shows that group's pilots and the fields the task
requires to be recorded for round 3.

#### AC3: Sheets are printable in advance of any round
**Given** the draw is accepted but round 1 has not started
**When** the Organiser prints blank scoring sheets for every round
**Then** the sheets are produced — the paper fallback kit is ready before
flying begins.

#### AC4: Reprints reflect lane adjustments
**Given** a lane adjustment made after the first printing (Jane Smith moved
from lane 2 to lane 5 in round 3)
**When** the Organiser reprints the draw report
**Then** it shows the current lane allocations, including Jane Smith in
lane 5.

### INVEST Check

Independent (read-only over the draw + task configuration) · Valuable (field
clarity + the failure-policy kit) · Small (3 days, 2–3 functional points:
draw report layouts, scoring sheets, reprint currency) · Testable.
