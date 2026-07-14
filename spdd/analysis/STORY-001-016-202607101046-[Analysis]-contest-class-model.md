# SPDD Analysis: Contest Class Model — Seeded Rulesets and Custom Clones

> Foundational story. Realises **D12** (already recorded in
> `docs/requirements/decisions.md`) and **NFR-1/NFR-2**. Introduces the Contest
> Class Model as the one place a class's shape lives, pivots `competition.discipline`
> to a model **reference**, and **supersedes** the standalone landing-table
> library (STORY-001-002). Reshapes 001-004/007/008 as tracked follow-ups.

## Original Business Requirement

# [STORY-001-016] Contest Class Model — Seeded Rulesets and Custom Clones

> Source: `docs/requirements/non-functional.md` NFR-1 (one centralised task model) · NFR-2 (additive-only extensibility) · `docs/requirements/high-level-requirements.md` Area 3 · `docs/requirements/decisions.md` **D12 (to be recorded)** · `docs/requirements/rules/` (authoritative, read-only)
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**
> **Foundational** — underpins STORY-001-004, 001-007, 001-008; supersedes STORY-001-002.

### Background

Every FAI class fixes its own scoring numbers — the group-score basis, the
drop-worst threshold, the points-per-flight-second rate, and the mandated
landing table. Until now the software has treated `discipline` as a bare enum
and let those numbers be configured loosely per competition, with landing
tables kept as free-floating master data selected per event. That approach
hard-codes per-class behaviour in application code and forces a code change to
add a class — a direct conflict with **NFR-1** ("there must be exactly one
place that knows a task's shape; nothing else may hard-code per-class
behaviour") and **NFR-2** ("adding a new competition type must not require
changing existing code").

This story realizes NFR-1/NFR-2 by introducing the **Contest Class Model** — a
first-class, seeded, cloneable definition the application *defers to* instead
of switching on discipline. Each of the six MVP classes ships as a **stock
model** encoding its scoring basis, drop-worst rule, points-per-second, and
its own landing table. The Organiser never edits a stock model; to run a
club-level variation they **clone** it into a named custom model ("F5L – local
rule") and change the value there. That clone is the deliberate,
auditable rule deviation — no silent departure, and reports can name exactly
which model a competition ran and how it differs from the FAI stock.

The class model **owns its landing table outright** — "pick F5L, you get the
F5L table, period." This supersedes STORY-001-002's standalone landing-table
library: tables are managed *within* class definitions, not chosen
independently per competition.

**House-rule reconciliation (house rule 1).** The stock models are a
**derived** encoding of the read-only rule docs (`docs/requirements/rules/`) —
regenerated when those docs change, never authoritative over them. `discipline`
becomes a *reference* to a model, not a copy of a rule number scattered across
the competition aggregate. This position is to be recorded as **decision
D12**, and the existing "key into the rule corpus, not a copy" note in the
competition configuration reconciled to it.

### Business Value

- Provide the Organiser with correct-by-default, class-complete definitions for
  all six MVP classes, seeded and ready — no per-event re-keying of scoring
  numbers or landing tables.
- Support deliberate club-level rule variations as **named, auditable custom
  models**, never silent per-field overrides.
- Enable a new class to be added later as a **new seeded model with no
  application-code change** (NFR-2), and give every downstream feature (draw,
  capture, scoring, reports) **one** place to read a class's shape from
  (NFR-1).

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (a competition exists to reference a model).
- **Data assumptions**: all rule numbers and landing-table shapes derive from
  `docs/requirements/rules/` (e.g. F5L: 2 points/second, drop-worst beyond 5
  rounds, the 100→0 landing table; F5J: 1 point/second, drop-worst beyond 4
  rounds, the 50→0 table; F3B: three tasks normalised separately, discard
  per task beyond 5 rounds). These are read-only inputs, not editable in the
  product.
- **Integration points**: reshapes **STORY-001-004** (discipline selection
  becomes class-model selection), **STORY-001-007** (scoring options are read
  from the model; deviation is the clone-and-edit here), and **STORY-001-008**
  (per-task parameters and penalties are additive slots on the model).
  **Supersedes STORY-001-002** (standalone landing-table library retires into
  table management within class models).
- **Business constraints**: house rule 1 — the model must not contravene the
  rule docs and is derived from them; **decision D12** to be recorded; the
  MVP class set is the six FAI classes, additive thereafter (NFR-2).

### Scope In

- A **Contest Class Model** definition holding: identity (name, source-class
  metadata), the group-score basis (best raw = 1000 scaled; an inverted marker
  for speed tasks; a separate-per-task marker for F3B), the drop-worst rule
  (threshold + unit — round vs task), points-per-second, and an **owned
  landing table**.
- **Seed one stock model per MVP class** (F3B, F3J, F3K, F5J, F5K, F5L),
  derived from the rule docs; stock models are **read-only**.
- **Clone** a stock model into a **named custom model** and **edit** its
  rule-fixed values; the difference from the source model is recorded as an
  auditable deviation.
- **Referential integrity**: a model referenced by a competition cannot be
  deleted; stock models can never be edited or deleted.
- A **competition references a class model by id** (the data linkage that
  replaces the bare discipline enum).
- Landing tables are **managed within class models** (superseding the
  standalone library).

### Scope Out

- The class-model **selection UX** and the change-with-captured-scores guard —
  reshaped **STORY-001-004**.
- Per-task parameters, metrics, and **penalties** detail — additive slots on
  the model, owned by **STORY-001-008**.
- **Applying** the scoring basis, drop-worst or landing table during actual
  score computation — scoring stories (**STORY-001-007** and per-discipline).
- The scoring-options screens and any per-field deviation warnings — reshaped
  **STORY-001-007** (now expressed as clone-and-edit here).
- **Rendering** deviations in reports — reports stories consume the recorded
  deviation; this story records it.

### Acceptance Criteria

#### AC1: Six stock models are seeded from the rules
**Given** a freshly initialised system
**When** the Organiser opens the contest classes
**Then** exactly six stock models are present — F3B, F3J, F3K, F5J, F5K, F5L —
each showing its group-score basis, drop-worst rule, points-per-second and
landing table, and each marked as a read-only FAI stock definition.

#### AC2: A stock model owns its landing table
**Given** the F5L stock model
**When** the Organiser views it
**Then** its landing table is F5L's mandated table (100 points at ≤ 0.2 m down
to 0 beyond 15 m) and is presented as part of the model — not as a separately
selected table.

#### AC3: Class-specific numbers reflect the rule
**Given** the F5L and F5J stock models
**When** the Organiser compares them
**Then** F5L shows 2 points per flight second and drop-worst once more than 5
rounds are flown, while F5J shows 1 point per flight second and drop-worst
once more than 4 rounds are flown.

#### AC4: F3B stock model reflects separate per-task normalisation
**Given** the F3B stock model
**When** the Organiser views it
**Then** it is marked as normalising its three tasks separately (round score
= the sum of the per-task partials) and its drop-worst unit is **per task**
beyond 5 rounds — distinct from the single-group-score man-on-man classes.

#### AC5: Clone a stock model into a named custom model
**Given** the F5L stock model
**When** the Organiser clones it, names the copy "F5L – local rule" and changes
drop-worst to "once more than 3 rounds are flown"
**Then** a new custom model exists with that name and threshold, the F5L stock
model is unchanged, and the custom model is recorded as derived from F5L.

#### AC6: A custom model records its deviation from the stock rule
**Given** the "F5L – local rule" custom model cloned from F5L with drop-worst
changed to "beyond 3 rounds"
**When** the model is viewed
**Then** it is flagged as deviating from the FAI F5L rule, showing the stock
value ("beyond 5 rounds") alongside the chosen value ("beyond 3 rounds").

#### AC7: Stock models are read-only
**Given** the F3J stock model
**When** the Organiser attempts to change one of its rule-fixed values directly
**Then** the system prevents the change and directs the Organiser to clone the
model into a custom model instead.

#### AC8: A competition references a class model
**Given** a competition
**When** it is associated with the "F5L – local rule" custom model
**Then** the competition's class definition is taken from that model (no bare
discipline value stands alone), and the association is recorded.

