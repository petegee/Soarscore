# [STORY-001-038] Mirror the Group's Phase and Clock on the Scorer Device

> Source: `docs/user-stories/03-scorer.md` §5.1.4 ·
> `docs/requirements/high-level-requirements.md` Area 5.1, Area 6 (Display,
> Timer & Audio) · `docs/requirements/decisions.md` D6 (offline-first) ·
> relates to STORY-001-032 (the run-control authority this display never
> exposes)
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

The Base Station drives a group's shared clock — round, group, current phase
(preparation / working time / landing window) and the remaining countdown —
for the field board, the audio callouts, and every Scorer device. This story
gives the Scorer device a **read-only mirror** of that state, so a Scorer can
follow where the group is without looking away to the field board.

The mirror must never present stale information as if it were live: if the link
to the base drops, the device keeps counting locally from the last known state
and shows a visible out-of-sync indication, reconciling once the link returns.
The device offers no control over the clock — starting, pausing or advancing a
phase belongs to the Announcer/Timekeeper and the Contest Director's run-control
authority (STORY-001-032).

### Business Value

- Let a Scorer follow the group's timing without diverting attention from the
  flight to the field board.
- Keep every device's view of "where we are" consistent with the board and
  audio callouts, driven from one shared clock.
- Make a lost link visible immediately rather than silently showing a frozen or
  wrong time as if it were current.

### Dependencies and Assumptions

- **Prerequisites**: the Base Station's shared clock and phased sequence exist
  to be mirrored (Area 6.1 — the driving capability itself is assumed here, not
  built by this story).
- **Data assumptions**: round, group, current phase and remaining countdown are
  all base-station-authoritative and pushed to devices.
- **Integration points**: strictly read-only — the device never issues a
  start/pause/advance command; those actions belong to the Announcer/Timekeeper
  and the Contest Director's run-control authority (STORY-001-032).
- **Business constraints**: offline-first (D6) — the device keeps counting
  locally on a lost link rather than freezing or going blank.

### Scope In

- Mirroring round, group, current phase (prep / working / landing) and
  remaining countdown from the base's shared clock.
- Following phase changes promptly as they occur.
- Continuing to count locally from the last known state on a lost link, with a
  visible out-of-sync / last-updated indication, reconciling when the link
  returns.
- Read-only presentation only, with no control affordance on the device.

### Scope Out

- Driving the clock, phases or callouts themselves — Area 6.1/6.2, not yet
  their own stories.
- Starting, pausing, fast-forwarding or adding time to a phase —
  STORY-001-032 (Contest Director run-control).
- The field display board and audio callouts — Area 6.2/6.3.

### Acceptance Criteria

#### AC1: The device mirrors round, group, phase and countdown
**Given** round 4 group 2 is running its working-time phase with 3 minutes 20
seconds remaining on the base's shared clock
**When** I look at my device
**Then** it shows round 4, group 2, "working time" and a countdown matching the
shared clock.

#### AC2: Phase changes follow promptly
**Given** the group's phase changes from preparation to working time
**When** the change happens on the base's shared clock
**Then** my device's display follows promptly, matching what the field board
and audio callouts show.

#### AC3: A lost link is shown, not hidden
**Given** my device loses its link to the base station mid-group
**When** the link drops
**Then** my device keeps counting from the last known state and shows an
out-of-sync / last-updated indication, rather than presenting a frozen or wrong
time as if it were live.

#### AC4: Reconciliation on reconnect
**Given** my device was showing an out-of-sync indication after a dropped link
**When** the link is restored
**Then** the device reconciles to the base's current state and the
out-of-sync indication clears.

#### AC5: The display offers no control
**Given** the phase/clock display is showing
**When** I interact with my device
**Then** I cannot start, pause or advance the group clock from it — those
actions belong to the Announcer/Timekeeper and Contest Director elsewhere.

#### Non-Functional Expectations
- The mirrored display must let a Scorer know the current phase and remaining
  time without needing to look at the field board.

### INVEST Check

Independent (a read-only display fed by an existing shared clock) · Valuable
(keeps a Scorer's attention on the flight while staying synchronised with the
field) · Small (2 days, 2 functional points: live mirror + prompt phase
changes, lost-link handling + reconciliation) · Testable (mirrored values,
phase-change timing, and the out-of-sync indication are all directly
observable).
