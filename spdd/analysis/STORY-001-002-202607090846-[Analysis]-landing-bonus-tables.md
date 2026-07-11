# SPDD Analysis: Reusable Landing-Bonus Table Management

## Original Business Requirement

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

### INVEST Check

Independent · Valuable (removes per-event table re-entry) · Small (2 days,
2 functional points: table CRUD + referential protection) · Testable.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Master data (event scope `"master-data"`)**: the append-only event log
  already carries a `"master-data"` scope, currently used by the Pilot
  library. Landing-bonus tables are the second master-data concept and slot
  into the same scope and the same event-sourcing machinery (append → apply
  → in-memory projection).
- **Pilot library (vertical slice)**: not a landing concept, but the
  **structural precedent** this story mirrors almost exactly — `shared`
  domain types + Zod schemas, an `EventStore` append, a rebuildable
  in-memory projection, a service enforcing invariants, Fastify routes, and a
  React companion screen. Landing tables are the same shape with a different
  entity.
- **`CompetitionRef` (`packages/shared/src/errors.ts`)**: an already-defined
  `{ id, name }` reference type, introduced for pilot deletion protection and
  directly reusable to name the competitions that block a table deletion.
- **Reference-checker seam (`RosterReferenceChecker` / `NoRostersYetChecker`)**:
  the existing pattern for "protect a master-data entity from deletion while a
  not-yet-built feature may reference it." The pilot slice injects a checker
  that returns `[]` until rosters exist (STORY-001-005). Landing tables need
  the identical seam for competition references (which arrive with
  STORY-001-008), so this concept is a *pattern* to clone, not reuse verbatim.
- **Attribution / immutable event log (D4)**: every mutation carries
  `{ actorName, originClient, authority }` and is appended immutably; landing
  table mutations inherit this unchanged.
- **Landing-bonus table (domain, defined in rule docs)**: the sport concept
  already exists authoritatively in `docs/requirements/rules/` — F3J
  (`F3J.10.5`, fine 0.2 m steps, 100→0 by 15 m), F5J (`5.5.11.12 h`, coarser
  whole-metre, 50→0 by 10 m), F3B Task A (`F3B.2.3 d`, whole-metre 100→0 by
  15 m), and F5L (shares the finer F3J-style table). These are the expected
  *content* an Organiser will key in; the software concept is a container for
  them.

### New Concepts Required

- **LandingBonusTable**: named master-data entity owning an ordered set of
  distance→points entries — the core new aggregate. Relates to master data
  the same way `Pilot` does; will later be *referenced by* a task's scoring
  configuration (STORY-001-008).
- **LandingBonusEntry (distance → points)**: the repeated element inside a
  table. This is the one genuinely new structural wrinkle versus the flat
  Pilot record: the entity owns a **collection**, and the collection carries
  boundary semantics ("≤ first distance", "over last distance → 0") that must
  be *storable and displayable verbatim* even though their scoring
  interpretation is out of scope here.
- **TableReferenceChecker seam (new instance of the existing pattern)**: a
  checker answering "which competitions reference this table?", with a
  `NoTaskConfigYetChecker`-style stub returning `[]` until STORY-001-008
  introduces per-task table selection.
- **Landing-table event types**: new event payloads for created / updated /
  deleted (and the duplicate operation, which is a create), analogous to the
  `pilot.*` events.

### Key Business Rules

- **Referential deletion protection (AC4)**: a table referenced by any
  competition must not be deleted; the Organiser is told which competitions
  block it. Governs `LandingBonusTable` ↔ competition/task-config.
- **Independent duplication (AC3)**: a duplicate is a fully independent new
  table; edits to one must never mutate the other. Governs
  `LandingBonusTable` identity/copy semantics.
- **Verbatim persistence & display (AC1, AC2)**: entries are stored and shown
  exactly as entered, including the ≤-first and over-last boundary rows; this
  story does **not** interpret, round, or band them (that is scoring scope).
- **Tables are optional (AC5, business constraint)**: landing tables must
  never be mandatory; time-only tasks (F3K, F5K) require none. In *this*
  story that manifests only as "a table can exist independently of any task";
  the enforcement of optionality at save lives in STORY-001-008.
