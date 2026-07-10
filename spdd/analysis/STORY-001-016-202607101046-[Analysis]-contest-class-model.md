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
  direct precedent for cloning.
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

- **ContestClassModel** (new aggregate): the first-class definition holding
  identity (display name, source-class metadata), the group-score basis
  (`best-raw=1000` scaling; an **inverted** marker for speed; a
  **separate-per-task** marker for F3B), the drop-worst rule (threshold **+ unit**:
  round vs task), points-per-second, and an **owned** landing table. Two
  kinds: **stock** (seeded, read-only, one per class) and **custom** (cloned,
  editable, named). Relates to `Competition` as its referenced class definition;
  **contains** a `LandingBonusTable` rather than pointing at a library one.
- **Stock-model catalogue / seed** (new mechanism): the derived encoding of the
  six classes from the rule docs, materialised once into the event log so that
  projections rebuild deterministically. There is **no existing "seed initial
  data on init"** mechanism in the codebase (the `contestTemplate.seeded` event
  is audit-only provenance, not a data seed) — this must be introduced.
- **Model provenance / deviation record** (new): a custom model records the
  **stock model it was cloned from** and, per changed rule-fixed field, the
  **stock value alongside the chosen value** (AC6). This is state a downstream
  report renders; this story records it.
- **Competition→model reference** (new field on the `Competition` /
  `ContestTemplate` aggregates and their event payloads): the id linkage that
  replaces the embedded `discipline` value (AC8).

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
  UUIDs → trade-off: random UUIDs (the repo default for created aggregates) make
  re-seed and "regenerate when rule docs change" ambiguous and risk duplicate
  stock rows on restart. **Recommend deterministic stock ids** so the seed is
  idempotent (upsert-by-id), competitions reference a stable target, and
  re-generation updates the same row. Custom models keep random UUIDs.
- **Seed materialised into the event log vs computed in-memory at boot** →
  trade-off: pure in-memory stock (never appended) keeps the log clean but breaks
  the "current state derivable from the log" invariant (D4) and complicates
  referential integrity and audit. **Recommend appending a `classModel.seeded`
  (or `classModel.created` with a stock marker) event once, idempotently**, so
  stock models are first-class log citizens like everything else.
- **Model shape must accommodate the F3B outlier without a code branch** →
  trade-off: a flat "points-per-second + one landing table" record fits the five
  man-on-man classes but not F3B (per-task normalisation, per-task discard, and
  tasks that have no single points-per-second or landing table). **Recommend a
  shape with an explicit `normalisation`/basis marker (single-group vs
  separate-per-task) and a drop-worst `unit` (round vs task)** — the markers the
  story's Scope In already names — carrying the F3B specifics as markers now and
  deferring full per-task detail to 008 (additive slots). This keeps NFR-1's
  "no switching on discipline" honest.
- **Deviation recorded as structured stock-vs-chosen per field vs a free-text
  note** → **recommend structured** (field → {stockValue, chosenValue}) so AC6
  and future report rendering are data-driven, matching the codebase's
  denormalise-for-audit habit (`contestTemplate.seeded.templateName`).
- **Pivot `Competition.discipline` → `classModelId` as a replacement vs an
  additive parallel field** → trade-off: a hard replacement is cleanest for NFR-1
  but forces migration of existing competitions and every payload/consumer at
  once; a parallel field defers the cleanup but violates "no bare discipline
  stands alone" (AC8). **Recommend the reference field is authoritative and the
  bare enum is removed from the write path**, with existing competitions
  back-filled by mapping their `discipline` to the matching stock model (see
  Risks). The scale (D7: ≤ handful of competitions) makes migration trivial.
