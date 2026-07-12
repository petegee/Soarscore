# Story Decomposition: Per-Task Draw Presentation in the Workflow Screen

## INVEST Analysis

### Abstract Task: "Per-Task Draw Presentation"

**Analysis Dimensions**:
- **Core Responsibility**: give the Organiser and Contest Director a way to
  see and decide on a multi-task class's draw when it now contains an
  independent group composition **per task** (STORY-001-020), instead of the
  single shared composition the draw workflow screen (STORY-001-018)
  currently assumes.
- **Primary Operations**: display each task's group composition for a round;
  let the reviewer see per-task fairness evidence side by side; accept or
  re-draw the whole multi-task draw as one decision (acceptance stays a
  single act per STORY-001-017 — only the *display* changes).
- **Key Constraints**: single-task classes must render exactly as they do
  today (one composition, one fairness view) — this is purely additive
  presentation for classes with more than one task; the accept/re-draw
  decision itself is out of scope (STORY-001-017 already owns it and is not
  changed by this story).
- **Technical Complexity**: Medium — a presentation change over data
  STORY-001-020 already produces; no new business logic.
- **Business Complexity**: Low — the underlying decision (accept/re-draw) is
  unchanged; this is about making a richer data shape legible, not about new
  business rules.

### INVEST Evaluation
- ✅ **Independent**: depends only on STORY-001-020's output shape; does not
  depend on updates to draw acceptance, group management or draw reports
  (those remain separate follow-on work).
- ✅ **Negotiable**: exact layout (tabs per task vs. stacked sections vs. a
  combined table) is open for design.
- ✅ **Valuable**: without this, STORY-001-020's per-task draws are generated
  correctly but invisible — the Organiser/Contest Director cannot review or
  trust what they cannot see, which blocks F3B contests from actually using
  the improved draw.
- ✅ **Estimable**: a bounded presentation change over a known, newly-shaped
  API response.
- ✅ **Small**: ~2–3 days, two functional points (per-task group display,
  per-task fairness display).
- ✅ **Testable**: each task's composition and fairness figures are
  independently visible and checkable against the underlying draw.

**Conclusion**: Ready as-is — carved out from STORY-001-020 specifically to
keep that story to a backend-only 2–3 functional points, matching the
STORY-001-018/STORY-001-019 precedent of separating backend draw mechanics
from their companion-app presentation.

---

## [STORY-001-021] Per-Task Draw Presentation in the Workflow Screen

> Source: `docs/requirements/rules/f3b.md` §1 (F3B.1.8b) ·
> `docs/requirements/companion-app.md` §1 (role-oriented views) ·
> STORY-001-018 (draw workflow screen, whose single-composition assumption
> this story extends for multi-task classes) · STORY-001-020 (produces the
> per-task data this story presents)
> Module: 001 (Organiser MVP) · Estimated effort: **2–3 days**

### Background

STORY-001-018 built the draw workflow screen around one group composition
per round. Once STORY-001-020 lands, a multi-task class like F3B produces
three independent compositions per round (Duration, Distance, Speed) plus
per-task fairness evidence. Without this story, that richer, more accurate
draw exists in the system but the Organiser and Contest Director have no way
to see it — the screen would either show only one task's groups or render
something that doesn't reflect what was actually drawn. This story extends
the workflow screen's presentation so a multi-task round's per-task
compositions and fairness evidence are all visible before the Contest
Director accepts or re-draws.

### Business Value

- Provide the Organiser and Contest Director with a trustworthy view of what
  an F3B draw actually contains — three task-specific compositions, not one.
- Support the accept/re-draw decision (STORY-001-017) with fairness evidence
  broken out per task, so a task-specific imbalance isn't hidden inside a
  blended figure.
- Enable F3B contests to actually use the improved per-task draw from
  STORY-001-020, rather than leaving it generated but unreviewable.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-020 (per-task draw domain model, generation
  and fairness evidence); STORY-001-018 (the existing draw workflow screen
  this story extends); STORY-001-017 (accept/re-draw decision — unchanged by
  this story).
- **Data assumptions**: the base returns per-task group compositions and
  per-task fairness evidence for multi-task classes, and the existing single
  composition/evidence shape for single-task classes (STORY-001-020 AC5).
- **Integration points**: reads from the same draw-evidence endpoint
  STORY-001-018 already uses, now carrying the richer per-task shape for
  multi-task classes.
- **Business constraints**: offline-first — the screen works over the base's
  local Wi-Fi with no internet (D6), consistent with the rest of the
  companion app.

### Scope In

- Displaying each task's group composition for a round, for multi-task
  classes, alongside the existing single-composition display for single-task
  classes.
- Displaying per-task fairness evidence (matchup distribution, fairness
  metric) so a reviewer can judge each task's fairness independently.
- No change to the accept/re-draw action itself — it remains one decision for
  the whole draw, per STORY-001-017.

### Scope Out

- The accept/re-draw decision logic — STORY-001-017 (unchanged).
- Draw acceptance's downstream consumers (group management, draw reports)
  reading per-task groupings — tracked as follow-on work, not built here.
- Any change to how single-task classes are displayed — must remain
  identical to today's STORY-001-018 behaviour.

### Acceptance Criteria

#### AC1: Multi-task rounds show a composition per task
**Given** a generated F3B draw where a round's Duration, Distance and Speed
tasks have different group compositions
**When** the Organiser opens the draw workflow screen for that round
**Then** all three task's group compositions are shown, clearly labelled by
task, rather than a single blended list.

#### AC2: Per-task fairness evidence is shown side by side
**Given** the same generated F3B draw, where Speed's larger groups produce a
different matchup-distribution than Duration's and Distance's smaller groups
**When** the Contest Director reviews the draw before deciding
**Then** the screen shows each task's fairness metric and matchup
distribution separately, not combined into one figure that would hide the
difference.

#### AC3: Single-task classes render unchanged
**Given** an F5J competition's generated draw
**When** the Organiser or Contest Director opens the draw workflow screen
**Then** the screen shows exactly the single composition and single fairness
view it showed before this story, with no per-task labelling or layout
change.

#### AC4: Accepting or re-drawing still acts on the whole draw as one decision
**Given** a multi-task F3B draw displayed with its three per-task
compositions
**When** the Contest Director accepts the draw
**Then** all three tasks' compositions are accepted together as a single
draw decision, consistent with STORY-001-017 — there is no per-task
accept/reject action.

### INVEST Check

Independent (a presentation layer over STORY-001-020's already-shaped data;
no new business logic) · Valuable (makes the improved per-task draw usable —
without it, F3B contests cannot review or trust what was actually drawn) ·
Small (2–3 days, 2 functional points: per-task composition display, per-task
fairness display) · Testable (each task's composition and fairness figures
are independently visible and checkable).
