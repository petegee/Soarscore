# Story Decomposition: Competition Lifecycle State Machine & Start Proceedings

## INVEST Analysis

### Abstract Task: "Authoritative Competition Lifecycle"

**Analysis Dimensions**:
- **Core Responsibility**: make a competition's **lifecycle state** a single,
  authoritative, readable fact and make the **legality of every 2.1–2.4 action**
  a property of that state — so the core system permits Create, Delete, Start
  Proceedings, Suspend, Resume, Lock and round-advance only from the states the
  [state machine](../docs/requirements/high-level-requirements.md#competition-lifecycle-state-machine)
  allows, and rejects them everywhere else with a clear reason. This is the new
  authoritative model added to Area 2, plus the new **2.2 Start Proceedings**
  action.
- **Primary Operations**: report current lifecycle state (incl. Setup readiness
  sub-state); admit or reject each lifecycle transition against its guard; open
  proceedings (Setup → Running); enforce the settled boundary rules (delete only
  from Setup; suspend / lock / advance only from BetweenGroups).
- **Key Constraints**: the state machine is **authoritative** for *when* each
  action is legal; the core system must interpret it generically and never
  branch on discipline (CLAUDE.md class-model law); every accepted transition is
  an immutable event-log mutation (D4); Setup readiness reuses existing roster
  (STORY-001-005) and draw-acceptance (STORY-001-017) facts, not new ones;
  in-phase behaviour inside a running group belongs to Area 6, not here.
- **Technical Complexity**: Medium (a lifecycle aggregate with composite Setup /
  Running states layered over existing roster, draw and run-control facts).
- **Business Complexity**: Medium (a well-defined but broad state machine with
  two guard branches and several "only from this state" rules).

### INVEST Evaluation
- ✅ **Independent**: the state/legality layer sits over facts other stories
  already produce (roster, draw acceptance, group run); Start builds directly on
  the state layer.
- ✅ **Negotiable**: how the state is surfaced and how the readiness sub-state is
  derived are open.
- ✅ **Valuable**: turns "when is this action legal?" from scattered ad-hoc
  guards into one authoritative model — the requirement's whole point.
- ✅ **Estimable**: bounded set of states and edges.
- ✅ **Small**: splits into two 3-day stories.
- ✅ **Testable**: state readouts and admitted/rejected transitions are
  observable facts.

**Conclusion**: **Split into two stories** along the boundary the requirement
itself draws — the *state model + transition legality* (this story), and the new
*Start Proceedings* action that rides on it (STORY-001-025). Start depends on the
state layer but nothing else new; the dependency is linear, not tangled.

### Split Strategy
- **STORY-001-024 (this file)** — authoritative lifecycle state and transition
  legality: the readable state, the Setup readiness sub-states, and the settled
  "only from state X" rules for Delete / Suspend / Lock / round-advance.
- **STORY-001-025** — the new **2.2 Start Proceedings** action: the readiness
  gate and its outstanding-items list, the Setup → Running transition, and the
  configuration-authority boundary it marks.

---

# [STORY-001-024] Competition Lifecycle — Authoritative State & Transition Legality

> Source: `docs/requirements/high-level-requirements.md` Area 2 (Competition
> Lifecycle State Machine — states, transitions, guards) · Areas 2.1, 2.3, 2.4 ·
> `docs/requirements/decisions.md` D4 (immutable event log), D10 (operator-driven
> progression), D11 (device scope is the current group)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Area 2 now carries an **authoritative state machine** that is the single source
of truth for a competition's states and the legal transitions between them.
Until now, "is this action allowed right now?" was answered piecemeal inside
individual stories (delete is guarded against a locked competition in
STORY-001-003; suspend is group-boundary-only in STORY-001-013; draw acceptance
status lives in STORY-001-017). The state machine unifies these into one model:
a **Setup** composite (Draft → RosterComplete → DrawSpecified → DrawGenerated →
DrawAccepted/READY), a **Running** composite (BetweenGroups ↔ GroupInProgress),
plus **Suspended**, **Locked** (terminal) and **Deleted** (terminal).

This story delivers that model as an enforced, readable fact: the current
lifecycle state (including which Setup readiness sub-state a competition sits in),
and the settled legality rules that fall directly out of the diagram —
**Delete is legal only from Setup**; **Suspend, Lock and round-advance leave only
from BetweenGroups**, never mid-group. Editing the roster or draw specification
inside Setup **falls back toward the left** (a draw cannot survive a change to its
inputs). Every admitted transition is recorded in the immutable event log (D4);
every rejected one leaves the state untouched and explains why.

The new **Start Proceedings** action (Setup → Running) rides on this state layer
and is specified separately in STORY-001-025. The behaviour *inside* a running
group — Preparation / Working Time / Landing Window phases, manual-run tasks — is
owned by Area 6 and is out of scope here; this story owns only the
BetweenGroups ↔ GroupInProgress boundary at the lifecycle level.

### Business Value

- Provide every client and downstream capability with one authoritative answer
  to "what state is this competition in, and what may be done to it now?".
- Support safe operation by rejecting out-of-state actions (deleting a running
  contest, suspending mid-group) instead of leaving each caller to guard itself.
- Enable the new Start Proceedings action (STORY-001-025) and give the
  configuration-authority boundary a well-defined "Setup vs Running" line to
  hang off.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-003 (competition exists, Create/Open/Delete),
  STORY-001-005 (roster complete fact), STORY-001-009 / STORY-001-017 (draw
  generated / accepted facts). This story consumes those facts to derive the
  Setup readiness sub-state; it does not re-implement them.
- **Data assumptions**: current lifecycle state is derivable from the immutable
  event log (D4); Scorer self-correction is group-bounded (D11), so the
  "BetweenGroups only" rule for suspend/lock/advance never truncates it.
- **Integration points**: exposes the lifecycle state to the companion app and
  all downstream stories; reuses STORY-001-017's draw acceptance status as the
  DrawGenerated/DrawAccepted sub-states rather than inventing a parallel status.
  The Running composite's group boundary is where Area 6 group run-control
  (STORY-001-011 and the Area 6 stories) attaches.
- **Business constraints**: the state machine is **class-agnostic** — the core
  interprets it generically and never branches on discipline (CLAUDE.md). MVP
  covers qualifying-round competitions only.

### Scope In

- A single **authoritative lifecycle state** readable by any client,
  distinguishing **Setup** (with its readiness sub-state), **Running** (with
  BetweenGroups vs GroupInProgress), **Suspended**, **Locked** and **Deleted**.
- Derivation of the **Setup readiness sub-state** — Draft, RosterComplete,
  DrawSpecified, DrawGenerated, DrawAccepted/READY — from existing roster and
  draw facts, and the **left-fallback**: editing the roster or draw spec drops
  the competition back to the earliest affected sub-state (any generated draw is
  discarded).
- **Transition legality** for the settled edges: Delete admitted only from
  Setup; Suspend, Lock and round-advance admitted only from BetweenGroups;
  Resume only from Suspended. An illegal action is rejected with a clear reason
  and no state change; every admitted transition is recorded in the event log.

### Scope Out

- The **Start Proceedings** action, its readiness gate and outstanding-items
  list, and the configuration-authority boundary — STORY-001-025.
- **In-phase behaviour** inside GroupInProgress (Preparation / Working Time /
  Landing Window sequencing, manual-run tasks, abort/restart) — Area 6
  (STORY-001-011 and Area 6 stories); this story owns only the group boundary.
- The mechanics behind the facts it reads — roster completion (STORY-001-005),
  draw generation/acceptance (STORY-001-009 / STORY-001-017), suspend/resume
  and crash recovery (STORY-001-013), the Lock validation pass and the
  minimum-rounds OfficialResults/NoContest resolution (Area 2.3, presently
  unstoried — see open questions). This story enforces *when* Lock and Suspend
  may fire, not what they compute.

### Acceptance Criteria

#### AC1: Lifecycle state is readable and unambiguous
**Given** a competition at any point in its life
**When** a client reads its lifecycle state
**Then** exactly one state is reported — Setup, Running, Suspended, Locked or
Deleted — and for Setup the readiness sub-state (Draft, RosterComplete,
DrawSpecified, DrawGenerated or DrawAccepted/READY) and for Running whether it is
BetweenGroups or GroupInProgress.

#### AC2: Setup readiness advances with roster and draw progress
**Given** a freshly created competition (Draft) with no roster and no draw
**When** the roster is completed, then a draw spec is set, then a draw is
generated, then the Contest Director accepts it
**Then** the readiness sub-state moves Draft → RosterComplete → DrawSpecified →
DrawGenerated → DrawAccepted/READY in step, reflecting the existing roster and
draw-acceptance facts rather than a separate parallel status.

#### AC3: Editing an input falls the state back to the left
**Given** a competition in DrawGenerated (a candidate draw exists)
**When** the Organiser edits the roster
**Then** the competition falls back to RosterComplete, the generated draw is
discarded, and the state readout reflects that no draw exists — matching the
"replace entrants after the draw" rule (STORY-001-005).

#### AC4: Delete is legal only from Setup
**Given** a competition that has been started (Running) or Suspended
**When** deletion is attempted
**Then** the system rejects it, explains that a competition can be deleted only
during Setup, and the competition is unchanged. (A Setup-state competition
deletes as specified in STORY-001-003.)

#### AC5: Suspend, Lock and round-advance leave only from BetweenGroups
**Given** a running competition with a group in progress (GroupInProgress)
**When** Suspend, Lock or round-advance is attempted
**Then** each is rejected because it is not at a group boundary; the same actions
are admitted once the group is scored and the competition is BetweenGroups.

#### AC6: Resume is legal only from Suspended
**Given** a Running competition that is not suspended
**When** Resume is attempted
**Then** the system rejects it as not-suspended; from the Suspended state, Resume
returns the competition to BetweenGroups.

#### AC7: Rejected transitions change nothing; admitted transitions are logged
**Given** any lifecycle action
**When** it is admitted
**Then** the state changes accordingly and the transition is recorded in the
immutable event log (D4); **when** it is rejected as illegal, the state is
unchanged and no mutation is recorded.

#### Non-Functional Expectations
- The state model is interpreted generically by the core system and carries no
  knowledge of any specific competition class (CLAUDE.md class-model law).
- State reads and legality checks operate entirely on the base with no internet
  connection (offline-first, D6).

### INVEST Check

Independent (a state/legality layer over facts other stories already produce) ·
Valuable (the requirement's central model — one authoritative answer to legality)
· Small (3 days, 3 functional points: readable state, Setup readiness derivation
+ left-fallback, settled-edge legality) · Testable (each state and each
admit/reject outcome is observable).
</content>
</invoke>
