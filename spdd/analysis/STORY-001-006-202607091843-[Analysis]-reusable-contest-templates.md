# SPDD Analysis: Reusable Contest Templates (STORY-001-006)

## Original Business Requirement

> # [STORY-001-006] Reusable Contest Templates
>
> > Source: `docs/user-stories/01-organiser.md` §1.3, §3.1 (seeding) · `docs/requirements/high-level-requirements.md` Areas 1.3, 3.1
> > Module: 001 (Organiser MVP) · Estimated effort: **3 days**
>
> ### Background
>
> A club runs the same kinds of contest repeatedly — the monthly F5J, the
> winter F3K series. Configuring draw, scoring and task settings from scratch
> each time is slow and error-prone, and requires understanding the scoring
> maths. A contest template captures a configured competition's settings, with
> its discipline, under a reusable name; creating a competition from the
> template seeds all of it, leaving everything editable. Templates are master
> data shared across competitions.
>
> ### Business Value
>
> - Provide the Organiser with one-step reuse of a proven competition
>   configuration.
> - Support quick, correct event creation without re-deriving scoring settings.
> - Enable template maintenance without disturbing competitions already created
>   from a template.
>
> ### Dependencies and Assumptions
>
> - **Prerequisites**: STORY-001-003 (competitions), STORY-001-004
>   (discipline), STORY-001-007/008 (there must be draw/scoring/task settings
>   worth templating). Recommended late in the setup group.
> - **Data assumptions**: a template is discipline-specific; per-discipline
>   task detail is defined by the deferred per-discipline requirements.
> - **Integration points**: consumed by competition creation (STORY-001-003's
>   flow gains a "seed from template" path).
> - **Business constraints**: templates capture configuration, never roster or
>   results.
>
> ### Scope In
>
> - Save a configured competition (or a fresh configuration) as a named,
>   discipline-specific template capturing draw / scoring / task settings.
> - Create a competition seeded from a template, with every setting still
>   editable.
> - Edit and delete templates without affecting competitions already created
>   from them.
>
> ### Scope Out
>
> - The configuration content itself (STORY-001-004/007/008).
> - Multi-discipline templates — templates are single-discipline by design.
>
> ### Acceptance Criteria
>
> #### AC1: Save a configuration as a template
> **Given** an F5J competition with configured draw, scoring and task settings
> **When** the Organiser saves it as template "Club F5J standard"
> **Then** the template captures those settings and the discipline F5J under
> that name, available when creating future competitions.
>
> #### AC2: Seed a new competition from a template
> **Given** the "Club F5J standard" template
> **When** the Organiser creates a competition from it named "Levin Spring F5J"
> **Then** the new competition's draw, scoring and task settings are pre-filled
> from the template and the Organiser can still change any of them.
>
> #### AC3: Discipline travels with the template and cannot silently mismatch
> **Given** a competition created from the F5J template
> **When** the Organiser opens it
> **Then** its discipline is F5J and cannot be silently changed to a class
> whose tasks differ (the STORY-001-004 discipline guard applies).
>
> #### AC4: Template edits do not touch existing competitions
> **Given** two competitions already created from "Club F5J standard"
> **When** the Organiser edits the template's preparation-time setting, or
> deletes the template entirely
> **Then** both existing competitions keep the settings they were created with,
> unchanged.
>
> ### INVEST Check
>
> Independent (pure master-data feature over existing configuration) ·
> Valuable (repeat events set up in minutes) · Small (3 days, 3 functional
> points: save-as-template, seed-from-template, template lifecycle isolation) ·
> Testable.

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Competition** (`packages/shared/src/competition.ts`): the aggregate whose
  configuration a template snapshots and later seeds. Its current configurable
  surface is **discipline + entry options** (`discipline`,
  `pilotNumbersEnabled`, `pilotClassesEnabled`, `pilotClasses`); identity
  fields (`name`, `date`, `venue`) are per-event and are *not* configuration.
  The draw/scoring/task settings the story headlines do not exist on the
  aggregate yet — see RD1 and the sequencing risk below.
- **Discipline** (`DISCIPLINES` tuple, same file): the closed six-class enum a
  template must carry (story: "a template is discipline-specific"). Additive-
  only by NFR; the template inherits that stance.
- **Master-data aggregate pattern** (Pilot, LandingBonusTable —
  `apps/base/src/pilots/*`, `apps/base/src/landing-tables/*`): the established
  shape for "shared across competitions" data — shared Zod schema →
  event-sourced service under `scope = "master-data"` → in-memory projection
  rebuilt from the log → REST routes → companion library/form views. The
  template is the third master-data aggregate and should follow this shape.
  Landing tables also demonstrate a `duplicate` verb (copy under a fresh id),
  the closest existing relative of copy-on-seed.
