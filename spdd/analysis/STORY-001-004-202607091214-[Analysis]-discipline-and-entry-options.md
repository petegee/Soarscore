# SPDD Analysis: Discipline Selection and Entry Options

## Original Business Requirement

# [STORY-001-004] Discipline Selection and Entry Options

> Source: `docs/user-stories/01-organiser.md` §3.2, §3.3 · `docs/requirements/high-level-requirements.md` Areas 3.2, 3.3
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

A competition's discipline (F3B, F3J, F3K, F5J, F5K or F5L) determines which
tasks exist, what data is captured and how scores compute — e.g. F3B
normalises its three tasks separately while the man-on-man classes produce
one group score. Choosing the discipline is therefore the pivotal
configuration step, and changing it after scores exist would invalidate
results. Separately, the Organiser toggles per-event entry options — start
numbers and pilot classes — that shape what each roster entry carries and how
results can be grouped.

### Business Value

- Provide the Organiser with a single choice that makes all downstream task
  and scoring configuration correct for the class being flown.
- Support per-event tailoring of entrant attributes (pilot numbers, pilot
  classes) without carrying fields the event doesn't use.
- Enable results grouped/ranked by pilot class where the event wants it.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (a competition exists to configure).
- **Data assumptions**: the six MVP disciplines and their task/rule sets are
  defined by the class rule docs (`docs/requirements/rules/`), which are
  authoritative on numbers.
- **Integration points**: discipline drives scoring options
  (STORY-001-007), task rules (STORY-001-008) and the draw; entry options
  drive roster attributes (STORY-001-005) and reports.
- **Business constraints**: MVP is individual-only — team entry and per-entry
  frequency are Future Enhancements.

### Scope In

- Select one of the six disciplines for a competition; the available tasks
  and rules become those of that discipline.
- Guard against discipline changes that would invalidate captured scores.
- Toggle **pilot numbers** and **pilot classes** entry options per
  competition.

### Scope Out

- The per-discipline task and scoring detail itself (STORY-001-007/008 and
  deferred per-discipline requirements).
- Team entry, `omit-from-team-score`, per-entry frequency — Future
  Enhancements.

### Acceptance Criteria

#### AC1: Discipline selection scopes available tasks and rules
**Given** a new competition
**When** the Organiser selects discipline F3K
**Then** the tasks and rules available for configuration are F3K's (e.g. its
task catalogue), not those of any other class.

#### AC2: Discipline change with captured scores is guarded
**Given** a competition with discipline F5J and scores already captured
**When** the Organiser attempts to change the discipline to F3J
**Then** the system prevents the change or requires explicit re-confirmation
that states it invalidates task configuration and results — never a silent
switch.

#### AC3: Pilot numbers option
**Given** a competition with the pilot-numbers option enabled
**When** the Organiser edits the roster and produces the draw or reports
**Then** each roster entry can carry a pilot number and it appears in the
draw and reports.

#### AC4: Pilot classes option
**Given** a competition with the pilot-classes option enabled and entrants
assigned classes "Open" and "Sportsman"
**When** results are produced
**Then** results can be grouped or ranked by those classes.

#### AC5: Disabled option removes the attribute
**Given** a competition where the Organiser disables pilot numbers
**When** the roster is viewed
**Then** the pilot-number attribute is no longer required or shown on
entries.

### INVEST Check

Independent of later stories · Valuable (correct class behaviour + tailored
entries) · Small (2 days, 2 functional points: discipline selection/guard +
entry-option toggles) · Testable.

---

## Resolved Decisions

Settled interactively with the user (2026-07-09); the strategic content below
reflects these. Where a decision diverged from the original recommendation, the
divergence and its consequences are noted.

- **RD1 — Discipline is required at creation** *(diverges from original
  recommendation of nullable-set-later).* `discipline` becomes a required field
  on the create schema and `competition.created`; a competition never exists
  without one. There are **no legacy `competition.created` events** to backfill
  (confirmed with user; dev DB is disposable), so the projection-default concern
  is dropped. **Requirements reconciled** (house rule 2): HLR 3.1 and 3.2 updated
  to state discipline is captured at creation; `01-organiser.md` §3.2 AC1
  reworded to create-time; STORY-001-003 given a forward note that STORY-001-004
  adds discipline to create (its shipped ACs left as the historical record).