#### AC9: An in-use model cannot be deleted
**Given** a competition references the "F5L – local rule" custom model
**When** the Organiser attempts to delete that model
**Then** the system prevents the deletion and explains that a competition
depends on it; stock models cannot be deleted under any circumstances.

#### AC10: Clone requires a unique, non-blank name
**Given** the Organiser clones a model
**When** they supply a blank name, or a name already used by another model
**Then** the system rejects the request with a clear message and no model is
created.

#### Non-Functional Expectations

- Adding a seventh class must be achievable by **adding a new seeded model
  alone** — no change to existing application behaviour, stored data or the
  five other classes' results (NFR-2).
- Stock models are a **derived** snapshot of the read-only rule docs: they must
  never contravene those docs, and are the single place the rest of the system
  reads a class's shape from (NFR-1). Editing a custom model never alters a
  stock model or the rule docs.

### INVEST Check

**Independent** — delivers the class-model aggregate and its seed standalone;
the reference linkage needs only an existing competition (001-003).
**Valuable** — correct-by-default class definitions and named, auditable
deviations, with no per-event re-keying. **Small-ish** — 5 days, 3 functional
points (seeded stock catalogue with owned landing tables · clone-to-custom +
edit as the auditable deviation, with referential/stock-immutability
protection · competition→model reference pivot). **Testable** — every AC is a
concrete Given-When-Then a QA engineer can exercise without reading source.
Foundational: it reshapes 001-004/007/008 and supersedes 001-002 — those
supersession edits are tracked as follow-ups, not carried inside this story.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Discipline** (`packages/shared/src/competition.ts`): the six-value FAI enum
  (`F3B F3J F3K F5J F5K F5L`), today embedded directly on the `Competition`
  aggregate and on `ContestTemplate`, and carried verbatim on
  `competition.created/updated` and `contestTemplate.*` event payloads. Its own
  source comment already anticipates this pivot ("under D12 a class's numbers …
  live in the one derived Contest Class Model, which `discipline` pivots to
  *reference*"). This story converts it from an embedded value to a **reference**.
- **LandingBonusTable** (`packages/shared/src/landing-table.ts`,
  `apps/base/src/landing-tables/*`): today a **standalone master-data aggregate**
  under scope `master-data`, with its own create/update/**duplicate**/delete
  service, projection, routes and companion UI. D12 **repurposes** this: a table
  becomes an **owned component of a class model**, not an independently selected
  library entry. The `duplicate` verb and deep-copy-on-apply discipline are a
  direct precedent for cloning. *(As built: the standalone landing-tables module —
  service, projection, routes, checker — was removed once tables moved inside the
  model, commit `4170e60`; `LandingBonusTable` survives only as a type owned per
  `TaskParameterSet`.)*
- **Competition** (`apps/base/src/competitions/*`): the aggregate that will hold
  the model reference. Its existing **discipline-change guard** (blocks a change
  once the competition is locked or has captured scores) is the behavioural
  precedent for the (out-of-scope-here) model-change guard in 001-004.
- **ContestTemplate** (`packages/shared/src/contest-template.ts`,
  `apps/base/src/templates/*`): a configuration snapshot that also carries
  `discipline`; it too must pivot to a model reference so a seeded competition
  inherits a class model, not a bare enum. It also demonstrates the
  **name-uniqueness** (`assertNameAvailable`, trimmed + case-insensitive) and
  **provenance/audit event** (`contestTemplate.seeded`) patterns reusable here.
- **Event-sourcing substrate** (`apps/base/src/eventstore/*`, per-aggregate
  `projection.ts` + `service.ts`): the fixed architecture — a single-writer
  append-only SQLite `EventStore`, in-memory `Projection`s rebuilt from the log
  on boot, `Service`s that parse (Zod) → check invariants → append → apply.
  The class model is a new aggregate slotting into this same shape.
- **Reference-checker seam** (`landing-tables/table-reference-checker.ts` with
  its `NoTaskConfigYetChecker` stub; `roster/roster-reference-checker.ts`'s
  real `ProjectionRosterReferenceChecker`): the established pattern for
  **referential-integrity-on-delete**. AC9 (in-use model cannot be deleted)
  needs a *competition→model* checker of exactly this shape.

### New Concepts Required

- **ContestClassModel** (`packages/shared/src/class-model.ts`, new aggregate):
  the first-class definition. **As built the model shape grew past this story's
  original flat "points-per-second + one owned landing table"**: those two
  fields were **folded into a `tasks: TaskParameterSet[]` list** (one task for the
  man-on-man classes, three for F3B, five for F5K) so per-task detail from
  STORY-001-008 could ride the same aggregate rather than being deferred out of
  it. Each `TaskParameterSet` owns its own `pointsPerSecond` (**nullable** — null
  where the task fixes no single rate), `landingScored` + `landingTable`
  (**nullable, owned outright**, D12), `timingPrecision`, `penaltyTypes`, NLH
  `nlhCoefficients` (F5K), and `minGroupSize`. Model-level it carries: identity
  (display `name`, `sourceClass` metadata, `origin`), the group-score `basis`
  (`single-group` vs `separate-per-task` for F3B), a model-level `speedInverted`
  marker, the `dropWorst` rule (`{ threshold, unit }`, unit `round` vs `task`),
  `lonePilotBehaviour` (`dummy`/`annul`, STORY-001-011), `minimumForValidContest`
  (STORY-001-026), and `groupSizeMinimumClause`. Two kinds: **stock** (`origin:
  "stock"`, seeded, read-only, one per class) and **custom** (`origin: "custom"`,
  cloned, editable, named). Relates to `Competition` as its referenced class
  definition; each task **contains** its `LandingBonusTable` rather than pointing
  at a library one.
- **Stock-model catalogue / seed** (`STOCK_CLASS_MODELS` + `seedStockModels`):
  the derived encoding of the six classes from the rule docs, materialised into
  the event log via a **`classModel.seeded` event** so projections rebuild
  deterministically. The seed is **idempotent — upsert-by-id keyed on the
  deterministic `stock-<discipline>` id** (`stockModelIdFor`): a stock model
  already present is skipped, so a restart never duplicates or orphans a
  referencing competition. Runs on the single synchronous SQLite writer in
  `buildApp`.
- **Model provenance / deviation record** (`deriveDeviations`): a custom model
  records the **stock model it was cloned from** (`sourceModelId`), and the
  deviation set is **derived on read by diffing** the custom model against its
  source (never persisted stale, D4) — a structured `{ field, stockValue,
  chosenValue }` per differing **rule-fixed** field (AC6). Identity fields (id,
  name, origin, sourceModelId, sourceClass) are excluded; tasks are diffed
  positionally by task id with dotted field names.
- **Competition→model reference** (`classModelId`): now a **required field**
  (`z.string().min(1)`) on the `Competition`, `ContestTemplate` and task-config
  aggregates and their event payloads — the id linkage that **replaces** the
  embedded `discipline` value (AC8). The bare `discipline` enum survives only as
  the model's `sourceClass` metadata, not as a Competition field.

### Key Business Rules

- **NFR-1 — single source of a class's shape**: after this story, nothing may
  read scoring numbers by switching on `discipline`; the model is the sole
  authority. Governs `Competition`, all downstream scoring/draw/report readers.
- **NFR-2 — additive extensibility**: a seventh class is a new seed row only —
  no change to the aggregate shape, existing data, or the other five models.
  Governs the model schema and the seed mechanism.
- **House rule 1 — derived, never authoritative**: stock model numbers are a
  snapshot of the read-only rule docs and must never contravene them. Governs
  the seed's *values* and the "regenerated when docs change" obligation.
- **Stock immutability** (AC7): a stock model can never be edited or deleted;
  the only path to a variation is clone-then-edit. Governs the model service's
  command guards. *(No existing aggregate has a read-only sub-kind — this is a
  new invariant, not a reuse.)*
- **Referential integrity** (AC9): a model referenced by any competition cannot
  be deleted; stock models are undeletable regardless of references. Governs
  delete, via a competition→model reference checker.
- **Name uniqueness + non-blank** (AC10): custom-model names are required,
  trimmed, and unique case-insensitively across models — the existing template
  rule, reused.
- **Every competition resolves to exactly one model** (AC8): no bare discipline
  value stands alone once the pivot lands; a competition without a model
  reference is an invalid state to be reconciled (see Risks — back-fill).
- **F3B is structurally distinct** (AC4): separate per-task normalisation and a
  **per-task** drop-worst unit — the model shape must express this without a
  code branch, and without pulling in the full per-task detail deferred to 008.

---

## Strategic Approach

### Solution Direction

Introduce **ContestClassModel as a new event-sourced aggregate** that reuses the
repo's established shape end-to-end: a Zod-validated domain type + request
schemas in `packages/shared`, new `classModel.*` event types + `*ToCreatedPayload`
mappers in `events.ts`, and a `class-models/{projection,service,errors}.ts`
slice in `apps/base` wired into `buildApp` exactly as landing-tables/templates
are. The general data flow is unchanged: **route → service (parse → guard →
append event → apply to projection) → projection read**.

Three functional slices, mirroring the story's own decomposition:

1. **Seeded stock catalogue with owned landing tables.** A new **seed-on-init**
   step (idempotent, keyed on stable stock ids) materialises the six stock
   models — each embedding its landing table — into the event log if absent.
   Values are transcribed from the rule docs (F5L 2 pt/s beyond 5; F5J 1 pt/s
   beyond 4; F3B separate-per-task, per-task discard beyond 5; etc.). The
   landing table rides **inside** the model payload (owned), not as a separate
   `master-data` table event.
2. **Clone-to-custom + edit as the auditable deviation.** A `clone` command
   (precedented by `landingTable.duplicate`) deep-copies a stock model into a
   named custom model, recording its source id; an `update`/edit command changes
   rule-fixed values on a *custom* model only, computing and recording the
   per-field deviation (stock value vs chosen value). Stock immutability,
   referential-integrity-on-delete (new competition→model checker), and
   name-uniqueness guards live in the service.
3. **Competition→model reference pivot.** Add a `classModelId` reference to the
   `Competition` (and `ContestTemplate`) aggregate + payloads; the association is
   recorded per AC8. Selection UX and the change-with-scores guard are explicitly
   001-004's, not built here.

The **standalone landing-table library retires** into model-owned tables:
existing landing-table events stay in the immutable log (D4 — repurpose, not
purge), but the independent selection path is superseded. Reconciling the
existing landing-table code/UI/routes and the `NoTaskConfigYetChecker` seam is a
tracked follow-up, surfaced under Risks per house rule 2.

### Key Design Decisions

- **Stable, deterministic stock-model ids** (e.g. a fixed id per class) vs random
  UUIDs → **Adopted: deterministic stock ids** via `stockModelIdFor` (`F5L →
  "stock-f5l"`), so the seed is idempotent (upsert-by-id), competitions reference
  a stable target, and re-generation updates the same row. Custom models keep
  random UUIDs (`crypto.randomUUID()` on clone). Owned landing-table and task ids
  derive deterministically from the stock id too (`stock-f5l-landing`,
  `stock-f5l-task`).
- **Seed materialised into the event log vs computed in-memory at boot** →
  **Adopted: a dedicated `classModel.seeded` event appended once, idempotently**
  by `seedStockModels` (skips any stock id already projected), so stock models are
  first-class log citizens like everything else and state stays derivable from the
  log (D4). The projection treats `classModel.seeded` / `.created` / `.updated`
  identically (full model payload), with `.deleted` as a tombstone.
- **Model shape must accommodate the F3B outlier without a code branch** →
  **Adopted the basis + drop-worst-unit markers — and went further than the
  original defer-to-008 plan**: rather than carrying F3B markers alone and
  deferring per-task detail, the aggregate now holds the **full
  `TaskParameterSet[]`** (008's slots folded in). F3B is expressed purely as data
  — `basis: "separate-per-task"`, `dropWorst.unit: "task"`, three tasks with
  their own precision/rate/penalties and `minGroupSizeAllCompetitorsFallback` —
  with no `switch (discipline)` anywhere. Nullable per-task `pointsPerSecond` /
  `landingTable` absorb the F3K/F5K/F3B-Distance-Speed outliers that have no single
  rate or table.
- **Deviation recorded as structured stock-vs-chosen per field vs a free-text
  note** → **Adopted structured** (`ModelFieldDeviation { field, stockValue,
  chosenValue }`), derived on read by `deriveDeviations` diffing custom-vs-source
  (never persisted), so AC6 and future report rendering are data-driven.
- **Pivot `Competition.discipline` → `classModelId` as a replacement vs an
  additive parallel field** → **Adopted the hard replacement**: `classModelId` is
  a **required** field (`z.string().min(1, "A contest class is required")`) on
  `Competition`, `ContestTemplate` and task-config, and the bare `discipline`
  field is gone from the Competition write path (it survives only as the model's
  `sourceClass` metadata). Green-field status (no real data, per CLAUDE.md) made
  the "back-fill existing competitions" concern moot — no reconciliation event was
  needed.
- **Reference-checker direction inverts** (was: task-config → landing table;
  now: competition → model) → **Adopted `ProjectionClassModelReferenceChecker`**
  backed by the competition projection (filters `competition.classModelId ===
  modelId`), mirroring `ProjectionRosterReferenceChecker`, with no force/override
  path (AC9).

### Alternatives Considered

- **Keep `discipline` enum and hang a config blob off it** — rejected: exactly
  the "numbers scattered across configuration / hard-coded per-class behaviour"
  NFR-1 forbids and D12 overturns.
- **Keep landing tables as an independent library and *link* a model to a table
  by id** — rejected: contradicts "owns its landing table outright … pick F5L,
  you get the F5L table, period" (AC2) and D12's supersession of 001-002;
  reintroduces the free-floating selection the story removes.
- **Seed via a DB migration / fixture rather than the event log** — rejected:
  breaks D4 (state derivable from the immutable log) and the single-writer
  discipline; the repo has no migration-seed precedent and every aggregate is
  log-born.
- **A per-field "override with warning" on a shared model instance** (the
  pre-D12 001-007 shape) — rejected by D12 itself: a deviation must be a **named
  custom clone**, not a silent per-field override.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **D12 status**: the story header says "**D12 (to be recorded)**", but D12 is
  **already recorded** in `docs/requirements/decisions.md` (dated 2026-07-10).
  The story text is stale on this point — no action needed beyond noting the
  prerequisite is satisfied.
- **"Points-per-second" and "an owned landing table" as universal fields** →
  **Resolved: per-task and nullable.** Both moved onto `TaskParameterSet` as
  `pointsPerSecond: number | null` and `landingTable: LandingBonusTable | null`
  gated by a `landingScored` boolean. F3B Distance/Speed, F3K tenths, and F5K
  summed-per-task all carry `null` rates; only landing-scored tasks carry a table
  (a table on a `landingScored:false` task is dropped at save, not persisted).
- **"Regenerated when those docs change"** → **Resolved: no update path required
  (green-field).** `STOCK_CLASS_MODELS` is a checked-in derived artifact
  transcribed from the rule docs; `seedStockModels` seeds any *missing* stock
  model by its stable `stock-<discipline>` id. Because there is no live data to
  preserve (CLAUDE.md), re-deriving an already-seeded model in place is
  deliberately out of scope — a rule-doc change is applied by editing the artifact
  and re-initialising a fresh log; no in-place upsert or version bump was needed.
- **Deviation granularity** → **Resolved: every differing rule-fixed field,
  identity fields excluded.** `deriveDeviations` emits one entry per changed
  scoring-shape field (basis, speedInverted, dropWorst.threshold/unit,
  lonePilotBehaviour, and each task's rule-fixed slots diffed positionally by id);
  `name` and other identity fields are deliberately not counted as deviations.
- **What "rule-fixed values" are editable on a custom clone** → **Resolved:
  enumerated in `updateClassModelRequestSchema`.** Editable surface = `name`,
  `basis`, `speedInverted`, `dropWorst`, `lonePilotBehaviour`, and the full
  `tasks[]` shape (name, timing precision, points-per-second, speedInverted,
  landing table, per-round override, NLH, penalty types, min group size).
  `origin` / `sourceModelId` / `sourceClass` / `groupSizeMinimumClause` /
  `minimumForValidContest` are **preserved server-side** as non-editable identity
  metadata (008's per-task detail was ultimately included, not deferred).

### Edge Cases

- **Existing competitions with a bare `discipline` and no model reference** →
  **Resolved: no back-fill needed (green-field).** `Competition.classModelId` is a
  required field and `discipline` was removed from the Competition write path
  outright; with no real data to migrate (CLAUDE.md), no reconciliation event was
  written.
- **Existing `ContestTemplate`s** → **Resolved the same way**: `ContestTemplate`
  and task-config both pivoted to a required `classModelId`; a seeded competition
  inherits a model reference, never a bare enum.
- **Cloning a custom model** (not just a stock one) → **Resolved: supported.**
  `clone(sourceId, …)` accepts any source and records it as `sourceModelId`;
  cloning a custom model points the clone at that custom source (deviations are
  derived against the immediate source, not chained back to stock).
- **Re-seed after a stock model is referenced/cloned** → **Resolved: skip-if-
  present, by design.** `seedStockModels` skips any stock id already present, so a
  re-seed never duplicates or orphans a referencing competition. Propagating a
  rule-doc correction into an already-seeded stock model in place is intentionally
  not supported (green-field — no live data to preserve; re-initialise a fresh log
  instead).
- **Name collision between a custom model and a stock model's display name**
  (e.g. naming a clone "F5L"): AC10 covers uniqueness across models — confirm
  stock names participate in the uniqueness set.
- **Deleting the standalone landing-table library data**: retiring the library
  (D12) while existing landing-table events remain in the log (D4) — the
  companion UI and routes for standalone tables must be handled without a purge.

### Technical Risks

- **No existing seed-on-init mechanism** → risk of non-deterministic or
  duplicated stock data across restarts. Mitigation: idempotent seed keyed on
  deterministic stock ids, run in `buildApp` before projections are read (or
  guarded by projection state), on the single SQLite writer.
- **Cross-aggregate pivot blast radius** → changing `Competition`/`ContestTemplate`
  payload shape touches their schemas, events, projections, services, routes,
  companion forms, and every test asserting `discipline`. Mitigation: treat the
  bare-enum removal as a tracked, mechanical follow-up per the story's own
  "supersession edits are follow-ups" note; keep this story's build to the
  additive reference field + model aggregate where feasible.
- **F3B / F3K shape pressure on NFR-1** → **Addressed.** The outliers are
  expressed as data — `basis`, `dropWorst.unit`, nullable per-task
  `pointsPerSecond` / `landingTable`, and F3B's `minGroupSizeAllCompetitorsFallback`
  — with no `switch (discipline)` in the aggregate. The full `TaskParameterSet[]`
  gives downstream readers a data-driven surface instead of a discipline branch.
- **Reference-checker inversion (house rule 2 conflict check)** → **Resolved.**
  The old `NoTaskConfigYetChecker` / standalone landing-table module was removed
  (commit `4170e60`, "remove orphaned landing-tables module (016 leftover)");
  the direction is now competition → model via
  `ProjectionClassModelReferenceChecker`.
- **Immutability enforcement is new** → **Addressed in the service.**
  `update()` and `delete()` both throw `StockModelReadonlyError`
  (`CLASS_MODEL_STOCK_READONLY`) for `origin: "stock"`, so AC7/AC9 hold at the API,
  not just the UI. Delete additionally refuses an in-use custom model with
  `ReferencedClassModelError` naming the referencing competitions.
- **Landing-table value fidelity** → stock tables are transcribed from rule-doc
  tables (e.g. F5L's 100→0 over 15 m); a transcription error would contravene
  house rule 1. Mitigation: derive directly from the class rule doc tables and
  cover the boundary rows (≤ first, over last → 0) in seed tests.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Six stock models seeded, read-only, each showing basis/drop-worst/pts-per-sec/table | Yes | Needs the new idempotent seed-on-init; verify exactly six and the read-only marker. |
| 2 | Stock model owns its landing table (F5L 100→0) | Yes | Table embedded in model payload; transcribe F5L rule table incl. boundary rows. |
| 3 | Class numbers reflect rule (F5L 2pt/beyond5; F5J 1pt/beyond4) | Yes | Straight seed values from rule docs. |
| 4 | F3B separate-per-task + per-task drop-worst unit | **Done** | `basis: "separate-per-task"` + `dropWorst.unit: "task"` on the F3B stock model, with its three tasks fully present (full 008 per-task detail was folded in, not deferred). |
| 5 | Clone stock → named custom, stock unchanged, source recorded | **Done** | `clone()` deep-copies every task via `copyTaskParameterSet`, records `sourceModelId`; accepts a custom source too. |
| 6 | Custom model records deviation (stock value vs chosen) | **Done** | `deriveDeviations` — structured `{field, stockValue, chosenValue}` per changed rule-fixed field, derived on read (D4). |
| 7 | Stock models read-only; direct edit prevented, directed to clone | **Done** | `update()` throws `StockModelReadonlyError` for stock origin; message directs to clone. |
| 8 | Competition references a class model (no bare discipline) | **Done** | `classModelId` is a required field on Competition/ContestTemplate/task-config; bare `discipline` removed from the write path (green-field, no back-fill needed). |
| 9 | In-use model undeletable; stock never deletable | **Done** | `ProjectionClassModelReferenceChecker` + stock guard in `delete()`; no force path. |
| 10 | Clone requires unique, non-blank name | **Done** | `assertNameAvailable` (trimmed, case-insensitive) across all models incl. stock; blank caught by Zod `modelName`. |