- **Reference-checker direction inverts** (was: task-config → landing table;
  now: competition → model) → **recommend a `ClassModelReferenceChecker` backed
  by the competition projection**, mirroring `ProjectionRosterReferenceChecker`,
  replacing the `NoTaskConfigYetChecker` role for tables.

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
- **"Points-per-second" and "an owned landing table" as universal fields**: the
  Scope In lists these as if every class has exactly one of each, but F3B's
  Distance and Speed tasks have no landing table and no single points-per-second
  rate, and F3K/all-up scoring differs again. Ambiguous whether these are
  nullable/per-task for the outliers or simply absent. Needs clarification of
  the model shape's optionality for non-duration tasks.
- **"Regenerated when those docs change"**: the mechanism and trigger for
  re-deriving stock models when the read-only rule docs change is unspecified —
  is it a manual re-seed, a checked-in derived artifact, a version bump? Affects
  the seed's idempotency/upsert design.
- **Deviation granularity**: AC6 shows one changed field (drop-worst). Whether
  the deviation record must enumerate *every* differing field, or only
  rule-fixed ones, and whether the model name itself counts, is not pinned down.
- **What "rule-fixed values" are editable on a custom clone**: AC5/AC7 imply
  drop-worst, points-per-second, basis and the landing table are all editable on
  a custom model, but the story does not enumerate the editable surface. Needs
  an explicit list (with 008's per-task additions out of scope).

### Edge Cases

- **Existing competitions with a bare `discipline` and no model reference**: the
  pivot must back-fill them to the matching stock model, or they violate AC8's
  "no bare discipline value stands alone". The event-sourced log already contains
  `competition.created` events carrying `discipline` — a projection-time mapping
  or a one-off reconciliation event is required.
- **Existing `ContestTemplate`s** likewise carry `discipline`; seeding a
  competition from an old template must resolve to a model, not an enum.
- **Cloning a custom model** (not just a stock one): AC5 clones a stock model;
  the behaviour of cloning an already-custom model (source-of-record, deviation
  chaining) is unspecified.
- **Re-seed after a stock model is referenced/cloned**: an idempotent re-seed
  must not orphan competitions referencing a stock id, nor silently alter a
  stock model a competition already ran under (audit/history implication).
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
- **F3B / F3K shape pressure on NFR-1** → if the model can't express the
  outliers as data, a hidden `switch (discipline)` creeps back in downstream,
  silently breaking NFR-1. Mitigation: bake the basis/normalisation and
  drop-worst-unit markers into the model now (AC4 already forces the F3B markers),
  and verify no consumer branches on discipline.
- **Reference-checker inversion (house rule 2 conflict check)** → 001-008 was
  scoped to make *task config* reference landing tables via
  `NoTaskConfigYetChecker`; D12 moves tables inside models, inverting the
  reference direction. This is a cross-story inconsistency to **flag and
  reconcile with the user** before landing (do not silently repurpose the seam).
- **Immutability enforcement is new** → no current aggregate has a read-only
  sub-kind; the stock/custom distinction must be enforced in the service (edit
  and delete both), not just the UI, or AC7/AC9 are bypassable via the API.
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
| 4 | F3B separate-per-task + per-task drop-worst unit | Partial | Requires basis + drop-worst-unit markers in the model shape; full per-task detail is 008. Confirm markers suffice for AC4's "distinct" assertion. |
| 5 | Clone stock → named custom, stock unchanged, source recorded | Yes | Reuse duplicate/deep-copy precedent; record source id. |
| 6 | Custom model records deviation (stock value vs chosen) | Yes | Structured per-field deviation record; confirm granularity (all fields vs changed only). |
| 7 | Stock models read-only; direct edit prevented, directed to clone | Yes | New service-level immutability guard; enforce in API, not just UI. |
| 8 | Competition references a class model (no bare discipline) | Partial | Reference field addable here; full removal of bare enum + back-fill of existing competitions is the cross-aggregate follow-up. |
| 9 | In-use model undeletable; stock never deletable | Yes | New competition→model `ClassModelReferenceChecker` (mirror roster checker) + stock guard. |
| 10 | Clone requires unique, non-blank name | Yes | Reuse template `assertNameAvailable` (trimmed, case-insensitive); confirm stock names are in the set. |
