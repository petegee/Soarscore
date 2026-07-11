# [STORY-001-013] Suspend at End of Day and Resume Next Morning

> Source: `docs/user-stories/01-organiser.md` §2.3 · `docs/requirements/high-level-requirements.md` Area 2.3 · `docs/requirements/decisions.md` D4, D7, D11
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Two-day events are routine (decisions.md D7). At the end of day one the
Organiser suspends the competition; the next morning it resumes exactly where
it stopped — completed rounds, captured scores, draw position and
round-in-progress status intact. Suspension happens between groups, never
inside a running group's working time; suspending mid-round (some groups
flown) is allowed with a warning. The system must also survive an unplanned
shutdown (e.g. base power loss) by reconstructing the correct contest state
from its immutable event log, treating a group that was running at the
moment of failure as aborted.

### Business Value

- Provide the Organiser with routine overnight continuity for two-day events.
- Support recovery from unplanned shutdowns without losing the contest.
- Enable an auditable record of every suspend and resume.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (competition lifecycle); meaningful once
  rounds/scores exist (STORY-001-007/009).
- **Data assumptions**: current state is derivable from the immutable event
  log (decisions.md D4); Scorer self-correction is group-bounded
  (decisions.md D11), so a group-boundary suspension never truncates it.
- **Integration points**: distinct from the Contest Director's in-group
  run-control pause (Area 6.5) and the Announcer's round advance (Area 6.4);
  post-failure acceptance of pen-and-paper results is the Contest Director's
  call (decisions.md D3).
- **Business constraints**: suspension only at group boundaries.

### Scope In

- Suspend a running competition at a group boundary; resume with all contest
  state intact.
- Mid-round suspension (round incomplete) with a warning, not a block;
  resume continues the round.
- Recovery from unplanned shutdown: state reconstructed from the event log;
  a group running at failure treated as aborted (restart from preparation,
  its metrics annulled) unless the Contest Director accepts pen-and-paper
  results for it.
- Suspend and resume recorded in the event log.

### Scope Out

- In-group run control (pause/abort of a live group) — Contest Director,
  Area 6.5.
- Backup/mirroring of the event log — accepted single-copy risk, Future
  Enhancement (decisions.md D4).

### Acceptance Criteria

#### AC1: Clean overnight suspend/resume
**Given** a two-day competition with rounds 1–4 complete and round 5 fully
scored, suspended at end of day one
**When** the Organiser resumes it the next morning
**Then** completed rounds, captured scores, draw position and
round-in-progress status are all intact and the contest continues from
exactly where it stopped.

#### AC2: Mid-round suspension warns but proceeds
**Given** round 5 in progress with 2 of 3 groups flown
**When** the Organiser suspends at the group boundary
**Then** the system warns the round is incomplete but does not block; on
resume, round 5 simply continues with the remaining group.

#### AC3: Group-boundary suspension truncates nothing
**Given** the same mid-round suspension and resume the next day
**When** the same round continues
**Then** the already-flown groups were closed to device edits at their group
boundary as normal, and changes to them remain available through base-side
score administration — the suspension removed no correction path.

#### AC4: Unplanned shutdown recovers correct state
**Given** the base station loses power without a clean suspend, while no
group is running
**When** the system restarts
**Then** it resumes into the correct contest state reconstructed from the
event log, with no captured score lost.

#### AC5: A group running at failure is treated as aborted
**Given** the base station fails while a group's working time is running
**When** the system restarts
**Then** that group is treated as aborted — it restarts from preparation with
its accumulated metrics annulled — unless the Contest Director instead
accepts pen-and-paper results for it.

#### AC6: Suspend and resume are logged
**Given** any suspend or resume
**When** it happens
**Then** it is recorded in the event log.

### INVEST Check

Independent (lifecycle behaviour over existing state) · Valuable (two-day
events are routine, D7) · Small-ish (4 days, 3 functional points: clean
suspend/resume, mid-round handling, crash recovery) · Testable.
