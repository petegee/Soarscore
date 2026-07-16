# [STORY-001-044] Start Every Group with One Deliberate Action

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.5.1 ·
> `docs/requirements/high-level-requirements.md` Area 6.5 · `docs/requirements/
> decisions.md` D10 (operator-driven progression) · `docs/requirements/rules/
> 00-general-rules.md` §1 · relates to STORY-001-040 (the phased sequence this
> starts), STORY-001-032 (the Contest Director's authority once a group is
> running), STORY-001-034 (the prep confirmation gate this exposes as a hold)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Every group — whether its task runs the automatic phased sequence
([STORY-001-040](%5BUser-story-40%5Dgroup-timer-engine-and-shared-clock.md))
or is manual-run (e.g. F3B Distance/Speed, F3K all-up) — begins with the same
single, deliberate action from the Announcer/Timekeeper: nothing starts
itself (D10). This story delivers that start action and its two outcomes,
which the Announcer/Timekeeper triggers identically either way, since
whether a task is sequence-driven or manual-run derives from the task type,
not from anything the operator chooses.

For a duration-shaped task, starting the group hands off to the phased
sequence (STORY-001-040): announce round/group → announce pilots →
preparation. For a manual-run task, starting the group marks it current and
gives Scorer devices their group context for normal capture, but runs no
automated countdown, callouts or prep-gate hold — the Announcer/Timekeeper
runs that field by hand. Either way, when the preparation phase's confirmation
gate is holding at one minute remaining because not every pilot has a
confirming device, that hold must be visible to the Announcer/Timekeeper —
so they know why the group hasn't progressed and who is outstanding — even
though only the Contest Director can release it (STORY-001-032).

### Business Value

- Let the Announcer/Timekeeper move the field only when they judge it ready,
  with one unambiguous action, matching the "hands busy, eyes on the field"
  need.
- Remove any decision burden about *how* to start a group — the same single
  action works whether the task is sequence-driven or manual-run.
- Make a stuck prep confirmation gate visible immediately, so the
  Announcer/Timekeeper isn't left wondering why a group hasn't moved.

### Dependencies and Assumptions

- **Prerequisites**: the previous group (if any) has ended its landing
  window or, for a manual-run task, its field-run is complete; the phased
  sequence engine exists to hand off to (STORY-001-040); the prep
  confirmation gate exists to expose as a hold ([5.0.4](../docs/user-stories/03-scorer.md#504--pre-group-confirmation-guard-blocks-entry-until-re-confirmed)).
- **Data assumptions**: whether the current group's task is duration-shaped
  or manual-run derives from the task type/configuration, not an operator
  choice (D10); the prep confirmation gate's hold state and the outstanding
  pilot(s)/device(s) are available to display.
- **Integration points**: for duration-shaped tasks, this action hands off
  to STORY-001-040's sequence; for manual-run tasks, it marks the group
  current and pushes group context to Scorer devices with no automated
  clock; the Contest Director's pause/fast-forward/add-time/abort/gate-
  release authority (STORY-001-032) acts on a group only after this start
  action.
- **Business constraints**: no group crosses its start boundary
  automatically (D10); the start action itself must require minimal,
  unambiguous interaction — a stated field need.

### Scope In

- One single, deliberate start action per group, usable identically
  regardless of whether the task is duration-shaped or manual-run.
- For a duration-shaped task: handing off to the automatic phased sequence
  (announce round/group → announce pilots → preparation) on start.
- For a manual-run task: marking the group current and giving Scorer devices
  their group context, with no automated countdown, callouts or prep-gate
  hold.
- Requiring the same repeated single action to start each subsequent group —
  no group, sequence-driven or manual-run, starts itself after the previous
  one ends.
- Displaying the prep confirmation gate's hold (which pilot(s)/device(s) are
  outstanding) when it is active, so the Announcer/Timekeeper can see why a
  group hasn't progressed.

### Scope Out

- The phased sequence's internal countdown/phase logic — STORY-001-040.
- The audio callouts and field board — STORY-001-041, STORY-001-042.
- Releasing the prep confirmation gate, pausing/fast-forwarding/adding time
  to preparation, and aborting a group — all Contest Director authority,
  STORY-001-032.
- The round-boundary score-completeness gate — STORY-001-043 (this story's
  group start is never score-gated; only the round advance is).
- The prep confirmation gate's own mechanics (device confirmation, exclusive
  claim per pilot) — STORY-001-034.

### Acceptance Criteria

#### AC1: A duration-shaped group starts its sequence with one action
**Given** a duration-shaped group (e.g. an F3J flight-time task) is ready
**When** the Announcer/Timekeeper starts it with the single start action
**Then** the sequence begins — announce round/group, announce pilots, then
preparation — with no further action needed to reach preparation.

#### AC2: A manual-run group starts with the same single action, no automation
**Given** the current group's task is manual-run (e.g. F3B Speed)
**When** the Announcer/Timekeeper starts it with the same single start action
**Then** the group is marked current and Scorer devices receive their group
context for normal capture, but no automated countdown, callouts or
prep-gate hold run.

#### AC3: The next group never starts itself
**Given** a duration-shaped group has finished its landing window (or a
manual-run group's field-run is complete)
**When** the next group is due
**Then** it does not begin on its own — the Announcer/Timekeeper starts it
with the same single action, whenever the field is ready.

#### AC4: The start action requires minimal, unambiguous interaction
**Given** a group is ready to start
**When** the Announcer/Timekeeper triggers the start action
**Then** it requires only one deliberate, unambiguous interaction — no
multi-step confirmation sequence — consistent with hands-busy, eyes-on-the-
field use.

#### AC5: A held prep confirmation gate is visible to the operator
**Given** the preparation countdown has paused at one minute remaining
because one pilot's device has not confirmed
**When** the Announcer/Timekeeper looks at the field aids
**Then** the hold is visibly shown, along with which pilot/device is
outstanding, even though only the Contest Director can release it
(STORY-001-032).

#### Non-Functional Expectations
- The start action carries no knowledge of any specific competition class —
  whether a group runs the automated sequence or is manual-run derives
  generically from the task's declared shape (CLAUDE.md class-model law).

### INVEST Check

Independent (a single start action and its two outcomes, distinct from the
sequence engine, authority actions and round gate it touches) · Valuable
(the zero-fuss, single-action control the field-side role fundamentally
needs) · Small (3 days, 3 functional points: duration-shaped start hand-off,
manual-run start with no automation, prep-gate hold visibility) · Testable
(both start outcomes, the never-auto-starts behaviour, and the hold's
visibility are all directly observable).
