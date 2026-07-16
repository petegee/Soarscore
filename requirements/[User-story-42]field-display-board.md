# [STORY-001-042] Show Round, Group, Phase and Remaining Time on the Field Display Board

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.3.1 ·
> `docs/requirements/high-level-requirements.md` Area 6.3 · `docs/
> architecture/logical-architecture.md` Field Aids node · relates to
> STORY-001-040 (the shared clock this board displays), STORY-001-041 (the
> audio callouts driven by the same clock)
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

The field always has a large, bright, daylight-readable display board and
loudspeaker set, both driven by the Base Station — the Base Station itself is
headless, and no one should need to crowd an operator's companion-app screen
to know where the group is. This story delivers the board's content: the
current round and group, the current phase (preparation / working time /
landing window) and the remaining time of that phase, read straight from the
shared clock ([STORY-001-040](%5BUser-story-40%5Dgroup-timer-engine-and-shared-clock.md)).

Pilot names and flying order are announced by audio
([STORY-001-041](%5BUser-story-41%5Daudio-callout-sequence.md)), not shown on
the board — this is a confirmed decision, not an omission. The board carries
round/group, phase and the clock only, and is read-only: it does not let
anyone edit the draw or flying order.

### Business Value

- Let every pilot and helper on the field see, at a glance and in daylight,
  which round/group is current, what phase it's in, and how much time is
  left.
- Keep the field aids uncluttered — the board shows only what a glance needs,
  leaving pilot identification to the audio callouts.
- Avoid making anyone crowd the operator's own screen just to check where the
  group is.

### Dependencies and Assumptions

- **Prerequisites**: the shared clock and phased sequence exist to display
  (STORY-001-040).
- **Data assumptions**: round, group, phase and remaining time are all
  Base-Station-authoritative and pushed to the board; no other data (pilot
  names, flying order) is required on this surface.
- **Integration points**: the board is a read-only consumer of the shared
  clock; it never accepts input or edits the draw/flying order (Area 4, the
  Organiser's).
- **Business constraints**: the board must be legible at a glance from the
  flight line in daylight — a stated field need
  ([users.md §4](../docs/requirements/users.md#4-announcer--timekeeper-field-aid-operator));
  exact layout, size, colours and hardware are not designed here.

### Scope In

- Displaying the current round and group.
- Displaying the current phase (preparation / working time / landing
  window).
- Displaying the remaining time (mm:ss) of the current phase.
- Following the shared clock's round/group/phase/time changes without
  showing a stale value.
- Presenting large enough, legible enough content to be read at a glance from
  the flight line in daylight.

### Scope Out

- Pilot names and flying order — announced by audio only
  (STORY-001-041), never shown on the board.
- The shared clock and phased sequence themselves — STORY-001-040.
- The audio callout sequence — STORY-001-041.
- Any control affordance — the board is read-only; it never edits the draw,
  flying order or run control.
- Exact visual design, board hardware, colours or physical placement.

### Acceptance Criteria

#### AC1: The board shows round, group, phase and remaining time
**Given** Round 4 Group C is running its working-time phase with 3 minutes 20
seconds remaining
**When** the board is shown
**Then** it presents "Round 4, Group C", "Working Time" and "03:20", all
sourced from the Base Station's shared clock.

#### AC2: The board is legible at a glance from the flight line
**Given** a pilot or helper is standing at the flight line in daylight
**When** they glance at the board
**Then** the round/group, phase and remaining time are large and legible
enough to read without walking closer — the stated field need.

#### AC3: The board follows changes, never showing a stale value
**Given** the group's phase changes from preparation to working time, or the
round/group advances to the next
**When** that change happens on the shared clock
**Then** the board updates to reflect the new phase/group promptly, rather
than continuing to show the previous one.

#### AC4: The board carries no pilot names or flying order
**Given** a group's pilots have been announced by audio
**When** the board is shown
**Then** it does not list pilot names or flying order — it shows round/group,
phase and the clock only.

#### Non-Functional Expectations
- The board's content must remain readable in direct daylight from the
  flight line — the stated need this story exists to satisfy.

### INVEST Check

Independent (a read-only display fed by an existing shared clock) · Valuable
(the single glanceable surface the whole field relies on for round/group/
phase/time) · Small (2 days, 2 functional points: displaying round/group/
phase/time + following live changes, daylight legibility) · Testable
(displayed values, update timing and the absence of pilot names are all
directly observable).
