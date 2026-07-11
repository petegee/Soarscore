# SPDD Analysis: Master Pilot Library Management (STORY-001-001)

## Original Business Requirement

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

## Domain Concept Identification

> Codebase state: **greenfield**. The repository contains requirements and
> architecture documentation only — no build files, no application code, no
> schema, no prior SPDD artifacts. "Existing concepts" below therefore means
> *specified in the requirements/architecture docs*, not *present in code*.
> Everything must be introduced in code for the first time by this story.

#### Existing Concepts (from the requirements/architecture docs)

- **Pilot (master record)**: a reusable person record — name required;
  registration ID, club, contact optional — shared across all competitions
  (Area 1.1). The subject of this story.
- **Competition / Roster Entry**: a competition references master pilots
  through roster entries carrying per-competition attributes (Area 3.4,
  STORY-001-005). Not built yet, but its future existence dictates this
  story's reference-protection and edit-isolation semantics (AC4, AC6).
- **Immutable Event Log**: every mutation from every client is recorded as
  an append-only event carrying originating client, exercised authority and
  operator identity; current state must be derivable from the log
  (decisions.md D4, NFR-1 interaction). Pilot create/edit/delete are
  mutations and must land in it.
- **Base Station**: the headless authoritative controller that owns all
  state, the event log and the web server (physical architecture §1). The
  pilot library physically lives here.
- **Companion app (operator client)**: the base-served web UI through which
  the Organiser performs all master-data work (companion-app.md §3.1); it is
  stateless and stamps an unauthenticated operator **name-pick** into every
  action's identity field.

#### New Concepts Required (first-time introduction in code)

- **Pilot Library**: the collection of master pilot records with
  create/view/edit/delete operations — the first domain aggregate the
  system will have.
- **Pilot Reference Check**: the notion of "is this pilot referenced by any
  competition roster?" — introduced now as a seam even though rosters arrive
  in STORY-001-005 (until then the answer is always "no").
- **Mutation Event (pilot events)**: the concrete event-log entries for
  pilot mutations — the story that forces the event-log foundation into
  existence.

#### Key Business Rules

- **Name required, everything else optional** — governs pilot creation and
  editing (AC1–AC3).
- **No uniqueness constraint on name** — duplicate names are legitimate and
  are disambiguated by optional attributes (AC7); the system must not reject
  or merge same-name pilots.
- **Master edits never rewrite competition data** — a master pilot edit is
  visible wherever the *library* is browsed but must not alter any roster or
  result already built from it (AC4). This forces a deliberate boundary
  between master data and per-competition data.
- **Referenced pilots cannot be destroyed** — deletion is prevented (or the
  record retired) when any roster references the pilot, with the referencing
  competitions named (AC6).
- **Every mutation is auditable** — pilot create/edit/delete events carry
  actor identity (operator name-pick), originating client and authority
  (D4); auditability replaces authentication in the club trust model (D1).
- **Offline-first** — the library must be fully usable with no internet
  (D6); it lives on the Base Station and is operated over local Wi-Fi.

## Strategic Approach

#### Solution Direction

- This story is the **walking skeleton** of the whole system in disguise:
  delivering pilot CRUD end-to-end requires, for the first time, (1) a Base
  Station server process with persistent storage, (2) the append-only event
  log with state derivable from it (D4), and (3) the base-served companion
  web UI with the operator name-pick (companion-app.md §1). The strategic
  choice is to accept that and build the thinnest vertical slice of each,
  with the pilot library as the first — deliberately simple — domain area
  flowing through all three.
