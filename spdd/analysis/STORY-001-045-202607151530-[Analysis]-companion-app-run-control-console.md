# SPDD Analysis: Companion-App Run-Control Console

## Original Business Requirement

# Story Decomposition: Companion-App Run-Control Console

## INVEST Analysis

### Abstract Task: "Operator Run-Control Console"

**Analysis Dimensions**:
- **Core Responsibility**: give an operator — Contest Director,
  Announcer/Timekeeper, or (at club scale, per the "many hats" ethos) the same
  person wearing both — a single companion-app surface that reaches every
  start/advance/authority action needed to actually run a contest: opening
  proceedings, starting a group, advancing a round, and the Contest Director's
  authority holds and overrides over a running group.
- **Primary Operations**: display current lifecycle/phase state; trigger Start
  Proceedings (STORY-001-025); trigger the single group-start action
  (STORY-001-044); trigger round advance and show its outstanding-items list
  (STORY-001-043); trigger the Contest Director's run-control authority
  actions — prep pause/resume/fast-forward/add-time, abort, the two-form
  prep-gate release, "advance anyway" (STORY-001-032).
- **Key Constraints**: the companion app enforces no authorisation between
  role views in the MVP (companion-app §1) — this screen exposes every action
  to whoever holds it, stamping actor identity and authority per action; the
  run-control view must work at phone size (companion-app §3.2); the client
  is stateless — all state is fetched/streamed from the base (D8); no group
  or round boundary crosses itself (D10) — every action here is a deliberate
  tap, never automatic.
- **Technical Complexity**: Low–Medium (UI over four existing/planned backend
  stories, plus live phase-state display driven by the group timer engine,
  STORY-001-040).
- **Business Complexity**: Low (one operator, one screen, one state machine to
  reflect; the hard business logic already lives in the backend stories this
  screen only drives).

### INVEST Evaluation
- ✅ **Independent**: builds on STORY-001-025, -032, -040, -043 and -044;
  contributes no backend logic of its own.
- ✅ **Negotiable**: exact layout/grouping of the controls is open to design.
- ✅ **Valuable**: without this screen none of the start/advance/authority
  actions those four stories deliver are reachable — the base is headless
  (D8), so nothing on the field can begin.
- ✅ **Estimable**: a bounded screen over four known backends.
- ✅ **Small**: ~4 days, four cohesive functional points sharing one state
  display.
- ✅ **Testable**: each action has an observable resulting state.

**Conclusion**: Ready as-is — single story. Splitting by backend (a screen
per story) would fragment the one continuous operator workflow — open
proceedings, start each group, advance each round, hold authority over
whichever is running — into artificial pieces that would still need to share
the same live state display.

---

## [STORY-001-045] Companion-App Run-Control Console

> Source: `docs/requirements/companion-app.md` §3.2 (run control), §3.3
> (round progression), §1 (name-pick identity, every mutating action to the
> base) · `docs/requirements/decisions.md` D8 (headless base + companion
> client), D10 (operator-driven progression) · relates to STORY-001-025
> (Start Proceedings), STORY-001-032 (run-control authority), STORY-001-040
> (group timer engine this screen displays), STORY-001-043 (round-progression
> gate), STORY-001-044 (group start control)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

STORY-001-025, -032, -043 and -044 each define a piece of *what* happens when
proceedings open, a group starts, a round advances, or the Contest Director
holds/overrides a running group — but the base station is headless (D8), so
none of it is reachable until an operator can reach it from a companion
client. Today those four behaviours exist only as backend definitions; there
is no single companion-app surface that lets an operator actually open a
competition and keep it moving. This story adds that surface: **one
run-control console** that shows the competition's current lifecycle/phase
state and offers exactly the action that state calls for — Start Proceedings
before Running, Start Group at each group boundary, Advance Round at each
round boundary, and the Contest Director's authority controls (prep holds,
abort, gate release, "advance anyway") whenever a group is live.

