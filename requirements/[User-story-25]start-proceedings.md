# [STORY-001-025] Start Proceedings — Open a Competition for Running

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

### INVEST Check

Independent (a single action over the STORY-001-024 state layer) · Valuable (the
deliberate begin-boundary and the config-authority line the whole running phase
depends on) · Small (3 days, 3 functional points: start transition, readiness
gate + outstanding-items list, config-authority boundary) · Testable (start,
each blocked-start reason, and the before/after config behaviour are observable).
</content>
