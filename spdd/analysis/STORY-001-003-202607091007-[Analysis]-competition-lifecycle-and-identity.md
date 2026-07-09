# SPDD Analysis: Competition Lifecycle — Create, Open, Delete, Identity

## Original Business Requirement

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
  be present before dependent configuration proceeds.
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

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Immutable event log / `EventStore` (D4)**: a single append-only SQLite
  `events` table with a `scope` column, guarded by `no-update` / `no-delete`
  triggers, the one writer for all mutations. Every mutation carries
  `Attribution { actorName, originClient, authority }`. The competition
  aggregate is the *first non-master-data* citizen of this log and inherits
  the append → apply → in-memory-projection machinery unchanged.
- **`scope` column, currently always `"master-data"`**: both existing slices
  (Pilot, Landing table) file every event under the single `"master-data"`
  scope. This story is the point at which `scope` starts to *earn its keep*:
  competition-scoped data must be partitionable by scope so that opening one
  competition cannot surface another's rows (AC3). The mechanism already
  exists; this story is the first to use it non-trivially.
- **`CompetitionRef { id, name }` (`packages/shared/src/errors.ts`)**: already
  defined and consumed by *both* prior slices' deletion-protection paths
  (`ReferencedPilotError`, `ReferencedLandingTableError`). This story finally
  produces the real objects that `CompetitionRef` has been describing all
  along. The competition entity's `{ id, name }` projection *is* the source of
  truth those refs point at.
- **Reference-checker seam (`RosterReferenceChecker`/`NoRostersYetChecker`,
  `LandingTableReferenceChecker`/`NoTaskConfigYetChecker`)**: the established
  pattern for "let a not-yet-built feature's state influence this slice through
  an injected interface with a no-op stub." AC5 (captured-scores state) and AC6
  (locked state) both depend on features outside this story (scoring; CD lock)
  and are the natural next application of this exact pattern —
  [[competition-state-seams]].
- **Vertical-slice precedent (Pilot / Landing table)**: `shared` types + Zod
  schemas → `EventStore.append` → rebuildable projection → service enforcing
  invariants → Fastify routes wired in `app.ts` with an error-handler branch
  per domain error → React companion screen reached from `App.tsx`'s `Screen`
  switch. The competition slice is the same shape with a new aggregate and one
  new structural wrinkle (scope-based isolation).
- **Attribution from headers + companion identity**: routes derive attribution
  from `x-actor-name` / `x-client-id`; the companion supplies them via
  `apiRequest`. Competition mutations reuse this verbatim; `authority` stays
  `"organiser"` for the operations in scope here.

### New Concepts Required

- **Competition (aggregate root)**: a named event object owning identity
  (name, venue, date) and, transitively, everything a later story attaches
  (roster, draw, scores). The core new concept. Relates to master data by
  *referencing* it (a competition selects landing tables / pilots), never the
  reverse — which is why master data guards deletion against competitions,
  not vice versa. Introduces the first aggregate with a genuine **lifecycle
  state** (exists → possibly locked → possibly deleted) rather than flat CRUD.
- **Competition identity (name, venue, date)**: the required-before-config
  identity triple, held as **mutable descriptive attributes over a stable
  surrogate id** — identity is *not* the primary key (user decision): the
  competition is keyed by a generated id (the `crypto.randomUUID()` precedent),
  and name/venue/date are all editable after creation. Name and date are
  mandatory; venue is present in AC1 but absent from the AC2 mandatory set, so
  it is optional. **Date is the event's start date** (user decision): events
  may span multiple days (D7), but **no end date is captured**; it is a
  calendar date distinct from the event-log timestamps.
- **Competition scope / isolation boundary**: the conceptual partition that
  makes AC3 true — each competition's contents live under a scope keyed by its
  id, so a projection or query for one competition can never observe another's
  events. This is the concept that turns the dormant `scope` column into the
  isolation mechanism.
- **Lifecycle / deletion guard**: the rules governing whether a delete may
  proceed — a *hard* block when locked (AC6) and a *soft, acknowledge-first*
  guard when captured scores exist (AC5). Distinct from master data's
  referential-integrity guard: here the guard is about the aggregate's own
  state, not about who points at it.
