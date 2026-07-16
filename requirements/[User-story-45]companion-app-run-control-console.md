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
