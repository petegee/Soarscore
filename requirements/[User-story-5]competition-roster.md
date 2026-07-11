# [STORY-001-005] Build and Edit the Competition Roster

> Source: `docs/user-stories/01-organiser.md` §3.4 · `docs/requirements/high-level-requirements.md` Area 3.4
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

The roster is the list of who is flying this competition. It is built from
the master pilot library so entering an event means picking known pilots, not
re-typing details. Each roster entry carries this competition's per-entry
attributes (pilot number, pilot class — as enabled by the entry options).
Before the draw is generated the roster changes freely; after the draw, a
withdrawal is handled by replacing the entrant in their existing draw slot
rather than re-drawing the whole event. Pilots confirm their own entry
details by reading the roster.

### Business Value

- Provide the Organiser with fast roster building from known pilots for
  fields of up to 20.
- Support per-competition attribute edits that never leak back into master
  pilot records or other events.
- Enable late entrant replacement without destroying an accepted draw.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-001 (pilot library), STORY-001-003
  (competition), STORY-001-004 (entry options define which attributes exist).
- **Data assumptions**: the draw, when it exists, was produced by
  STORY-001-009; pilot retirement is a Contest Director action reflected
  here, not performed here.
- **Integration points**: the roster feeds the draw (STORY-001-009) and all
  scoring and reports.
- **Business constraints**: individual-only MVP; retirement (5.5) and
  re-draws are Contest Director authority.

### Scope In

- Add master pilots to a competition as roster entries; remove them freely
  before the draw exists.
- Edit per-entry attributes (e.g. pilot number, class) scoped to this
  competition only.
- Replace an entrant after the draw exists, inheriting the withdrawn pilot's
  draw slot, with a warning.
- Reflect a Contest-Director-retired pilot's state in the roster.

### Scope Out

- Retiring pilots and re-drawing remaining rounds — Contest Director
  authority (Area 5.5).
- Team entries and per-entry frequency — Future Enhancements.
- Draw generation itself (STORY-001-009).

### Acceptance Criteria

#### AC1: Build the roster from the library
**Given** a pilot library holding 25 pilots and a new competition
**When** the Organiser adds 14 of them to the competition
**Then** each becomes a roster entry carrying the per-entry attributes the
competition's entry options enable (e.g. pilot number, class).

#### AC2: Per-entry edits stay in this competition
**Given** roster entry "Jane Smith" with pilot number 7 in this competition
**When** the Organiser changes her pilot number to 12
**Then** the change applies to this competition only; her master pilot record
and her entries in other competitions are unchanged.

#### AC3: Free roster changes before the draw
**Given** the draw has not been generated
**When** the Organiser adds two entrants and removes one
**Then** the roster updates freely with no warnings about the draw.

#### AC4: Replacement after the draw inherits the slot
**Given** a generated draw and entrant "John Brown" withdrawing
**When** the Organiser replaces him with "Ken White"
**Then** Ken White takes John Brown's place in every round of the existing
draw (groups and lanes), and the Organiser is warned that draw and lane
allocations are affected.

#### AC5: Retired pilots are visible and not silently re-added
**Given** a pilot the Contest Director has retired from the competition
**When** the Organiser views the roster
**Then** the entry shows its retired state, and re-adding or reactivating the
pilot is not possible as a silent side effect of ordinary roster editing.

### INVEST Check

Independent (consumes, not extends, earlier stories) · Valuable (the field
list every event needs) · Small (3 days, 3 functional points: build/edit,
post-draw replacement, retired-state respect) · Testable.
