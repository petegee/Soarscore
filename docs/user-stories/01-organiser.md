# Soarscore — User Stories: Organiser

The **Organiser** prepares the event and owns the competition data: master data,
competition lifecycle and configuration, the draw, score administration, and
reports. The Organiser **sets up and administers** — decisions that carry
*authority* (accepting or re-drawing the draw, penalties, approving re-flights,
retiring pilots, locking, publishing) belong to the
[Contest Director](../requirements/users.md#2-contest-director). Where a task
needs that authority, the story below stops at *preparing, proposing or executing
under authority* and notes the handoff.

**Scope.** MVP only. These stories flesh out the Organiser's areas from
[`users.md §1`](../requirements/users.md#1-organiser):

- **Area 1** — master data (pilots, landing-bonus tables, contest templates)
- **Area 2.1** — create / open / delete competitions
- **Area 3** — competition setup & configuration (3.1–3.7)
- **Area 4.1, 4.2, 4.4** — draw specification, generation, lane adjustment
- **Area 5.3, 5.4, 5.6** — score administration (moves/re-flights, score-by-pilot,
  validation)
- **Area 7** — draw and results reports

Stories are **high-level and implementation-agnostic** — they describe *what* must
be possible, not any screen, framework or store. Rule-bound stories stay
consistent with [`docs/requirements/rules/`](../requirements/rules/), which is
authoritative and read-only. Open questions and possible conflicts are collected
in [Conflicts & questions for the user](#conflicts--questions-for-the-user).

---

## Area 1 — Master Data Management

### 1.1 — Maintain reusable pilot records

**As an** Organiser, **I want** to maintain a reusable library of pilot records
independent of any competition, **so that** I can build a roster from known
pilots without re-typing their details for every event.

**Acceptance criteria**
- [ ] Given the master pilot library, when I add a pilot, then a **name is
  required** and registration ID, club and contact are optional.
- [ ] Given an existing pilot, when I edit their details, then the change is
  reflected wherever that master record is browsed, without altering any
  competition roster already built from it.
- [ ] Given a pilot who has never been added to a competition, when I delete them,
  then the record is removed from the library.
- [ ] Given a pilot who is referenced by one or more competition rosters, when I
  attempt to delete them, then the deletion is prevented (or the record retired
  without breaking existing rosters) and I am told why.
- [ ] Given two pilots with the same name, when I view the library, then I can
  still tell them apart by their optional attributes.

**Traces to:** area 1.1 · users.md §1 Organiser
**Notes:** Master data is shared across all competitions; editing a master pilot
must not silently rewrite historical results. Frequency, models/devices, country
codes and roles are **Future Enhancements** — out of scope here.

### 1.2 — Maintain reusable landing-bonus tables

**As an** Organiser, **I want** to define and reuse landing-bonus tables that map
landing distance to points, **so that** any competition can select a table
without redefining it each time.

**Acceptance criteria**
- [ ] Given the master data, when I create a landing-bonus table, then I can enter
  a set of **distance → points** entries and name the table for later selection.
- [ ] Given an existing table, when I edit or duplicate it, then I can adjust
  entries and save it as the same or a new named table.
- [ ] Given a table already selected by a competition, when I attempt to delete it,
  then the deletion is prevented or the competition's reference is preserved, and I
  am told why.
- [ ] Given a competition configured for a task that scores flight time only, when
  I set up that competition, then selecting a landing table is not required (see
  Notes).

**Traces to:** area 1.2 · users.md §1 Organiser
**Notes:** Landing result = distance from model nose at rest to the allocated spot,
converted to bonus points via the table
([00-general-rules §2](../requirements/rules/00-general-rules.md)). **Not every
task uses landings** — e.g. F3K and F5K score flight time only — so a landing
table is meaningful only where the discipline/task uses it. Consumed per
competition via [3.7](#37--configure-per-task-scoring-rules).

### 1.3 — Maintain reusable contest templates

**As an** Organiser, **I want** to save a pre-configured competition as a reusable,
discipline-specific template, **so that** I can create a new competition quickly
without re-entering draw, scoring and task settings, and without needing to
understand the scoring maths each time.

**Acceptance criteria**
- [ ] Given a configured competition (or a fresh configuration), when I save it as a
  template, then its draw / scoring / task settings and its **discipline** are
  captured under a name I can reuse.
- [ ] Given a template, when I create a competition from it, then the new
  competition is seeded with the template's settings and I can still change any of
  them (see [3.1](#31--create-a-competition)).
- [ ] Given a template, when I edit or delete it, then existing competitions
  already created from it are **unaffected**.
- [ ] Given a template, when I create a competition from it, then the template's
  discipline is applied and cannot be silently mismatched to a different
  discipline's tasks.

**Traces to:** area 1.3 · users.md §1 Organiser
**Notes:** Templates are **discipline-specific**; discipline-specific task detail
is deferred to per-discipline requirements. Consumed by
[3.1 Create Competition](#31--create-a-competition).

---

## Area 2 — Competition Lifecycle

### 2.1 — Create, open and delete competitions

**As an** Organiser, **I want** to create, open and delete whole competitions,
**so that** I can manage each event as a distinct object over its lifetime.

**Acceptance criteria**
- [ ] Given the system, when I create a competition, then it exists as a distinct
  object I can name and later re-open (identity detail is captured in
  [3.1](#31--create-a-competition)).
- [ ] Given several competitions, when I open one, then I work against that
  competition's data only, with no cross-contamination between events.
- [ ] Given a competition that is **not locked**, when I delete it, then it and its
  data are removed after I confirm the irreversible action.
- [ ] Given a competition that the Contest Director has **locked** ([2.2], not the
  Organiser's), when I attempt to delete it, then deletion is prevented and I am
  told the competition is locked.
- [ ] Given a competition with scores already captured, when I request deletion,
  then I must explicitly confirm, because the action destroys results.

**Traces to:** area 2.1 · users.md §1 Organiser
**Notes:** **Lock (2.2)** is the Contest Director's authority, not the Organiser's;
these stories only *respect* the locked state. Deletion of a competition with real
data is a destructive unhappy path worth guarding.

### 2.3 — Suspend at end of day and resume the next day

**As an** Organiser, **I want** to suspend the competition at the end of day one
and resume it the next morning with all state intact, **so that** a routine
two-day event ([decisions.md D7](../requirements/decisions.md#d7--scale-bounds-and-multi-day-operation))
just carries on where it stopped.

**Acceptance criteria**
- [ ] Given a running competition, when I suspend it, then on resume the contest
  state — completed rounds, captured scores, draw position, round-in-progress
  status — carries over **intact**
  ([2.3](../requirements/high-level-requirements.md#area-2--competition-lifecycle)).
- [ ] Given a round in progress (some groups flown, scores incomplete), when I
  suspend at a **group boundary**, then I am **warned that the round is
  incomplete** but not blocked; on resume the round **simply continues** with
  the remaining groups.
- [ ] Given Scorer self-correction is **group-bounded** — it ends when the next
  group starts
  ([decisions.md D11](../requirements/decisions.md#d11--the-devices-scope-is-the-current-group)),
  when the competition resumes the next day with the same round still open, then
  suspension (always at a group boundary) has not truncated anything: flown
  groups were already closed to device edits, and changes to them remain
  available as base-side score administration
  ([5.3/5.4](../requirements/high-level-requirements.md#area-5--scoring)).
- [ ] Given an **unplanned shutdown** (e.g. base-station power loss) instead of a
  clean suspend, when the system restarts, then it resumes into the **correct
  contest state** reconstructed from the event log
  ([decisions.md D4](../requirements/decisions.md#d4--immutable-event-log);
  [scorer-device.md §9](../requirements/scorer-device.md#9-environment-envelope-d));
  a group that was **running at the moment of failure is treated as
  aborted** — restart from preparation, its accumulated metrics annulled
  ([6.5](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids))
  — unless the Contest Director instead accepts pen-and-paper results for it
  ([decisions.md D3](../requirements/decisions.md#d3--failure-policy-pen-and-paper-reconcile-at-the-base)).
- [ ] Given a suspend or resume, when it happens, then it is recorded in the
  event log.

**Traces to:** area 2.3 · users.md §1 Organiser
**Notes:** Suspension is **lifecycle administration** (Organiser); it is distinct
from the Contest Director's run-control pause of a group's preparation
([6.5](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids))
and from the Announcer's round advance ([6.4](../requirements/high-level-requirements.md#area-6--display-timer--audio-field-aids)).
Suspend happens **between groups**, never inside a running group's working time.

---

## Area 3 — Competition Setup & Configuration

### 3.1 — Create a competition

**As an** Organiser, **I want** to capture a competition's identity and optionally
seed it from a template, **so that** the event is identifiable and quick to set up.

**Acceptance criteria**
- [ ] Given a new competition, when I create it, then I can record its **name,
  venue and date**.
- [ ] Given a template, when I seed the competition from it, then draw / scoring /
  task settings are pre-filled and remain editable ([1.3](#13--maintain-reusable-contest-templates)).
- [ ] Given a competition, when I save its identity, then name and date are present
  before I can proceed to configuration that depends on them.

**Traces to:** area 3.1 · users.md §1 Organiser
**Notes:** Templates seed the configuration but every setting stays editable.
**Fly-off competitions are a Future Enhancement** — out of MVP scope — so the MVP
covers qualifying-round competitions only.

### 3.2 — Select the discipline

**As an** Organiser, **I want** to choose the competition's discipline, **so that**
the available tasks, scoring and rules are the correct ones for that class.

**Acceptance criteria**
- [ ] Given a new competition, when I select a discipline (e.g. F3B, F3J, F3K, F5J,
  F5K, F5L), then the tasks and rules available for configuration are those of that
  discipline.
- [ ] Given a competition seeded from a template, when I open it, then its
  discipline matches the template and is not silently changeable to a class whose
  tasks differ.
- [ ] Given scores already captured, when I attempt to change the discipline, then
  the change is prevented or requires explicit re-confirmation, because it
  invalidates task configuration and results.

**Traces to:** area 3.2 · users.md §1 Organiser
**Notes:** Discipline determines the scoring model — e.g. **F3B normalises its
three tasks separately** whereas the man-on-man classes produce one group score
([00-general-rules §3, §4](../requirements/rules/00-general-rules.md)). Per-class
numbers live in the per-class rule docs and are authoritative.

### 3.3 — Configure entry options

**As an** Organiser, **I want** to toggle entry features that shape the roster and
results — start numbers and pilot classes — **so that** the competition captures
exactly the per-entrant attributes this event needs.

**Acceptance criteria**
- [ ] Given a competition, when I enable **start numbers**, then each roster entry
  can carry a start number and it appears in the draw and reports.
- [ ] Given a competition, when I enable **pilot classes**, then each roster entry
  can be assigned a class and results can be grouped/ranked by it.
- [ ] Given an option I disable, when I view the roster, then the corresponding
  per-entry attribute is no longer required or shown.

**Traces to:** area 3.3 · users.md §1 Organiser
**Notes:** MVP is **individual-only** — team entry and `omit-from-team-score`, plus
per-entry frequency, are **Future Enhancements** and out of scope.

### 3.4 — Build and edit the roster

**As an** Organiser, **I want** to build the competition roster from master pilots
and edit each entry's attributes, **so that** the field is correct before the draw
and can be corrected afterwards.

**Acceptance criteria**
- [ ] Given the master pilot library, when I add pilots to the competition, then
  each becomes a roster entry carrying its per-entry attributes (e.g. start number,
  class) as enabled in [3.3](#33--configure-entry-options).
- [ ] Given a roster entry, when I edit its attributes, then the change applies to
  this competition only and not to the master pilot record.
- [ ] Given the draw has **not** been generated, when I add or remove entrants,
  then the roster updates freely.
- [ ] Given the draw **has** been generated, when I **replace** an entrant, then the
  replacement takes the withdrawn pilot's place in the existing draw and I am
  warned that the draw/lane allocations are affected (see Notes).
- [ ] Given a pilot the Contest Director has retired ([5.5], not the Organiser's),
  when I view the roster, then their retired state is reflected and I do not
  silently re-add them.

**Traces to:** area 3.4 · users.md §1 Organiser
**Notes:** Replacing an entrant after the draw is a real unhappy path — the
replacement inherits the slot rather than triggering a full re-draw. **Retirement
(5.5)** and **re-draw of remaining rounds** are the Contest Director's authority,
not the Organiser's; this story only reflects that state. The Pilot confirms their
own entry details via the roster ([users.md §5](../requirements/users.md#5-pilot--competitor)).

### 3.5 — Configure draw fairness options

**As an** Organiser, **I want** to configure the draw's fairness constraints —
lane allocation — **so that** the generated draw is fair and defensible.

**Acceptance criteria**
- [ ] Given a competition, when I configure **lane allocation**, then the draw
  generator uses that policy when assigning lanes within groups.
- [ ] Given constraints that cannot all be satisfied for the roster/task, when I
  save them, then I am warned rather than silently getting an unfair draw.

**Traces to:** area 3.5 · users.md §1 Organiser
**Notes:** MVP assumes **all competitors on 2.4 GHz** and is **team-free**, so
**frequency management** and **team-separation** draw constraints
([00-general-rules §1](../requirements/rules/00-general-rules.md)) are retained as
sport reference but **out of MVP software scope** (Future Enhancements). There is
**no helper-assignment constraint**: the FAI helper/official separation is
consciously waived at club level — the Scorer **is** the helper
([decisions.md D1](../requirements/decisions.md#d1--trust-model-small-known-trusted-group)).
The draw's anti-repeat matrix itself is specified at [4.1](#41--specify-the-draw).

### 3.6 — Configure scoring options

**As an** Organiser, **I want** to configure result computation — group-score
basis, rounding/precision and discard (drop-worst) rules — **so that** final
results are computed correctly for the discipline without me doing the maths.

**Acceptance criteria**
- [ ] Given a discipline, when I open scoring options, then the **group-score
  basis** defaults to the rule: within a group the **best raw result = 1000
  points** and others are scaled to it, inverted for speed tasks
  ([00-general-rules §3](../requirements/rules/00-general-rules.md)).
- [ ] Given F3B, when I view scoring options, then the model reflects that its
  **three tasks normalise separately** into partial scores rather than one group
  score ([00-general-rules §3–4](../requirements/rules/00-general-rules.md);
  [f3b.md](../requirements/rules/f3b.md)).
- [ ] Given a discipline, when I configure **rounding/precision** of the normalised
  score, then the choice respects the class's rounding unit.
- [ ] Given a discipline, when I configure **drop-worst**, then the setting defaults
  from the class rule — discard applies only once more than a class-specific number
  of rounds is flown (e.g. more than 4 for F5J, more than 7 for F3J)
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)) — and I am
  warned if I deviate from it (see Conflicts).
- [ ] Given **any** parameter the class rules fix — the mandated landing-bonus
  table (F3J/F3B/F5J/F5L each prescribe one), points-per-second (F5L = 2 pt/s,
  others 1 pt/s), rule-bounded landing-window durations — when I configure it,
  then the **class rule is the default** and a deviating value requires
  **explicit confirmation with a warning**, never a silent accept (the same
  guardrail pattern as drop-worst;
  [3.6](../requirements/high-level-requirements.md#area-3--competition-setup--configuration)).
- [ ] Given drop-worst is in effect, when results compute, then **penalties are
  retained even if the round they occurred in is dropped**
  ([00-general-rules §5–6](../requirements/rules/00-general-rules.md)).
- [ ] **(Degenerate case)** Given a group in which **every raw score is zero**,
  when the group score computes, then **every pilot in the group scores 0** — the
  normalisation does not divide by zero and does not raise an error.
- [ ] **(Degenerate case)** Given two or more pilots **tie for the best raw
  result** in a group, when the group score computes, then **each of the tied
  pilots scores 1000** and the others scale to that shared best (consistent with
  the formula in
  [00-general-rules §3](../requirements/rules/00-general-rules.md#3-group-score-normalisation);
  the same holds for the inverted speed-task ratio on a tied best time).
- [ ] **(Degenerate case)** Given penalties that would take a final aggregate
  **below zero**, when results compute, then the aggregate is recorded as **0**
  with the penalties still logged
  ([00-general-rules §6](../requirements/rules/00-general-rules.md#6-penalties-common);
  imposition itself is the Contest Director's
  [5.9](02-contest-director.md#59--impose-penalties-with-correct-recompute)).

**Traces to:** area 3.6 · users.md §1 Organiser
**Notes:** The Organiser configures scoring but the *numbers* are authoritative in
the per-class rule docs. Free configuration of drop-worst must not be allowed to
**contravene** the class rule — see [Conflicts & questions](#conflicts--questions-for-the-user).
The three degenerate cases above are deliberate **shared test cases**: carry them
into each per-discipline scoring spec as it is written, so every class's
computation is exercised against the same corners.

### 3.7 — Configure per-task scoring rules

**As an** Organiser, **I want** to configure each task's scoring parameters
generically — target times, timing precision, points-per-second, landing-bonus
table and penalty/deduction types — **so that** live capture and
scoring behave correctly for this competition's tasks.

**Acceptance criteria**
- [ ] Given a task, when I set its **target time**, then I can also set **per-round
  overrides** where the task allows them.
- [ ] Given a task, when I set its **timing precision**, then it matches the class
  rule for that task (e.g. F3J/F3K = 0.1 s; F5J/F5K/F5L and F3B-duration = whole
  seconds; F3B-speed = 1/100 s —
  [00-general-rules §2](../requirements/rules/00-general-rules.md)).
- [ ] Given a task that uses landings, when I configure it, then I can select a
  **landing-bonus table** from master data ([1.2](#12--maintain-reusable-landing-bonus-tables)).
- [ ] Given a task that scores flight time only, when I configure it, then a landing
  table is not required.
- [ ] Given a task, when I configure **points-per-second** and
  **penalty/deduction types**, then those parameters drive capture and scoring
  for that task.
- [ ] Given a class whose rules leave a scoring constant to the **event** —
  e.g. **F5K's Nominal Launch Height** (60 m light wind / 70 m moderate,
  CD-announced — [f5k.md](../requirements/rules/f5k.md)) — when I configure
  the competition, then that constant has a **named place in 3.7** and feeds
  the class's scoring computation; rule-fixed values around it (F5K's
  ±per-metre adjustments) default per the [3.6 guardrail](#36--configure-scoring-options).

**Traces to:** area 3.7 · users.md §1 Organiser
**Notes:** Intentionally **generic** — discipline-specific tasks and special rules
are deferred to per-discipline requirements. Precision and which fields exist are
per-class ([00-general-rules §2](../requirements/rules/00-general-rules.md)); the
per-class docs are authoritative on numbers. There is **no timekeeper-count
parameter**: the FAI two-timekeeper practice is consciously waived at club level
— the one Scorer's device time is official
([decisions.md D1](../requirements/decisions.md#d1--trust-model-small-known-trusted-group)).

---

## Area 4 — Draw & Rounds Generation

### 4.1 — Specify the draw

**As an** Organiser, **I want** to set the draw mode, groups-per-round and
consecutive-flight constraints within the bounds implied by the roster and task,
**so that** the draw I generate is well-formed and fair.

**Acceptance criteria**
- [ ] Given a roster and task, when I set **groups-per-round**, then values outside
  the bounds implied by roster size and group limits are rejected with an
  explanation.
- [ ] Given the draw specification, when I set a **consecutive-flight constraint**,
  then the generator will avoid drawing a pilot into back-to-back groups where the
  constraint forbids it.
- [ ] Given the draw specification, when I choose a **draw mode**, then it reflects
  the random initial order and the round-by-round **anti-repeat** intent (any two
  pilots meet as few times as possible —
  [00-general-rules §1](../requirements/rules/00-general-rules.md)).

**Traces to:** area 4.1 · users.md §1 Organiser
**Notes:** Initial starting order is a **random draw before the contest**, and group
composition changes every round via an anti-repeat matrix
([00-general-rules §1](../requirements/rules/00-general-rules.md)). Team separation
and frequency-follows-frequency grouping are **out of MVP scope**. Progressive /
seeded draws (used by fly-off re-draws) are a **Future Enhancement** — out of MVP
scope.

### 4.2 — Generate the draw

**As an** Organiser, **I want** to generate the flight groups for a chosen number
of rounds, keeping the fairest of several attempts, **so that** I hand the Contest
Director a draw that is as fair as the roster allows.

**Acceptance criteria**
- [ ] Given a valid draw specification, when I generate the draw for N rounds, then
  flight groups are produced for each round honouring the anti-repeat and
  consecutive-flight constraints.
- [ ] Given generation runs multiple attempts, when it completes, then the
  **fairest** attempt (by the matchup-distribution metric) is retained.
- [ ] Given the roster allows it, when the draw is generated, then it **avoids
  producing a group with only one scoring pilot**; where the roster makes a
  single-pilot group unavoidable, the lone-pilot safeguard at
  [5.3](#53--manage-groups-and-prepare-re-flights) applies.
- [ ] Given a generated draw, when I review it, then I can see the fairness metric
  and matchup distribution that the Contest Director will use to accept or re-draw
  (see Notes).
- [ ] Given a roster or specification that makes a valid draw impossible, when I
  generate, then I get a clear failure rather than an invalid draw.

**Traces to:** area 4.2 · users.md §1 Organiser
**Notes:** **Handoff:** validating fairness and **accepting or re-drawing (4.3)**
is the [Contest Director's](../requirements/users.md#2-contest-director) authority.
The Organiser generates and *presents* the draw and its fairness evidence; the
accept/re-draw decision is the Director's story, not this one.

### 4.4 — Adjust lane allocations

**As an** Organiser, **I want** to review and manually reassign lane allocations
after the draw, **so that** I can correct lane placements without disturbing the
fair group composition.

**Acceptance criteria**
- [ ] Given an accepted draw, when I review lane allocations, then I can see each
  pilot's lane within their group per round.
- [ ] Given a lane allocation, when I reassign a pilot's lane, then group
  membership (who meets whom) is unchanged — only lanes move.
- [ ] Given a manual lane change that would clash (two pilots in one lane, or a lane
  left empty where one is required), when I apply it, then the clash is flagged and
  prevented.

**Traces to:** area 4.4 · users.md §1 Organiser
**Notes:** Lane adjustment is distinct from re-drawing; it must not alter the
anti-repeat matrix. Re-draw remains the Director's decision at
[4.3](../requirements/users.md#2-contest-director).

---

## Area 5 — Scoring (administration slice)

> The Organiser's slice of Area 5 is **oversight**: corrections, cross-round
> review, group moves/re-flights, and outlier/missing validation. **Live capture**
> (5.0/5.1/5.2) is the [Scorer's](../requirements/users.md#3-scorer) role, and
> the *authority* to approve re-flights/group changes and to retire pilots (5.5)
> is the [Contest Director's](../requirements/users.md#2-contest-director).

### 5.3 — Manage groups and prepare re-flights

**As an** Organiser, **I want** to move pilots between groups and set up re-flights,
new groups or splits with clash checks, **so that** the running order can adapt to
real-world disruptions under the Contest Director's authority.

**Acceptance criteria**
- [ ] Given a round, when I move a pilot between groups or create/split a group,
  then the system runs **clash checks** and flags conflicts before applying.
- [ ] Given a pilot needs a re-flight, when I prepare it, then the re-flight is set
  up for execution, and if it requires the Contest Director's **approval** the story
  records that handoff rather than granting approval here.
- [ ] Given a group change that would violate a draw constraint, when I apply it,
  then I am warned with the reason.
- [ ] Given a group resolves to a **single scoring pilot** and the draw could not
  avoid it ([4.2](#42--generate-the-draw)), when the group is scored, then a
  **randomly-chosen dummy** from the other pilots is inserted for the lone pilot to
  be normalised against — so they are **not auto-awarded the group winner's 1000**
  ([00-general-rules §3](../requirements/rules/00-general-rules.md)) — and the
  dummy's flight **does not count** toward that pilot's own score.
- [ ] Given a discipline whose rules dictate a different outcome — e.g. **F3B
  annuls a one-valid-result group** ([f3b.md](../requirements/rules/f3b.md)) —
  when a lone-pilot group arises, then the dummy is **not** applied automatically;
  the system warns and the **Contest Director's explicit per-contest approval** is
  required before proceeding (this story records that handoff rather than granting
  approval here).
- [ ] Given a re-flight approved by the Director, when its new result is captured,
  then scoring recomputes consistently for the affected group/round, applying the
  class's **which-score-counts rule**
  ([00-general-rules §7](../requirements/rules/00-general-rules.md#7-re-flights-common-pattern)):
  for the pilot(s) **allocated the re-flight**, the re-flight result is the
  official score **even if worse**; for every other pilot flying in that group
  (random-draw fillers, or the original group re-flying), the **better of** their
  original flight and the re-flight counts.
- [ ] Given a re-flight is placed in a **new group of re-flyers**, when I prepare
  it, then the group is filled to the class minimum (**4**; **6 for F5J**) by
  **random draw** from the other competitors, and the fillers' better-of scoring
  applies as above ([00-general-rules §7](../requirements/rules/00-general-rules.md#7-re-flights-common-pattern)).

**Traces to:** area 5.3 · users.md §1 Organiser (+ Contest Director for approval)
**Notes:** **Handoff:** *approving* re-flights and group changes is the Contest
Director's authority ([users.md §2](../requirements/users.md#2-contest-director));
the Organiser *prepares and executes* them. The **lone-pilot safeguard** follows
the same split — the draw avoids single-pilot groups ([4.2](#42--generate-the-draw))
and the Organiser executes the dummy insertion, but the **override** where a class
rule would annul instead (e.g. F3B) is the **Contest Director's to approve**, scoped
to that one contest. **Pilot retirement (5.5)** and any consequent re-draw are the
Director's — out of the Organiser's scope.

### 5.4 — Review and correct scores by pilot

**As an** Organiser, **I want** to review and enter a single pilot's scores across
all rounds, **so that** I can find and correct capture errors and fill gaps in one
place.

**Acceptance criteria**
- [ ] Given a pilot, when I open their scores, then I see their results **across all
  rounds** in one view.
- [ ] Given a captured score I believe is wrong, when I correct it, then the change
  is recorded and results recompute for the affected group and final aggregate.
- [ ] Given a round with a missing result for a pilot, when I enter it here, then it
  is stored against the correct pilot and round.
- [ ] Given a correction, when it is applied, then it is **attributable/auditable**
  (who changed what) so the result remains defensible.
- [ ] Given the competition is **locked** by the Director, when I attempt a
  correction, then it is prevented and I am told the competition is locked.

**Traces to:** area 5.4 · users.md §1 Organiser
**Notes:** This is post-hoc administration, distinct from the Scorer's **live**
capture (5.1/5.2). Penalties themselves are imposed by the Contest Director
([00-general-rules §6](../requirements/rules/00-general-rules.md)); the Organiser
corrects captured task metrics, not penalty rulings.

### 5.6 — Validate scores for outliers and gaps

**As an** Organiser, **I want** the system to flag outlier and missing scores
against configurable limits, per pilot or overall, **so that** capture mistakes
surface before results are trusted.

**Acceptance criteria**
- [ ] Given configurable limits, when scores are captured, then values outside the
  limits are **flagged as outliers** for review.
- [ ] Given a round in progress or complete, when a pilot in a flown group has **no
  score**, then the gap is flagged as missing.
- [ ] Given a flagged outlier or gap, when I review it, then I can correct it via
  [5.4](#54--review-and-correct-scores-by-pilot) or confirm it is genuine, and the
  flag clears.
- [ ] Given validation limits, when I set them **per pilot or overall**, then
  flagging honours the chosen scope.

**Traces to:** area 5.6 · users.md §1 Organiser
**Notes:** Validation is advisory — it flags for human judgement, it does not
silently alter scores. Ties into 5.4 for the correction path.

---

## Area 7 — Reports

### 7.1 — Produce results reports

**As an** Organiser, **I want** to produce results reports — overall, positional,
round-by-round, landing and ranked — with scope filters and round-range selection,
**so that** results are available at any stage of the event.

**Acceptance criteria**
- [ ] Given captured scores, when I produce a results report, then I can choose
  **overall, positional, round-by-round, landing or ranked** views.
- [ ] Given a report, when I apply **scope filters** and a **round range**, then the
  output reflects exactly that selection.
- [ ] Given any final-classification output, when it is produced, then it is
  presented **in final order, winner first**, with **drop-worst applied** and
  **penalties retained** per the rules
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)).
- [ ] Given an event still in progress, when I produce a report, then each completed
  round's results are available as the contest proceeds
  ([00-general-rules §5](../requirements/rules/00-general-rules.md)).

**Traces to:** area 7.1 · users.md §1 Organiser
**Notes:** **Handoff:** the Organiser *produces* reports; **publishing official
results** is the Contest Director's authority
([users.md §2](../requirements/users.md#2-contest-director)). PDF/CSV export and
online publishing channels are **Future Enhancements**.

### 7.3 — Produce draw reports

**As an** Organiser, **I want** to produce draw reports and scoring sheets in
multiple layouts and sort orders, **so that** the flying order is clear on the
field and Scorers have the sheets they need.

**Acceptance criteria**
- [ ] Given an accepted draw, when I produce a draw report, then I can choose among
  **multiple layouts and sort orders** (e.g. by group, by pilot, by lane).
- [ ] Given the draw, when I produce **scoring sheets**, then each shows the pilots
  and the task fields to be recorded for the relevant group/round.
- [ ] Given lane adjustments made at [4.4](#44--adjust-lane-allocations), when I
  reprint the draw report, then it reflects the current lane allocations.

**Traces to:** area 7.3 · users.md §1 Organiser
**Notes:** Draw reports feed the Pilot (reads flying order/lane) and the field.
Score capture in the MVP is device-based, but printed scoring sheets remain a valid
report output.

### 7.2 / 7.4 — Custom reports and score cards

**As an** Organiser, **I want** to produce customisable report layouts and
printable per-pilot score cards and records, **so that** the event's output suits
its audience.

**Acceptance criteria**
- [ ] Given a report layout, when I apply branding/customisation available in the
  MVP, then the output reflects it.
- [ ] Given a pilot, when I produce a **score card / record**, then it shows that
  pilot's per-round breakdown printable per pilot.

**Traces to:** area 7.2, 7.4 · users.md §1 Organiser
**Notes:** Branding/customisation depth is light in the MVP; **badges**, **output
channels (PDF/CSV/online)**, **email distribution** and **combined preliminary +
fly-off reporting** are **Future Enhancements**.

---

## Coverage self-check

Every Organiser task in [`users.md §1`](../requirements/users.md#1-organiser) is
covered:

- Master data (Area 1) → 1.1, 1.2, 1.3
- Create/open/delete (2.1) → 2.1
- Suspend/resume across days (2.3) → 2.3
- Configure a competition (Area 3) → 3.1–3.7
- Specify/generate/adjust the draw (4.1, 4.2, 4.4) → 4.1, 4.2, 4.4
- Administer scores (5.3, 5.4, 5.6) → 5.3, 5.4, 5.6
- Draw and results reports (Area 7) → 7.1, 7.3, 7.2/7.4

No story crosses into another role's authority (draw acceptance/re-draw 4.3,
penalties, re-flight approval, the **lone-pilot dummy override**, retirement 5.5,
lock 2.2, publishing are all noted as Contest Director handoffs); no story depends
on a Future-Enhancement capability.

---

## Conflicts & questions for the user

All items raised in the first draft have been **resolved** with the user; the
resolutions are reflected in the stories above and, where noted, in the
requirements docs.

1. **Organiser "Primary areas" shorthand listed Area 4 wholesale — resolved,
   applied.** The *User-at-a-glance* table in
   [`users.md`](../requirements/users.md#user-at-a-glance) implied the Organiser
   owned **4.3 (Validate Draw)**, which belongs to the Contest Director. The
   glance-table entry has been **narrowed to "4.1, 4.2, 4.4"** to match the §1 task
   table.

2. **Drop-worst configuration (3.6) — resolved, applied.** Area 3.6 presented
   discard (drop-worst) as freely configurable, but
   [00-general-rules §5](../requirements/rules/00-general-rules.md) makes it
   **class-specific** (thresholds differ per class). Resolution: the class
   rule is the **default and guardrail** — drop-worst pre-fills from the discipline,
   and any deviation requires an explicit "deliberate deviation from FAI rule"
   confirmation surfaced in reports. Story 3.6 is written to this.

3. **Fly-offs & progressive/seeded draw — resolved, removed from MVP.** The
   progressive/seeded draw (former Area 4.5) exists to support **fly-off re-draws**,
   so fly-offs and progressive draws are **removed from the MVP and moved to
   [Future Enhancements](../requirements/high-level-requirements.md#future-enhancements)**.
   Former Area 4.5 is deleted, the fly-off clause is removed from 3.1, and combined
   preliminary + fly-off reporting is removed from 7.2. No Organiser story now
   covers fly-offs or seeded draws. Plain re-draw of remaining rounds on **pilot
   retirement (5.5)** remains the Contest Director's authority and is unaffected.

4. **Landing tables vs. tasks that don't use landings — no change needed.** [1.2]
   and [3.7] let the Organiser define/select landing-bonus tables, but
   [00-general-rules §2](../requirements/rules/00-general-rules.md) notes some tasks
   (F3K, F5K) **score flight time only**. Handled in the stories (landing table not
   required for such tasks); flagged only so per-discipline work keeps the
   constraint.

5. **Lone-pilot group → auto-1000 — resolved, applied.** Under
   [00-general-rules §3](../requirements/rules/00-general-rules.md) a pilot alone in
   a group is the group winner and banks **1000** regardless of how they flew.
   Resolution: the draw **avoids** single-pilot groups ([4.2](#42--generate-the-draw));
   where unavoidable, a **randomly-chosen dummy** is inserted for the lone pilot to
   normalise against (the dummy's flight not counting for the dummy). This must
   **not** be applied where a class rule mandates otherwise — **F3B annuls a
   one-valid-result group** ([f3b.md](../requirements/rules/f3b.md)) — so there the
   dummy override needs the **Contest Director's explicit per-contest approval**.
   Stories [4.2] and [5.3] are written to this.
