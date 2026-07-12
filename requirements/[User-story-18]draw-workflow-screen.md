# Story Decomposition: Companion-App Draw Workflow Screen

## INVEST Analysis

### Abstract Task: "Operator Draw Console"

**Analysis Dimensions**:
- **Core Responsibility**: give the Organiser / Contest Director a single
  companion-app surface to generate a draw, see it and its fairness evidence,
  and decide its fate — accept, regenerate, or cancel.
- **Primary Operations**: generate (trigger the STORY-001-009 generation
  backend), display, accept / regenerate / cancel (trigger the STORY-001-017
  acceptance backend).
- **Key Constraints**: draw acceptance is Contest Director authority (Area
  4.3); the companion app enforces no authorisation but stamps actor identity
  and authority on every action (companion-app §1, D4); nothing downstream
  (lanes, groups, reports) may consume the draw until it is accepted; the
  client is stateless — the draw and its status live on the base.
- **Technical Complexity**: Low–Medium (UI over generation (STORY-001-009) and
  acceptance (STORY-001-017) backends, plus the three-way decision surface).
- **Business Complexity**: Low–Medium (single candidate at a time, one
  decision loop, clear terminal states).

### INVEST Evaluation
- ✅ **Independent**: builds on the STORY-001-009 generation backend and the
  STORY-001-017 acceptance backend; contributes no backend of its own.
- ✅ **Negotiable**: layout of the fairness evidence and the decision controls
  is open to design.
- ✅ **Valuable**: without this screen the generated draw is unreachable to
  operators and nothing downstream can start.
- ✅ **Estimable**: a bounded screen over a known API.
- ✅ **Small**: ~3 days, three cohesive functional points.
- ✅ **Testable**: each action has an observable terminal state.

**Conclusion**: Ready as-is — single story. The three decision actions share
one candidate draw and one screen; splitting them would break the decision
loop and manufacture inter-story dependencies.

---

## [STORY-001-018] Companion-App Draw Workflow Screen

> Source: `docs/requirements/high-level-requirements.md` Areas 4.1, 4.2, 4.3 ·
> `docs/requirements/companion-app.md` §1 (role-oriented views, name-pick
> identity, every mutating action to the base) · `docs/requirements/decisions.md`
> D4 (immutable event log), D8 (headless base + companion client)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

The draw-generation backend (STORY-001-009) produces a fair draw and its
fairness evidence, and the acceptance backend (STORY-001-017) commits, cancels
and reports the status of that draw — but the base station is headless, so
every human action goes through a companion client (D8). Until an operator can
reach those backends from the companion app, the draw is invisible and nothing
downstream (lane adjustment, group management, reports, scoring) can begin.
This story adds the
operator-facing draw workflow screen: the Organiser or Contest Director opens
it, generates the draw, reviews the resulting groups and the fairness evidence
the Contest Director needs, and then takes one of three decisions — **accept**
(commit it for the contest), **regenerate** (re-draw and review a fresh
attempt), or **cancel** (discard, leaving no accepted draw). Draw acceptance
is Contest Director authority (Area 4.3); the companion app enforces no
authorisation between role views in the MVP but stamps the acting person's
name and the authority under which they acted onto every submitted action
(companion-app §1, D4).

### Business Value

- Provide the Organiser and Contest Director with the single place to generate,
  see and decide on the contest draw.
- Support the Contest Director's accept / re-draw decision by presenting the
  fairness evidence (matchup distribution and fairness metric) on screen.
- Enable every downstream capability — lane adjustment, group management, draw
  reports and scoring — which may only begin once a draw is accepted.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw specification, generation, fairness
  evidence and clear-failure backend — **done**); STORY-001-017 (draw
  acceptance / cancellation and acceptance-status backend — the accept, cancel
  and status endpoints this screen drives); STORY-001-019 (the companion-app
  draw-specification editor — a **saved specification** must exist before this
  screen can generate a draw; otherwise generation reports no specification);
  a competition with an established roster (STORY-001-005) and discipline/task
  configuration (STORY-001-004) exists.
- **Data assumptions**: the base owns all contest state and the event log; the
  companion app is stateless and fetches/streams the current draw and its
  status from the base (companion-app §1). Operator identity comes from the
  name-pick already in the companion app — no login.