- **Competition creation flow** (`CompetitionService.create`,
  `apps/companion/src/competitions/CompetitionForm.tsx`): the integration
  point that gains the "seed from template" path. Creation already builds the
  full aggregate from a validated request; seeding is pre-filling that request,
  not a new kind of write.
- **STORY-001-004 discipline guard** (`CompetitionService.update`): the
  existing locked / captured-scores checks that AC3 leans on. A seeded
  competition is an ordinary competition, so the guard applies with zero new
  work.
- **Reference-checker seams** (`LandingTableReferenceChecker`,
  `RosterReferenceChecker`): the existing pattern for *blocking* master-data
  deletion while referenced. Deliberately **not** used here — copy-on-seed
  semantics (RD4) mean no competition ever references a template, so template
  deletion is free.
- **EventStore + Attribution** (`apps/base/src/eventstore/event-store.ts`,
  `attribution.ts`): append-only attributed log (D4). Template create / update
  / delete and the seeding act itself are mutations and ride this for free.

### New Concepts Required

- **ContestTemplate**: a named, discipline-specific master-data record holding
  a **configuration snapshot** — today: discipline + entry options
  (`pilotNumbersEnabled`, `pilotClassesEnabled`, `pilotClasses`); tomorrow:
  the draw / scoring / task settings of STORY-001-007/008/009, added
  additively (RD1/RD2). It deliberately excludes competition identity (name,
  date, venue) and, per the business constraint, roster and results. Relates
  to Competition only at two moments: *capture* (snapshot a competition's
  settings into a new template) and *seed* (copy the template's settings into
  a new competition); no live link exists in either direction (RD4).
- **Save-as-template capture**: an operation on an existing competition that
  reads its current configuration and creates a template from it under a
  supplied name. The story also allows saving "a fresh configuration" — i.e.
  creating/editing a template directly without going through a competition.
- **Seed-from-template creation**: a variant of competition creation where the
  template's snapshot pre-fills the configuration and the Organiser supplies
  the per-event identity (name, date, venue). Everything remains editable
  afterwards (AC2) because the result is an ordinary competition.

### Key Business Rules

- **Copy-on-seed, never reference** (AC2/AC4): seeding copies values; the
  competition owns its settings outright afterwards. Editing or deleting the
  template can therefore never touch an existing competition — isolation is
  structural, not enforced. Governs ContestTemplate ↔ Competition.
- **Templates capture configuration, never roster or results** (business
  constraint): the snapshot's field set is exactly the competition's
  *configuration* surface — never entries, draws-as-generated, or scores.
  Governs the ContestTemplate payload.
- **A template is single-discipline** (scope): discipline is a required,
  first-class field of the template; the seeded competition starts with it
  (AC3), after which the ordinary STORY-001-004 discipline guard governs
  changes. Governs ContestTemplate ↔ Discipline.
- **Template names are unique, case-insensitively** (RD3): templates are
  picked by name at creation time, so "Club F5J standard" must denote one
  template. A colliding create/update is a named validation refusal. (A
  deliberate departure from landing tables, which tolerate duplicates —
  justified because templates are *selected by name* in a picker; landing
  tables are selected in context.)
- **Seeded competitions are ordinary competitions** (AC2/AC3): no special
  state, no template-aware behaviour post-creation; every existing guard
  (discipline lock, delete confirmation, roster rules) applies unchanged.
- **Entry options are part of the configuration** (RD2): the pilot-numbers /
  pilot-classes toggles and the allowed class-name set travel with the
  template; the entry-option invariants (enabled ⇒ ≥1 class, dedupe, discard
  on disable) hold inside the template exactly as they do on a competition.

## Strategic Approach

### Resolved Design Decisions (interactive review with the Organiser)

Settled in this session — do not re-litigate.

- **RD1 — Build now; the snapshot grows additively.** The story's stated
  prerequisites (STORY-001-007/008) have not landed: today a competition's
  only configurable settings are discipline + entry options. Rather than
  defer, the template captures **whatever the competition's configuration
  surface is at the time**, and the payload extends additively as scoring
  (007), per-task (008) and draw-spec (009) settings land — the same
  additive-only stance the NFRs mandate for new classes. Save / seed /
  lifecycle mechanics ship complete now; later stories add fields to the
  snapshot, not new mechanics.
- **RD2 — Entry options are templated.** `pilotNumbersEnabled`,
  `pilotClassesEnabled` and the allowed `pilotClasses` set are per-competition
  configuration (not roster or results), and a club's "standard" event
  plausibly always uses the same class groupings.