This console does not introduce a fifth role or re-litigate who is allowed to
tap what. Companion-app §1 already treats Organiser, Contest Director and
Announcer/Timekeeper as one app with role-oriented views and no enforced
authorisation between them in the MVP — at club scale, the same physical
person routinely holds every hat this console touches. Every action taken
here is still stamped with the acting person's name-pick identity and the
authority under which the *underlying story* records it (Contest-Director
authority for STORY-001-025/-032, no particular authority for
STORY-001-043/-044) — this screen changes nothing about who each backend
attributes an action to, only that an operator, whoever they are today, can
reach it.

### Business Value

- Give the operator a single place to actually run the contest — open
  proceedings, start each group, advance each round, and hold authority over
  a live group — without hunting across screens for four separate actions.
- Make the competition's current state (not yet started / between groups /
  in preparation / working / landing / round boundary) visible at a glance,
  so the operator always knows which single action is next.
- Put the run-control authority controls (pause, fast-forward, add time,
  abort, gate release, advance anyway) in reach at phone size, so the person
  holding the flight-line hat is never tied to the laptop's location
  (companion-app §3.2).

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-025 (Start Proceedings backend and readiness
  gate), STORY-001-040 (the group timer engine and shared clock this console
  displays live), STORY-001-044 (the single group-start action), STORY-001-043
  (the round-advance gate and its outstanding-items list), STORY-001-032 (the
  Contest Director's run-control authority actions and their consequences).
- **Data assumptions**: the base owns all contest/phase state and the event
  log; the companion app is stateless and fetches/streams current
  lifecycle/phase state from the base (companion-app §1, D8). Operator
  identity comes from the existing name-pick — no login.
- **Integration points**: submits Start Proceedings, Start Group, Advance
  Round, and each run-control authority action to the base, each landing in
  the immutable event log with originating client, authority and actor
  identity (D4) exactly as its owning story defines. Displays the live phase
  state produced by STORY-001-040 and the prep-confirmation-gate hold
  surfaced by STORY-001-044.
- **Business constraints**: offline-first — the console works over the
  base's local Wi-Fi with no internet (D6); the run-control portion of the
  screen must work at phone size (companion-app §3.2); no action here fires
  itself — every boundary crossing is a deliberate tap (D10).

### Scope In

- A run-control console in the companion app that shows the competition's
  current lifecycle/phase state (not started / between groups / preparation /
  working / landing / round boundary reached) fetched live from the base.
- The **Start Proceedings** control, shown only before Running: triggers
  STORY-001-025, and on a blocked attempt displays its outstanding-items list
  (roster incomplete / draw not accepted) exactly as that story defines.
- The **Start Group** control, shown at each group boundary: triggers the
  single STORY-001-044 start action (identical control regardless of
  duration-shaped vs manual-run task), and displays a held prep-confirmation
  gate with its outstanding pilot/device when active.
- The **Advance Round** control, shown at each round boundary: triggers
  STORY-001-043, and on a blocked attempt displays the specific outstanding
  group(s)/competitor(s)/item(s) that story lists.
- The **Contest Director run-control authority controls**, shown whenever a
  group is live: prep pause/resume, fast-forward, add-time (preparation
  only), abort, the two distinct prep-gate release actions ("device
  offline" / "pilot unconfirmed"), and the "advance anyway" override on a
  blocked round advance — each triggering its STORY-001-032 behaviour and
  consequence unchanged.
- Rendering the run-control portion of the console usably at phone size.

### Scope Out

- The lifecycle state machine and Start Proceedings' readiness gate and
  config-authority boundary — STORY-001-025.
- The group timer/phase engine and shared clock itself — STORY-001-040.
- The group-start action's own behaviour (sequence hand-off vs manual-run
  marking) and the prep-confirmation gate's mechanics — STORY-001-044,
  STORY-001-034.
- The round-advance completeness checks themselves — STORY-001-043.
- The run-control authority actions' own mechanics and consequences (fixed
  working-time/landing-window guard, abort's data annulment, the two
  gate-release forms' no-score outcomes, "advance anyway"'s flagged-anomaly /
  zero / lapse consequences) — STORY-001-032.
- Enforced authorisation between operator roles or any change to which
  authority an action is recorded under — out of MVP (companion-app §1); this
  console does not decide or narrow who may tap a control.
- The audio callout sequence and field display board — STORY-001-041,
  STORY-001-042.
- Score administration screens (re-flights, no-score resolution, penalties,
  manual entry) — companion-app §3.4/§3.5, separate stories.