- **RD2 — Discipline change under captured scores is a HARD BLOCK** *(diverges
  from original recommendation of acknowledge-first).* A dedicated
  discipline-change operation refuses with a `409` (`DISCIPLINE_LOCKED`-style
  domain error) whenever the captured-scores seam reports scores — no
  acknowledgment flag clears it. Consequence: the only way to change discipline
  once scores exist is to delete the scores first. The change is **also** refused
  when the competition is locked (via the existing lock seam). `01-organiser.md`
  §3.2 change-guard AC tightened from "prevented or re-confirmation" to
  "prevented."
- **RD3 — Pilot classes = flag + defined set** *(matches recommendation).* The
  competition carries `pilotClassesEnabled` plus a competition-level
  `pilotClasses: string[]` list of allowed class names; roster entries
  (STORY-001-005) pick from it and reports (STORY-001-014/015) group/rank by it.
- **RD4 — Disabling pilot classes DISCARDS** *(diverges from original
  recommendation of retain-but-hide).* Disabling clears the competition-level
  `pilotClasses` set. Because there are **no roster entries in this slice**
  (STORY-001-005), the entry-level "clear each entry's assigned class" behaviour
  is a rule handed forward to STORY-001-005. In event-sourcing terms "discard" is
  a forward event clearing current state; the audit log is retained.
- **RD5 — Discipline rides the create + PUT path, not a separate change op**
  *(diverges from this analysis's own Strategic-Approach recommendation to
  separate the discipline change from the free identity update).* `discipline`
  is a field on **both** the create schema and the update (`PUT`) schema and
  travels in the existing `competition.created` / `competition.updated` events —
  there is **no** dedicated `competition.disciplineChanged` event, no
  `PATCH .../discipline` route, and no separate `changeDiscipline` service
  operation. RD2's hard block is preserved by moving the guard **inside**
  `update`: when the submitted `discipline` differs from the current one, the
  service consults the lock and captured-scores seams and refuses with the `409`
  `DISCIPLINE_LOCKED`-style error before appending; an unchanged discipline (or a
  pure name/venue/date/toggle edit) passes freely. The rule stays
  server-authoritative — a mis-built client still cannot switch discipline behind
  captured scores, because the guard lives in the service, not on a distinct
  endpoint.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **`Competition` aggregate (`packages/shared/src/competition.ts`)**: today a
  flat identity object `{ id, name, date, venue }` created and edited by
  STORY-001-003. This story is the first to *extend* the aggregate with
  configuration state beyond identity. Its Zod `competitionFields` (shared by
  create and update) and the whole-aggregate `competition.updated` event are
  the extension points — discipline and the entry-option flags land here as new
  aggregate attributes.
- **Whole-aggregate identity update (`CompetitionService.update`,
  `competition.updated`)**: the established mutation shape — a single event
  carrying the *entire* new identity, re-projected over the stable surrogate
  id, with a rename never breaking id-keyed references. This story must decide
  whether discipline rides this same free update or needs a distinct,
  *guarded* mutation path (see Strategic Approach), because discipline — unlike
  name/venue/date — cannot be changed silently once scores exist (AC2).
- **`CapturedScoresProvider` / `NoScoresYetProvider` seam
  (`apps/base/src/competitions/state-providers.ts`)**: an already-built,
  already-injected read-only view of "does this competition have captured
  scores?", stubbed to *none* until the scoring stories exist. STORY-001-003
  uses it for the guarded *delete*; **AC2's guarded discipline-change is the
  same question against the same seam** — a direct reuse, not a new mechanism.
  [[competition-state-seams]]
- **Domain-error + centralised error-handler pattern
  (`competitions/errors.ts`, `app.ts setErrorHandler`)**: each aggregate owns
  typed `DomainError` subclasses with a `code`, each mapped to an HTTP status
  in one `setErrorHandler` branch (e.g. `CompetitionDeleteNeedsConfirmationError`
  → 409 with a `reason`). A discipline-change guard error follows this exact
  precedent (a 409 needs-confirmation analogue).
