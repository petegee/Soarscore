# [STORY-001-037] Concurrent Multi-Device Capture and Round-Close Completeness

> Source: `docs/user-stories/03-scorer.md` §5.1.3 ·
> `docs/requirements/high-level-requirements.md` Area 5.1, Area 6.4 (round
> progression) · relates to STORY-001-034 (per-device confirmed competitor),
> STORY-001-036 (capture mechanics run concurrently), STORY-001-032 (the
> "advance anyway" override that bypasses this gate)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

A group flies with several pilots at once, each with their own Scorer on their
own device — 1 device → 1 Scorer → 1 competitor. This story guarantees those
concurrent captures never collide or cross-attribute, that a device only ever
touches its own confirmed competitor, and that a missing capture is visible at
the point of capture rather than discovered later.

It also delivers the **round-close completeness** guarantee: the next round
cannot start until every group in the previous round has all its scores in
(captured or no-scored), so no capture is ever stranded. This story computes
and surfaces that completeness fact and honours it; it does not build the
round-advance action itself, which belongs to the Announcer/Timekeeper and is
not yet its own story, nor the Contest Director's "advance anyway" override
(STORY-001-032), which deliberately bypasses this gate.

### Business Value

- Let a whole group be scored simultaneously by its own Scorers with no risk of
  one Scorer's entry landing on another's pilot.
- Make a missing capture visible at the point of capture, not discovered after
  the fact.
- Guarantee no capture is ever stranded by blocking the next round until the
  previous one is fully accounted for.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-034 (each device's confirmed competitor is what
  isolates its entries), STORY-001-036 (the capture mechanics being run
  concurrently).
- **Data assumptions**: "all scores in" for a group is derivable from confirmed
  competitors against captured-or-no-scored outcomes; a round comprises several
  groups (Area 4).
- **Integration points**: the completeness fact this story computes is the same
  one the round-advance action (Area 6.4, not yet its own story) must consult
  before starting the next round — this story surfaces and honours it but does
  not implement the advance action itself; the Contest Director's "advance
  anyway" override (STORY-001-032) is the sole way to proceed regardless.
- **Business constraints**: 1 device → 1 Scorer → 1 competitor (Area 5 intro);
  operator-driven progression (D10) — nothing advances a round automatically.

### Scope In

- Concurrent capture by every device in a group with no collision or
  cross-attribution.
- Independent acceptance of near-simultaneous submissions from different
  devices.
- Restricting each device's own view and edit access to its own confirmed
  competitor only.
- Surfacing, per device, which of its confirmed competitors still owe a
  result.
- Computing the round-completeness fact — every group in the round fully
  captured — for the round-advance action to consult, and blocking an attempt
  to start the next round while it does not hold.

### Scope Out

- Operating the round advance itself (starting round 5 once round 4 is
  complete) — Area 6.4 / Announcer-Timekeeper, not yet its own story.
- The Contest Director's "advance anyway" override that bypasses this gate —
  STORY-001-032.
- The confirmation guard and live-capture/correction mechanics this story
  relies on — STORY-001-034 / STORY-001-036.

### Acceptance Criteria

#### AC1: Concurrent captures from different devices never collide
**Given** round 4 group 2 has six confirmed Scorer devices, each on its own
pilot
**When** all six devices capture a flight result at nearly the same moment
**Then** all six results are accepted and each lands only against its own
confirmed competitor — none is overwritten or cross-attributed.

#### AC2: A device only ever touches its own competitor
**Given** my device is confirmed for John Brown in round 4 group 2
**When** I use my device
**Then** I can see and edit only John Brown's entries — I have no way to view
or change another Scorer's confirmed competitor's record.

#### AC3: A device shows which of its competitors still owe a result
**Given** my device has captured results for some but not all of the
competitors it has been confirmed for across the round so far
**When** I check my device
**Then** it shows me which of those competitors still owe a result.

#### AC4: The next round is blocked until the previous round is fully captured
**Given** round 4 has a group still missing one competitor's result
**When** an attempt is made to start round 5
**Then** the attempt is blocked because round 4 is not yet complete.

#### AC5: A fully-captured round clears the block
**Given** every group in round 4 now has every competitor's result in
(captured or no-scored)
**When** an attempt is made to start round 5
**Then** round 4 no longer blocks it on completeness grounds.

#### Non-Functional Expectations
- Completeness is computed from live capture/no-score state, never a cached or
  stale snapshot, since it gates the next round.

### INVEST Check

Independent (concurrency isolation and a completeness fact, both self-contained
given confirmed competitors and capture mechanics already exist) · Valuable
(guarantees no capture is ever stranded and makes a gap visible immediately) ·
Small (3 days, 2 functional points: concurrency/isolation, outstanding-items +
completeness gate) · Testable (collision-freedom, per-device visibility scope,
and the round-block boundary are all directly observable).
