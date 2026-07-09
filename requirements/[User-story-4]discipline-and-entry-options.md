# [STORY-001-004] Discipline Selection and Entry Options

> Source: `docs/user-stories/01-organiser.md` §3.2, §3.3 · `docs/requirements/high-level-requirements.md` Areas 3.2, 3.3
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

A competition's discipline (F3B, F3J, F3K, F5J, F5K or F5L) determines which
tasks exist, what data is captured and how scores compute — e.g. F3B
normalises its three tasks separately while the man-on-man classes produce
one group score. Choosing the discipline is therefore the pivotal
configuration step, and changing it after scores exist would invalidate
results. Separately, the Organiser toggles per-event entry options — start
numbers and pilot classes — that shape what each roster entry carries and how
results can be grouped.

### Business Value

- Provide the Organiser with a single choice that makes all downstream task
  and scoring configuration correct for the class being flown.
- Support per-event tailoring of entrant attributes (pilot numbers, pilot
  classes) without carrying fields the event doesn't use.
- Enable results grouped/ranked by pilot class where the event wants it.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (a competition exists to configure).
- **Data assumptions**: the six MVP disciplines and their task/rule sets are
  defined by the class rule docs (`docs/requirements/rules/`), which are
  authoritative on numbers.
- **Integration points**: discipline drives scoring options
  (STORY-001-007), task rules (STORY-001-008) and the draw; entry options
  drive roster attributes (STORY-001-005) and reports.
- **Business constraints**: MVP is individual-only — team entry and per-entry
  frequency are Future Enhancements.

### Scope In

- Select one of the six disciplines for a competition; the available tasks
  and rules become those of that discipline.
- Guard against discipline changes that would invalidate captured scores.
- Toggle **pilot numbers** and **pilot classes** entry options per
  competition.

### Scope Out

- The per-discipline task and scoring detail itself (STORY-001-007/008 and
  deferred per-discipline requirements).
- Team entry, `omit-from-team-score`, per-entry frequency — Future
  Enhancements.

### Acceptance Criteria

#### AC1: Discipline selection scopes available tasks and rules
**Given** a new competition
**When** the Organiser selects discipline F3K
**Then** the tasks and rules available for configuration are F3K's (e.g. its
task catalogue), not those of any other class.

#### AC2: Discipline change with captured scores is guarded
**Given** a competition with discipline F5J and scores already captured
**When** the Organiser attempts to change the discipline to F3J
**Then** the system prevents the change or requires explicit re-confirmation
that states it invalidates task configuration and results — never a silent
switch.

#### AC3: Pilot numbers option
**Given** a competition with the pilot-numbers option enabled
**When** the Organiser edits the roster and produces the draw or reports
**Then** each roster entry can carry a pilot number and it appears in the
draw and reports.

#### AC4: Pilot classes option
**Given** a competition with the pilot-classes option enabled and entrants
assigned classes "Open" and "Sportsman"
**When** results are produced
**Then** results can be grouped or ranked by those classes.

#### AC5: Disabled option removes the attribute
**Given** a competition where the Organiser disables pilot numbers
**When** the roster is viewed
**Then** the pilot-number attribute is no longer required or shown on
entries.

### INVEST Check

Independent of later stories · Valuable (correct class behaviour + tailored
entries) · Small (2 days, 2 functional points: discipline selection/guard +
entry-option toggles) · Testable.