### Acceptance Criteria

#### AC1: Before proceedings open, the console offers Start Proceedings
**Given** a competition in DrawAccepted/READY that has not yet started
**When** the operator opens the console
**Then** it shows the competition as not yet Running and offers the Start
Proceedings control; tapping it triggers STORY-001-025 and, on success, the
console reflects Running (BetweenGroups).

#### AC2: A blocked Start Proceedings shows what's missing
**Given** a competition whose roster is incomplete or whose draw is not yet
accepted
**When** the operator taps Start Proceedings
**Then** the console shows the outstanding items STORY-001-025 reports (e.g.
roster incomplete, draw not accepted) and the competition stays in Setup.

#### AC3: Between groups, the console offers Start Group
**Given** proceedings are open and the previous group's landing window (or
manual-run field-run) is complete
**When** the operator opens the console
**Then** it shows the competition between groups and offers the single Start
Group control; tapping it triggers STORY-001-044 identically whether the
next task is duration-shaped or manual-run.

#### AC4: A held prep-confirmation gate is visible on the console
**Given** a started group's preparation countdown has paused at one minute
because a pilot's device has not confirmed
**When** the operator views the console
**Then** the hold and the outstanding pilot/device are shown, alongside the
Contest Director's two gate-release controls.

#### AC5: Run-control authority controls appear only while a group is live
**Given** a group currently in preparation
**When** the operator views the console
**Then** pause/resume, fast-forward, add-time and abort are available; **and
given** the same group later in working time or the landing window, **when**
the operator views the console, **then** pause/fast-forward/add-time are not
offered (STORY-001-032's fixed-duration guard) and only abort remains.

#### AC6: At a round boundary, a blocked advance lists what's outstanding
**Given** Round 3 has an unresolved no-score with groups remaining
**When** the operator taps Advance Round
**Then** the console shows the outstanding item STORY-001-043 reports and
offers the Contest Director's "advance anyway" override alongside it.

#### AC7: A complete round advances from the console
**Given** every group in Round 3 has all scores captured and no item is
outstanding
**When** the operator taps Advance Round
**Then** Round 4 becomes current and the console returns to the
between-groups state with Start Group offered for its first group.

#### AC8: The run-control portion works at phone size
**Given** the operator is using a phone browser rather than the laptop
**When** they open the console
**Then** the live state display and every action in Scope In remain usable
at phone width (companion-app §3.2).

#### AC9: The console recovers its state from the base
**Given** a group is mid-preparation and the operator's laptop is replaced by
another companion client
**When** the new client opens the console
**Then** it shows the current lifecycle/phase state fetched from the base,
because the client holds no state of its own (D8).

#### Non-Functional Expectations
- The console works entirely over the base's local Wi-Fi with no internet
  connection (offline-first, D6).
- A companion client can leave, sleep or be replaced without affecting a
  running group held on the base (stateless client, D8).
- The console carries no knowledge of any specific competition class — it
  displays whichever phase/state its backends report generically (CLAUDE.md
  class-model law).

### INVEST Check

Independent (a screen over the STORY-001-025, -032, -040, -043 and -044
backends, contributing no logic of its own) · Valuable (none of those
backends' actions are reachable from a headless base without it) · Small (4
days, four functional points: Start Proceedings display, Start Group
display, Advance Round display, run-control authority controls — all sharing
one live state read) · Testable (each control's resulting state, the
blocked-attempt displays, phone-size usability and state recovery are all
observable).

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **LifecycleState / LifecycleStateResponse** (`packages/shared/src/lifecycle.ts`):
  the authoritative `{ state, subState, admissibleActions }` DTO already
  returned by `GET /api/competitions/:id/lifecycle` and mutated by
  `POST /api/competitions/:id/start` (STORY-001-025). `state` is one of
  `Setup | Running | Suspended | Locked | Deleted`; `Running` carries
  `runningSubState: "BetweenGroups" | "GroupInProgress"`. This is the natural
  root of "the competition's current lifecycle/phase state" the console must
  show, and its `admissibleActions` array already includes `"Start"` and
  `"RoundAdvance"` as class-agnostic action names the console can key its
  buttons off — but it stops at the round/group-boundary level; it carries no
  notion of preparation/working/landing phase, prep-gate holds, or per-group
  authority state, all of which are STORY-001-040/-032/-044 concepts that do
  not exist in the codebase yet (see New Concepts, and Risk & Gap Analysis).
- **Attribution** (`{ actorName, originClient, authority }`): the established
  event-log attribution shape (D1/D4), already built in the base from
  `x-actor-name`/`x-client-id` request headers per STORY-001-025's route
  layer. The console's every action must supply these same two headers; no
  new attribution concept is needed.
- **Actor / useActor()** (`apps/companion/src/identity/useActor.ts`): the
  existing name-pick identity hook already used elsewhere in the companion
  app — holds `actorName` and a generated `clientId` in `localStorage`. The
  console reuses this unchanged; it introduces no new identity mechanism
  (companion-app §1).
- **apiRequest / ApiError** (`apps/companion/src/api/client.ts`): the
  established fetch wrapper that stamps `X-Actor-Name`/`X-Client-Id` headers
  and throws a typed `ApiError` carrying the base's `ErrorResponse` on a
  non-2xx response. The console's every mutating call (Start Proceedings,
  Start Group, Advance Round, each authority action) is a straightforward
  consumer of this same wrapper — no new HTTP layer.