- General flow: companion web UI (Organiser's master-data view) → base
  API → domain validation (name required) → **pilot mutation event appended
  to the event log** → current library state derived/updated → UI reflects
  it. Reads are served from the derived current state.
- Reference protection is built as a seam: the delete operation asks "which
  competitions reference this pilot?" — an answer that is trivially empty
  until STORY-001-005 lands, but the check, its refusal message shape and
  its test exist from day one so rosters plug in without reworking deletion.

#### Key Design Decisions

- **Event-sourced from the first story vs. CRUD-now/retrofit-log-later**:
  D4 requires all mutations in an immutable log with state derivable from
  it, and NFR-1 says the domain model must be designed together with the
  log. Retrofitting event sourcing under a CRUD schema is expensive and
  error-prone → **recommendation: model pilot mutations as events from the
  start**, even though a plain table would satisfy this story alone. This is
  the single most consequential decision in the story and the main reason
  its true cost exceeds "simple CRUD".
- **Prevent vs. retire on referenced-pilot deletion**: AC6 permits either.
  Retirement adds a lifecycle state that every future consumer (roster
  pickers, reports) must understand → **recommendation: prevent with an
  explanatory message naming the referencing competitions** in the MVP;
  introduce a retired state only if a real need appears. (Note: pilot
  *contest* retirement, Area 5.5, is a different concept — reusing the word
  in master data would invite confusion.)
- **Edit-isolation semantics (AC4)**: two viable models — roster entries
  **snapshot** the pilot's identity attributes at add-time, or rosters
  **reference** the master record while results freeze independently. The
  requirement's wording ("reflected wherever that master record is browsed,
  without altering any competition roster already built from it") points to
  snapshot-at-add for whatever a roster displays. Decision binds
  STORY-001-005 more than this story → **recommendation: decide the
  principle now (snapshot-at-add), implement nothing roster-side yet**, and
  record it for the roster story's canvas.
- **Scope of the event log — global vs. per-competition**: D4 describes the
  log as recording "how the contest evolved", but master data is
  cross-competition by definition. Master-data mutations need a home →
  **recommendation: one system-level log stream with events attributed to a
  competition where applicable and to the master-data scope otherwise**;
  surface this to the owner because it shapes the log's design for every
  later story.

#### Alternatives Considered

- **Plain CRUD table with an audit-trail column/table, event log deferred**:
  fastest path to the seven ACs, but violates the D4/NFR-1 instruction that
  the domain model and event log be designed together, and guarantees a
  migration later. Rejected.
- **Retire-only (no hard delete ever)**: simpler invariant, but AC5
  explicitly requires an unreferenced pilot's record to be removed from the
  library. Rejected as the default; retirement kept as AC6's permitted
  fallback if prevention proves awkward.
- **Building master data as a laptop-local app first (defer the base)**: the
  architecture makes the base the sole state owner and the companion app
  stateless (D8) — a laptop-local store would create a second authority to
  merge later. Rejected.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Technology stack is undecided**: no language, framework, storage or UI
  toolkit has been chosen anywhere in the repo. The physical architecture
  constrains the choice (Pi-class headless box; on-box web server; TTS,
  Wi-Fi AP and device sync later) but does not make it. This must be decided
  before or during the REASONS Canvas — it is an owner decision, not a
  derivable one.
- **Event-log scope for master data** (see design decision above): global
  stream vs. per-competition streams needs an owner ruling; it affects
  suspend/resume reconstruction and any future export.
- **"Retired without breaking existing rosters"** (AC6's parenthetical):
  prevented-vs-retired should be settled one way for the MVP; the
  recommendation is prevention, with the choice recorded.
- **Contact field shape**: "contact" is a single free-text optional field in
  the requirement (phone? email? both?). Treat as one free-text field unless
  the owner wants structure; flag to avoid over-modelling.
- **Name-pick people list vs. pilot library**: the companion app's operator
  name-pick selects "from a people list" (D4). Whether that list *is* the
  pilot library or a separate operator list is unspecified. At club scale
  the same humans appear in both; reusing the pilot library is tempting but
  couples operator identity to competition master data. Needs an owner call
  (default: keep them separate, revisit later).

#### Edge Cases

- **Whitespace-only name**: AC3 says empty name is rejected; a name of
  spaces should fail the same rule.
- **Editing a pilot to blank optional fields**: clearing club/contact must
  be a legal edit (optional means removable, not just omittable).
- **Delete then re-add same name**: legal (no uniqueness); the re-added
  pilot is a new record with a new identity — historical events still refer
  to the deleted one.
- **Concurrent edits from two companion clients**: D8 says multiple clients,
  last-action-wins, no lock — two Organisers editing the same pilot must
  resolve last-write-wins with both actions event-logged, never merged.
- **Deletion race**: pilot deleted from one client while another client is
  adding them to a roster (once rosters exist) — the reference check and the
  delete must not interleave into a roster pointing at a deleted pilot; the
  seam's contract should state this now.
- **Event-log replay with deleted pilots**: state derivation must
  reconstruct a library where created-then-deleted pilots are absent but
  their events remain (immutability).

#### Technical Risks

- **Hidden bootstrap cost**: the 2-day estimate holds only for the pilot
  domain itself. The first-story reality includes project scaffolding, the
  event-log foundation and the served-web-app skeleton — realistically a
  separate enabling effort. Mitigation: either split an explicit
  "walking-skeleton" technical task out of this story or re-estimate the
  story to include it; the canvas should choose.
- **Event-log design debt**: decisions taken here (event shape, attribution
  fields, derivation approach) become the pattern for every subsequent
  story per NFR-1/D4. Under-designing now is the project's largest
  compounding risk. Mitigation: keep the event contract minimal but carry
  the D4 attribution triple (client, authority, actor identity) from the
  first event.
- **Hardware absence**: no Base Station hardware exists yet; development
  runs on an ordinary machine. Low risk for this story (no radio, clock or
  device involvement) — one reason it is the right first story.
- **Scale is a non-risk**: tens of pilots, single-digit concurrent clients
  (D7); no performance concern justifies complexity anywhere in this story.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Add pilot with name only | Yes | Straightforward create + derived-state read |
| 2 | Add pilot with all four attributes | Yes | — |
| 3 | Empty name rejected, no record created | Yes | Extend to whitespace-only names |
| 4 | Master edit leaves existing rosters/results untouched | Partial | Fully testable only once rosters exist (STORY-001-005); testable now as "edit emits event + library reflects it", with the snapshot-at-add principle recorded for the roster story |
| 5 | Delete unreferenced pilot | Yes | Removal from derived state; event retained in log |
| 6 | Delete of referenced pilot prevented, competitions named | Partial | The check is a seam returning "unreferenced" until rosters exist; contract and message shape testable now |
| 7 | Same-name pilots distinguishable | Yes | List view must show optional attributes; no uniqueness rule |

Coverage: 5 fully addressable now, 2 partially (both blocked only by the
not-yet-built roster story, by design — the seams land here).
