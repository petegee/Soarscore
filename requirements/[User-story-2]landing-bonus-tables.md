# [STORY-001-002] Reusable Landing-Bonus Table Management

> Source: `docs/user-stories/01-organiser.md` §1.2 · `docs/requirements/high-level-requirements.md` Area 1.2
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

Several glider classes award landing bonus points based on how far the model's
nose comes to rest from an allocated landing spot. Each class's rules mandate
a specific distance→points table (e.g. F3J's table runs from 100 points at
≤ 0.2 m down to 0 beyond 15 m; F5J's coarser table runs 50 points at ≤ 1 m
down to 0 beyond 10 m). The Organiser needs to define these tables once, as
named master data, and let any competition select one — without re-keying the
table per event and without needing to understand the scoring maths.

### Business Value

- Provide the Organiser with named, reusable distance→points tables selectable
  by any competition.
- Support correct landing-bonus scoring in the classes that use landings
  (F3B, F3J, F5J, F5L) without per-event re-entry.
- Enable safe table maintenance without corrupting competitions that already
  reference a table.

### Dependencies and Assumptions

- **Prerequisites**: none (parallel to STORY-001-001).
- **Data assumptions**: tables start empty; the class-mandated tables from the
  rule docs (`docs/requirements/rules/`) are the expected reference content.
- **Integration points**: selected per task by per-task scoring configuration
  (STORY-001-008).
- **Business constraints**: not every task uses landings — F3K and F5K score
  flight time only, so a table must never be forced on such tasks.

### Scope In

- Create, name, view, edit, duplicate and delete landing-bonus tables holding
  a set of distance → points entries.
- Deletion protection for tables referenced by a competition.
- Tables are optional for tasks that score flight time only.

### Scope Out

- Applying the table during score computation (scoring stories).
- Selecting a table for a specific task (STORY-001-008).
- The rule-default guardrail warning on deviating tables (STORY-001-007).

### Acceptance Criteria

#### AC1: Create a named table
**Given** the master data area
**When** the Organiser creates a table named "F3J standard" with entries
"≤ 0.2 m → 100, 1.0 m → 96, 15 m → 30, over 15 m → 0" (and the rows between)
**Then** the table is saved under that name and its entries are shown exactly
as entered, available for later selection by any competition.

#### AC2: Edit an existing table
**Given** the "F3J standard" table exists
**When** the Organiser changes the 15 m entry from 30 to 25 points and saves
**Then** the stored table reflects 25 points at 15 m.

#### AC3: Duplicate as a new table
**Given** the "F3J standard" table exists
**When** the Organiser duplicates it and saves the copy as "Club short-field"
**Then** both tables exist independently; editing one does not change the
other.

#### AC4: Deletion of a referenced table is prevented
**Given** a competition has selected the "F3J standard" table
**When** the Organiser attempts to delete that table
**Then** the system prevents the deletion (or preserves the competition's
reference) and tells the Organiser why.

#### AC5: Time-only tasks need no table
**Given** a competition configured with a task that scores flight time only
(e.g. an F3K task)
**When** the Organiser sets up that competition
**Then** selecting a landing table is not required and its absence is not
reported as an error.

> **Scope note:** the save-time assertion in AC5 lives at the task-configuration
> surface, which is owned by STORY-001-008 — this story has no competition/task
> config to exercise it against. Within STORY-001-002, AC5 reduces to *a table
> can exist independently of any task* (a table is never forced into being).
> STORY-001-008 owns "no table is demanded at save for a time-only task."

### INVEST Check

Independent · Valuable (removes per-event table re-entry) · Small (2 days,
2 functional points: table CRUD + referential protection) · Testable.