- **OutstandingItem** (`{ code, message }` flat DTO, `packages/shared`): the
  shape STORY-001-025 already returns for a blocked Start (`ROSTER_INCOMPLETE`
  / `DRAW_NOT_ACCEPTED`) via `CompetitionNotReadyError`'s
  `details.outstandingItems`. The console's blocked-Start display (AC2) is a
  direct, already-solved consumer. STORY-001-043's round-advance
  outstanding-items list is described in its own requirement as the same
  family of shape but has **not yet been implemented or typed** in shared code
  — a new concept, below.
- **Competition** (`apps/companion/src/competitions/*`): the existing
  competition-selection/library screens the console will sit alongside/within
  in the companion app's navigation; no new competition concept, just a new
  screen consuming the same `competitionId`.

#### New Concepts Required

- **Group Timer / Shared Clock read model** (STORY-001-040, not yet built):
  the round/group/phase/remaining-time state the console must poll or stream
  to know whether a group is in preparation, working time, or the landing
  window, and to render the phase-specific authority controls (AC5). This is
  the single biggest new concept the console depends on and it does not exist
  in `apps/base/src` today (only `class-models`, `competitions`, `draw`,
  `eventstore`, `lifecycle`, `pilots`, `roster`, `routes`, `scoring`,
  `task-config`, `templates` exist — no `timer`/`clock`/`groups` module).
- **Prep-Confirmation Gate hold** (STORY-001-034/-044, not yet built): the
  "paused at one minute, pilot X's device not confirmed" state the console
  must surface (AC4), together with the two Contest-Director release actions
  ("device offline" / "pilot unconfirmed") STORY-001-032 defines. No backend
  representation exists yet.
  Related backend work: [[STORY-001-034]], [[STORY-001-044]].
- **Group Start action** (STORY-001-044, not yet built): the single
  deliberate action that starts the next group, with two outcomes
  (duration-shaped hand-off vs manual-run marking) the console must trigger
  identically regardless of task shape.
- **Round-Advance Gate + outstanding items** (STORY-001-043, not yet built):
  the completeness check performed when Advance Round is tapped, and its
  outstanding-item list (missing scores / unresolved no-scores / unflown
  re-flights) the console must render on a block (AC6).
- **Run-Control Authority actions** (STORY-001-032, not yet built): pause/
  resume/fast-forward/add-time (preparation only), abort, the two prep-gate
  release forms, and "advance anyway" — six distinct Contest-Director
  commands the console must expose conditionally on current phase (AC5), none
  of which have an endpoint, event type, or projection yet.
- **Companion-side lifecycle/phase polling or subscription mechanism**: the
  companion app today has no established pattern for *live*, auto-refreshing
  state display — existing screens (`CompetitionLibrary`, `CompetitionForm`)
  are request/response, edited-and-saved forms, not continuously-updating
  views. The console's core promise ("state is always fetched/streamed from
  the base", D8/AC9) needs a refresh strategy (polling interval vs.
  WebSocket/SSE) that has no precedent in this codebase to imitate.