- **RD3 — Template names are unique, case-insensitively.** Enforced as a
  service-level invariant against the template projection (Zod cannot see
  sibling templates); collision is a named validation refusal. Deliberately
  stricter than landing tables because templates are picked by name.
- **RD4 — Copy-on-seed with event-log-only provenance.** The competition
  aggregate carries **no** template reference; the seeding act is recorded in
  the immutable event log (D4) for audit only. Consequences: AC4 isolation is
  guaranteed by construction; template deletion needs **no reference checker**
  and is always free; there is no dangling-reference problem when a template
  is deleted.

### Solution Direction

- Introduce **ContestTemplate as the third master-data aggregate**, cloned
  from the landing-table module shape: shared Zod schemas in
  `packages/shared`, an event-sourced `TemplateService` +
  `TemplateProjection` under `scope = "master-data"`, REST routes, and a
  companion library/form pair — full CRUD with attributed events, tombstone
  delete, projection rebuilt from the log.
- **Capture** ("save as template") is a service operation that reads the
  source competition from the existing `CompetitionProjection`, extracts its
  configuration fields, and appends an ordinary template-created event —
  reusing the read side, no new competition behaviour.
- **Seed** is a *pre-fill*, not a new write path: the flow reads the template
  and produces a create-competition request (template configuration + the
  Organiser's per-event identity fields), which flows through the existing
  `CompetitionService.create` validation and guards unchanged. Whether the
  merge happens companion-side (form pre-fill) or base-side (a
  create-from-template endpoint) is a tactical choice for the REASONS Canvas;
  strategically the invariant is that **the resulting competition is
  indistinguishable from a hand-configured one**.
- General data flow: companion form → REST → Zod-validated request → service
  invariants (name uniqueness, source-competition existence) → attributed
  event append → projection → read back.

### Key Design Decisions

- **Snapshot copy vs live reference to the template.** A live reference would
  make "update all my events when the template improves" possible, but
  directly violates AC4 and the business value of "maintenance without
  disturbing competitions". → **Copy-on-seed (RD4)**: isolation by
  construction, free deletion, no checker, no sync semantics.
- **Template payload: mirror of competition-configuration fields vs opaque
  settings blob.** A typed mirror (reusing the same field schemas the
  competition uses) keeps validation identical in both places and lets the
  compiler flag drift when 007/008/009 add settings; an opaque blob would
  template unknown future settings "for free" but validate nothing. →
  **Typed mirror sharing the competition's configuration field schemas**;
  each future settings story extends both the competition and the template
  snapshot in the same change (recorded as an explicit obligation on
  007/008/009).
- **Where seeding lives: companion pre-fill vs base endpoint.** Strategic
  requirement only: seeding must pass through the standard create validation
  and the seeding act should be attributable in the log (RD4). Direction
  recommended to REASONS Canvas: a base-side create-from-template path keeps
  the provenance in the log authoritative rather than inferred; final call is
  tactical.
- **Deletion policy.** Landing tables block deletion while referenced; pilots
  block while rostered. Templates, having no references (RD4), **delete
  freely** with a plain tombstone — matching AC4's explicit "deletes the
  template entirely → existing competitions unchanged".

### Alternatives Considered

- **Defer the story until 007/008/009 land** (the story's own "recommended
  late" note): rejected (RD1) — the mechanics are independent of which
  settings exist, and building now delivers reuse value for discipline +
  entry options immediately while later stories only append fields.
- **Model a template as a hidden/archetype competition** (a flagged
  `Competition` cloned on use): rejected — pollutes the competition registry
  and its lifecycle guards (lock, scores, deletion confirmation) with a
  non-event, and drags identity fields (date, venue) into something that has
  none. Master data deserves its own aggregate, per the existing pattern.
- **Reference-checker-guarded deletion** (the landing-table pattern): rejected
  — with copy-on-seed there is nothing to reference; a guard would be dead
  code and would contradict AC4's free-delete scenario.
- **Multi-discipline or discipline-less templates**: explicitly scoped out by
  the story; single-discipline keeps the template compatible with the
  STORY-001-004 guard and the future per-discipline task settings.

## Risk & Gap Analysis

### Requirement Ambiguities

- **What is templatable today** *(RESOLVED — RD1)*: the headline settings
  (draw / scoring / task) don't exist yet; the template snapshots the current
  configuration surface (discipline + entry options) and grows additively.
- **Entry options in or out** *(RESOLVED — RD2)*: in.
- **Name uniqueness** *(RESOLVED — RD3)*: unique, case-insensitive.
- **Provenance** *(RESOLVED — RD4)*: event-log only; no aggregate reference.
- **"Save a fresh configuration as a template"**: the story allows creating a
  template without a source competition. Assumed to mean ordinary template
  create/edit forms (the master-data CRUD path) alongside the
  save-from-competition shortcut — worth confirming the companion UX
  expectation in REASONS Canvas, but both paths converge on the same create
  event.
- **Re-saving over an existing template**: when the Organiser saves a
  competition as a template whose name already exists — refuse (RD3 collision)
  or offer "overwrite existing template"? Recommend refuse-with-named-error
  for MVP (the Organiser can edit the existing template instead); flag for
  UX confirmation.
- **AC4's "preparation-time setting"** names a STORY-001-008-era field that
  doesn't exist yet. The AC is read as *any* templated setting; the concrete
  test uses an entry-option field today and gains preparation time when 008
  lands.

### Edge Cases

- **Seeding from a template, then the template is edited/deleted mid-flow**:
  harmless under copy-on-seed — the create request already carries the copied
  values; worst case the Organiser seeds from the pre-edit snapshot they saw.
  The single synchronous SQLite writer serialises the log either way.
- **Save-as-template from a competition that is deleted before the save
  lands**: source-competition existence is checked at command time against the
  projection; a vanished source is a named not-found refusal.
- **Template with `pilotClassesEnabled` but the class set emptied by edit**:
  the same cross-field invariant as competitions (enabled ⇒ ≥1 class) must
  hold on the template, or seeding would produce an invalid create request.
  Sharing the competition's field schemas (Key Design Decisions) makes this
  automatic.
- **Case-only rename collisions** (RD3): renaming "club f5j standard" to
  "Club F5J Standard" while another template holds that name — the
  case-insensitive check must exclude the template being edited itself.
- **Seeded competition immediately edited to a different discipline** (AC3):
  legal while unlocked and score-free — AC3 requires the *guard*, not
  immutability; the existing STORY-001-004 behaviour is exactly right and
  needs a regression test from the seeded path, not new code.
- **Duplicate of a template** (if the landing-table `duplicate` verb is
  mirrored): a verbatim name copy would violate RD3; duplication must
  disambiguate the name or be omitted.

### Technical Risks

- **Snapshot/competition schema drift as 007/008/009 land**: the central risk
  of RD1. Each future settings story must extend the template snapshot and the
  seed mapping in the same change, or templates silently stop covering new
  settings. Mitigation — share the configuration field schemas between
  competition and template in `packages/shared` so an added field is a
  compile-visible change in both, and record the obligation in those stories'
  analyses.
- **Two writers of competition state** (seed path): if seeding becomes a
  base-side endpoint, it must delegate to `CompetitionService.create` (or its
  exact validation + guards), never append `competition.created` itself —
  otherwise the discipline/entry-option invariants fork. Low risk if the
  delegation rule is stated in the REASONS Canvas.
- **Uniqueness check race**: two concurrent creates with the same name — moot
  in practice under the base's single synchronous SQLite writer (the same
  argument the existing reference-checker comments rely on), but the check
  must read current projection state at command time.
- **Growth/scale**: templates are a handful of records per club; no
  projection-size or rebuild concern (bounded far below the roster analysis's
  deferred NFR thresholds).

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Save a configured competition as a named, discipline-carrying template | Yes | Fully in scope via save-as-template capture from the competition projection. "Configured draw, scoring and task settings" is today satisfied by discipline + entry options (RD1); the AC's full literal breadth arrives as 007/008/009 extend the snapshot. |
| AC2 | Seed a new competition from a template; everything pre-filled and still editable | Yes | Copy-on-seed through the standard create path makes the result an ordinary, fully editable competition by construction. |
| AC3 | Discipline travels with the template; no silent mismatch (001-004 guard applies) | Yes | Zero new mechanism: the template carries the discipline into create; the existing locked/captured-scores guard covers subsequent changes. Needs a regression test from the seeded path only. |
| AC4 | Template edits/deletes never touch competitions already created from it | Yes | Structurally guaranteed by copy-on-seed (RD4): no reference exists to propagate through. The AC's "preparation-time setting" example is tested with an existing settings field until 008 lands. |

---

**House-rule cross-check (per CLAUDE.md §2):** no conflict with the rule docs —
templates are a product-level convenience over configuration; they copy
settings whose *values* are governed elsewhere (the 007 guardrails will apply
to templated values exactly as to hand-entered ones once that story lands:
seeding must not become a route around a rule-deviation warning — recorded
here as an explicit obligation on STORY-001-007's analysis). Checked against
`high-level-requirements.md` Areas 1.3/3.1 and `users.md`: consistent —
templates are Organiser master data, seeding is part of competition creation.
The one requirement-level tension is **sequencing**: the story names
STORY-001-007/008 as prerequisites but they are unbuilt; resolved (RD1) by an
additively growing snapshot rather than a requirements change.