- **Additive extensibility (NFR-2)**: the table model must hold every
  landing-using class's numbers (fine 0.2 m F3J/F5L, whole-metre F3B, coarse
  F5J) without per-class branching — one generic distance→points container.
- **Immutable audit (D4)**: every create/edit/duplicate/delete is an appended
  event; "edit" is a new event superseding prior state in the projection, not
  an in-place mutation.

---

## Strategic Approach

### Solution Direction

Implement a second master-data vertical slice that **clones the Pilot slice's
architecture** end to end, substituting the `LandingBonusTable` aggregate:

- `packages/shared`: `LandingBonusTable` / `LandingBonusEntry` types, Zod
  create/update schemas, `landingTable.*` event types and payload mappers.
- `apps/base`: a `LandingTableService` (create/get/list/update/duplicate/
  delete) appending to the shared `EventStore`; a rebuildable in-memory
  `LandingTableProjection` keyed by table id; a `TableReferenceChecker` seam
  with a no-op stub; domain errors; and `/api/landing-tables` Fastify routes
  wired in `app.ts` with matching error-handler cases.
- `apps/companion`: a `LandingTableLibrary` screen + form mirroring
  `PilotLibrary`/`PilotForm`, extended to edit a repeating entry list and to
  offer a "Duplicate" action.

General data flow, matching the existing slice: **React form → `apiRequest`
→ Fastify route (attribution from headers) → service (Zod validate +
invariant checks) → `EventStore.append` → `projection.apply` → response**,
with `projection.rebuild(eventStore.readAll())` on boot.

### Key Design Decisions

- **Reuse `"master-data"` scope vs. a new scope**: the projection filters by
  `scope` then switches on `type` and ignores unknown types, so a new
  `landingTable.*` type under the existing `"master-data"` scope is safe and
  consistent. → **Recommend reusing `"master-data"`**; a dedicated
  `LandingTableProjection` still owns only its own types. Rationale: matches
  D4's single log and avoids a scope proliferation with no benefit at this
  scale.
- **Deletion protection before STORY-001-008 exists**: references arrive only
  with per-task selection, which is not built. → **Recommend cloning the
  `NoRostersYetChecker` pattern**: ship a `TableReferenceChecker` interface
  with a no-op stub returning `[]`, injected via `AppOptions` exactly like
  `referenceChecker` today. Rationale: the protection code path and its
  409 + `CompetitionRef[]` contract are fully built and unit-testable now (by
  injecting a stub that returns references), and STORY-001-008 only swaps the
  implementation — no rework.
- **Entry representation for boundary rows**: the table must capture "≤ 0.2 m"
  and "over 15 m → 0" verbatim. → **Recommend a plain ordered list of
  `{ distanceM, points }` entries plus explicit first/last boundary meaning
  held as data, not derived** — keep scoring interpretation (≤, banding,
  round-up) entirely out. Rationale: AC1/AC2 demand exact round-tripping;
  over-modelling the semantics now would leak scoring scope into master data.
- **"Edit" and "duplicate" as events**: edit appends `landingTable.updated`
  carrying the full new entry set (whole-aggregate replacement, as pilots do);
  duplicate appends a `landingTable.created` with a fresh id and the copied
  entries. → **Recommend whole-aggregate event payloads** (not per-entry
  deltas). Rationale: matches the pilot precedent, keeps the projection
  trivial, and guarantees AC3 independence (the copy shares no mutable state).
- **Validation stance**: mirror the Pilot Zod approach (trim, name required,
  length bounds). → **Recommend minimal structural validation** (name
  required/bounded; entries well-formed numbers) and **defer semantic
  validation** (monotonicity, ascending distance, rule-conformance) — that is
  the guardrail concern of STORY-001-007. Rationale: keeps this story small
  (2 days) and avoids pre-empting the guardrail story.

### Alternatives Considered

- **Persist tables in a dedicated SQL table instead of the event log**:
  rejected — contradicts D4 (single immutable event log; projections are
  derived and rebuildable) and diverges from the established slice.
- **Model entries as a separate top-level aggregate with their own events**:
  rejected — entries have no identity or lifecycle outside their table;
  whole-table event payloads are simpler and match the pilot precedent.
