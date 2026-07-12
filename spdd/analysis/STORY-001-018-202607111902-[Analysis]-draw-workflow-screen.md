# SPDD Analysis: Companion-App Draw Workflow Screen

## Original Business Requirement

> Source file: `requirements/[User-story-18]draw-workflow-screen.md` — reproduced verbatim.

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
  and status endpoints this screen drives); a competition with an established
  roster (STORY-001-005) and discipline/task configuration (STORY-001-004)
  exists.
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
  that is the STORY-001-009 specification surface, not this decision screen.
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

---

## Domain Concept Identification

This is a **frontend/UI story** in a TypeScript monorepo. The companion app is
a Vite + React SPA (`apps/companion`) served by the headless Fastify base
(`apps/base`); domain types are shared through `@soarscore/shared`
(`packages/shared`). The story adds one competition-scoped screen over
already-defined (STORY-001-009) and to-be-defined (STORY-001-017) base
endpoints. It introduces **no** new backend and **no** new persisted state.

### Existing Concepts (from codebase)

- **DrawEvidenceView** (`packages/shared/src/draw.ts`): the read-model the
  screen renders — `{ spec: DrawSpecification | null, candidate: GeneratedDraw
  | null, warnings: ConstraintWarning[] }`. Served by `GET
  /api/competitions/:competitionId/draw` (`apps/base/src/routes/draw.ts`,
  `DrawService.getEvidence`). This is the single source of truth the stateless
  client re-fetches (AC8). **Note: it currently carries no acceptance-status
  field** — that is a STORY-001-017 addition (see risks).
- **GeneratedDraw** (`packages/shared/src/draw.ts`): the materialised candidate
  — `rounds → groups → memberships`, each `GroupMembership` keyed on
  `rosterEntryId` with an explicit integer `lane`; plus `metric`,
  `metricValue`, `distribution`, `attemptsRun`. This is what AC1 renders.
- **MatchupDistribution / MeetCount**: the fairness evidence for AC2 —
  `pairs[]` (each a `{ a, b, count }` over `rosterEntryId`s), `maxMeets`,
  `totalExcessMeets`, `variance`. `GeneratedDraw.metric` + `metricValue` name
  the retained metric and its scalar.
- **RosterEntryView** (`packages/shared/src/roster.ts`): carries `pilotName`,
  `pilotNumber`, `pilotClass`, `retired` keyed by roster entry `id`. **Load-
  bearing for AC1**: the draw candidate stores only `rosterEntryId`s, so the
  screen must fetch the roster (`GET /api/competitions/:id/roster`) and join
  `rosterEntryId → pilotName`/`pilotNumber` to render human-readable groups and
  matchup pairs. RosterView already fetches this exact endpoint.
- **Generate endpoint** (`POST /api/competitions/:competitionId/draw/generate`,
  `DrawService.generate`): returns `GeneratedDraw` on success; throws
  `DrawGenerationFailedError` (`DRAW_GENERATION_FAILED`, 400) with a human
  reason and appends nothing on failure (AC7), or `DrawSpecNotFoundError` /
  `GroupSizeOutOfBoundsError` on spec/roster problems. Regenerate (AC5) is the
  same endpoint called again — the projection replaces the prior candidate.
- **apiRequest / ApiError** (`apps/companion/src/api/client.ts`): the fetch
  helper that stamps `X-Actor-Name` and `X-Client-Id` headers and throws
  `ApiError` (carrying `ErrorResponse` with `code`, `message`, `details`) on a
  non-2xx. Every mutating call in the screen goes through it; the base's
  `attributionFromHeaders` (`apps/base/src/routes/draw.ts`) turns those headers
  into the D4 attribution (`authority: "organiser"`).
- **useActor / Actor** (`apps/companion/src/identity/useActor.ts`): the
  name-pick identity hook providing `actorName` and a persisted `clientId`.
  Passed into every competition-scoped view.
