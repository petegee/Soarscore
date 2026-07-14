# [STORY-001-039] Capture Task-Driven Metrics and Task-Integral Deductions

> Source: `docs/user-stories/03-scorer.md` §5.2.1–5.2.3 ·
> `docs/requirements/high-level-requirements.md` Area 5.2 ·
> `docs/requirements/rules/00-general-rules.md` §2 (data the timer/helper
> collects), §6 (penalties) · `docs/requirements/scorer-device.md` §1 (capture
> model) · `docs/requirements/decisions.md` D5/D9 (working-time cap and
> base-clock timestamps) · relates to STORY-001-034 (confirmed competitor),
> STORY-001-036 (live capture mechanics this screen is built on),
> STORY-001-029 (Contest Director's discretionary penalties)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Every FAI class shapes its tasks differently, but the Scorer's device must stay
**generic**: one capture screen driven by the competition's configured task,
never a hard-coded per-class layout. This story delivers that generic,
task-driven metric set — flight/working time, landing result, per-flight
records, nominated-time calls, launch/start height and task-integral
deductions — presented in the order the flight naturally unfolds.

The **raw-capture principle** governs everything captured here: the Scorer
records the raw observation only — a stopwatch time, a tape reading, an
observed land-out — never an interpretation. Caps, bonus-table conversions and
derived judgements (such as an over-working-time flight) are applied by the
system from the raw data and base-clock timestamps, consistently for every
pilot, never from the Scorer's own judgement. This story also draws the line
already settled between a **task-integral deduction** (an observed
flight-level event the Scorer records, like a land-out or a model contacting a
person) and a **discretionary disciplinary penalty** (infringements, dangerous
flying, cheating or unsporting behaviour), which is never entered on a Scorer
device and belongs to the Contest Director (STORY-001-029).

### Business Value

- Let one generic capture screen serve every class's task shape, so adding a
  new discipline is additive configuration, not a device rewrite
  (class-model law).
- Keep the record trustworthy by capturing only raw observations, so caps,
  bonuses and derived judgements are applied consistently for every pilot.
- Let a Scorer record the flight-level events an unfolding flight actually
  produces, without straying into disciplinary judgement calls that belong to
  the Contest Director.

### Dependencies and Assumptions

- **Prerequisites**: the competition's configured task/discipline (task
  configuration, assumed as input here); STORY-001-034 (confirmed competitor)
  and STORY-001-036 (the live-capture and correction mechanics this screen is
  built on).
- **Data assumptions**: which metric categories a task uses, and their required
  precision/units, come from that task's configuration, never a hard-coded
  per-class list; a multi-flight task stores each flight as its own record —
  which flight(s) count is computed downstream, never pre-filtered by the
  Scorer.
- **Integration points**: caps, overflies and bonus-table conversions are
  derived by the system from raw captures and base-clock timestamps (D5/D9),
  not entered by the Scorer; a discretionary disciplinary matter observed
  during a flight is handed off to the Contest Director (STORY-001-029), not
  recorded here.
- **Business constraints**: class-agnostic core (CLAUDE.md) — this screen must
  never branch on discipline; the working-time cap is always applied from
  base-clock timestamps, never the Scorer's judgement of when working time
  ended.

### Scope In

- Presenting only the metric categories the current task uses, driven by its
  configuration.
- Capturing flight/working time to the precision the task requires.
- Capturing a landing result as the measured observation, not its bonus-table
  conversion.
- Capturing each flight of a multi-flight/last-flight task as its own record.
- Capturing raw observations only — no caps, bonus tables, deductions or
  derived judgements applied by the Scorer.
- Timing through to first ground contact regardless of the working-time horn.
- Capturing a nominated target time and whether it was achieved (nominated-time
  tasks).
- Capturing launch/start height for F5 classes as the task requires.
- Ordering inputs to follow the natural sequence of the flight (e.g. launch →
  flight → landing).
