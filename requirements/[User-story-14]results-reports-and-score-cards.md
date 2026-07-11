# [STORY-001-014] Results Reports and Per-Pilot Score Cards

> Source: `docs/user-stories/01-organiser.md` §7.1, §7.2/7.4 · `docs/requirements/high-level-requirements.md` Areas 7.1, 7.2, 7.4 · `docs/requirements/rules/00-general-rules.md` §5
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Results must be available at any stage of the event — after each round for
the pilots on the field, and as final classification when the contest ends.
The Organiser produces overall, positional, round-by-round, landing and
ranked views with scope filters and round-range selection, plus printable
per-pilot score cards showing a pilot's round-by-round breakdown. Final
classification must be presented winner first, with the class's drop-worst
applied and penalties retained. The Organiser produces reports; publishing
official results is the Contest Director's authority.

### Business Value

- Provide the Organiser (and through them, pilots) with results at any stage
  of the event, without internet.
- Support final classification that is rule-correct by construction
  (drop-worst applied, penalties retained, winner first).
- Enable per-pilot score cards so each pilot can see their own breakdown.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-007 (score computation), captured scores.
- **Data assumptions**: report content reflects the current corrected state
  (STORY-001-012) at the time of production.
- **Integration points**: publishing official results is the Contest
  Director's; PDF/CSV export, online publishing and email distribution are
  Future Enhancements; branding/customisation depth is light in the MVP.
- **Business constraints**: offline-first — no report may depend on internet.

### Scope In

- Results reports: overall, positional, round-by-round, landing and ranked
  views, with scope filters and round-range selection.
- Final-classification presentation rules: final order winner first,
  drop-worst applied, penalties retained.
- Per-round results available as the contest proceeds.
- Printable per-pilot score card / record; the light MVP layout
  customisation.

### Scope Out

- Draw reports and blank scoring sheets (STORY-001-015).
- Publishing official results — Contest Director authority.
- PDF/CSV export, online channels, email distribution, badges — Future
  Enhancements.

### Acceptance Criteria

#### AC1: Choose among the five report views
**Given** a competition with captured scores over 5 rounds
**When** the Organiser produces a results report
**Then** overall, positional, round-by-round, landing and ranked views are
available to choose from.

#### AC2: Filters and round range are honoured
**Given** a report scoped to pilot class "Open" and rounds 2–4
**When** the Organiser produces it
**Then** the output contains exactly the Open-class entrants and only rounds
2–4.

#### AC3: Final classification is rule-correct
**Given** an F5J competition with 6 flown rounds and a pilot carrying a
50-point penalty in a round that is also their lowest
**When** any final-classification output is produced
**Then** it is presented in final order winner first, the lowest round score
per pilot is dropped (F5J drops once more than 4 rounds are flown), and the
50-point penalty is still deducted from the aggregate despite its round
being dropped.

#### AC4: Mid-contest results as the event proceeds
**Given** rounds 1–3 complete and round 4 in progress
**When** the Organiser produces a report
**Then** each completed round's results (1–3) are available, without waiting
for the contest to finish.

#### AC5: Per-pilot score card
**Given** pilot "Jane Smith" with results in every flown round
**When** the Organiser produces her score card / record
**Then** it shows her per-round breakdown and is printable per pilot.

#### AC6: MVP layout customisation is reflected
**Given** a report layout with the branding/customisation available in the
MVP applied (e.g. the event name in the header)
**When** the report is produced
**Then** the output reflects that customisation.

### INVEST Check

Independent (read-only over computed results) · Valuable (results are the
product of the whole event) · Small-ish (4 days, 3 functional points: report
views+filters, final-classification rules, score cards/customisation) ·
Testable.
