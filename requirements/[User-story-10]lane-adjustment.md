# [STORY-001-010] Manual Lane Adjustment After the Draw

> Source: `docs/user-stories/01-organiser.md` §4.4 · `docs/requirements/high-level-requirements.md` Area 4.4
> Module: 001 (Organiser MVP) · Estimated effort: **2 days**

### Background

After a draw is accepted, real-world lane placements sometimes need
correcting — a pilot who can't hear the speakers from lane 1, a lane blocked
by ground conditions. Lane adjustment moves pilots between lanes **within
their existing group** without touching group composition, so the anti-repeat
fairness the Contest Director accepted stays intact. It is deliberately
distinct from re-drawing, which is the Director's decision.

### Business Value

- Provide the Organiser with lane corrections that never disturb the fair
  group composition.
- Support practical field adjustments without invoking the Contest
  Director's re-draw authority.
- Enable reprinted draw reports to reflect current lanes (STORY-001-015).

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (an accepted draw with lane allocations
  exists).
- **Data assumptions**: the lane-allocation policy configured in the draw
  specification produced the initial lanes.
- **Integration points**: draw reports (STORY-001-015) must reflect
  adjustments; group membership changes are STORY-001-011, not here.
- **Business constraints**: re-draw remains Contest Director authority
  (Area 4.3).

### Scope In

- Review each pilot's lane within their group, per round.
- Reassign a pilot's lane, leaving group membership untouched.
- Clash detection: two pilots in one lane, or a required lane left empty.

### Scope Out

- Moving pilots between groups (STORY-001-011).
- Re-drawing rounds — Contest Director authority.

### Acceptance Criteria

#### AC1: Review lanes per group and round
**Given** an accepted draw for 6 rounds
**When** the Organiser opens lane allocations
**Then** each pilot's lane within their group is visible for every round.

#### AC2: Reassignment moves lanes only
**Given** round 3, group B, with pilot "Jane Smith" in lane 2 and lane 5 free
**When** the Organiser moves her to lane 5
**Then** she occupies lane 5, group B's membership (who meets whom) is
unchanged, and no other round is affected.

#### AC3: Lane clashes are prevented
**Given** round 3, group B, with pilot "John Brown" already in lane 4
**When** the Organiser attempts to also place "Jane Smith" in lane 4, or
leaves a required lane empty
**Then** the clash is flagged and the change is prevented until resolved.

### INVEST Check

Independent (pure adjustment over the accepted draw) · Valuable (field
practicality without fairness damage) · Small (2 days, 2 functional points:
lane review/reassign + clash checks) · Testable.