#### Key Business Rules

- **One state, one next action** (D10, background): at any moment the
  console shows exactly the action the current lifecycle/phase state calls
  for (Start Proceedings, Start Group, or Advance Round) — never more than
  one "next boundary" action at once; this governs the console's own
  conditional-rendering logic, not any backend rule.
- **Authority controls are phase-gated, not group-gated** (STORY-001-032,
  AC5): pause/fast-forward/add-time are visible only during preparation;
  abort remains visible through working time and the landing window; this
  governs which authority-control subset renders per phase.
- **No enforced authorisation between roles** (companion-app §1): every
  control on the console is visible and tappable by any operator; the
  console must not attempt to hide or grey out actions based on "who" is
  currently name-picked — that would silently introduce authorisation the
  MVP explicitly rejects.
- **The console never causes a boundary crossing on its own** (D10): every
  action is a deliberate tap; no auto-advance, no timer-driven UI action
  (distinct from the *display* auto-updating, which is expected and required
  by AC9).
- **Class-agnostic display** (CLAUDE.md, Non-Functional Expectations): the
  console renders whatever phase/state strings its backends report — it must
  not special-case a rendering path per competition class.

## Strategic Approach

#### Solution Direction

- Add a new **run-control screen** under `apps/companion/src` (sibling to
  `competitions/`, `draw/`, `roster/`, etc.) that, for a selected competition,
  fetches the current lifecycle/phase state, derives which single
  next-boundary action (if any) and which authority-control subset to render,
  and dispatches each action through the existing `apiRequest` wrapper with
  the existing `useActor()` identity — following exactly the pattern already
  established by `CompetitionLibrary`/`CompetitionForm` for API calls and
  identity, but adding a live-refresh loop those screens don't need.
- Data flow: companion screen → periodic/streamed
  `GET /api/competitions/:id/lifecycle` (+ whatever read endpoint
  STORY-001-040 exposes for phase/clock state, once it exists) → conditional
  render of the single next action or the authority-control set → `POST`
  action via `apiRequest` → re-fetch/re-render on response.
- Because four of the five backends this console drives (STORY-001-032,
  -040, -043, -044) do not exist in the codebase yet, the console's UI-layer
  work for those four backends is **necessarily speculative** until their own
  REASONS Canvases fix concrete endpoint shapes; only the Start
  Proceedings integration (STORY-001-025) can be built and demonstrated
  end-to-end today.

#### Key Design Decisions

- **Build order — console-first-against-mocks vs. backend-first**: building
  the whole console now against assumed endpoint shapes for -032/-040/-043/
  -044 risks throwaway rework once those REASONS Canvases fix real shapes
  → **recommend building this story in the same order its own Dependencies
  list already declares** (backends first), or, if the console must start
  now, building only the STORY-001-025-backed slice (AC1/AC2/AC9 for the
  pre-Running case) fully, and stubbing the other three slices behind a
  clearly-marked seam (e.g. a single `RunControlState` read model interface)
  so later backends slot in without reshaping the screen.
- **Live-refresh mechanism — polling vs. streaming**: the requirement says
  "fetched/streamed" (D8) without mandating one; a short-interval poll
  (e.g. every 1–2s while the console is open) is far simpler and consistent
  with the rest of the companion app's plain-REST pattern, but a live group
  clock counting down plausibly wants sub-second accuracy that polling alone
  renders jerkily → **recommend starting with polling for the
  lifecycle/round-boundary state** (matches existing patterns, low risk) and
  deferring the question of whether the STORY-001-040 clock needs push
  delivery to that story's own REASONS Canvas, since this console only
  *displays* that clock and does not own its transport.
- **Where the screen lives in the app**: as a new top-level route/view
  alongside the existing `competitions`/`draw`/`roster` screens vs. nested
  under the competition-detail flow → **recommend nesting under the
  already-selected competition** (the console is meaningless without a
  competition context), consistent with how `CompetitionForm` and
  `CompetitionLibrary` already scope by competition.