- **Defer deletion protection until STORY-001-008 lands**: rejected — AC4 is
  in scope now, and the proven no-op-checker seam lets us build and test the
  full protection path today without the referencing feature existing.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **Entry boundary semantics**: AC1 lists "≤ 0.2 m" and "over 15 m → 0" but
  the story only requires verbatim storage/display. The exact data shape for
  the first ("at or below") and last ("over → 0") rows needs a concrete
  representation decided in REASONS Canvas — without committing to any scoring
  interpretation.
- **Name uniqueness**: neither this story nor the Pilot precedent enforces
  unique names; AC3 duplicates to a *different* name. Unspecified whether two
  tables may share a name. Recommend following the Pilot precedent (no
  uniqueness constraint) unless the user says otherwise.
- **Duplicate naming flow**: AC3 says "duplicates it and saves the copy as
  'Club short-field'" — unclear whether duplicate mints a copy immediately
  (then rename) or prompts for a name up front. Either satisfies the AC; a UX
  choice for REASONS Canvas.
- **Entry ordering/validation**: whether the system enforces ascending
  distance or non-increasing points is unstated; per Strategic Approach this
  is deferred to STORY-001-007, but the boundary should be confirmed with the
  user.

### Edge Cases

- **Empty table**: can a table be saved with zero entries (data assumption:
  "tables start empty")? Affects whether the form permits an entry-less save.
- **Duplicate keyed while the original is edited**: independence (AC3) must
  hold; whole-aggregate copy of entries at duplicate time removes shared
  references — verify no array aliasing in the projection/service.
- **Delete of a non-existent / already-deleted table**: pilot slice throws
  `NotFoundError` → 404; landing tables should behave identically.
- **Reference check race on delete**: pilots note the base's single SQLite
  writer serialises delete against a concurrent reference-add; the same
  guarantee must be relied on (not re-invented) for tables once STORY-001-008
  provides real references.
- **AC5 in this story**: there is no task/competition configuration surface in
  this slice yet, so "no table demanded at save" is not directly exercisable
  here — it is genuinely STORY-001-008 behaviour. Risk of writing a test that
  can't be satisfied in this slice.

### Technical Risks

- **Nested collection in event payload & projection**: the first master-data
  entity with a repeated child. Low risk, but the projection must deep-copy
  entries on `apply` so no two projected tables (esp. a duplicate) alias the
  same array — directly threatens AC3 if mishandled.
- **Reference-checker seam wiring**: must be added to `AppOptions` and the
  error handler must gain a `landingTable`-referenced 409 case parallel to
  `ReferencedPilotError`; missing the error-handler branch would leak a 500.
  Note the current error codes (`PILOT_NOT_FOUND`, `PILOT_REFERENCED`) are
  pilot-specific — landing tables need their own codes, so error types should
  not be blindly shared.
- **Unexercisable protection path in production**: like pilots today, the real
  protection only bites once STORY-001-008 exists; coverage must come from
  unit tests injecting a stub that returns references. Risk of shipping an
  untested path if that test is skipped.
- **Frontend form complexity**: editing a variable-length entry list (add/
  remove/reorder rows) is meaningfully more UI than the flat `PilotForm`;
  the 2-day estimate is dominated by this. Keep the list editor minimal.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Create a named table; entries shown exactly as entered | Yes | Needs a concrete entry representation that round-trips the ≤-first / over-last boundary rows verbatim (decide in REASONS Canvas). |
| AC2 | Edit an entry's points and persist | Yes | Whole-aggregate `landingTable.updated` event, mirroring pilot update. |
| AC3 | Duplicate as an independent new table | Yes | Must deep-copy entries so the copy shares no mutable array with the original; verify in projection + test. |
| AC4 | Deletion of a referenced table is prevented, with reason | Partial | Full protection path buildable now via a `TableReferenceChecker` stub + injected-reference unit test; real references only arrive with STORY-001-008, so end-to-end proof deferred. |
| AC5 | Time-only tasks need no table | Partial | No task/competition config surface exists in this slice; genuinely STORY-001-008 behaviour. In-scope here only as "a table can exist independently of any task." Confirm with user how (or whether) to assert this within STORY-001-002. |