- **Locked-state provider (seam)**: an injected read-only view of "is this
  competition locked?", stubbed to *unlocked* until the CD lock story exists —
  the deletion path can be built and tested now by injecting a stub that
  reports locked. [[competition-state-seams]]
- **Captured-scores provider (seam)**: an injected read-only view of "does this
  competition have captured scores?", stubbed to *none* until scoring exists —
  same rationale as above. [[competition-state-seams]]
- **`competition.*` event types**: `competition.created`, `competition.deleted`
  (and, if identity is editable in-scope, `competition.updated`), analogous to
  `pilot.*` / `landingTable.*`.

### Key Business Rules

- **Identity gating (AC2)**: name and date must be present before any
  identity-dependent configuration proceeds; the system names which is
  missing. Governs Competition creation/validation.
- **Isolation (AC3)**: work against one competition must never read or mutate
  another's data. Governs the scope boundary and every competition-scoped
  query/projection.
- **Locked ⇒ undeletable (AC6, hard)**: a locked competition cannot be deleted
  under any confirmation; the Organiser is told it is locked. Governs the
  deletion guard; the lock itself is set elsewhere (CD authority, out of
  scope).
- **Captured scores ⇒ guarded delete (AC5, soft)**: deletion of a competition
  holding results requires an *explicit* confirmation that names the
  destructive consequence, above the ordinary confirmation of AC4. Governs the
  deletion guard.
- **Delete is logical against an immutable log (D4)**: "removed" cannot mean a
  physical row delete — the log forbids it. Deletion is a `competition.deleted`
  tombstone; the projection drops the competition and its scoped contents are
  thereafter ignored on rebuild. Audit history is retained.
- **Immutable audit (D4)**: create / delete (and any identity edit) are
  appended events carrying attribution; last-action-wins, no session lock (D8).

---

## Strategic Approach

### Solution Direction

Implement a **competition-lifecycle vertical slice** that reuses the proven
slice architecture but introduces the first *aggregate with lifecycle state
and a scope boundary*:

- `packages/shared`: `Competition` type (id, name, venue, date) + Zod
  create/(update) schemas requiring name and date; `competition.*` event types
  and payload mappers; likely a `CompetitionRef`-compatible shape so the
  existing `{ id, name }` refs are literally this aggregate's projection.
- `apps/base`: a `CompetitionService` (create / get / list / delete, plus
  identity update if in-scope) appending to the shared `EventStore`; a
  rebuildable `CompetitionProjection` keyed by competition id; **two injected
  state seams** (locked-state, captured-scores) mirroring the reference-checker
  pattern with unlocked / no-scores stubs; competition-specific domain errors
  (not-found, locked, needs-confirmation); `/api/competitions` Fastify routes
  wired in `app.ts` with matching error-handler branches.
- `apps/companion`: a competition screen reached from `App.tsx` (a competition
  list + create form + guarded-delete flow), and — conceptually — the notion of
  an "open" competition that scopes the existing Pilot/Landing screens later
  (the isolation *plumbing* begins here even if only lightly exercised).

General data flow, matching the existing slices: **React form → `apiRequest`
→ Fastify route (attribution from headers) → service (Zod validate + lifecycle
guards) → `EventStore.append` → `projection.apply` → response**, with
`projection.rebuild(eventStore.readAll())` on boot.

### Key Design Decisions

- **Scope model for isolation**: competition *registry* events
  (`competition.created` / `.deleted`, which are metadata about which
  competitions exist) versus competition *content* events (roster, draw,
  scores, which belong to a specific competition). → **Recommend a
  `"competitions"` registry scope for the lifecycle/identity events, and
  `scope = competitionId` for that competition's future content events.**
  Isolation (AC3) then falls out of scope-filtered projections: a
  competition-content projection built for id X only ever applies events whose
  scope is X. Rationale: matches D4's single log, needs no new table, and
  makes AC3 a structural guarantee rather than a query-time filter that can be
  forgotten. This slice mostly *establishes the convention*; later stories are
  the heavy consumers.
