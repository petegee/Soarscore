# SPDD Analysis: Per-Task Scoring Rules Configuration

> **Post-D12 story.** STORY-001-008 lands *after* the Contest Class Model
> (STORY-001-016) already owns each class's rule-fixed scoring shape and its
> landing table, and *after* STORY-001-007 narrowed to discipline-agnostic
> computation. The original AC text predates that pivot; the story's own
> reshaping banner reconciles part of it, but not all. This analysis's central
> job is to separate what is **already delivered by 016** (rule-fixed class
> shape, deviation via clone-and-edit) from what is **genuinely new here**
> (per-event / per-competition task configuration and a penalty-type
> catalogue), and to surface where the AC text still contradicts D12.

> ## Resolved Design Decisions (interactive, 2026-07-11)
>
> Three decisions were settled with the user before REASONS Canvas; they are
> **inputs, not open questions**:
>
> 1. **Two-layer structure (confirmed).** Rule-fixed values are additive slots
>    on the shared `ContestClassModel`; per-event overrides (round target-time
>    overrides, F5K NLH value) live on a **new per-competition task-config
>    aggregate** filed under `scope = competitionId` (roster pattern), reading
>    its defaults from the referenced model. The banner's "additive slots on
>    the class model" is reconciled to "…for the rule-fixed slice only".
> 2. **AC3 is already delivered by 016 (confirmed).** The landing table stays
>    model-owned; a different table is a custom clone. 008 adds only the
>    "landings scored?" flag and AC4's save behaviour — **no** standalone
>    per-event table selection is rebuilt. AC3's literal "select from master
>    data / per-field warning" wording is superseded by D12.
> 3. **Distinct `timingPrecision` type (confirmed).** AC2's capture precision is
>    a new value object (`{ stepSeconds; rounding: "truncate" | "nearest" }`) on
>    the class model, **independent** of `scoring.ts`'s `NormaliseOptions.precision`
>    (normalised-score decimals). No reuse; the two quantities stay separate.
> 4. **Task multiplicity: a `tasks[]` list on the class model (confirmed).** The
>    model owns a **list** of named task-parameter sets — F3B: 3 (Duration whole
>    seconds / Distance / Speed 1/100 s, inverted); F5K: 5 (A–E); man-on-man
>    classes: 1 — each carrying its own precision, points-per-second, landing
>    (scored? / table), and penalty types. The **round → task scheduling** stays
>    deferred as per-discipline layout. A single task per competition is provably
>    insufficient (F3B carries two precisions), so the list is mandatory for NFR-1.
> 5. **Penalty types: seed a per-class catalogue on the model (confirmed).** Each
>    stock model seeds its class's real deduction types from the rule docs
>    (house rule 1) as `{ code, label, defaultDeduction }` descriptors; a task
>    offers only its class's set (AC5). **Imposition is out of scope** (CD
>    authority, Area 5.9) — 008 defines the available types only.
> 6. **F5K NLH value: optional at save, defined unset state (confirmed).** The
>    per-competition task-config accepts `nlhValue: number | null`; save never
>    demands it (matches the CD-announces-a-day-before workflow). Downstream F5K
>    raw-score assembly (per-discipline) treats an unset NLH as a blocking
>    "not ready" condition surfaced to the CD — never a crash (mirrors
>    `scoring.ts`'s never-throw-on-degenerate-input stance). 008 owns only:
>    allow null, don't demand it.
> 7. **Retire the orphaned landing-table seam (confirmed).** The standalone
>    `landing-tables` module and `NoTaskConfigYetChecker` are already orphaned
>    (no route registered, nothing constructs them) since 016 made tables
>    model-owned. 008 creates no per-competition table references, so the seam's
>    premise is dead: remove/close `NoTaskConfigYetChecker` and **note** the
>    broader orphaned module (service / projection / routes) as a 016-leftover
>    cleanup to confirm separately — not silently deleted here.
>
> **Consequence of #4 — a clean reshape, no back-fill needed.** 016 stored
> `pointsPerSecond` and `landingTable` as *flat* fields on `ContestClassModel`.
> Introducing `tasks[]` reconciles those into the list (single-task classes:
> the one task mirrors the flat values; F3B: three tasks each own theirs). There
> is **no real persisted data to migrate at this stage** (confirmed 2026-07-11):
> the dev event store can be **reset and re-seeded**, and the idempotent
> stock-seed regenerates the six models in the new shape. So this is a plain
> aggregate/schema/payload reshape — **not** a projection back-fill, and the
> `discipline → classModelId` migration technique is *not* needed here. Cost it
> as a model reshape (interface + seed + payload + schema + `deriveDeviations`),
> no data migration. NFR-2's additive-only claim still holds for *adding a
> seventh class*; the field set itself simply changes shape pre-release.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-8]per-task-scoring-rules.md`.

# [STORY-001-008] Per-Task Scoring Rules Configuration

> Source: `docs/user-stories/01-organiser.md` §3.7 · `docs/requirements/high-level-requirements.md` Area 3.7 · `docs/requirements/rules/00-general-rules.md` §2
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

> **Reshaped by D12 / STORY-001-016.** Per-task **rule-fixed** parameters are
> **additive slots on the Contest Class Model** (timing precision,
> points-per-second, landing-scored flag + owned table, penalty-type catalogue,
> NLH coefficients); AC2/AC5 defaults come from the model, and a deviation from
> any of them is a **custom clone** (016), not a per-field warning. AC3's
> landing table is the model's **owned table** (STORY-001-002's standalone
> selection is superseded). The **per-event** parameters a shared model cannot
> carry — a round's target-time override (AC1) and the CD-announced F5K NLH
> **value** (AC6) — live on a **new per-competition task-config overlay** filed
> under `scope = competitionId`.

### Background

Each task a competition flies has parameters that drive both live capture and
scoring: target times (with per-round overrides where the task allows them),
timing precision, points-per-second, the landing-bonus table where landings
are scored, and the penalty/deduction types the task can incur. Some classes
also leave a scoring constant to the event — F5K's Nominal Launch Height is
announced by the Contest Director as 60 m in light wind or 70 m in moderate
wind. Configuration here is deliberately **generic**: discipline-specific
task layouts are deferred to per-discipline requirements, but the generic
parameter model must already hold every class's numbers correctly.

### Business Value

- Provide the Organiser with one place to set each task's scoring parameters
  so capture and scoring behave correctly for this event's tasks.
- Support per-event rule constants (e.g. F5K NLH) that class rules leave to
  the event.
- Enable the single central task model (NFR-1) to be configured rather than
  hard-coded per class.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-016 (the Contest Class Model — owns landing
  tables and supplies rule-fixed defaults, superseding STORY-001-002),
  STORY-001-004 (discipline), STORY-001-007 (computation behaviours).
- **Data assumptions**: class precisions per the rule docs — F3J/F3K 0.1 s
  (F3K truncated); F5J/F5K/F5L and F3B Duration whole seconds; F3B Speed
  1/100 s.
- **Integration points**: this configuration is projected to the Scorer
  devices as the task descriptor and consumed by score computation; there is
  no timekeeper-count parameter (the one Scorer's device time is official,
  decisions.md D1).
- **Business constraints**: NFR-1 — exactly one place knows a task's shape;
  NFR-2 — adding a class later must be additive only.

### Scope In

- Per task: target time with per-round overrides where the task allows them.
- Per task: timing precision, points-per-second, the landing-scored flag and
  the class model's owned landing table (per-event selection superseded by
  016), penalty/deduction types.
- Named per-event rule constants where a class leaves them to the event
  (first case: F5K Nominal Launch Height).

### Scope Out

- Discipline-specific task screens and special rules — deferred
  per-discipline requirements.
- The device-side capture experience (scorer-device scope).
- Rule-fixed value defaults and deviation handling — the clone-and-edit
  mechanism owned by STORY-001-016, applied here (no per-field warnings).

### Acceptance Criteria

#### AC1: Target time with per-round overrides
**Given** a competition whose task permits per-round working-time overrides
(F3K in MVP — the only class whose rule grants the organiser working-time
reduction; F3J/F5J/F5L/F5K/F3B working times are rule-fixed)
**When** the Organiser reduces round 5's working time below the base
**Then** other rounds keep the base and round 5 carries the override.

#### AC2: Timing precision matches the class rule
**Given** tasks configured for F3J, F5J and F3B Speed
**When** the Organiser reviews each task's timing precision
**Then** they default to 0.1 s, whole seconds and 1/100 s respectively, and a
deviating precision is a custom clone of the class model (D12/016), surfaced
as a model deviation — not a per-field warning.

#### AC3: Landing table where landings are scored
**Given** an F5J task (landings scored)
**When** the Organiser configures it
**Then** the class model's owned landing table applies as the default; scoring
a different table is a custom clone of the model (D12/016), not a per-event
selection from master data.

#### AC4: No landing table for time-only tasks
**Given** an F3K task (flight time only)
**When** the Organiser configures it
**Then** no landing table is required and none is demanded at save.

#### AC5: Points-per-second and penalty types drive the task
**Given** an F5L task
**When** the Organiser reviews points-per-second and penalty/deduction types
**Then** points-per-second defaults to 2 (the F5L rule) and the
penalty/deduction types offered are those appropriate to the task; the saved
values drive capture and scoring for that task.

#### AC6: Per-event rule constant — F5K Nominal Launch Height
**Given** an F5K competition
**When** the Organiser configures the competition
**Then** the Nominal Launch Height has a named place in the **per-competition
task-config overlay** accepting the CD-announced value (60 m light wind / 70 m
moderate wind), it feeds F5K's scoring computation, and the rule-fixed
adjustments around it (+0.5 per metre below, −1.0 per metre 1–10 m above,
−3.0 per metre 11 m and above) default per the class rule; a deviation from
them is a custom clone of the model (D12/016), not a warning.

### INVEST Check

Independent (generic parameter model; class specifics defer) · Valuable
(capture and scoring configured, not coded, per event) · Small-ish (4 days,
3 functional points: per-task parameters, per-round overrides, per-event
constants) · Testable.

---

## Domain Concept Identification

The decisive framing question is **where each parameter lives**. STORY-001-016
established that a class's *rule-fixed shape* lives on the shared, reusable
`ContestClassModel` (the single place — NFR-1), and that a deviation from it is
a named **clone-and-edit** of the model, never a per-field override or warning.
STORY-001-008's parameters split cleanly along that line into two layers:

- **Rule-fixed, class-level** parameters (same for every event that runs the
  class): timing precision, points-per-second, whether landings are scored and
  by which table, the penalty/deduction *types* the task can incur, and the
  F5K NLH *adjustment coefficients*. These are **additive slots on the class
  model** (NFR-2 additive), and deviating from them is a clone-and-edit — the
  016 mechanism already exists (`clone`, `update`, `deriveDeviations`).
- **Per-event, per-competition** parameters (differ between two events running
  the same class): a specific round's target-time override (AC1) and the
  CD-announced NLH *value* for this event (AC6). These cannot live on a shared
  model — a model reused by two competitions cannot carry "round 5 = 8 min for
  the Nelson event". They require a **new per-competition task-configuration
  aggregate**, filed under `scope = competitionId` exactly as the roster is.

This two-layer split is the heart of the story and is *not* fully captured by
the reshaping banner's "additive slots on the Contest Class Model" line — AC1
and part of AC6 are inescapably per-event.

### Existing Concepts (from codebase)

- **ContestClassModel** (`packages/shared/src/class-model.ts`): the seeded,
  cloneable class shape. Already carries `basis`, `speedInverted`,
  `pointsPerSecond`, `dropWorst`, and an owned `landingTable`. **This story
  extends it** with the rule-fixed task parameters (precision, penalty-type
  catalogue, landing-scored flag, NLH coefficients). `deriveDeviations` is the
  existing diff engine any new rule-fixed field must be added to (AC2/AC5/AC6
  deviation surfacing).
- **Clone-and-edit deviation mechanism** (`ClassModelService.clone` / `.update`
  + `updateClassModelRequestSchema`): the *actual* realisation of "a deviation
  requires explicit confirmation". Under D12 there is **no per-field warning**;
  the deviation is the custom clone. Every "…and a deviation warns" clause in
  AC2/AC3/AC5/AC6 resolves to this, not to a new warning primitive.
- **LandingBonusTable** (`packages/shared/src/landing-table.ts`) + the
  model-owned `landingTable` slot: already the home of "landings scored / which
  table" under 016. AC3/AC4 are largely *already delivered*.
- **Competition** (`packages/shared/src/competition.ts`): references a class
  model by `classModelId` and overlays per-event entry options
  (`pilotNumbersEnabled`, `pilotClasses`). It is the natural anchor for the new
  per-event task-config overlay (target-time overrides, NLH value).
- **Scoring computation** (`packages/shared/src/scoring.ts`): consumes raws
  "as given" and a `penaltyTotal` tracked outside the series. **Raw-score
  assembly** (points-per-second × seconds, landing bonus, launch-height
  bonus/penalty) is explicitly this story's *upstream* — 008 configures the
  inputs; the assembly maths is per-discipline. Note `NormaliseOptions.precision`
  here is *normalised-score* decimal places — a **different** quantity from the
  capture *timing* precision AC2 asks for (see Risks).
- **Event-sourcing substrate** (`EventStore`, per-module `projection.ts` /
  `service.ts` / `routes/*.ts`, `scope` discriminator): the fixed pattern any
  new aggregate follows. Roster is the template for a `scope = competitionId`
  per-competition aggregate.
- **`NoTaskConfigYetChecker`** (`apps/base/src/landing-tables/table-reference-checker.ts`):
  an explicit **STORY-001-008 seam** anticipating per-task landing-table
  selection. Under 016 the table became model-owned, so this seam's premise
  ("which task in which competition selected this table") is now partly
  superseded — see Risks.

### New Concepts Required

- **Task parameter set (rule-fixed slice)** — the generic, class-level bundle
  of {timing precision, landing-scored flag, penalty-type catalogue, NLH
  coefficients}, added as additive slots on `ContestClassModel`. Relates to
  the model as its existing rule-fixed fields do; participates in
  `deriveDeviations`.
- **Timing precision** — a class-fixed capture granularity enum (0.1 s / whole
  second / 1/100 s), with F3K's "truncate not round" nuance. New field; must
  not be conflated with normalised-score precision.
- **Penalty / deduction type** — a *catalogue* of the penalty kinds a task can
  incur (e.g. F5K overfly −100, off-field → 0, launch penalties, landing
  outside area −10). **Entirely greenfield** — no penalty concept exists in
  code. This story defines the *available types* only; **imposing** a penalty
  is CD authority (Area 5.9), out of scope. Relates to the class model (which
  types this class's task offers) and downstream to `penaltyTotal` in scoring.
- **Per-competition task configuration** — the new per-event aggregate holding
  target time + per-round overrides (AC1) and the F5K NLH *value* (AC6),
  filed under `scope = competitionId`. Relates to `Competition` (one-to-one
  overlay) and reads its defaults from the referenced class model.
- **Target time + per-round override schedule** — a base target/working time
  with a sparse map of round → override, "where the task allows per-round
  overrides" (a class-model capability flag). Per-event.
- **Nominal Launch Height (per-event value)** — a named F5K-only constant
  accepting the CD-announced 60/70 m; feeds raw-score assembly. Per-event;
  its adjustment coefficients are the rule-fixed (class-model) counterpart.
- **Task metric applicability** — the generic "does this task score landings?
  does it have a single points-per-second rate? does it have an NLH?" flags
  that let one generic model represent F3K (time-only, no table, tenths),
  F5J (time + table), F5L (2 pt/s + fine table), F5K (NLH, no single rate).

### Key Business Rules

- **NFR-1 (one place for a class's shape):** rule-fixed task parameters live
  only on the class model; per-event overlays live only on the competition
  task-config. No third home, no per-class code branch (governs both new
  slices).
- **NFR-2 (additive-only):** new fields append to `ContestClassModel` and the
  stock seed; the aggregate is never reshaped and a seventh class stays a
  pure data addition. (Governs the model extension.)
- **House rule 1 (rules are authoritative, read-only):** every default is
  transcribed from `docs/requirements/rules/`, never invented. Where a class
  fixes no single value the slot is `null`, never a placeholder — matching the
  existing `pointsPerSecond: null` convention. (Governs every default.)
- **Deviation = clone-and-edit, not per-field warning (D12):** the "a
  deviation warns / requires confirmation" language in AC2/AC3/AC5/AC6 is
  satisfied by the 016 clone mechanism plus `deriveDeviations`. (Governs the
  guardrail interpretation.)
- **Penalty types are configured, never imposed here:** 008 defines which
  deduction types a task offers; the CD imposes them later (Area 5.9). Penalty
  totals are retained through drop-worst (already in `scoring.ts`, AC5 of 007).
- **Per-round override only where the task allows it (AC1):** the class model
  declares whether per-round target-time overrides are permitted; the
  competition supplies the actual overrides.
- **No landing table demanded for time-only tasks (AC4):** save-time validation
  must not require a table where the class scores flight time only (F3K, F5K);
  already expressed by `landingTable: null` in the stock models.
- **F3K precision truncates, not rounds:** tenths are truncated (dropped), a
  per-class capture nuance distinct from generic rounding.

---

## Strategic Approach

### Solution Direction

Deliver the story as a **two-layer extension**, reusing existing machinery on
both layers rather than inventing a standalone "task" aggregate:

1. **Extend the Contest Class Model with additive rule-fixed slots**
   (timing precision, landing-scored flag, penalty-type catalogue, NLH
   adjustment coefficients + an NLH-applicable flag, and a
   per-round-override-allowed capability flag). Seed the six stock models with
   the correct rule-doc values (F3J/F3K 0.1 s, F5×/F3B-Duration whole seconds,
   F3B-Speed 1/100 s; F5L 2 pt/s already present; F5K NLH coefficients
   +0.5/−1/−3; F3K/F5K landing-scored = false). Add each new rule-fixed field
   to `deriveDeviations` so AC2/AC5/AC6 deviations surface, and to
   `updateClassModelRequestSchema` / the clone deep-copy / the created payload.
   This satisfies AC2, AC3, AC4, AC5 (points-per-second + penalty types), and
   AC6's coefficient half **through the 016 clone-and-edit path** — no new
   warning primitive.

2. **Introduce a per-competition task-configuration overlay** as a new
   event-sourced aggregate filed under `scope = competitionId` (the roster
   pattern: `packages/shared` types + events, `apps/base` projection / service
   / routes). It holds the per-event data that cannot live on a shared model:
   target time + per-round overrides (AC1) and the F5K NLH value (AC6). Its
   defaults are read from the referenced class model; it persists only
   deviations/overrides, keeping the model as the single source of the shape
   (NFR-1). General data flow: `class model (defaults) → per-competition
   task-config (overrides) → projected task descriptor → capture + raw-score
   assembly (downstream)`.

General data-flow direction (consistent with existing modules): REST route →
service (validates against class model + competition state, appends event) →
projection → read model consumed by capture/scoring and reports.

### Key Design Decisions

- **Where per-round overrides & NLH value live** — on a new per-competition
  aggregate vs. shoehorned onto the class model. *Trade-off:* the banner says
  "additive slots on the class model", which is clean for rule-fixed values but
  wrong for per-event values (a shared model reused by two events cannot carry
  one event's round-5 override). → **Recommendation:** rule-fixed slots on the
  model; per-event overrides on a new `scope = competitionId` aggregate. This
  is the only split that honours NFR-1 (defaults) *and* the reusable-model
  invariant. Flag the banner wording as needing reconciliation.
- **Penalty types: catalogue shape** — a fixed enum of deduction kinds vs. a
  free-form list vs. a per-class curated set. *Trade-off:* free-form invites
  contravening the rule docs; a global fixed enum offers types "not appropriate
  to the task" (AC5 says offer only appropriate ones). → **Recommendation:** a
  rule-derived catalogue of penalty *types* seeded per class model (additive,
  house rule 1), each type a `{code, label, defaultDeduction, appliesToScope}`
  descriptor; the task offers only its class's set. Imposition stays out of
  scope.
- **Timing precision representation** — reuse `NormaliseOptions.precision`
  (a number of decimal places) vs. a distinct capture-precision type.
  *Trade-off:* reuse conflates two different quantities (capture granularity
  vs. normalised-score rounding) and can't express "1/100 s" + "truncate not
  round" cleanly. → **Recommendation:** a distinct `timingPrecision` value
  object/enum (e.g. `{ stepSeconds; rounding: "truncate" | "nearest" }`),
  independent of scoring's normalisation precision.
- **How "generic, class-specifics deferred" is honoured** — model a full
  multi-task list now vs. the minimal generic slice. *Trade-off:* F3B (3 tasks)
  and F5K (per-round task A–E) genuinely have multiple tasks, but the story
  explicitly defers discipline-specific task *layouts*. → **Recommendation:**
  hold the generic *parameter* slice such that every class's numbers are
  representable, but do **not** build discipline task screens or the per-round
  task-catalogue selection (F5K A–E) — that is per-discipline. Confirm the MVP
  cardinality with the user (see Risks: "one task vs. task list").
- **Landing table selection (AC3 as written) vs. 016 model-ownership** —
  per-competition selection from master data vs. model-owned table. *Trade-off:*
  AC3's literal text contradicts D12/016. → **Recommendation:** treat AC3 as
  already delivered by 016 (model owns the table; a different table = a custom
  clone); do **not** rebuild standalone per-event table selection. Flag the
  contradiction to the user before building (house-keeping rule 2).

### Alternatives Considered

- **Everything onto the class model (literal banner reading):** rejected — puts
  per-event data (round-5 override, this-event NLH) on a shared reusable model,
  breaking the reuse invariant and NFR-1's "one place for the *shape*" (a value
  is not the shape).
- **A brand-new standalone "Task" master-data library independent of both
  competition and model:** rejected — creates a third home for a class's shape,
  directly against NFR-1, and duplicates what 016 already owns.
- **Reusing `scoring.ts`'s `precision` for timing precision:** rejected —
  conflates normalised-score rounding with capture granularity; cannot express
  1/100 s or F3K truncation.
- **A generic per-field deviation-warning primitive (literal AC2/AC5/AC6
  wording):** rejected — D12 replaced per-field warnings with clone-and-edit;
  reintroducing warnings would fork the guardrail model 016 just unified.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **~~"Additive slots on the class model" vs. per-event data (AC1, AC6)~~
  — RESOLVED:** the story spans two layers — rule-fixed slots on the model +
  a new per-competition task-config overlay (`scope = competitionId`). See
  Resolved Design Decisions #1.
- **~~AC3 contradicts D12/016~~ — RESOLVED:** AC3 is satisfied by 016; 008 adds
  only the "landings scored?" flag and the AC4 save behaviour. No standalone
  per-event table selection. See Resolved Design Decisions #2.
- **~~Task cardinality (one task vs. task list)~~ — RESOLVED:** a `tasks[]` list
  on the class model (F3B: 3, F5K: 5, others: 1); round → task scheduling
  deferred per-discipline. See Resolved Design Decisions #4 (and its migration
  consequence).
- **~~Penalty-type scope~~ — RESOLVED:** 008 seeds a per-class catalogue of
  deduction *types* on the model; imposition is out of scope (Area 5.9). See
  Resolved Design Decisions #5.
- **~~"Where the task allows per-round overrides"~~ — RESOLVED (2026-07-11):**
  settled against the rule docs. The *only* working-time-reduction authority in
  the corpus is F3K-specific (F3K.11: "the tasks and the related working time may
  be reduced by a decision of the organiser"; task B large-field → 7 min). So
  `perRoundOverrideAllowed = true` for **F3K alone**; F3J/F5J/F5L/F5K/F3B are all
  `false` (rule-fixed working times). Note the earlier guess "allowed for duration
  tasks" was *inverted* — the duration classes are the fixed ones; F3K (non-single-
  rate) is the exception. For F3K/F5K the working time also varies via the deferred
  round→task schedule, which is a *separate* mechanism from this override flag.
  AC1's original F3J example was rule-incorrect and was reworded to a generic,
  class-agnostic framing (F3K noted as the MVP case).

### Edge Cases

- **Per-round override for a round that doesn't exist yet / beyond round count:**
  the round count isn't fixed at config time (draw is STORY-001-009). Overrides
  keyed by round number must tolerate rounds not yet created and rounds later
  removed.
- **NLH value unset at F5K scoring time — RESOLVED:** `nlhValue: number | null`;
  optional at save, downstream scoring treats unset as a blocking "not ready"
  condition, never a crash. See Resolved Design Decisions #6. (008 owns only
  allow-null; the not-ready computation behaviour is per-discipline.)
- **Deviating precision / coefficients on a stock model:** stock models are
  read-only (AC7 of 016) — a deviation *must* force a clone; the story must not
  reintroduce a direct-edit path to satisfy "deviation warns".
- **Time-only task still offered a landing table (AC4 inverse):** save must
  reject / ignore a table where `landingScored = false`, and must not *demand*
  one — both directions.
- **F3K truncation vs. rounding at the boundary** (e.g. 59.99 s → 59 s, not
  60): a precision nuance that silently corrupts scores if implemented as
  nearest-rounding.
- **~~Landing-table deletion once a task references it~~ — RESOLVED:** 016's
  model-ownership fully subsumes it; `NoTaskConfigYetChecker` (and the whole
  standalone `landing-tables` module) is already orphaned. Retire the seam;
  note the module as separate 016-leftover cleanup. See Resolved Design
  Decisions #7.

### Technical Risks

- **Two conflated "precision" concepts — RESOLVED (kept distinct):**
  `NormaliseOptions.precision` (normalised-score decimals) vs. capture timing
  precision. Decision #3 keeps them separate via a distinct `timingPrecision`
  value object; the residual risk is only implementation discipline (never
  routing one through the other), covered by the naming.
- **Class-model aggregate reshape (`tasks[]`) — Decision #4, no back-fill:**
  flat `pointsPerSecond` / `landingTable` reconcile into the task list. Because
  there is no real persisted data to migrate, the dev event store is reset and
  re-seeded — so **no projection back-fill** is required. Every touch-point must
  still change in one change: the interface, the stock seed,
  `classModelToCreatedPayload`, the clone deep-copy, `updateClassModelRequestSchema`,
  and `deriveDeviations`. The competition-config comment already warns that
  adding a config field obliges updating the template snapshot + seed mapping in
  the same change. Missing one point produces silent data loss or stale
  deviations. *Mitigation:* treat the touch-points as a checklist; lean on
  `class-models.service.test.ts` and `scoring.test.ts`. (No legacy-event
  compatibility needed for the new shape — the store is reset pre-release.)
- **New per-competition aggregate wiring:** a task-config module must slot into
  `buildApp` (projection rebuilt from log, service, routes, error handler
  branches) following the roster template; missing the projection rebuild or the
  `scope = competitionId` filing would break audit/replay.
- **Penalty types are greenfield:** no existing shape to extend; risk of
  over-designing (imposition, cumulative tracking) beyond the config slice.
  *Mitigation:* deliver only the catalogue + task-applicability; keep imposition
  and `penaltyTotal` assembly downstream.
- **House rule 1 compliance:** every seeded number (precisions, NLH
  coefficients, penalty deductions) must be transcribed from the rule docs, not
  invented. F5K coefficients are in `f5k.md` §NLH; precisions in
  `00-general-rules.md` §2 and per-class docs. *Mitigation:* cite the rule-doc
  line for each seeded value in code comments, as the existing stock models do.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Per-round working-time overrides (F3K only — organiser reduction, F3K.11) | Partial | Needs the **new per-competition task-config aggregate** — cannot live on the shared model. Depends on round identity (draw, 009) not yet built; overrides keyed by round number must tolerate not-yet-created rounds. Requires a class-model `perRoundOverrideAllowed` flag — `true` for F3K alone, `false` for the other five (rule-fixed working times). |
| AC2 | Timing precision defaults per class; deviation warns | Yes | New rule-fixed model slot + `deriveDeviations`; **distinct** from scoring's `precision`. "Warns" = clone-and-edit (D12), not a per-field warning. F3K truncation nuance to capture. |
| AC3 | Landing table where landings scored; default + different warns | Yes (via 016) | **RESOLVED:** delivered by 016 (model-owned table, deviate = clone). 008 adds only the landing-scored flag. No standalone per-event selection. |
| AC4 | No landing table for time-only tasks (F3K) | Yes | Already expressed by `landingTable: null` on the F3K/F5K stock models; 008 adds the save-time "don't demand a table" behaviour + the landing-scored flag. |
| AC5 | Points-per-second default (F5L=2) + penalty types | Partial | Points-per-second already on the model (F5L=2 present). **Penalty/deduction types are greenfield** — new catalogue concept; "appropriate to the task" implies a per-class seeded set. Imposition out of scope. |
| AC6 | F5K NLH per-event value + rule-fixed adjustments | Partial | **Two layers:** the NLH *value* is per-event (new competition overlay); the +0.5/−1/−3 *coefficients* are rule-fixed model slots (deviate via clone). "Feeds scoring" is upstream raw-score assembly (per-discipline) — 008 supplies the config, not the maths. Undefined-NLH-at-scoring behaviour needs specifying. |