- **Phone-size layout — one shared responsive layout vs. a separate phone
  route**: a single responsive layout (CSS breakpoints) keeps one source of
  truth for the control set and avoids duplicating action-dispatch logic
  across two views → **recommend one responsive layout**, consistent with
  "the run-control **portion** of the console must work at phone size"
  (AC8) rather than the whole app needing a phone variant.

#### Alternatives Considered

- **A screen per backend story** (four separate UI stories): rejected in the
  requirement's own INVEST analysis — it would fragment one continuous
  operator workflow and duplicate the shared live-state display across four
  screens.
- **Role-gated rendering** (show only the controls a given name-picked
  operator is expected to use): rejected — contradicts companion-app §1's
  explicit no-enforced-authorisation MVP stance; would introduce a role
  concept the backend does not have.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **What exactly STORY-001-040's read API looks like** is unspecified here
  (and in STORY-001-040 itself, which only describes the engine's behaviour,
  not its API shape) — the console needs a phase/clock DTO (round, group,
  phase, remaining time) that has not been designed. This should be resolved
  in STORY-001-040's own REASONS Canvas before or alongside this console's
  detailed design.
- **"Fetched/streamed"** (D8, background) leaves the transport mechanism
  (poll vs. WebSocket/SSE) open — the requirement is deliberately
  implementation-agnostic here, but the REASONS Canvas will need to pick one.
- **How the console groups/lays out six authority controls plus three
  boundary actions on one phone-width screen** is explicitly left open
  ("Negotiable" — exact layout is open to design) but the requirement gives
  no wireframe or grouping hint; this is a design decision for REASONS
  Canvas / implementation, not something the analysis can resolve.
- **What happens to the round-boundary state once a round genuinely has no
  next group** (i.e., the contest is on its last round and completes) is not
  addressed by this story or by STORY-001-043 as read — likely out of scope
  here (probably a Lock/finalisation-adjacent concern, STORY-001-026) but
  worth flagging so the console's state machine doesn't assume a round
  advance is always possible.
  **RESOLVED (user-confirmed, this revision)**: the console now designs a
  minimal display fallback for this case rather than deferring it further —
  a "Contest complete — proceed to Lock" state, shown instead of Start
  Group/Advance Round/any authority control, derived from a successful
  `advanceRound()` response whose `admissibleActions` no longer contains
  `"RoundAdvance"`. Lock itself remains out of scope (STORY-001-026) — this
  is a read-only, action-free placeholder so the console never dead-ends.
  See the REASONS Canvas's Entities (`ContestCompleteState`), Approach §5,
  Operations (view/hook logic), and Safeguard 9.
- **How the console decides "is this really a round boundary" before
  offering Advance Round**: **RESOLVED (settled, not open)** — the console
  performs no client-side boundary detection at all. It always shows the
  Advance Round control whenever `runningSubState === "BetweenGroups"` and
  lets the backend's 409 `COMPETITION_NOT_READY` response on a premature tap
  surface the outstanding-items list (AC6), exactly as `TRANSITION_NOT_ALLOWED`
  already does for any other illegal-state tap. No new backend signal or
  client-side round-counting logic is needed. See the REASONS Canvas's
  Approach §3.

#### Edge Cases

- **A competition with zero prerequisites built yet** (i.e., this console is
  implemented before STORY-001-032/-040/-043/-044 land): the console would
  have working AC1/AC2/AC9 (Start Proceedings) but nothing to show or trigger
  for AC3–AC8 — the requirement's own Dependencies section lists all five
  stories as prerequisites, so this is presumably sequenced correctly in
  practice, but is a real risk if stories are picked up out of order.
  Related backend work: [[STORY-001-032]], [[STORY-001-040]],
  [[STORY-001-043]], [[STORY-001-044]].
- **Two companion clients open the console simultaneously** and one taps
  Start Group while the other is mid-render of the "between groups" state:
  companion-app §2 establishes last-action-wins with no control-session lock
  — the console must tolerate its own action being rejected (e.g.
  `TRANSITION_NOT_ALLOWED` because another client already advanced) and
  refresh to the base's authoritative state rather than trusting its own
  optimistic UI.
