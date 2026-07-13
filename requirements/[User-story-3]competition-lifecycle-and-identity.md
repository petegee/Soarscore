# [STORY-001-003] Competition Lifecycle — Create, Open, Delete, Identity

> Source: `docs/user-stories/01-organiser.md` §2.1, §3.1 · `docs/requirements/high-level-requirements.md` Areas 2.1, 3.1
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Each event is a distinct competition object with its own identity (name,
venue, date), configuration, roster, draw and results, managed over its whole
lifetime: created before the event, opened for work, and possibly deleted.
Several competitions coexist (last month's event, this weekend's), so opening
one must never leak data into another. Deletion is only ever a **Setup**-stage
action: once proceedings start the competition can no longer be deleted — it
ends via Lock / no-contest instead — and a locked competition (terminal) is
likewise not deletable. This keeps captured results from ever being destroyed.

### Business Value

- Provide the Organiser with distinct, re-openable competition objects so each
  event is managed independently over one or two days.
- Support guarded deletion so captured results are never destroyed by
  accident.
- Enable the rest of setup (discipline, roster, draw) to hang off a clearly
  identified competition.

### Dependencies and Assumptions

- **Prerequisites**: none of module 001; template seeding is deferred to
  STORY-001-006.
- **Data assumptions**: locked state is set by the Contest Director (out of
  Organiser scope); this story only respects it.
- **Integration points**: all later configuration stories operate on the
  competition created here.
- **Business constraints**: MVP covers qualifying-round competitions only —
  fly-offs are a Future Enhancement. All mutations are audit-recorded.

### Scope In

- Create a competition capturing **name, venue and date**; name and date must
  be present before dependent configuration proceeds. (STORY-001-004 adds
  **discipline** to the create step as a required field.)
- Open one of several competitions and work against its data in isolation.
- Delete a competition, with explicit confirmation, **only while it is still in
  Setup** (proceedings not yet started); blocked once Running/Suspended/Locked.

### Scope Out

- Lock — Contest Director authority (respected here, implemented in
  STORY-001-026); Locked is a terminal state, so there is no unlock.
- Template seeding (STORY-001-006) and all further configuration
  (STORY-001-004 onward).
- Suspend/resume across days (STORY-001-013).

### Acceptance Criteria

#### AC1: Create a competition with its identity
**Given** the system with no competitions
**When** the Organiser creates a competition named "Levin Autumn F5J", venue
"Levin field", date 2026-08-15
**Then** the competition exists as a distinct object with those details and
can be closed and re-opened later with them intact.

#### AC2: Name and date are required before configuration
**Given** a new competition with a blank name or no date
**When** the Organiser attempts to proceed to configuration that depends on
identity
**Then** the system requires name and date to be present first and says which
is missing.

#### AC3: Competitions are isolated
**Given** two competitions "Levin Autumn F5J" and "Hamilton Winter F3K", each
with its own roster
**When** the Organiser opens "Levin Autumn F5J"
**Then** only that competition's data is visible and editable; nothing done
there changes "Hamilton Winter F3K".

#### AC4: Delete an unlocked competition after confirmation
**Given** an unlocked competition with no captured scores
**When** the Organiser deletes it and confirms the irreversible action
**Then** the competition and its data are removed.

#### AC5: A competition past setup cannot be deleted
**Given** a competition whose proceedings have started (Running or Suspended) —
so scores may have been captured
**When** the Organiser attempts to delete it
**Then** the system prevents the deletion and tells the Organiser that a
competition that has started can no longer be deleted; ending it happens via
Lock / no-contest ([2.3](../docs/requirements/high-level-requirements.md#area-2--competition-lifecycle)),
not deletion. Deletion is legal only while the competition is still in **Setup**
([state machine](../docs/requirements/high-level-requirements.md#competition-lifecycle-state-machine)).

#### AC6: A locked competition cannot be deleted
**Given** a competition the Contest Director has locked
**When** the Organiser attempts to delete it
**Then** the system prevents the deletion and tells the Organiser the
competition is locked (a terminal state).

### INVEST Check

Independent (first competition-scoped story) · Valuable (events as managed
objects) · Small (3 days, 3 functional points: create+identity, open/isolate,
guarded delete) · Testable.
