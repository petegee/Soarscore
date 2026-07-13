# [STORY-001-016] Contest Class Model — Seeded Rulesets and Custom Clones

> Source: `docs/requirements/non-functional.md` NFR-1 (one centralised task model) · NFR-2 (additive-only extensibility) · `docs/requirements/high-level-requirements.md` Area 3 · `docs/requirements/decisions.md` **D12 (to be recorded)** · `docs/requirements/rules/` (authoritative, read-only)
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**
> **Foundational** — underpins STORY-001-004, 001-007, 001-008, 001-026; supersedes STORY-001-002.

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
  per task beyond 5 rounds). The **minimum-rounds-for-a-valid-contest** values
  likewise derive from the per-class rule docs: **4 rounds** for F3J / F5J /
  F5L, **5 rounds** for F3K, **1 round + 1 task** for F3B, and **no minimum**
  for F5K. These are read-only inputs, not editable in the product.
- **Integration points**: reshapes **STORY-001-004** (discipline selection
  becomes class-model selection), **STORY-001-007** (scoring options are read
  from the model; deviation is the clone-and-edit here), and **STORY-001-008**
  (per-task parameters and penalties are additive slots on the model).
  **Supersedes STORY-001-002** (standalone landing-table library retires into
  table management within class models). **Consumed by STORY-001-026** (Lock &
  Finalisation), which reads the **minimum-rounds-for-a-valid-contest**
  threshold from the model at Lock to resolve a locked contest to
  OfficialResults vs NoContest — that story only reads the value; this story is
  where it is encoded (NFR-1: one place knows a class's shape).
- **Business constraints**: house rule 1 — the model must not contravene the
  rule docs and is derived from them; **decision D12** to be recorded; the
  MVP class set is the six FAI classes, additive thereafter (NFR-2).

### Scope In

- A **Contest Class Model** definition holding: identity (name, source-class
  metadata), the group-score basis (best raw = 1000 scaled; an inverted marker
  for speed tasks; a separate-per-task marker for F3B), the drop-worst rule
  (threshold + unit — round vs task), points-per-second, the
  **minimum-rounds-for-a-valid-contest** threshold (see below), and an **owned
  landing table**.
- The **minimum-rounds-for-a-valid-contest** threshold is modelled as a
  **structured, optional** value — not a bare integer — so it can express all
  three shapes the rules require: a plain round-count minimum (e.g. F3K = 5
  rounds; F3J/F5J/F5L = 4 rounds), a **compound** rounds-and-tasks minimum
  (F3B = 1 round **and** 1 task), or **no minimum at all** (F5K — absent /
  none, where finalising at a low round count is the Contest Director's
  judgement). The core system reads this value generically to resolve contest
  validity; it never branches on discipline to obtain it.
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
each showing its group-score basis, drop-worst rule, points-per-second,
minimum-rounds-for-a-valid-contest and landing table, and each marked as a
read-only FAI stock definition.

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

#### AC5: Minimum-rounds-for-a-valid-contest is present and class-specific
**Given** the seeded stock models
**When** the Organiser inspects each model's minimum-rounds-for-a-valid-contest
**Then** F3K shows **5 rounds**, F3J / F5J / F5L each show **4 rounds**, F3B
shows the **compound** minimum **1 round and 1 task**, and F5K shows **no
minimum** (none) — each value read from the model itself, with no discipline
branch in the core system; and the model exposes the value in a shape the core
can interpret generically for all three cases (plain round count, compound
rounds-and-tasks, and absent).

#### AC6: Clone a stock model into a named custom model
**Given** the F5L stock model
**When** the Organiser clones it, names the copy "F5L – local rule" and changes
drop-worst to "once more than 3 rounds are flown"
**Then** a new custom model exists with that name and threshold, the F5L stock
model is unchanged, and the custom model is recorded as derived from F5L.

#### AC7: A custom model records its deviation from the stock rule
**Given** the "F5L – local rule" custom model cloned from F5L with drop-worst
changed to "beyond 3 rounds"
**When** the model is viewed
**Then** it is flagged as deviating from the FAI F5L rule, showing the stock
value ("beyond 5 rounds") alongside the chosen value ("beyond 3 rounds").

#### AC8: Stock models are read-only
**Given** the F3J stock model
**When** the Organiser attempts to change one of its rule-fixed values directly
**Then** the system prevents the change and directs the Organiser to clone the
model into a custom model instead.

#### AC9: A competition references a class model
**Given** a competition
**When** it is associated with the "F5L – local rule" custom model
**Then** the competition's class definition is taken from that model (no bare
discipline value stands alone), and the association is recorded.

#### AC10: An in-use model cannot be deleted
**Given** a competition references the "F5L – local rule" custom model
**When** the Organiser attempts to delete that model
**Then** the system prevents the deletion and explains that a competition
depends on it; stock models cannot be deleted under any circumstances.

#### AC11: Clone requires a unique, non-blank name
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
protection · competition→model reference pivot). Adding the
minimum-rounds-for-a-valid-contest attribute is an **additive** field on the
seeded catalogue (NFR-2), not a new function point — effort stays at 5 days.
**Testable** — every AC is a concrete Given-When-Then a QA engineer can
exercise without reading source. Foundational: it reshapes 001-004/007/008,
supersedes 001-002, and supplies the minimum-rounds threshold that 001-026
consumes — those supersession edits are tracked as follow-ups, not carried
inside this story.