- **Integration points**: submits generate / accept / regenerate / cancel to
  the base, each landing in the immutable event log with originating client,
  authority and actor identity (D4). An accepted draw is the input to
  STORY-001-010 (lane adjustment), STORY-001-011 (group management) and
  STORY-001-015 (draw reports).
- **Business constraints**: offline-first — the screen works over the base's
  local Wi-Fi with no internet (D6). Draw acceptance and re-draw are Contest
  Director authority (Area 4.3).

### Scope In

- A draw workflow screen in the companion app that triggers generation and
  displays the resulting draw (groups per round, pilots, lanes) for review.
- On-screen fairness evidence for the review: the matchup distribution and the
  fairness metric produced by STORY-001-009.
- The three decisions on the displayed candidate: **accept** (commit),
  **regenerate** (discard the candidate and generate a fresh one to review),
  **cancel** (discard and leave no accepted draw) — each submitted to the base
  and stamped with the acting person and authority.
- Surfacing the backend's clear-failure outcome to the operator when no valid
  draw can be produced.

### Scope Out

- The draw-generation algorithm, constraint enforcement, fairness computation
  and lone-pilot handling itself — STORY-001-009 (done).
- Editing the draw specification (draw mode, groups-per-round, constraints) —
  that is the STORY-001-019 draw-specification editor, not this decision screen.
- The accept / cancel / acceptance-status backend behaviour itself (the
  events, endpoints and the accepted-draw fact downstream reads) —
  STORY-001-017. This screen only drives those endpoints.
- Manual lane reassignment (STORY-001-010) and group/membership changes
  (STORY-001-011).
- Draw reports and printable output (STORY-001-015).
- Enforced authorisation between operator roles — out of MVP (companion-app §1).

### Acceptance Criteria

#### AC1: Generate and display a draw
**Given** a competition with a 14-pilot roster and a valid draw specification,
and no draw yet generated
**When** the operator opens the draw screen and generates the draw
**Then** the screen shows the resulting flight groups for every round, with
each group's pilots and their lanes, ready for review.

#### AC2: Fairness evidence is shown for the decision
**Given** a generated draw is displayed
**When** the Contest Director reviews it
**Then** the screen presents the matchup distribution and the fairness metric
from generation, so the accept / re-draw decision can be made without leaving
the screen.

#### AC3: Accepting commits the draw
**Given** a generated draw is displayed and under review
**When** the operator accepts it
**Then** the draw becomes the contest's accepted draw, the screen reflects the
accepted status, and the acceptance is recorded with who accepted it and the
authority under which they acted.

#### AC4: An accepted draw unlocks downstream work
**Given** the draw has just been accepted
**When** the operator moves on
**Then** lane adjustment, group management and draw reports are able to act on
this accepted draw, whereas before acceptance none of them had a draw to use.

#### AC5: Regenerating replaces the candidate under review
**Given** a generated but not-yet-accepted draw is displayed
**When** the operator regenerates (re-draws)
**Then** the previous candidate is discarded, a fresh draw with its own
fairness evidence is displayed for review, and no draw is left accepted from
the discarded attempt.

#### AC6: Cancelling leaves no accepted draw
**Given** a generated but not-yet-accepted draw is displayed
**When** the operator cancels the workflow
**Then** the candidate is discarded, the competition has no accepted draw, and
the operator can return later to generate again from scratch.

#### AC7: Generation failure is surfaced clearly
**Given** a roster or specification for which the backend can produce no valid
draw
**When** the operator generates
**Then** the screen shows the clear failure and its reason, offers to generate
again, and no draw is displayed as acceptable or stored as accepted.

#### AC8: The screen recovers its state from the base
**Given** a draw was accepted earlier and the operator's laptop is replaced by
another companion client
**When** the new client opens the draw screen
**Then** it shows the current accepted draw and its status fetched from the
base, because the client holds no draw state of its own.

#### Non-Functional Expectations
- The screen works entirely over the base's local Wi-Fi with no internet
  connection (offline-first, D6).
- A companion client can leave, sleep or be replaced without affecting the draw
  held on the base (stateless client, D8).

### INVEST Check

Independent (a screen over the STORY-001-009 and STORY-001-017 backends) · Valuable
(the draw is unreachable and nothing downstream can start until this exists) ·
Small (3 days, 3 functional points: generate/display, fairness review, the
accept/regenerate/cancel decision) · Testable (each action has an observable
terminal state).
