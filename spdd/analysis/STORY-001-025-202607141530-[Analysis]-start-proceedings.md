# SPDD Analysis: Start Proceedings — Open a Competition for Running (STORY-001-025)

## Original Business Requirement

> Source: `docs/requirements/high-level-requirements.md` Area 2.2 (Start
> Proceedings), Area 2 state machine (DrawAccepted → Running), Area 3
> (Mid-contest configuration changes) · `docs/requirements/decisions.md` D4
> (immutable event log), D10 (operator-driven progression), D14 (group-size
> minima are advisory) · Areas 3.4 (roster complete), 4.3 (draw accepted)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

A competition has, until now, no explicit "we have begun" moment on the
organising side — setup simply flowed into the first group being run. Area 2.2
adds the **Start Proceedings** action: the **Contest Director** officially opens
proceedings, transitioning the competition from **Setup** to **Running**. It is
the deliberate begin-boundary that mirrors Lock's close-boundary (Area 2.3), and
is distinct from the Announcer/Timekeeper operationally starting the first
round/group (Area 6.4/6.5, D10) — nothing on the field may run until proceedings
are open.

Starting is **readiness-gated with a hard block**: the competition cannot be
started until its **roster is complete** (3.4) **and** its **draw has been
generated and accepted** (4.3) — i.e. it is in the DrawAccepted/READY state
(STORY-001-024). A blocked start **lists its outstanding items** so the Contest
Director knows exactly what is missing. The softer roster-size judgement is
already resolved upstream at draw time (a too-thin roster warns and requires
acknowledgement *there*, D14 / STORY-001-022), so once a draw is accepted the
Start gate needs no override — it is a clean pass/fail.

Starting is recorded in the event log (D4) and **marks the boundary past which
configuration changes require Contest-Director authority** (Area 3): before Start,
setup is freely mutable; after Start, any change to scoring/running configuration
(3.5–3.8) needs CD authority and is logged. The Area 3 wording changed from "once
the first round has started" to "once proceedings have started (2.2)" — this story
owns that boundary.

### Business Value

- Provide the Contest Director with a single deliberate act that opens the
  competition for running, with an unambiguous readiness check behind it.
- Support a clear "you cannot start yet, here is what is missing" message so a
  competition is never half-started with an incomplete roster or unaccepted draw.
- Enable the configuration-authority boundary (Setup vs Running) that Area 3 and
  every mid-contest config change depend on.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-024 (lifecycle state & DrawAccepted sub-state),
  STORY-001-005 (roster complete), STORY-001-017 (draw accepted). Start rides on
  the state layer; the gate is satisfied exactly when the competition is in
  DrawAccepted/READY.
- **Data assumptions**: actor identity arrives with the request (companion
  name-pick); there is no login — Contest Director authority is **recorded, not
  enforced** (D1). The too-thin-roster acknowledgement already happened at draw
  time (D14), so Start applies no size override of its own.
- **Integration points**: gates Area 6 group/round run (STORY-001-011 and Area 6
  stories) — nothing runs until Running; establishes the boundary that the
  mid-contest configuration-change rule (Area 3) keys off. Driven from the
  companion app; the base is headless.
- **Business constraints**: MVP is qualifying-round only; offline-first (D6).

### Scope In

- **Start Proceedings**: the Contest Director transitions a DrawAccepted/READY
  competition from Setup to Running, recorded in the event log with the acting
  person and Contest-Director authority.
- **Readiness gate (hard block)** with an **outstanding-items list**: a start
  attempted before the roster is complete and the draw accepted is refused and
  names each missing prerequisite (roster incomplete, draw not accepted).
- **Configuration-authority boundary**: before Start, scoring/running
  configuration (3.5–3.8) is freely editable; after Start it requires
  Contest-Director authority and is recorded in the event log. No group or round
  may run before Start.

### Scope Out

- The lifecycle state model and the generic legality of other transitions —
  STORY-001-024.
- The mechanics of roster completion (STORY-001-005) and draw generation /
  acceptance (STORY-001-009 / STORY-001-017); Start only *reads* their result.
- The too-thin-roster warning and its acknowledgement — resolved upstream at
  draw time (STORY-001-022 / STORY-001-023, D14); Start adds no override.
- Operationally running the first group/round — Announcer/Timekeeper, Area 6.4/6.5
  (STORY-001-011 and Area 6 stories).
- The detailed content of each mid-contest configuration change (which fields,
  what confirmation) — the owning configuration stories; this story establishes
  only that the Start boundary is what flips those changes into
  authority-required, logged changes.
