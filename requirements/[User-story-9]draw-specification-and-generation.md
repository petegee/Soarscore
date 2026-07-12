# [STORY-001-009] Draw Specification and Generation

> Source: `docs/user-stories/01-organiser.md` §3.5, §4.1, §4.2 · `docs/requirements/high-level-requirements.md` Areas 3.5, 4.1, 4.2 · `docs/requirements/rules/00-general-rules.md` §1
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

A contest is a sequence of rounds, each split into groups that fly a shared
working time and are scored man-on-man. Fairness rests on the draw: a random
initial order, group composition changing every round so any two pilots meet
as few times as possible (an anti-repeat matrix), a lane-allocation policy,
and a consecutive-flight constraint so nobody flies back-to-back groups
without a break. The Organiser specifies the draw, generates it — keeping the
fairest of several attempts — and presents its fairness evidence to the
Contest Director, whose authority it is to accept or re-draw. The draw
should also avoid producing a group with only one scoring pilot, because a
lone pilot would otherwise bank an automatic 1000.

### Business Value

- Provide the Organiser with a generated draw that is fair and defensible for
  a roster of up to 20 pilots over up to 8 rounds per day.
- Support fairness evidence (matchup distribution, fairness metric) the
  Contest Director uses to accept or reject the draw.
- Enable clear failure instead of a silently unfair or invalid draw.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-005 (roster), STORY-001-004 (discipline —
  group-size bounds are class-informed, e.g. F3J prefers 8–10 per group).
- **Data assumptions**: MVP assumes all competitors on 2.4 GHz and no teams,
  so frequency and team-separation constraints are out of scope.
- **Integration points**: the accepted draw feeds lane adjustment
  (STORY-001-010), group management (STORY-001-011) and draw reports
  (STORY-001-015). Accepting/re-drawing (4.3) is the Contest Director's
  story, not this one.
- **Business constraints**: progressive/seeded draws (fly-off re-draws) are
  Future Enhancements.

### Scope In

- Draw specification: draw mode (random initial order + anti-repeat intent),
  groups-per-round within roster/task bounds, consecutive-flight constraint,
  lane-allocation policy.
- The **spare-scorer override** (Area 4.1): an explicit flag recording that
  spare non-flying scorers are present, relaxing the two-groups-per-round
  floor so a single-group round may be specified. *(Added 2026-07-12: the
  original implementation omitted this Area 4.1 relaxation — story re-opened
  to include it; see AC7.)*
- Generation for N rounds over multiple attempts, retaining the fairest by
  the matchup-distribution metric.
- Fairness evidence review; lone-pilot-group avoidance; clear failure when no
  valid draw exists.

### Scope Out

- Draw acceptance / re-draw decision — Contest Director (Area 4.3).
- Manual lane reassignment (STORY-001-010).
- Frequency and team-separation constraints — Future Enhancements.

### Acceptance Criteria

#### AC1: Groups-per-round bounds are enforced
**Given** a roster of 14 pilots and a task whose groups need at least 5
pilots each
**When** the Organiser sets groups-per-round to 4 (which would force groups
below 5)
**Then** the system rejects the value and explains the bound implied by
roster size and group limits.

#### AC2: Constraint conflicts warn instead of silently degrading
**Given** a draw specification whose constraints cannot all be satisfied for
this roster and task
**When** the Organiser saves it
**Then** the system warns which constraints cannot be met rather than later
generating a silently unfair draw.

#### AC3: Generation honours the constraints
**Given** a valid specification for 8 rounds with a consecutive-flight
constraint enabled
**When** the Organiser generates the draw
**Then** flight groups are produced for all 8 rounds, no pilot is drawn into
back-to-back groups where the constraint forbids it, and group composition
varies round to round per the anti-repeat intent.

#### AC4: Fairest of several attempts is retained
**Given** generation runs multiple attempts
**When** it completes
**Then** the retained draw is the fairest attempt by the
matchup-distribution metric, and the Organiser can see that metric and the
matchup distribution for the Contest Director's accept/re-draw decision.

#### AC5: Lone-pilot groups are avoided where possible
**Given** a roster whose size allows every group at least two scoring pilots
**When** the draw generates
**Then** no group contains only one scoring pilot; **and given** a roster
that makes a single-pilot group unavoidable, **then** the draw is produced
with the lone-pilot group flagged so the STORY-001-011 safeguard applies at
scoring time.

#### AC6: Impossible draws fail clearly
**Given** a roster or specification for which no valid draw exists
**When** the Organiser generates
**Then** the system reports a clear failure with the reason, and no invalid
draw is stored.

#### AC7: Spare-scorer override relaxes the two-group floor *(added 2026-07-12)*
**Given** a 14-pilot roster
**When** the Organiser sets groups-per-round to 1 without the spare-scorer
override
**Then** the save is rejected with a message that cites the override as the
way to permit it; **and when** the Organiser sets the override (spare
non-flying scorers are present) and saves the same value
**Then** the specification is accepted with the single-group round.

### INVEST Check

Independent (algorithmic feature over the roster) · Valuable (the fairness
backbone of the contest) · Small enough (5 days, 3 functional points:
specification, generation with fairness retention, evidence/failure
handling) · Testable.