- **Deletion as a tombstone, not a purge**: the immutable log forbids row
  deletion. → **Recommend `competition.deleted` tombstone events**; the
  projection removes the competition from its map and ignores that scope on
  rebuild, so it is *logically* gone while the audit trail survives (D4).
  Rationale: satisfies AC4's "removed" without contravening the immutable-log
  house rule.
- **Locked and captured-scores as injected seams (not stored flags)**: both
  states originate outside this story. → **Recommend cloning the
  reference-checker seam twice**: a locked-state provider and a captured-scores
  provider, injected via `AppOptions`, defaulting to unlocked / no-scores
  stubs. The full AC5/AC6 guard paths (409-style locked error; require-explicit
  -confirmation on captured scores) are built and unit-testable now by
  injecting stubs that report locked / scores-present; the CD-lock and scoring
  stories later swap the implementations with zero rework. Rationale: exactly
  the deferral pattern the codebase already uses twice.
- **Where the delete guard lives (server vs UI)**: confirmation is a UX
  concern, but the *rules* must be server-enforced. → **Recommend the base
  enforces the hard locked block unconditionally (AC6), and enforces the
  captured-scores guard as a required `confirmDestroysResults`-style
  acknowledgment flag on the delete request (AC5)**; ordinary confirmation
  (AC4) is UI-only. Rationale: keeps the destructive rule authoritative on the
  base (a mis-built client cannot bypass it), consistent with D8's
  "authoritative base."
- **Identity editability in this slice** *(resolved)*: identity is **updatable
  and is not the primary identifier** (user decision). → The slice includes a
  `competition.updated` event carrying the full new identity, mutating
  name/venue/date over the stable surrogate id, mirroring the whole-aggregate
  update the Pilot/Landing slices use. Because the id — not the name — is the
  key, an edit (even a rename) never breaks references (`CompetitionRef` points
  at the id) or the scope boundary.
- **Validation stance**: mirror the Pilot/Landing Zod approach. → **Recommend
  trim + required + length-bounded name, a required well-formed date, optional
  venue**, with field-level messages so AC2 can name the missing field.
  Rationale: reuses the `ValidationError` → 400 `flatten()` contract already in
  place.

### Alternatives Considered

- **One projection over a global `"competitions"` scope holding all content
  inline**: rejected — collapses the isolation boundary AC3 needs and would
  force every future content projection to re-filter by competition id at
  query time; scope-per-competition makes isolation structural.
- **Physically deleting competition rows / a separate mutable competitions
  table**: rejected — contradicts D4 (single immutable log; derived,
  rebuildable projections) and the `no-delete` trigger.
- **Storing `locked` / `hasScores` as columns/flags on a competition record**:
  rejected for now — those states are owned by not-yet-built features (CD lock,
  scoring); modelling them as local flags would duplicate a source of truth
  this slice doesn't own. The injected-seam pattern defers them cleanly.
- **A server-side "currently open competition" session**: rejected — D8
  mandates a stateless, last-action-wins base with no control-session lock;
  "open" is a client-side selection that scopes requests by competition id, not
  a server session.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **Meaning of "open" / "close" / "re-open" (AC1, AC3)**: whether these are
  purely client-side selections or imply any server state. Recommend
  client-side selection scoping requests by id (per D8) — confirm with user.
- **Venue optionality**: AC1 supplies a venue but AC2's mandatory set is only
  name + date. Reads as venue-optional; confirm.
- **Date semantics** *(resolved)*: `date` is the event's **start date**. Events
  may span multiple days (D7), but **no end date is captured** in this story.
  Multi-day operation is otherwise STORY-001-013's concern.
- **"and its data are removed" (AC4)**: with an immutable log this is
  necessarily *logical* removal (tombstone + projection drop). Confirm the
  Organiser-visible behaviour ("gone from the list, unrecoverable") is what's
  meant, not literal log erasure.
