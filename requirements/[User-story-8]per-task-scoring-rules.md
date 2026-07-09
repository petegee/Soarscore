# [STORY-001-008] Per-Task Scoring Rules Configuration

> Source: `docs/user-stories/01-organiser.md` §3.7 · `docs/requirements/high-level-requirements.md` Area 3.7 · `docs/requirements/rules/00-general-rules.md` §2
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

> **Reshaped by D12 / STORY-001-016.** Per-task parameters are **additive
> slots on the Contest Class Model**. AC3's landing table is the **model's
> owned table** (STORY-001-002's standalone selection is superseded); AC2/AC5
> defaults come from the model, and a deviation is a custom clone (016), not a
> per-field warning. The per-event constant (F5K NLH, AC6) is unchanged.

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
- Per task: timing precision, points-per-second, landing-bonus table
  selection (where landings are used), penalty/deduction types.
- Named per-event rule constants where a class leaves them to the event
  (first case: F5K Nominal Launch Height).

### Scope Out

- Discipline-specific task screens and special rules — deferred
  per-discipline requirements.
- The device-side capture experience (scorer-device scope).
- Rule-fixed value defaults/warnings — pattern owned by STORY-001-007,
  applied here.

### Acceptance Criteria

#### AC1: Target time with per-round overrides
**Given** an F3J competition whose qualifying working time is 10 minutes
**When** the Organiser sets round 5's target/working time to 8 minutes where
the task allows per-round overrides
**Then** rounds 1–4 keep 10 minutes and round 5 carries 8 minutes.

#### AC2: Timing precision matches the class rule
**Given** tasks configured for F3J, F5J and F3B Speed
**When** the Organiser reviews each task's timing precision
**Then** they default to 0.1 s, whole seconds and 1/100 s respectively, and a
deviating precision triggers the explicit-confirmation warning
(STORY-001-007 guardrail).

#### AC3: Landing table where landings are scored
**Given** an F5J task (landings scored)
**When** the Organiser configures it
**Then** a landing-bonus table can be selected from master data, the class's
mandated table is the default, and a different selection warns.

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
**Then** the Nominal Launch Height has a named place in the task
configuration accepting the CD-announced value (60 m light wind / 70 m
moderate wind), it feeds F5K's scoring computation, and the rule-fixed
adjustments around it (+0.5 per metre below, −1.0 per metre 1–10 m above,
−3.0 per metre 11 m and above) default per the class rule with deviations
warned.

### INVEST Check

Independent (generic parameter model; class specifics defer) · Valuable
(capture and scoring configured, not coded, per event) · Small-ish (4 days,
3 functional points: per-task parameters, per-round overrides, per-event
constants) · Testable.
