# [STORY-001-040] Drive the Group's Phased Countdown from One Shared Clock

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.1.1, §6.1.2 ·
> `docs/requirements/high-level-requirements.md` Area 6.1 · `docs/requirements/
> decisions.md` D5 (end of working time does not stop the device stopwatch),
> D9 (per-flight timestamps on the base clock), D10 (operator-driven
> progression) · `docs/requirements/rules/00-general-rules.md` §2 · relates to
> STORY-001-032 (Contest Director's authority over this timer's preparation
> phase), STORY-001-038 (the Scorer device's read-only mirror of this clock),
> STORY-001-044 (the group-start action that begins this sequence)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Once a group is started ([STORY-001-044](%5BUser-story-44%5Dgroup-start-control-and-manual-run-tasks.md)),
its **duration-shaped** tasks run an automatic three-phase sequence —
**preparation**, **working time**, **landing window** — advancing from one
phase to the next with no Announcer/Timekeeper action in between. This story
delivers that phased-countdown engine and the **single shared clock** it runs
on: the same clock the field board ([STORY-001-042](%5BUser-story-42%5Dfield-display-board.md)),
the audio callouts ([STORY-001-041](%5BUser-story-41%5Daudio-callout-sequence.md))
and every Scorer device ([STORY-001-038](%5BUser-story-38%5Dscorer-device-phase-and-clock-mirror.md))
read from, so what the field sees, hears and captures on can never drift
apart.

Preparation and the landing window take their durations from the
per-competition field-aid settings ([3.8](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration));
working time takes its duration from the **current round's task**
([3.7](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
which may differ round to round. When working time reaches zero the engine
marks the end-of-working-time boundary the class rules cap countable flight
time against — it does **not** stop a Scorer's device stopwatch (D5); the
Scorer keeps timing to the model's first ground contact, and the engine's own
per-flight timestamps on this same clock (D9) let the system derive any
overfly later, downstream of this story.

### Business Value

- Let a duration-shaped group fly to one automatic, visible timeline instead
  of the Announcer/Timekeeper driving each phase transition by hand.
- Guarantee the board, the audio and every Scorer device can never show a
  different phase or time from one another, because all three read the same
  clock.
- Feed the per-flight, base-clock timestamps the downstream overfly/cap
  derivation (D5/D9) depends on, without the timer itself judging or scoring
  anything.

### Dependencies and Assumptions

- **Prerequisites**: a group has been started ([STORY-001-044](%5BUser-story-44%5Dgroup-start-control-and-manual-run-tasks.md));
  the current round's task and its working-time duration, and the
  per-competition preparation/landing-window durations ([3.7](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)/[3.8](../docs/requirements/high-level-requirements.md#area-3--competition-setup--configuration)),
  are already configured.
- **Data assumptions**: whether a task is duration-shaped (runs this sequence)
  or manual-run (does not) derives from the task type, not configuration
  (D10) — a manual-run group's handling is STORY-001-044's, not this story's.
- **Integration points**: the Contest Director's preparation-only
  pause/fast-forward/add-time/abort authority (STORY-001-032) acts directly on
  this engine's preparation phase; the board, audio and Scorer devices are
  read-only consumers of the clock this story produces.
- **Business constraints**: working time and the landing window run to their
  configured durations and are never paused or shortened by this story (only
  the Contest Director's abort reaches them, STORY-001-032); the core stays
  class-agnostic (CLAUDE.md) — durations are read from configuration, never
  hard-coded per class.

### Scope In

- Advancing a duration-shaped group automatically through preparation →
  working time → landing window with no manual trigger between phases.
- Reading preparation and landing-window durations from the per-competition
  field-aid settings, and working-time duration from the current round's
  task.
- Marking the end-of-working-time boundary at zero without stopping Scorer
  device timing.
- Stamping each phase transition and each flight's start/stop on the shared
  clock (D9), for downstream cap/overfly derivation to consume.
- Exposing one shared clock (round, group, phase, remaining time) that the
  board, audio and Scorer devices all read from.
- Resetting the clock cleanly for each new group with no leftover state from
  the previous group's run.

### Scope Out

- The board's presentation of the clock — STORY-001-042.
- The audio callouts fired on phase/time changes — STORY-001-041.
- The Scorer device's mirror of the clock — STORY-001-038.
- The Contest Director's pause/fast-forward/add-time/abort authority over
  preparation, and the prep confirmation gate's release — STORY-001-032.
- The deliberate action that starts a group, and manual-run task handling —
  STORY-001-044.
- Deriving overflies, caps or bonus conversions from the stamped
  timestamps — downstream scoring (Area 5), not this timer.

### Acceptance Criteria

#### AC1: The phases advance automatically in order
**Given** a duration-shaped group has been started
**When** its sequence runs
**Then** it counts down preparation, then working time, then the landing
window, each flowing into the next with no manual trigger between them.

#### AC2: Durations come from configuration, not a fixed value
**Given** round 3's task specifies an 8-minute working time and the
competition's field-aid settings specify a 5-minute preparation and a
3-minute landing window
**When** round 3's group runs its sequence
**Then** preparation counts down 5 minutes, working time counts down 8
minutes, and the landing window counts down 3 minutes — and a later round
with a 10-minute working-time task uses 10 minutes without any manual
retiming.

#### AC3: End of working time is marked without stopping device timing
**Given** working time reaches zero while a competitor's model is still
airborne
**When** the boundary is reached
**Then** the engine marks the end-of-working-time boundary and stamps it on
the shared clock, while the Scorer's device continues timing to first ground
contact unaffected.

#### AC4: Phase transitions and flight events are timestamped on the shared clock
**Given** a flight starts and later ends during working time
**When** each event occurs
**Then** it is stamped against the same shared clock as the phase
transitions, so downstream cap/overfly derivation has a single consistent
timeline to work from.

#### AC5: One clock feeds the board, audio and devices identically
**Given** a group is running
**When** the phase or remaining time changes
**Then** the board, the audio callouts and every Scorer device all reflect
the same phase and remaining time, because all three read this one clock.

#### AC6: The clock resets cleanly between groups
**Given** a group's landing window has ended
**When** the next group is started
**Then** the clock resets with no leftover phase, time or flight state from
the previous group's run.

#### Non-Functional Expectations
- The timer engine carries no knowledge of any specific competition class —
  it reads whatever durations the current round's task and the
  per-competition field-aid settings declare (CLAUDE.md class-model law).
- The engine runs entirely on the Base Station, offline (D6).

### INVEST Check

Independent (a self-contained clock/phase engine consumed by, but separable
from, the board, audio and device mirror) · Valuable (the one automatic
timeline every field surface depends on) · Small (4 days, 3 functional
points: automatic phase advance with configured durations, end-of-working-time
marking + timestamping, the shared-clock reset between groups) · Testable
(phase order and durations, the end-of-working-time boundary, and the clean
reset are all directly observable).