- **Name uniqueness**: neither prior slice enforces unique names; two
  competitions could share "Levin Autumn F5J". Recommend following precedent
  (no uniqueness) unless the user wants it.
- **Identity editability** *(resolved)*: name/venue/date **are editable** after
  creation and identity is **not the primary key** — the aggregate is keyed by a
  stable surrogate id, so a rename is a normal attribute update (see Strategic
  Approach decision; `competition.updated` in scope).

### Edge Cases

- **Create with blank name or missing date (AC2)**: must reject with a
  field-named message; whitespace-only name must trim to empty and fail.
- **Delete a locked competition (AC6)**: hard block regardless of any
  confirmation flag — the locked check must precede the captured-scores check.
- **Delete with captured scores but *without* the explicit acknowledgment
  (AC5)**: must be refused and prompt for the stronger confirmation, not
  silently proceed.
- **Delete a non-existent / already-deleted competition**: mirror the slices'
  `NotFoundError` → 404; a second delete of a tombstoned competition is a
  no-op-or-404.
- **Isolation leak (AC3)**: a projection or query that forgets to filter by
  scope would surface another competition's rows — the central risk this story
  exists to prevent; must be proven by a two-competition test.
- **Interaction with master-data deletion protection**: once real
  competitions exist, they are the objects the pilot/landing reference-checkers
  are *meant* to return — but those checkers are still stubs (STORY-001-005 /
  -008). This story creates competitions but does **not** wire them into those
  checkers; that remains deferred. Risk of over-reaching scope.

### Technical Risks

- **First real use of `scope` for partitioning**: the existing projections
  filter `scope !== "master-data"` and ignore it. Introducing competition
  scopes must not let a competition-content event be mis-applied by a
  master-data projection (or vice versa). Low risk given the existing
  scope-filter discipline, but every projection's scope guard must be correct.
- **Two new injected seams + `AppOptions` wiring**: like the landing-table
  seam, the error handler must gain locked / needs-confirmation branches
  parallel to the existing 404/409 cases; a missing branch leaks a 500. New
  domain error codes are needed (not the pilot-specific ones).
- **Ordering of guard checks**: locked (hard) must be evaluated before
  captured-scores (soft); reversing them could let a locked-with-scores
  competition slip through on an acknowledgment flag. Pure logic risk, cheap to
  test.
- **Tombstone rebuild correctness**: `projection.rebuild(readAll())` must drop
  a competition that has a later `competition.deleted` event even though its
  `created` (and any content) events remain in the log — standard event-sourcing
  tombstone handling, but the first time this slice needs it.
- **Unexercisable-in-production guard paths**: as with pilots/landing today,
  the locked and captured-scores paths only truly bite once CD-lock and scoring
  exist; coverage must come from unit tests injecting stubs that report
  locked / scores-present, or the paths ship untested.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Create a competition with name/venue/date; survives close & re-open | Yes | Straightforward create + rebuildable projection; "re-open" is a client-side selection returning the same projected object. Confirm venue optional. |
| AC2 | Name and date required before dependent configuration; names the missing field | Yes | Zod schema with field-level messages via the existing `ValidationError` → 400 `flatten()` contract. |
| AC3 | Competitions isolated; work on one never affects another | Partial | Establishes the scope-per-competition convention and proves isolation with a two-competition test, but the heavy consumers (roster/draw/scores) are later stories, so isolation is demonstrated at this slice's surface, not across all content types yet. |
| AC4 | Delete an unlocked, score-free competition after confirmation | Yes | `competition.deleted` tombstone; projection drop. "Removed" is logical (immutable log) — confirm Organiser-visible semantics. |
| AC5 | Deleting with captured scores needs explicit consequence-naming confirmation | Partial | Full guard path (require explicit acknowledgment) buildable now via a captured-scores stub returning present + a unit test; real captured scores only arrive with the scoring stories, so end-to-end proof deferred. |
| AC6 | A locked competition cannot be deleted; told it is locked | Partial | Full hard-block path buildable now via a locked-state stub + unit test; the lock is actually set by the CD story, so end-to-end proof deferred. Locked check must precede the AC5 check. |
