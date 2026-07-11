# [STORY-001-003] Competition Lifecycle — Create, Open, Delete, Identity

> Source: `docs/user-stories/01-organiser.md` §2.1, §3.1 · `docs/requirements/high-level-requirements.md` Areas 2.1, 3.1
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Each event is a distinct competition object with its own identity (name,
venue, date), configuration, roster, draw and results, managed over its whole
lifetime: created before the event, opened for work, and possibly deleted.
Several competitions coexist (last month's event, this weekend's), so opening
one must never leak data into another. Deleting a competition that holds real
results is destructive and needs guarding; a competition the Contest Director
has locked must not be deletable at all.

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
- Delete a competition, with explicit confirmation, unless it is locked.

### Scope Out

- Lock/unlock — Contest Director authority (respected, not implemented here).
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

#### AC5: Deleting a competition with captured scores needs explicit confirmation
**Given** an unlocked competition in which scores have been captured
**When** the Organiser requests deletion
**Then** the system warns that deletion destroys results and proceeds only on
an explicit confirmation naming that consequence.

#### AC6: A locked competition cannot be deleted
**Given** a competition the Contest Director has locked
**When** the Organiser attempts to delete it
**Then** the system prevents the deletion and tells the Organiser the
competition is locked.

### INVEST Check

Independent (first competition-scoped story) · Valuable (events as managed
objects) · Small (3 days, 3 functional points: create+identity, open/isolate,
guarded delete) · Testable.
