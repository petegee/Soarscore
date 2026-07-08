# [STORY-001-001] Master Pilot Library Management

> Source: `docs/user-stories/01-organiser.md` §1.1 · `docs/requirements/high-level-requirements.md` Area 1.1
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

Soarscore runs radio-control glider competitions for a small, trusted NZ club
group. The same pilots attend event after event. Today an organiser re-types
every pilot's details for every contest. A reusable pilot library, held
independently of any single competition, lets the Organiser build an event
roster from known pilots in minutes. Master data is the foundation every
competition roster is built on, so it is the natural first story.

### Business Value

- Provide the Organiser with a reusable library of pilot records so event
  setup does not start from scratch each time.
- Support fast, error-free roster building for events of up to 20 pilots.
- Enable safe editing of pilot details without silently rewriting historical
  competition results.

### Dependencies and Assumptions

- **Prerequisites**: none — this is the first story of the module.
- **Data assumptions**: no pre-existing pilot data; the library starts empty.
- **Integration points**: consumed later by competition rosters
  (STORY-001-005). Roster import from external files is a Future Enhancement.
- **Business constraints**: club-level trust model — no authentication; every
  change is recorded in the system's audit trail (event log, decisions.md D4).

### Scope In

- Create, view, edit and delete pilot records in a shared master library.
- Required and optional attributes: **name required**; registration ID, club
  and contact **optional**.
- Deletion protection for pilots referenced by any competition roster.

### Scope Out

- Competition rosters themselves (STORY-001-005).
- Pilot frequency, models/devices, country codes, roles — Future Enhancements.
- Roster import from external files — Future Enhancement.

### Acceptance Criteria

#### AC1: Add a pilot with minimal details
**Given** an empty pilot library
**When** the Organiser adds a pilot named "Peter Glassey" with no other details
**Then** the pilot is saved and appears in the library with name "Peter
Glassey" and empty registration ID, club and contact.

#### AC2: Add a pilot with full details
**Given** the pilot library
**When** the Organiser adds "Jane Smith" with registration ID "NZL-4021", club
"Levin MAC" and contact "jane@example.com"
**Then** all four attributes are stored and shown when the record is viewed.

#### AC3: Name is mandatory
**Given** the add-pilot form
**When** the Organiser attempts to save a pilot with an empty name
**Then** the system rejects the save and tells the Organiser a name is
required; no record is created.

#### AC4: Edit does not disturb existing competition rosters
**Given** pilot "Jane Smith" exists and is already on the roster of a
completed competition
**When** the Organiser changes her club from "Levin MAC" to "Wellington Soar"
**Then** the master record shows the new club wherever the library is browsed,
and the completed competition's stored roster and results are unchanged.

#### AC5: Delete an unreferenced pilot
**Given** a pilot who has never been added to any competition
**When** the Organiser deletes them
**Then** the record is removed from the library and no longer appears.

#### AC6: Deletion of a referenced pilot is prevented
**Given** a pilot who is on at least one competition roster
**When** the Organiser attempts to delete them
**Then** the system prevents the deletion (or retires the record without
breaking existing rosters) and tells the Organiser which competitions
reference the pilot.

#### AC7: Same-name pilots stay distinguishable
**Given** two pilots both named "John Brown", one with club "Levin MAC" and
one with club "Hamilton MAC"
**When** the Organiser views the library
**Then** both records are listed and can be told apart by their optional
attributes.

### INVEST Check

Independent (no prerequisites) · Valuable on its own (reusable data entry) ·
Small (2 days, 2 functional points: pilot CRUD + referential protection) ·
Testable (ACs above are QA-executable without source access).