- **RosterView** (`apps/companion/src/roster/RosterView.tsx`): the idiom this
  screen mirrors — a `{ competitionId, actor, onBack }` component, a `request`
  callback wrapping `apiRequest`, a `refresh()` that re-fetches base state, a
  `loading` guard, `ApiError`-coded branching (e.g.
  `ROSTER_REPLACE_AFFECTS_DRAW` → confirm dialog), and `role="alert"` /
  `role="dialog"` accessible feedback.
- **CompetitionLibrary** (`apps/companion/src/competitions/CompetitionLibrary.tsx`):
  the competition-scoped navigation host. `RosterView` is reached via
  `openId` (line 165), **not** through the top-level `App.tsx` nav (which only
  hosts library-level screens). The draw screen is competition-scoped and
  should be reached the same way.

### New Concepts Required (UI-only; no new domain/persistence)

- **Draw workflow screen / "Draw console"**: one competition-scoped React view
  (e.g. `apps/companion/src/draw/DrawView.tsx`) reached from
  `CompetitionLibrary` alongside "Roster". Renders the evidence read-model,
  offers Generate, and — post-generate — Accept / Regenerate / Cancel.
- **Draw display presentation**: rounds → ordered groups → lane-ordered pilot
  rows, resolved from `rosterEntryId` via the fetched roster. A `lonePilotFlagged`
  group is annotated (mirrors RosterView's `retired` badge idiom).
- **Fairness evidence presentation (AC2)**: the metric name + `metricValue`,
  the summary scalars (`maxMeets`, `totalExcessMeets`, `variance`,
  `attemptsRun`), and the matchup pairs with names substituted — at a strategic
  level, "honest fairest-of-K evidence", not a proven optimum.
- **Three-way decision surface**: Accept / Regenerate / Cancel controls with an
  observable terminal state each (accepted status shown; fresh candidate shown;
  no-candidate empty state). **Accept and Cancel are pure passthroughs to
  STORY-001-017 endpoints that do not yet exist.**
- **Acceptance-status view-model**: whatever field STORY-001-017 adds to the
  evidence read-model (e.g. an `accepted`/`status` marker + accepting actor)
  that AC3/AC8 render. Its exact shape is unknown until STORY-001-017 lands —
  a hard coupling to flag.

### Key Business Rules

- **Generate ≠ Accept** (STORY-001-009 doc + `draw.ts` comments): generating
  produces a *candidate*; only Accept commits it. The screen must never present
  a generated-but-unaccepted candidate as the contest's draw, and AC7 failure
  must leave nothing acceptable.
- **Nothing downstream until accepted** (AC4): lane adjustment (010), group
  management (011) and draw reports (015) may only consume an *accepted* draw.
  This screen's Accept is the gate; it renders that unlock as an observable
  state, but enforcement lives in those downstream stories + STORY-001-017.
- **Attribution on every mutation** (companion-app §1, D4): generate / accept /
  regenerate / cancel each carry actor-name + client-id headers → base
  attribution. Draw acceptance is recorded with *who* and *the authority*
  (Area 4.3). The base stamps `authority: "organiser"` today; whether accept
  should be stamped `contest-director` is a STORY-001-017 decision to confirm.
- **Stateless client** (D8, AC8): the screen holds no draw state of its own; it
  always derives from the fetched evidence read-model, so a replacement client
  shows the same status. No client-side caching of the candidate as truth.
- **Single candidate at a time**: regenerate replaces (the projection keeps one
  candidate); the UI decision loop assumes exactly one candidate under review.
- **Names via roster join** (implicit): the draw stores `rosterEntryId` only;
  displaying pilots and matchups requires joining to the live roster — a
  replaced pilot inherits the slot (RD4), so the join is by entry, not pilot.

---

## Strategic Approach

### Solution Direction

- Add a **competition-scoped React view** (`DrawView`) that follows the
  RosterView idiom exactly: a `{ competitionId, actor, onBack }` component, an
  `apiRequest`-wrapping `request` callback, a `refresh()` that re-fetches base
  state on mount and after every mutation, a `loading` guard, and
  `ApiError`-coded feedback with `role="alert"`/`role="dialog"`. Reach it from
  `CompetitionLibrary` via the same `openId` pattern that opens RosterView (add
  a "Draw" action next to "Roster"), **not** from the top-level `App.tsx` nav.
- **Data flow**: on open, `refresh()` fires `GET .../draw` (evidence) and
  `GET .../roster` (name join) in parallel (the RosterView `Promise.all`
  idiom). Render from the fetched read-model only (stateless, AC8). Generate =
  `POST .../draw/generate` then `refresh()`. Accept / Cancel = the STORY-001-017
  endpoints then `refresh()`. Regenerate = generate again then `refresh()`.
- **Rendering**: resolve `rosterEntryId → pilotName`/`pilotNumber` through a
  map built from the fetched roster; render rounds → ordered groups (by
  `flyingOrder`) → lane-ordered members; render fairness as a metric header +
  scalar summary + matchup table with names substituted. Reuse the existing
  `data-table` / `table-wrap` / `badge` / `toolbar` / `btn` CSS classes from
  RosterView so the screen is visually consistent with no new design system.
- **Failure (AC7)**: catch `ApiError`, branch on `code` (`DRAW_GENERATION_FAILED`,
  `DRAW_SPEC_NOT_FOUND`, `DRAW_GROUP_SIZE_OUT_OF_BOUNDS`), show `message` in a
  `role="alert"`, keep the Generate action available, and render no candidate —
  exactly the RosterView error-branching idiom.
- **Deferred coupling to STORY-001-017**: isolate the accept/cancel/status
  concerns behind a thin, clearly-marked seam (the endpoint paths, the request
  bodies, and the read-model status field the UI reads) so that when the
  backend contract is finalised the wiring is a localised change. The
  generate/display/fairness half (AC1, AC2, AC7) is fully buildable and
  testable today against the existing STORY-001-009 backend.

### Key Design Decisions

- **Where the screen lives**: competition-scoped, hosted by
  `CompetitionLibrary` (like RosterView) — **not** a top-level `App.tsx`
  screen. Trade-off: consistent with the roster idiom and keeps `competitionId`
  in scope; cost is a second entry-point button on the competition row.
  Recommended: host in `CompetitionLibrary` for idiom parity.
- **Name resolution source**: join the draw's `rosterEntryId`s against
  `GET .../roster` (RosterEntryView) rather than expecting the backend to
  denormalise names into the draw. Trade-off: an extra fetch and a client-side
  map vs. a backend change out of this story's scope. Recommended: client-side
  join — the roster endpoint already exists and RosterView already uses it; no
  backend change.
- **Regenerate semantics**: treat Regenerate as "call generate again" against
  the existing endpoint (the projection replaces the single candidate), rather
  than a distinct backend verb. Trade-off: reuses STORY-001-009 with zero new
  backend, but "discard the previous candidate" (AC5) relies on the projection
  overwrite — confirm STORY-001-017 does not require an explicit discard event
  when a candidate is replaced pre-acceptance. Recommended: reuse generate;
  flag the AC5 "no draw left accepted" clause as a STORY-001-017 interaction.
- **Accept/Cancel contract**: drive endpoints that STORY-001-017 will define.
  Trade-off: building the UI now risks guessing the path/verb/body/status
  shape; waiting blocks AC3/AC4/AC6/AC8. Recommended: build the pure-UI half
  now, stub the accept/cancel seam behind an explicit interface, and finalise
  when STORY-001-017's contract is published — do **not** invent the contract
  in this story.
- **Accepted-status rendering (AC3/AC8)**: read acceptance status from the
  evidence read-model (extended by STORY-001-017) so the stateless-recovery
  guarantee holds automatically. Trade-off: depends on the exact field
  STORY-001-017 adds. Recommended: consume a read-model field, never derive
  "accepted" from a local flag.
- **Empty/first-run state**: `candidate === null` (before first generate, or
  after cancel) renders a Generate call-to-action; `spec === null` renders a
  "no draw specification yet" guidance state (see the AC1 gap below).

### Alternatives Considered

- **Top-level nav screen (like Pilots/Templates)**: rejected — the draw is
  per-competition; a global screen would have no `competitionId` and break the
  RosterView-consistent navigation.
- **Backend denormalises pilot names into the draw payload**: rejected — that
  is a STORY-001-009 backend change out of this UI story's scope; the roster
  join is a zero-backend-change alternative already proven in RosterView.
- **Build the full accept/cancel flow now against an assumed contract**:
  rejected — STORY-001-017 is not built; guessing its endpoint shape would
  create rework and a hidden coupling. Build the buildable half, seam the rest.
- **Bundle draw-spec editing into this screen to satisfy AC1's "valid draw
  specification" precondition**: rejected as a silent scope change — spec
  editing is explicitly Scope Out (STORY-001-009's specification surface). The
  missing spec-creation UI is flagged as a gap, not absorbed here.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **STORY-001-017 contract is undefined**: the story drives "accept / cancel /
  acceptance-status" endpoints that **do not exist in the codebase** (no
  routes, no service, no shared types, no analysis/prompt file — confirmed:
  `spdd/` has only STORY-001-009 draw artefacts). The endpoint paths, HTTP
  verbs, request bodies, the acceptance-status field added to
  `DrawEvidenceView`, and the accepting-actor/authority record are all unknown.
  This blocks concrete design of AC3, AC4, AC6, AC8 until STORY-001-017 is
  specified. Recommendation: sequence STORY-001-017 first, or publish its API
  contract, before the REASONS Canvas fixes this screen's mutation seam.
- **"Valid draw specification" precondition (AC1) has no creation UI**:
  `generate` requires a saved spec (`DrawSpecNotFoundError` otherwise), and the
  base exposes `PUT .../draw/spec`, but **no companion-app screen creates or
  edits a draw specification today** (App.tsx and CompetitionLibrary host no
  draw-spec surface, and this story explicitly scopes spec-editing OUT). AC1's
  "a valid draw specification exists" is therefore an unmet prerequisite: as
  built, generating on a fresh competition returns `DRAW_SPEC_NOT_FOUND`.
  Recommendation: flag a missing prerequisite story (a draw-spec editor UI over
  the existing `PUT .../draw/spec`), and decide with the owner whether this
  screen shows a "no spec yet — configure it first" guidance state or whether
  the spec editor must land first. Do not silently absorb spec editing here.
- **Authority stamping for Accept (Area 4.3)**: draw acceptance is Contest
  Director authority, but the base's draw routes stamp `authority: "organiser"`
  unconditionally, and the companion app enforces no role separation
  (companion-app §1). Whether Accept should carry a `contest-director`
  authority is a STORY-001-017 decision; the UI can only stamp what the name-
  pick + endpoint contract dictate. Recommendation: confirm with STORY-001-017.
- **"Downstream unlocks" (AC4) is not observable on this screen alone**: lane
  adjustment (010), group management (011) and reports (015) are separate
  unbuilt stories. AC4 can only be demonstrated as "the accepted-draw fact is
  now present in the read-model", not as those screens actually acting. This
  screen cannot fully verify AC4 in isolation.

### Edge Cases

- **rosterEntryId with no matching roster entry** (e.g. roster changed between
  draw generation and view): the name join must degrade gracefully (show the id
  or a placeholder) rather than crash. Matters because the draw and roster are
  fetched independently and the roster is mutable (RosterView replace/retire).
- **Candidate present but stale vs. current roster**: the evidence read-model
  recomputes `warnings` against the *live* roster; a candidate generated before
  a roster change may no longer match. The screen should surface warnings and
  not present a stale candidate as safe to accept. STORY-001-017 likely governs
  whether a roster change invalidates a candidate.
- **`lonePilotFlagged` group**: must be visibly annotated so the CD sees the
  singleton before accepting (AC2 review integrity). The flag exists on the
  payload but has no UI yet.
- **Generation latency**: `ATTEMPTS = 200` runs synchronously on the base; the
  UI needs a pending/disabled state on Generate/Regenerate to avoid double-fire
  (RosterView disables buttons during in-flight actions — reuse that idiom).
- **Concurrent clients (companion-app §2, last-action-wins)**: a second client
  could accept or regenerate while this one reviews. `refresh()` on focus/action
  mitigates, but a truly live view would need streaming (out of MVP scope —
  polling/refresh is acceptable).
- **Cancel with no candidate / accept an already-accepted draw**: idempotency
  and terminal-state guards depend on STORY-001-017 semantics; the UI should
  disable actions that the current status makes invalid.

### Technical Risks

- **Hard dependency on an unbuilt backend (STORY-001-017)**: the single largest
  risk. Half the ACs (AC3, AC4, AC6, AC8) cannot be implemented or tested
  end-to-end until STORY-001-017 ships. Mitigation: build and merge the
  generate/display/fairness half (AC1, AC2, AC7) now; isolate the accept/cancel/
  status seam behind an explicit interface finalised against STORY-001-017's
  published contract.
- **Read-model shape change**: STORY-001-017 will extend `DrawEvidenceView`
  with an acceptance-status field. The screen's rendering of AC3/AC8 depends on
  that field's final name/shape; building against a guessed shape invites
  rework. Mitigation: consume the field name-agnostically behind a small
  adapter, or defer that rendering to post-STORY-001-017.
- **Name-join correctness (RD4)**: the draw keys on `rosterEntryId` so a
  post-draw pilot replacement inherits the slot; the join must key on entry id,
  not pilot id, to render the *current* occupant. Mitigation: build the map
  from `RosterEntryView.id`.
- **Offline-first / stateless (NFR)**: no external assets, no client-held draw
  truth. Low risk — the app is already base-served and RosterView already
  fetches all state from the base. Mitigation: mirror RosterView; no local
  persistence of the candidate.
- **No descriptor-driven task rendering needed here** (companion-app §4): the
  draw screen displays groups/lanes/matchups, not per-class task data, so NFR-1
  (no hard-coded per-class behaviour) is not directly engaged — a low-risk
  simplification to confirm.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Generate & display groups/pilots/lanes | Partial | Pure-UI over existing `POST .../draw/generate` + `GET .../draw`, with a roster join for names. **Blocked precondition**: no draw-spec-creation UI exists, so "a valid draw specification" is unmet on a fresh competition (generate → `DRAW_SPEC_NOT_FOUND`). Flag missing prerequisite story. |
| AC2 | Fairness evidence (distribution + metric) shown | Yes | Fully addressable today: `GeneratedDraw.metric/metricValue/distribution` are in the read-model; render metric + scalars + matchup pairs (names joined). |
| AC3 | Accepting commits the draw + records who/authority | No (blocked) | Depends entirely on STORY-001-017's accept endpoint + acceptance-status read-model field, neither of which exists. UI seam only until contract lands. |
| AC4 | Accepted draw unlocks downstream work | No (blocked) | Depends on STORY-001-017 (accepted fact) plus unbuilt 010/011/015. Not verifiable on this screen alone; at best renders "accepted" status. |
| AC5 | Regenerate replaces the candidate | Partial | "Fresh candidate + evidence" is buildable via re-calling generate (projection overwrites). "No draw left accepted from the discarded attempt" touches STORY-001-017 acceptance semantics — confirm no explicit discard event is required. |
| AC6 | Cancelling leaves no accepted draw | No (blocked) | Depends on STORY-001-017's cancel/discard endpoint; no such endpoint exists. |
| AC7 | Generation failure surfaced clearly | Yes | Fully addressable: catch `ApiError`, show `DRAW_GENERATION_FAILED` (and spec/group-bound) `message` in `role="alert"`, keep Generate available, render no candidate. |
| AC8 | Recover state from the base (stateless client) | Partial | The stateless-fetch mechanism is buildable now (re-fetch evidence on open, no local truth). But rendering the "current accepted draw and its status" depends on STORY-001-017's acceptance-status field. |

**Summary**: AC2 and AC7 are fully implementable and testable against the
existing STORY-001-009 backend today. AC1 is implementable but its
precondition (a saved draw spec) has no creation UI — a flagged prerequisite
gap. AC3, AC4, AC6 are blocked on the not-yet-built STORY-001-017 backend; AC5
and AC8 are half-buildable now with their acceptance-touching clauses blocked.
The dominant risk is the hard, undefined dependency on STORY-001-017 — this
screen should build the generate/display/fairness half now and seam the
accept/cancel/status half behind STORY-001-017's finalised contract.
