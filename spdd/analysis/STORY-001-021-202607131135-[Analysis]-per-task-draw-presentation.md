# SPDD Analysis: Per-Task Draw Presentation in the Workflow Screen

## Original Business Requirement

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

## Domain Concept Identification

#### Existing Concepts (from codebase)
- `TaskGroupSet` / `RoundDraw.taskGroups` (`packages/shared/src/draw.ts`):
  STORY-001-020 already lands this — each `RoundDraw` carries `taskGroups:
  TaskGroupSet[]`, one entry per class-model task, each with its own
  `taskId`, denormalised `taskName`, and `groups: FlightGroup[]`. This is the
  exact per-task composition data this story must render; nothing new to add
  to the shared type layer.
- `TaskMatchupDistribution` / `GeneratedDraw.taskDistributions`
  (`packages/shared/src/draw.ts`): also already landed — one entry per task,
  each wrapping its own `MatchupDistribution` and `metricValue`, computed
  only from that task's own placement. This is the per-task fairness
  evidence AC2 asks for; already fully populated by the base for every
  generated/accepted draw, for every class (single-task classes get exactly
  one entry).
- `GeneratedDraw.groups` / `.distribution` / `.metricValue` (flat,
  back-compat fields, `packages/shared/src/draw.ts`): the pre-existing
  single-composition/single-fairness fields STORY-001-018 was built against.
  For single-task classes they are the *only* meaningful view (AC3); for
  multi-task classes they are, by STORY-001-020's construction, a mirror of
  `taskGroups[0]`/`taskDistributions[0]` — i.e. always exactly Duration's
  figures for F3B, silently. `DrawView.tsx` currently reads only these flat
  fields, which is precisely the gap this story closes: today an F3B
  Organiser sees Duration's groups and fairness labelled as if they were "the
  draw," with Distance and Speed entirely invisible.
- `DrawRounds` / `FairnessEvidence` (`apps/companion/src/draw/DrawView.tsx`):
  the two existing presentation components STORY-001-018 built, each taking
  a `GeneratedDraw` and a roster-lookup map and rendering the flat
  `groups`/`distribution`/`metricValue` fields. These are the components
  this story extends (or reuses per-task) rather than anything built from
  scratch — the round-labelling, group-sorting-by-`flyingOrder`,
  lane-sorting, `lonePilotFlagged` badge, and name-lookup-via-`nameFor`
  conventions all carry over unchanged.
- `DrawView` (`apps/companion/src/draw/DrawView.tsx`): the screen-level
  component owning `status` (`no-draw`/`awaiting-decision`/`accepted`),
  `handleGenerate`/`handleDecision`, and the single accept/cancel toolbar
  STORY-001-017 wired up. This story only changes what is rendered *inside*
  the `awaiting-decision`/`accepted` branches (currently `<DrawRounds
  draw={candidate|accepted} .../>` and `<FairnessEvidence
  draw={candidate|accepted} .../>`), never the decision toolbar itself
  (AC4).
- `DrawEvidenceView` (`packages/shared/src/draw.ts`): the read-model
  (`spec`, `candidate`, `accepted`, `status`, `warnings`) already returned by
  the one endpoint (`GET .../draw`) this story continues to read from — no
  new endpoint, no new fetch, since `candidate`/`accepted` are already
  `GeneratedDraw`s carrying the per-task fields.
- `ConstraintWarning` / `GeneratedDraw.groupSizeWarnings`
  (`packages/shared/src/draw.ts`): task-qualified (`group-size-minimum:
  <taskId>`) per-task shortfall warnings, already produced by the base
  (STORY-001-020/022) but **not currently rendered anywhere in
  `DrawView.tsx`** — the screen only renders `evidence.warnings` (spec/roster
  advisories), never `candidate.groupSizeWarnings`. This is boundary context:
  arguably adjacent to "per-task evidence," but it belongs to the
  accept/acknowledge mechanics STORY-001-017 owns, not to this story's scope
  (composition + fairness display) — flagged under Risk & Gap below rather
  than folded silently into this story's ACs.