- Enforcing that only a Contest Director may start (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: Starting a ready competition opens proceedings
**Given** a competition in DrawAccepted/READY — roster complete and draw
accepted
**When** the Contest Director starts proceedings
**Then** the competition transitions to Running (BetweenGroups), the start is
recorded in the event log with who started it and the Contest-Director authority,
and the field may now run its first group.

#### AC2: A start with nothing ready is blocked and lists everything missing
**Given** a competition still in Draft — roster not complete and no draw
**When** a start is attempted
**Then** the system refuses and lists both outstanding items: the roster is not
complete and the draw has not been accepted; the competition stays in Setup.

#### AC3: A start with a generated-but-unaccepted draw is blocked on that item
**Given** a competition whose roster is complete and whose draw has been
generated into a candidate but **not** accepted (DrawGenerated)
**When** a start is attempted
**Then** the system refuses and the outstanding-items list names the one missing
item — the draw has not been accepted — and nothing else.

#### AC4: An accepted draw needs no size override to start
**Given** a competition in DrawAccepted/READY whose roster was flagged as thin at
draw time and acknowledged there (D14)
**When** the Contest Director starts proceedings
**Then** the start succeeds with no further size warning or override — the Start
gate is a clean pass because the judgement was already resolved upstream.

#### AC5: Nothing may run before proceedings are open
**Given** a competition in Setup (not yet started)
**When** an operator attempts to start the first group or advance a round
(Area 6)
**Then** the system refuses because proceedings are not open, and directs that
the Contest Director must start proceedings first.

#### AC6: Starting marks the configuration-authority boundary
**Given** a scoring/running configuration item (e.g. a task's working time,
3.7) that is freely editable while the competition is in Setup
**When** the competition is started and the same item is changed afterward
**Then** the change now requires Contest-Director authority and is recorded in
the event log, whereas the identical change before Start required neither.

#### AC7: A competition cannot be started twice or from a non-ready state
**Given** a competition that is already Running (or Suspended, or Locked)
**When** a start is attempted
**Then** the system rejects it because proceedings are already open (or the
competition is not in a startable state) and no second start is recorded.

#### Non-Functional Expectations
- Start operates entirely on the base with no internet connection (offline-first,
  D6).
- The readiness check and the Setup/Running boundary carry no knowledge of any
  specific competition class (CLAUDE.md class-model law).

---

## Domain Concept Identification

The codebase is a TypeScript npm-workspaces monorepo (Node ≥ 22): a headless
Fastify **base** (`apps/base`, authoritative, event-sourced), a Vite **companion**
client (`apps/companion`), and a shared vocabulary package (`packages/shared`).
Persistence is an **append-only event store** with in-memory **projections** that
fold events into read models — there is no mutable relational schema; "tables"
are event types and their derived projections. This story sits almost entirely in
the base, over the STORY-001-024 lifecycle layer.

### Existing Concepts (from codebase)

- **Competition** (`competitions/` projection + service): the aggregate being
  started. Registry-scoped lifecycle facts file under a fixed `"competitions"`
  scope; per-competition content facts file under `scope = competitionId`.
- **Lifecycle State** (`packages/shared/lifecycle.ts`, `lifecycle/projection.ts`):
  one authoritative composite state per competition — `Setup {Draft,
  RosterComplete, DrawSpecified, DrawGenerated, DrawAccepted}`, `Running
  {BetweenGroups, GroupInProgress}`, `Suspended`, `Locked`, `Deleted` — derived
  purely from the log. Start is the `Setup/DrawAccepted → Running/BetweenGroups`
  transition.
- **LifecycleAction / LifecycleGuard** (`lifecycle/guard.ts`): the single generic
  table of transition legality keyed on `(state[+sub-state], action)`. `"Start"`
  is already a member, admissible only from `Setup/DrawAccepted`. No class branch.
- **Readiness ladder** (`deriveSetupSubState` in `lifecycle/projection.ts`): folds
  roster and draw projections (with a deterministic staleness left-fallback) into
  the Setup sub-state. "Roster complete" ≡ ≥ 1 roster entry — the class-agnostic
  definition; group-size minima live in the class model, not here.
- **Event log / EventStore** (`eventstore/event-store.ts`, D4): the append-only
  source of truth; `competition.started` is an existing event type in
  `packages/shared/events.ts`.
- **Attribution** (`packages/shared/attribution.ts`): actorName, originClient,
  authority (`organiser` | `contest-director`) carried on every event — the
  vehicle for "recorded, not enforced" CD authority (D1).
- **StartStateProvider seam** (`competitions/state-providers.ts`): the injected
  class-agnostic "past-Start" predicate interface, mirroring
  LockStateProvider/DrawStateProvider, so a config module keys off Start without
  importing the lifecycle module (no cycle).
- **Task-config service** (`task-config/service.ts`, Area 3.7): the first
  config surface to adopt the Start boundary — the concrete AC6 witness.
- **DomainError family** (`*/errors.ts`) + centralised `setErrorHandler`
  (`app.ts`): uniform domain-coded 4xx mapping.

### New Concepts Required

- **Start command** (`CompetitionService.start`): the not-found → read-state →
  readiness-split → guard-assert → append `competition.started` → apply → return
  fresh DTO pipeline. Appends exactly one event on success, none on rejection.
- **OutstandingItem / OutstandingItemCode** (`packages/shared/lifecycle.ts`): a
  flat DTO `{ code, message }` — a stable machine code the companion switches on
  for localisation plus an operator-facing message. Codes: `ROSTER_INCOMPLETE`,
  `DRAW_NOT_ACCEPTED`.
- **CompetitionNotReadyError** (`competitions/errors.ts`): a DomainError carrying
  `outstandingItems[]`, mapped to `409 COMPETITION_NOT_READY` with
  `details.outstandingItems`. Distinct from the guard's `TRANSITION_NOT_ALLOWED`.
- **ProjectionStartStateProvider** (`lifecycle/start-state-provider.ts`): the real
  StartStateProvider answering from `LifecycleProjection.isStarted`, replacing the
  `NotStartedProvider` stub as the app default.
- **POST /api/competitions/:id/start** (`routes/competitions.ts`): the CD action
  endpoint, stamping contest-director authority from headers.

### Key Business Rules

- **Readiness is pass/fail, no override** (AC1/AC4): startable ⇔ state is
  `Setup/DrawAccepted`. The size judgement is settled upstream at draw time (D14);
  Start adds none.
- **A blocked start changes nothing and enumerates what is missing** (AC2/AC3):
  the outstanding-items list is derived from the readiness ladder with no new
  reads — `Draft` → both items; any rung below `DrawAccepted` → the draw item.
- **Exactly one start, from a startable state only** (AC7): double-start and
  start-from-terminal fall out of the guard table for free; no second event.
- **Start is the config-authority boundary** (AC6): past Start, an identical
  config edit is stamped `contest-director` authority and logged; in Setup it
  keeps organiser attribution. **Record-only** — the base rejects nothing (D1);
  the only observable difference is the recorded authority string.
- **CD authority is recorded, not enforced** (D1): the start endpoint stamps
  contest-director authority; it does not verify the caller is a CD.
- **Class-agnostic** (CLAUDE.md law): neither the guard, the readiness ladder, nor
  the boundary reads the Contest Class Model.

---

## Strategic Approach

### Solution Direction

- Implement Start as **one more command over the existing STORY-001-024 state
  layer**, reusing the established event-sourced idiom already used by delete:
  *not-found guard → read lifecycle state → readiness split → pure guard assert →
  append one event → apply to projection → return fresh read DTO*. Data flow:
  `POST /api/competitions/:id/start` → `CompetitionService.start` →
  `EventStore.append(competition.started)` → `LifecycleProjection.apply` →
  `LifecycleStateResponse`.
- Keep the **guard pure** (boolean legality only) and compute the **human-facing
  outstanding-items list in the service**, so the class-agnostic guard stays a
  table lookup and the "what's missing" richness lives at the service layer.
- Realise the config-authority boundary through the **injected StartStateProvider
  seam**, not a direct lifecycle import — the config module (task-config, 3.7)
  consults `isStarted` and stamps authority accordingly, decoupling the two
  modules and avoiding an import cycle.

### Key Design Decisions

- **Two distinct rejection codes — readiness vs. legality** (`409
  COMPETITION_NOT_READY` with `outstandingItems` vs. `409 TRANSITION_NOT_ALLOWED`):
  trade-off is a slightly richer error surface, but it cleanly separates
  "startable state, prerequisites unmet, here's the checklist" (AC2/AC3) from
  "wrong state entirely, e.g. already Running/Locked" (AC7). **Recommended** — the
  two carry genuinely different operator meaning and payloads.
- **Outstanding list derived from the readiness ladder, no new reads** (AC2/AC3):
  trade-off is coupling the list to the sub-state enum, but it guarantees the list
  can never disagree with the gate. **Recommended** — single source of truth for
  "ready".
- **Record-only config boundary** (AC6): trade-off is that the boundary changes
  nothing a client is forced to obey — it only stamps authority. But this is
  mandated by the D1 trust model (no enforcement, audit-via-log). **Recommended
  and correct** for the club-level trust model.
- **StartStateProvider seam adopted incrementally**: task-config (3.7) is the sole
  current adopter; 3.5/3.6/3.8 adopt the same predicate as they are built.
  Trade-off is that the boundary is only *witnessed* where a config surface exists
  today. **Recommended** — matches additive-only extensibility and avoids
  speculative wiring.
- **`isStarted` stays true through Suspended/Locked**: the boundary reflects
  "genuinely past Start", so config authority does not silently revert if a
  competition is suspended. **Recommended.**

### Alternatives Considered

- **Fold readiness into the guard as a special case**: rejected — it would put
  human-message/list logic into the pure class-agnostic table and blur the
  legality-vs-readiness distinction; the guard must stay a boolean lookup.
- **Enforce CD-only start at the endpoint**: rejected — contradicts D1 (authority
  recorded, not enforced) and the explicit Scope Out.
- **A dedicated `competitions.started` boundary flag separate from the lifecycle
  projection**: rejected — `LifecycleProjection.isStarted` already derives it from
  the same folded `competition.started` fact; a second source would risk drift.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **"Roster complete" definition**: the requirement leans on 3.4/STORY-001-005 but
  the class-agnostic operational definition used here is "≥ 1 roster entry". Any
  richer completeness notion (e.g. all entries valid) is out of this story's reach
  and lives in the roster projection — worth confirming that ≥ 1 is the intended
  MVP meaning.
- **AC6 scope of "configuration (3.5–3.8)"**: the story establishes the boundary
  but only 3.7 (task-config) exists to demonstrate it. Whether 3.5/3.6/3.8 will
  each stamp authority identically is an assumption carried forward (see the
  recorded decision that future 3.5–3.8 surfaces must adopt the shared past-Start
  predicate), not something this story can verify end-to-end.

### Edge Cases

- **Stale accepted draw**: a roster edit or draw-spec save logged after the latest
  `draw.generated` collapses the sub-state below `DrawAccepted` (left-fallback in
  the projection), so a start correctly re-blocks. Covered by the readiness ladder
  but sensitive to event ordering — a genuine edge worth targeted tests.
- **Deleted tombstone**: a start on a deleted competition must fall through to the
  guard (rejects Start from Deleted), not 404. Handled, but the not-found-vs-guard
  ordering is subtle.
- **Suspended/Locked after Start**: config authority must remain contest-director
  (isStarted stays true). Correct by design; a regression here would silently
  mis-attribute edits.
- **Double start** and **start-from-terminal**: both must append zero events;
  falls out of the guard table.

### Technical Risks

- **AC5 has no enforcement home yet**: "nothing may run before proceedings are
  open" depends on Area 6 group/round-run surfaces (STORY-001-011 and later) that
  are **not yet built** — no route currently produces `group.opened`, and no
  run-command consults the Running state to reject. This story establishes the
  *state* that gate will read, but the gate itself is deferred to Area 6. AC5 is
  therefore **not verifiable end-to-end within this story's code today**; it is a
  forward obligation on the Area 6 stories. This is the single most important item
  for a downstream reviewer to note.
- **Boundary witnessed only at 3.7**: AC6 is demonstrable solely through
  task-config; the config-authority guarantee for the rest of Area 3 rests on a
  discipline (adopt the seam) rather than a structural enforcement. Additive by
  design, but easy to forget when a new config surface lands.
- **Projection rebuild integrity**: all state is derived from the log and rebuilt
  in-memory; `isStarted`/readiness must remain correct after a full replay
  (offline-first suspend/resume). Low risk given pure-loader discipline, but the
  boundary now depends on it.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Ready competition starts → Running/BetweenGroups, logged with CD authority | Yes | Implemented in `CompetitionService.start`; covered by `competitions.start.test.ts`. |
| AC2 | Start with nothing ready → blocked, lists both items | Yes | `outstandingItemsFor("Draft")` → both codes; `409 COMPETITION_NOT_READY`. |
| AC3 | Generated-but-unaccepted draw → blocked on the one item | Yes | Ladder yields `DrawGenerated`; list names only `DRAW_NOT_ACCEPTED`. |
| AC4 | Accepted draw needs no size override | Yes | Gate is pure pass/fail at `DrawAccepted`; no size logic in Start (D14 upstream). |
| AC5 | Nothing may run before Start | **Partial** | Start establishes the Running state, but the *enforcement* point lives in unbuilt Area 6 run-commands; no current code rejects a group-open in Setup. Forward obligation, not verifiable here today. |
| AC6 | Start marks the config-authority boundary | Yes (at 3.7) | Witnessed by `task-config/service.ts` via StartStateProvider (record-only). Other 3.5–3.8 surfaces must adopt the same seam as they are built. |
| AC7 | No double-start / start from non-ready | Yes | Guard admits only `Setup/DrawAccepted`; terminal/Running/Suspended fall through; zero events on rejection. |

**Overall**: 6 of 7 ACs fully addressable within this story's code; **AC5 is
partial by design** — the Running-state precondition exists, but its enforcement
is legitimately deferred to the Area 6 run stories (consistent with this story's
own Scope Out). The config-authority boundary (AC6) is proven only at task-config
(3.7); extending it to the remaining 3.5–3.8 surfaces is a tracked forward
obligation, not a defect in this story.