- **Vertical-slice precedent (Pilot / Landing table / Competition)**: `shared`
  types + Zod schemas → `EventStore.append` → rebuildable projection → service
  enforcing invariants → Fastify routes wired in `app.ts` → React companion
  screen. Entry-option toggles and discipline selection extend the *existing*
  competition slice rather than adding a new aggregate.
- **Rule corpus (`docs/requirements/rules/`)**: authoritative source of the six
  disciplines, their task catalogues (e.g. F3K's A–N), and the F3B
  three-tasks-normalised-separately exception. This story does **not** encode
  those numbers; it records the *selection* that later stories (007/008) read to
  scope task/scoring config. House rule 1 applies: nothing here may contravene
  the rule docs.

### New Concepts Required

- **Discipline (competition attribute)**: an enumerated selection over the six
  MVP classes (F3B, F3J, F3K, F5J, F5K, F5L) that scopes which task/rule/scoring
  configuration later stories offer. Relates to `Competition` as a new
  first-class attribute; relates to the rule corpus as a *key into* it (not a
  copy of it). Conceptually it is the aggregate's most consequential field — it
  gates downstream configuration — yet it is set/changed by the Organiser like
  other config, subject to the AC2 guard. Additive-only per the NFR: new classes
  extend the enumeration without reshaping anything.
- **Discipline-change guard**: the rule that a discipline change is free while
  no scores exist but **hard-blocked once scores are captured** (RD2), because it
  invalidates task configuration and results (AC2). Distinct from STORY-003's
  *delete* guard only in the operation it protects — it consults the same
  captured-scores state, but offers **no** confirm-to-proceed flag. Applied
  **inside `update`** when the submitted discipline differs from the stored one
  (RD5).
- **Entry option — pilot numbers (toggle)**: a per-competition boolean that
  declares whether roster entries carry a pilot number. This story owns the
  *toggle*; the per-entry attribute itself lives on roster entries
  (STORY-001-005) and its appearance in draw/reports is STORY-001-009/014/015.
- **Entry option — pilot classes (toggle, + possible class set)**: a
  per-competition boolean declaring whether entrants are assigned a *pilot
  class* (e.g. "Open", "Sportsman") for grouping/ranking. **This "class" is an
  event-local skill/category grouping — orthogonal to the FAI "class" that this
  story calls *discipline*.** The rules corpus defines no Open/Sportsman
  categories, so pilot classes are a product grouping, not a rule concept (no
  house-rule conflict). Open question: whether enabling also defines the *set* of
  allowed class names at competition level or leaves them free-text per entry
  (see Risks).
- **`competition.*` event extension**: the discipline and entry-option state is
  represented in the existing `competition.created` / `competition.updated`
  payloads (RD5 — no dedicated `competition.disciplineChanged` event); the
  aggregate simply gains persisted configuration alongside identity.

### Key Business Rules

- **Discipline scopes downstream config (AC1)**: once a discipline is selected,
  the tasks/rules/scoring available for configuration are that discipline's and
  no other's. Governs Competition ↔ discipline and every later config story that
  reads it. This slice *records and exposes* the selection; the scoping is
  enforced where tasks/scoring are configured (007/008).
- **No silent discipline switch under scores (AC2)**: changing discipline when
  scores exist is prevented or requires explicit consequence-naming
  reconfirmation — never silent. Governs the discipline-change guard; consults
  the captured-scores seam.
- **Template-seeded discipline is not silently changeable to a differing-task
  class (story §3.2 AC2, HLR 3.2)**: an *implicit* rule surfaced by the source
  user story but **out of this slice's scope** — templates are STORY-001-006.
  Flagged so it is not lost, not implemented here.
- **Entry options are per-competition and additive to the entry shape (AC3,
  AC4)**: enabling an option makes the corresponding per-entry attribute
  available; the toggle lives on the competition, the attribute on the entry.
- **Disabling an option removes its attribute from the entry surface (AC5)**: a
  disabled option means the attribute is neither required nor shown. Governs the
  toggle→roster relationship (consumed in STORY-001-005).
- **Individual-only (MVP constraint)**: team entry, `omit-from-team-score` and
  per-entry frequency are excluded; only pilot-numbers and pilot-classes toggles
  exist.
- **Immutable audit (D4)**: discipline selection/change and entry-option toggles
  are appended events carrying attribution, like every other mutation.

---

## Strategic Approach

### Solution Direction

Extend the **existing competition vertical slice** — no new aggregate — with
discipline and two entry-option toggles, and add one *guarded* mutation path
that reuses the captured-scores seam already present for delete:

- `packages/shared`: add `Discipline` (a six-value enumeration, **required on the
  create schema** — RD1) and entry-option flags to the `Competition` type; extend
  the Zod schema(s) with a discipline enum (on **both** create and update — RD5),
  boolean toggles and the `pilotClasses` name list (RD3); extend the existing
  `competition.created` / `competition.updated` payloads and the payload mapper.
  *(No dedicated discipline-change event — RD5.)*
- `apps/base`: extend `CompetitionService` create/update to carry discipline and
  toggle entry options; guard the discipline change **inside `update`** (when the
  submitted discipline differs from the stored one) through the existing
  `CapturedScoresProvider` and lock seams so it is **hard-blocked when scores
  exist or when locked** — no acknowledgment flag (RD2/RD5); extend
  `CompetitionProjection` to carry the new fields; add a discipline-change-guard
  domain error with a `setErrorHandler` branch (409).
- `apps/companion`: extend the competition form/screen with a discipline picker
  and the two toggles, plus the reconfirmation flow for a guarded discipline
  change. The *consumption* of the toggles (roster attributes, draw/report
  columns) and of the discipline (task/scoring catalogues) belongs to later
  stories; this slice establishes and persists the configuration.

General data flow, unchanged from the slice precedent: **React form →
`apiRequest` (attribution headers) → Fastify route → service (Zod validate +
discipline-change guard) → `EventStore.append` → `projection.apply` →
response**, with `projection.rebuild(readAll())` on boot.

### Key Design Decisions

- **Is discipline set at create or as a separate step?** *(RESOLVED — RD1:
  required at create.)* STORY-001-003 shipped `competition.created` without
  discipline; this story **extends the create contract to require it**. → The
  create schema and `competition.created` payload gain a required `discipline`
  enum; a competition never exists without one, so later config stories never see
  an "unset" discipline. There are no legacy events to backfill (confirmed). The
  requirements docs were reconciled to match (HLR 3.1/3.2, `01-organiser.md`
  §3.2, STORY-003 forward note). Consequence accepted: the create form/endpoint
  now merges STORY-003 identity capture with the discipline choice.
- **Free identity update vs guarded discipline change.** *(RESOLVED — RD5:
  single create + PUT path, guard inside `update`.)* The current
  `competition.updated` rewrites the whole aggregate freely, but discipline
  cannot be changed under scores (AC2/RD2) whereas name/venue/date can. → Rather
  than a distinct event/operation, discipline rides the **same create + PUT
  path** and the guard lives **inside `update`**: the service compares the
  submitted discipline to the stored one and, only when they differ, consults
  `CapturedScoresProvider` and the lock seam and refuses (409) before appending;
  harmless renames and unchanged-discipline edits pass freely. Rationale: keeps
  the guard from gating renames while keeping the destructive rule
  server-authoritative (a mis-built client cannot switch discipline behind
  captured scores — the check is in the service, not on a separable endpoint).
- **Guard shape: hard block vs acknowledge-first (AC2).** *(RESOLVED — RD2: hard
  block.)* → The discipline-change operation **refuses outright** with a `409`
  domain error (`DISCIPLINE_LOCKED`-style, its own `setErrorHandler` branch)
  whenever the captured-scores seam reports scores, and likewise when the
  competition is locked. No acknowledgment flag clears it — to change discipline
  after scoring, the Organiser must first delete the scores. Simpler and stricter
  than the acknowledge-first alternative; matches "never a silent switch"
  absolutely.
- **Entry options as boolean flags on the competition.** → **Recommend two
  booleans (`pilotNumbersEnabled`, `pilotClassesEnabled`) on the aggregate**,
  defaulting off, toggled via the update path (no captured-scores guard needed —
  toggling doesn't invalidate scores, though see the pilot-classes edge case in
  Risks). Rationale: minimal, additive, and the roster story reads the flags to
  decide which attributes to surface.
- **Pilot-classes: flag only vs flag + class set.** *(RESOLVED — RD3: flag +
  defined set.)* → The competition carries `pilotClassesEnabled` plus a
  competition-level `pilotClasses: string[]` of allowed class names; the roster
  assigns from it (STORY-005) and reports group/rank by it (STORY-014/015).
  Rationale: grouping/ranking is far more robust against a defined set than free
  text.
- **Disabling pilot classes: retain vs discard.** *(RESOLVED — RD4: discard.)* →
  Disabling clears the competition-level `pilotClasses` set. This slice has no
  roster entries yet, so the entry-level clear is a rule handed to STORY-005;
  re-enabling starts from an empty set. Audit history is retained (the clear is a
  forward event).
- **Discipline enum lives in `shared` and is additive-only (NFR).** →
  **Recommend a Zod enum of the six class codes**, validated with a field-level
  message, so an unknown value fails at the boundary and new classes extend the
  enum without reshaping the aggregate. Rationale: matches the centralised
  flexible-task-model / additive-extensibility NFR.

### Alternatives Considered

- **Discipline as a required field on `competition.created`**: rejected —
  contradicts the already-shipped create path and the "configure an existing
  competition" framing; would force a create-time choice the story treats as a
  distinct configuration step.
- **A separate `Discipline`/config aggregate keyed by competition id**:
  rejected — discipline and two toggles are lightweight competition attributes,
  not an independent lifecycle; a separate aggregate adds a scope/projection for
  no benefit. Keep them on the competition aggregate.
- **Storing a "hasScores" flag on the competition to drive AC2**: rejected —
  captured-scores state is owned by the not-yet-built scoring feature; a local
  flag would duplicate a source of truth this slice doesn't own. The existing
  injected seam already answers the question.
- **Encoding each discipline's task catalogue now to satisfy AC1 fully**:
  rejected — that is STORY-001-007/008 and the deferred per-discipline
  requirements; this slice records the selection and exposes it, and must not
  copy rule numbers into product code (house rule 1).
- **Guarding entry-option toggles with the captured-scores seam too**: rejected
  as the default — toggling pilot numbers/pilot classes does not invalidate a
  captured score; only discipline does. (One edge — disabling pilot classes
  after classes were assigned — is a data-consequence question flagged in Risks,
  not a scoring-invalidation one.)

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Prevents *or* requires re-confirmation" (AC2)** *(RESOLVED — RD2)*: hard
  block. The change is refused outright while scores exist (or while locked);
  no reconfirmation path.
- **Discipline set-at-create vs later step** *(RESOLVED — RD1)*: required at
  create. Docs reconciled (HLR 3.1/3.2, `01-organiser.md` §3.2, STORY-003 note).
- **Pilot classes: defined set vs free text** *(RESOLVED — RD3)*: flag + a
  competition-level defined set of class names.
- **Overloaded word "class"**: the requirement uses "class" for both the FAI
  discipline (F3B…) and the pilot skill grouping (Open/Sportsman). These are
  orthogonal; the model must keep them as separate concepts (`discipline` vs
  `pilotClass`). Flagging to prevent a modelling conflation.
- **"appears in the draw and reports" (AC3) / "results can be grouped or ranked"
  (AC4)**: these behaviours live in STORY-001-009 (draw) and 014/015 (reports).
  Confirm this slice is expected only to *enable* them (persist the toggle/set),
  with the visible draw/report behaviour proven in those later stories.

### Edge Cases

- **Change discipline with no scores**: must be a free change (no guard fires);
  only captured scores trigger AC2.
- **Change discipline *to the same value***: should be a no-op / not trigger the
  guard.
- **Select a discipline outside the six (or unknown code)**: must be rejected at
  the Zod boundary with a field-named message.
- **Disable pilot classes after entrants were assigned classes** *(RESOLVED —
  RD4: discard)*: disabling clears the class values. In this slice only the
  competition-level `pilotClasses` set exists to clear; the entry-level clear is
  a rule handed to STORY-005.
- **Disable pilot numbers after a draw/reports already reference them**:
  interaction with STORY-009/014; likely just stops surfacing the attribute, but
  confirm no orphaned references break later.
- **Template-seeded discipline (story §3.2 AC2)**: "not silently changeable to a
  class whose tasks differ" — an implicit rule that only bites once templates
  exist (STORY-006); explicitly out of scope here but must not be silently
  dropped from the backlog.
- **Discipline unset when a later config story runs**: STORY-007/008 must treat
  "no discipline" as "not yet configurable" — a boundary this slice creates.

### Technical Risks

- **Discipline on the free identity path** *(mitigation settled — RD5)*:
  discipline *does* ride the free-editing `competition.updated`, so a rename must
  not be able to switch discipline behind captured scores. Mitigation: the guard
  lives **inside `update`** and fires only when the submitted discipline differs
  from the stored one — the name/venue/date/toggle edit stays free, the
  discipline change is hard-blocked (RD2) when scores exist or the competition is
  locked. No separate event/endpoint is needed to keep the rule
  server-authoritative.
- **Event-shape across the extension** *(largely moot — RD1)*: there are no
  legacy `competition.created` events to backfill (confirmed; disposable dev DB),
  so no default-injection is required. New creates always carry a required
  discipline; toggles default off. The projection still needs to read the new
  fields, but no cross-version defaulting is load-bearing.
- **New error-handler branch**: the discipline-change-guard error needs its own
  `setErrorHandler` branch (409 + reason), parallel to
  `CompetitionDeleteNeedsConfirmationError`; a missing branch leaks a 500 (same
  risk noted in STORY-003).
- **Unexercisable-in-production guard path**: as with the delete guard, the AC2
  path only truly bites once scoring exists; coverage must come from a unit test
  injecting a captured-scores stub returning *present*, or the path ships
  untested.
- **Scope creep into roster/draw/reports**: ACs 3–5 are phrased in terms of
  roster/draw/report behaviour owned by later stories. Risk of over-building;
  keep this slice to persisting the configuration and exposing it, with the
  downstream behaviour deferred and clearly noted.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Discipline selection scopes available tasks/rules to that class | Partial | Discipline is now **required at create** (RD1) and stored on the aggregate; the actual task-catalogue/scoring scoping is STORY-001-007/008. Provable here that a discipline is captured and is the active selection; full "F3K's tasks, not others'" behaviour proven in the config stories. |
| AC2 | Discipline change under captured scores is guarded, never silent | Yes | **Hard block** (RD2): the guard inside `update` (RD5) refuses (409) when the submitted discipline differs and the existing `CapturedScoresProvider` (or lock) seam reports present; unit-testable now via a stub returning scores-present. End-to-end proof (real scores) deferred to the scoring stories. |
| AC3 | Pilot-numbers option: entries carry a pilot number, shown in draw/reports | Partial | This slice owns the per-competition toggle; the per-entry attribute is STORY-001-005 and its appearance in draw/reports is STORY-001-009/014/015. Enablement provable here; downstream appearance deferred. |
| AC4 | Pilot-classes option: entrants assigned classes; results grouped/ranked by them | Partial | Toggle + **defined class-set** owned here (RD3); assignment is STORY-001-005 and grouping/ranking is a reports concern (STORY-001-014/015). |
| AC5 | Disabling an option removes the attribute from entries | Partial | The toggle state that drives this is owned here; disabling pilot classes **discards** the class-set (RD4). The roster-view behaviour ("no longer required or shown") and entry-value clear are realised in STORY-001-005. |