#### New Concepts Required
- **Per-task section/label in the UI**: a presentation-only grouping of one
  task's composition (and, separately, its fairness card) under a visible
  task name (e.g. "Duration", "Distance", "Speed"), so AC1's "clearly
  labelled by task" requirement has a concrete UI anchor. This is not a new
  domain concept — `taskName` already exists on the data — but the
  *rendering unit* that groups a task's rounds-table and fairness-card
  together under that label does not yet exist in `DrawView.tsx` and must be
  introduced as a small presentational abstraction (not a new domain type).
- **Multi-task-vs-single-task display mode detection**: a derived, purely
  presentational condition (e.g. "does this draw have more than one task")
  that switches which rendering path runs. The data to derive it already
  exists (`taskGroups.length` / `taskDistributions.length` on the
  already-fetched `GeneratedDraw`) — no new fetch, no new field — but the
  *branch* itself is new to `DrawView.tsx`, which today has no such
  conditional at all.

#### Key Business Rules
- **Single-task classes must render byte-for-byte identical to today**
  (AC3, mirroring STORY-001-020's own AC5 for the data layer): governs the
  new display-mode detection — whatever condition selects "per-task layout"
  must evaluate false for every existing single-task class, and the
  single-task rendering path must remain the exact existing `DrawRounds`/
  `FairnessEvidence` call, not a "per-task layout with one entry."
- **Per-task fairness must stay separately attributable, never re-blended**
  (AC2, inherited from STORY-001-020's AC6): governs how the fairness
  evidence component consumes `taskDistributions` — each task's metric/
  distribution must be shown as its own figure; no code path may sum or
  average them into a single number for multi-task classes.
- **Accept/re-draw remains one decision for the whole draw regardless of
  how many task sections are displayed** (AC4, D13's third consequence,
  unchanged from STORY-001-017): governs the screen-level toolbar — the
  per-task rendering must not introduce a per-task accept/reject control;
  `handleDecision`'s existing single `candidate.id`-keyed call is reused
  completely unmodified.
- **Task ordering in the display should follow the class model's own task
  order** (implicit — `taskGroups`/`taskDistributions` are already emitted
  in `model.tasks` order by the base, per STORY-001-020's Operations):
  governs the rendering order of per-task sections — the UI should iterate
  the arrays in the order the base already provides them, not re-sort by
  name or introduce its own ordering logic.

## Strategic Approach

#### Solution Direction

`DrawView.tsx`'s existing `DrawRounds`/`FairnessEvidence` components already
encapsulate exactly the rendering logic a single task's composition and
fairness evidence need (round sections, group/lane sorting, lone-pilot
badge, name lookup, metric/pairs table). The natural extension is not to
rewrite these components but to make each of them **iterate the task
dimension when there is more than one task**, reusing the same per-round/
per-pair rendering logic inside a task-labelled wrapper. Concretely: a draw
is single-task when its (already-fetched) `taskGroups`/`taskDistributions`
arrays have exactly one entry, and multi-task otherwise; the single-task
path keeps rendering the flat `groups`/`distribution`/`metricValue` fields
completely unchanged (AC3), while the multi-task path renders one labelled
section per array entry, each reusing the existing per-round/per-pair
rendering body rather than a parallel, forked implementation. No new API
call, no new fetch, no new backend endpoint — this is purely a rendering
change inside the two existing components (or their immediate
decomposition) in `apps/companion/src/draw/DrawView.tsx`, over data the
`GET .../draw` endpoint already returns in full today.

Data flow: unchanged from STORY-001-018 — `DrawView`'s existing `refresh()`
call already fetches the full `GeneratedDraw` (including `taskGroups`/
`taskDistributions`) via `getDraw`; the only change is what the render tree
does with data already sitting in `evidence.candidate`/`evidence.accepted`.

#### Key Design Decisions

- **Layout for per-task sections**: (a) stacked sections, one per task,
  each with its own composition table directly followed by its own fairness
  card, read top-to-bottom; vs (b) tabs, one per task, showing one task at a
  time; vs (c) a single combined table with a task column.
  → Recommend (a) for the composition tables (mirrors the existing
  round-by-round stacked-section convention `DrawRounds` already uses, so
  the visual grammar is consistent with what STORY-001-018 established) but
  recommend a **side-by-side row of fairness cards** (not stacked) for the
  fairness evidence specifically, because AC2 explicitly requires the
  reviewer to compare each task's metric "side by side" — stacked fairness
  sections would still require scrolling/comparing across sections, and
  tabs would hide all but one task's figures at a time, directly working
  against AC2's comparison intent. This is the one place composition and
  fairness display reasonably diverge in layout, and Canvas should treat
  them as two separate layout decisions rather than one.
- **Where "is this a multi-task draw" is decided**: (a) derive it in the
  companion from `taskGroups.length > 1` / `taskDistributions.length > 1` on
  the already-fetched draw; vs (b) fetch the class model and check
  `model.tasks.length > 1`.
  → Recommend (a): the per-task arrays are already denormalised and
  self-describing (`taskId`/`taskName` carried on each entry, per
  STORY-001-020's Operations), so no additional fetch or cross-referencing
  the class model is needed — consistent with `DrawView`'s existing
  approach of deriving everything from the one `GeneratedDraw`/roster fetch
  it already performs, and avoiding a second source of truth for the same
  fact.
- **Component structure**: (a) parameterise the existing `DrawRounds`/
  `FairnessEvidence` components to accept an optional task-scoped view and
  loop over it internally when multi-task; vs (b) extract the per-round/
  per-pair rendering bodies into small reusable pieces called once per task
  from a new wrapper, keeping `DrawRounds`/`FairnessEvidence` themselves as
  the single-task (or "task index 0 only") case.
  → Lean towards (b) at the Canvas stage: it keeps the single-task path
  literally the existing, unmodified component (strongest guarantee for
  AC3's byte-for-byte requirement) while the multi-task path is additive
  wrapping rather than a new conditional threaded through the existing
  functions — but this is a REASONS-Canvas-level component-boundary
  decision, not one this analysis needs to settle definitively.

#### Alternatives Considered
- **Always render the per-task layout, even for single-task classes (with
  exactly one section)**: rejected — this would be a real (if maybe
  cosmetically small) behaviour change for the five single-task classes,
  directly contradicting AC3's "exactly...as it did before" wording and
  STORY-001-020's own precedent of never introducing an observable change
  for single-task classes.
- **Fetching the class model to drive task labelling/ordering**: rejected
  as unnecessary — `taskId`/`taskName` are already denormalised onto every
  `TaskGroupSet`/`TaskMatchupDistribution` entry specifically so downstream
  consumers don't need the class model to render (STORY-001-020's stated
  denormalisation rationale, mirroring `DrawSpecification.classModelId`'s
  precedent); re-fetching it here would add a request and a second source
  of truth for information already on the draw itself.

## Risk & Gap Analysis

#### Requirement Ambiguities
- **Exact layout is explicitly left open by the story itself**
  ("Negotiable" in the INVEST section): the story does not commit to
  stacked sections, tabs, or a combined table. The Strategic Approach above
  gives a recommendation (stacked for composition, side-by-side for
  fairness) but Canvas should confirm this is the intended reading of AC2's
  "side by side" language rather than treating it as merely "shown
  separately, wherever placed."
- **Whether "clearly labelled by task" (AC1) implies any particular visual
  treatment** (heading level, colour, ordering) beyond showing the task's
  name: the story specifies the labelling *exists*, not its exact
  presentation — reasonable for Canvas to settle as an implementation
  detail rather than an open business question.
- **Whether per-task `groupSizeWarnings` (task-qualified shortfall
  warnings) belong in this story's scope at all**: they are per-task
  evidence in spirit (a task-specific fact about the draw) but the story's
  Scope Out reserves acceptance/acknowledgement mechanics to STORY-001-017,
  and neither story's ACs mention rendering these warnings anywhere in the
  companion app today — see Technical Risks below; this is a real gap, not
  an assumption this analysis is silently resolving.

#### Edge Cases
- **A multi-task class where every task happens to draw an identical
  composition** (e.g. by coincidence, not by rule): AC1 requires each task's
  composition to be shown regardless of whether they happen to match — the
  per-task sections must render independently of whether the underlying
  `FlightGroup[]` arrays are equal, never collapsed/deduplicated on the
  assumption that "if they're the same, show one."
- **A task whose composition is a single lone-pilot group** (the existing
  `lonePilotFlagged` badge, carried unchanged into `TaskGroupSet.groups`):
  the per-task rendering must preserve this existing badge behaviour
  per-task, not just for the flat/back-compat view — a straightforward
  extension of existing logic, but easy to drop if the per-task loop is
  built as a fresh implementation rather than reusing `DrawRounds`'s
  existing per-group rendering body.
- **`accepted` vs `candidate` both need the same per-task rendering**:
  `DrawView` currently calls the same `DrawRounds`/`FairnessEvidence` pair
  for both the `awaiting-decision` candidate and the `accepted` draw (same
  components, different data) — whatever per-task restructuring is chosen
  must remain shared between both branches, not duplicated, since both are
  literally the same `GeneratedDraw` shape.
- **A future two-task or four-task class**: per STORY-001-020's own
  additive-only framing (NFR-2), the per-task UI must iterate
  `taskGroups`/`taskDistributions` generically (by array length), never
  hardcode "three sections" for F3B specifically — the design should be
  exercised by a fixture with a task count other than 1 or 3 in tests, not
  merely F3B and F5J.

#### Technical Risks
- **`groupSizeWarnings` (per-task group-size-minimum warnings) are not
  rendered anywhere in `DrawView.tsx` today**, confirmed by inspection — the
  screen renders only `evidence.warnings` (spec/roster-level advisories),
  never `candidate.groupSizeWarnings`, and `handleDecision`'s `acceptDraw`
  call never sends `acknowledgedWarningIds`. Since STORY-001-020 makes these
  warnings task-qualified and potentially multiple per draw (e.g. AC4's
  Speed-only warning), a Contest Director reviewing a per-task F3B draw
  under this story still has no in-screen way to see *why* a task's
  composition looks the way it does when a fallback fired, nor to
  acknowledge it before accepting. This gap predates this story (it is
  really STORY-001-017's unfinished half) but becomes more visible once
  per-task composition detail is otherwise on screen — worth flagging to
  Canvas as an explicit "not in scope, tracked separately" call rather than
  leaving it to be silently rediscovered during generate.
- **No test/story precedent yet for a "task count other than 1 or 3"
  fixture** in the companion app's existing tests (if any exist for
  `DrawView.tsx`) — Canvas should confirm what test coverage
  `DrawView.tsx`/`DrawRounds`/`FairnessEvidence` currently have (none found
  in this targeted pass; STORY-001-018's own analysis should be checked) so
  the new per-task rendering path has an equivalent regression harness,
  not just manual verification against F3B.
- **Component decomposition risk**: since `DrawRounds`/`FairnessEvidence`
  are currently private (non-exported) functions inside `DrawView.tsx` with
  no prop for "restrict to one task," introducing per-task iteration without
  care could accidentally change the single-task rendering path too (e.g. by
  threading a new optional prop through the existing function body rather
  than keeping the single-task call untouched) — the AC3 non-regression
  guarantee is only as strong as how cleanly the single-task path is kept
  as a literal no-op through this change.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Multi-task rounds show a labelled composition per task | Yes | Data (`taskGroups`) is already fully present on every fetched draw; this is a rendering-only change to `DrawView.tsx`. |
| AC2 | Per-task fairness evidence shown side by side | Yes | Data (`taskDistributions`) already present; "side by side" specifically implies a layout choice (row of cards, not stacked/tabs) that Canvas must commit to, per Strategic Approach. |
| AC3 | Single-task classes render unchanged | Yes | Achievable by keeping the existing `DrawRounds`/`FairnessEvidence` call as the literal single-task path, gated on `taskGroups.length === 1`; must be verified with a non-regression check (e.g. snapshot or explicit assertion), since it is an absence-of-change claim, mirroring STORY-001-020's own AC5 treatment. |
| AC4 | Accept/re-draw remains one whole-draw decision | Yes | No change needed at all — `handleDecision`/the toolbar are untouched; this AC is satisfied by *not* changing anything in the decision path, which the per-task rendering change must not incidentally touch. |