- Recording task-integral deductions the flight itself incurs (a land-out, the
  model contacting a person, or another task-defined flight-level event).

### Scope Out

- System-side derivation of caps, overflies, bonus-table conversions and which
  flights count — computed downstream, not by the Scorer.
- Discretionary disciplinary penalties (infringements, dangerous flying,
  cheating, unsporting behaviour) — Contest Director authority,
  STORY-001-029.
- Which concrete tasks map to which metrics for a given discipline, and any
  per-discipline screen layout — deferred to per-discipline requirements
  beyond this generic MVP scope.
- The confirmation guard and live-capture/correction mechanics this screen
  relies on — STORY-001-034 / STORY-001-036.

### Acceptance Criteria

#### AC1: Only the task's own metric categories are presented
**Given** the current task is an F3J flight-time task with no landing component
configured
**When** I open the capture screen for John Brown's flight
**Then** I am asked for flight time and its task-defined metrics only — I am
not asked for a landing result or an F5 launch height.

#### AC2: Flight time is captured to the task's required precision
**Given** the current task's rules require flight time to whole seconds
**When** I capture John Brown's flight time
**Then** it is recorded to whole seconds — neither more nor less precision than
the task's rules require.

#### AC3: A landing result is recorded as a raw measurement
**Given** the current task includes a landing component
**When** John Brown lands
**Then** I record the measured landing result the task defines (e.g. a tape
distance), not any points or bonus value derived from it.

#### AC4: Each flight of a multi-flight task is its own record
**Given** a multi-flight task and John Brown makes three launches during
working time
**When** I capture his flights
**Then** each launch is its own record (flight number, time, task fields), and
I am not asked to decide which of the three counts.

#### AC5: Only raw observations are entered, no interpretation
**Given** John Brown's flight overruns the task's working time
**When** I capture his flight time
**Then** I record the raw stopwatch time only — the system, not I, determines
that it was an overfly and by how much.

#### AC6: Timing continues past the working-time horn to touchdown
**Given** working time ends while John Brown's model is still airborne
**When** the horn sounds
**Then** I keep timing until his model's first ground contact — my watch does
not stop at the horn, and the working-time cap is applied later from the
timestamps, not my judgement.

#### AC7: A nominated target time and its achievement are captured
**Given** the current task is a nominated-time (Poker/ladder) task and John
Brown nominates 210 seconds before launch
**When** his flight concludes
**Then** I record the nominated 210 seconds and whether it was achieved.

#### AC8: Launch/start height is captured for F5 classes
**Given** the competition is an F5 class task that records launch height
**When** John Brown launches
**Then** I capture his launch height in whole metres as the task requires.

#### AC9: Inputs follow the shape of the flight
**Given** a task with launch → flight → landing order
**When** I capture John Brown's result
**Then** the inputs are presented in that order, so I am not hunting across the
screen while watching the model.

#### AC10: A task-integral deduction is recorded as an observed event
**Given** John Brown's model lands out (overshoots the designated landing area)
during a task that scores landing
**When** I observe the land-out
**Then** I record it as part of his flight result, as the task defines a
land-out.

#### AC11: A discretionary disciplinary matter is not recorded here
**Given** John Brown's flying is dangerous enough to warrant discipline, in my
judgement as the Scorer
**When** I consider recording it
**Then** my device does not offer this as something I record — it is raised to
the Contest Director instead.

#### Non-Functional Expectations
- The capture screen carries no knowledge of any specific competition class —
  it is driven entirely by the configured task's declared metric categories
  (CLAUDE.md class-model law).

### INVEST Check

Independent (a generic, task-configuration-driven capture surface, built on but
distinct from the underlying confirm/capture mechanics) · Valuable (one screen
that serves every class without a rewrite, and an honest raw-capture record) ·
Small (4 days, 3 functional points: task-driven metric set + precision,
raw-capture ordering, task-integral deductions) · Testable (metric-set
filtering by task, precision, raw-vs-derived boundaries and the deduction/
penalty split are all directly observable).