- **A blocked Start Proceedings that becomes ready while the outstanding-items
  list is still showing** (operator fixes the roster on another screen, then
  returns): the console needs to re-fetch state on view/focus, not just
  after its own action, given AC9's client-replacement scenario implies the
  console must always trust a fresh read over stale local state.
  Related backend work: [[STORY-001-025]].
- **A phase transition happens between the console's last poll and the next
  render** (e.g. working time expires mid-view): since STORY-001-040 runs the
  phase sequence autonomously on the base regardless of a connected client
  (companion-app §5), the console's polling interval directly determines how
  stale the phone-size view can appear — worth flagging as a UX risk even
  though it's a display staleness issue, not a data-correctness one.

#### Technical Risks

- **Four of five dependency backends do not exist yet** — no code under
  `apps/base/src` implements STORY-001-032, -040, -043 or -044; no shared
  types exist for prep-gate holds, phase/clock state, or round-advance
  outstanding items. This is the dominant risk: any REASONS Canvas or
  implementation for this console beyond the STORY-001-025 slice is building
  against an assumed, not actual, contract.
- **No live-refresh precedent in the companion app**: every existing
  companion screen (`CompetitionLibrary`, `CompetitionForm`, draw/roster
  screens) is a load-once-and-submit form; introducing a polling/streaming
  loop is new infrastructure for this codebase, not a copy of an existing
  pattern, and will want its own lightweight design (interval, cleanup on
  unmount, backoff on disconnect per companion-app §5's "obvious
  connected/disconnected state" requirement).
- **Optimistic UI vs. server-authoritative state under multi-client,
  last-action-wins semantics**: since there's no session lock (companion-app
  §2), the console must be designed defensively — every action's response
  (success or rejection) should trigger a fresh state read rather than a
  local state mutation, or two clients' views can drift.
- **Cross-story conflict over a "close group" action — RESOLVED, this
  revision**: the REASONS Canvas built from this analysis initially found
  STORY-001-044's on-disk prompt file documenting a `POST
  .../group-run/close` operator-facing action for manual-run tasks, which
  conflicted with the requirement that `group.scored` is emitted reactively
  with no human click. This has since been verified fixed on 044's side
  (its canvas now states explicitly there is no operator-facing close
  route on either task-shape path). The console's design — no close/
  mark-scored control anywhere — is confirmed correct and consistent with
  044's final design; no further reconciliation is needed.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Start Proceedings offered before Running; triggers STORY-001-025 | Yes | Backend fully exists (`LifecycleStateResponse`, `POST /start`); console-side work only. |
| 2 | Blocked Start Proceedings shows outstanding items | Yes | `OutstandingItem`/`CompetitionNotReadyError` already returns exactly this shape. |
| 3 | Start Group offered between groups; triggers STORY-001-044 | Partial | STORY-001-044 backend does not exist yet — no endpoint to call. |
| 4 | Held prep-confirmation gate visible with release controls | Partial | Depends on STORY-001-044 (hold visibility) and STORY-001-032 (release actions) — neither built. |
| 5 | Authority controls appear only while a group is live, phase-gated | Partial | Depends on STORY-001-040 (phase state) and STORY-001-032 (authority actions) — neither built. |
| 6 | Blocked Advance Round lists outstanding items + "advance anyway" | Partial | Depends on STORY-001-043 (gate + list) and STORY-001-032 (override) — neither built. |
| 7 | Complete round advances from the console | Partial | Depends on STORY-001-043 — not built. |
| 8 | Run-control portion usable at phone size | Yes | A responsive-layout implementation concern; addressable independent of backend state. |
| 9 | Console recovers state from the base (stateless client) | Yes | Direct consequence of always re-fetching `LifecycleStateResponse` (and, later, phase state) rather than caching locally. |

Five of nine ACs (3–7) are only **partially** addressable today because their
backing backend stories (STORY-001-032, -040, -043, -044) have no
implementation in the codebase — no route, event type, or projection exists
for any of them. This does not mean the requirement is wrong; it is
explicitly sequenced as dependent on those four stories (Dependencies and
Assumptions). It does mean that **detailed REASONS Canvas design for AC3–7
should either wait for those backends' own canvases, or proceed with an
explicitly-provisional read/command contract clearly marked for revision**
once the real backend shapes land.
