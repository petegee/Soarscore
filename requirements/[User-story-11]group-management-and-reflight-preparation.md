# [STORY-001-011] Group Management and Re-Flight Preparation

> Source: `docs/user-stories/01-organiser.md` §5.3 · `docs/requirements/high-level-requirements.md` Area 5.3 · `docs/requirements/rules/00-general-rules.md` §3, §7 · `docs/requirements/rules/f3b.md`
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

Contests get disrupted: a pilot isn't ready for their group, a mid-air
collision earns a re-flight, a group ends up with a single scoring pilot.
The Organiser adapts the running order — moving pilots between groups,
creating or splitting groups, preparing re-flights — always with clash checks
and always under the Contest Director's authority for the approvals
themselves. Scoring must then follow the class rules: the pilot allocated a
re-flight scores the re-flight even if worse, everyone else in that group
scores the better of their two results, and a lone-pilot group is normalised
against a randomly-chosen dummy rather than being auto-awarded 1000 — except
where a class rule (F3B) annuls instead, which needs explicit
Contest-Director approval to override.

### Business Value

- Provide the Organiser with safe running-order adaptation for real-world
  disruptions.
- Support rule-correct re-flight scoring (official-even-if-worse / better-of)
  without manual arithmetic.
- Enable fair lone-pilot handling so nobody banks an unearned 1000.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw/groups exist), STORY-001-007
  (group-score computation).
- **Data assumptions**: re-flight results are stored as distinct
  working-time results for the same round — two results for one pilot here
  is legitimate, never a capture conflict.
- **Integration points**: approvals (re-flights, group changes, the
  F3B-annulment override) are Contest Director authority — this story
  prepares and executes under that authority and records the handoff. A
  pilot-readiness move does not regenerate the draw.
- **Business constraints**: new re-flight groups are filled to the class
  minimum — 4 pilots (6 for F5J) — by random draw from the other competitors.

### Scope In

- Move pilots between groups; create and split groups; all with clash checks
  and draw-constraint warnings.
- Prepare re-flights (including new re-flyer groups filled to the class
  minimum by random draw) and apply the which-score-counts rule on capture.
- Lone-pilot safeguard: random-dummy insertion, and the F3B-annulment path
  requiring explicit Contest-Director approval.

### Scope Out

- Approving re-flights, group changes and the annulment override — Contest
  Director authority.
- Pilot retirement and consequent re-draw (Area 5.5) — Contest Director.
- Live capture of the re-flight itself (Scorer scope).

### Acceptance Criteria

#### AC1: Group changes run clash checks
**Given** round 4 with groups A and B drawn
**When** the Organiser moves pilot "Jane Smith" from group A to group B, or
splits group A in two
**Then** the system runs clash checks first and flags any conflict (e.g. a
lane clash or a violated draw constraint) before applying the change.

#### AC2: Constraint violations warn with the reason
**Given** a group change that would violate a draw constraint (e.g. placing a
pilot into back-to-back groups against the consecutive-flight constraint)
**When** the Organiser applies it
**Then** the system warns, stating which constraint is affected and why.

#### AC3: Re-flight preparation records the approval handoff
**Given** pilot "John Brown" is entitled to a re-flight
**When** the Organiser prepares it
**Then** the re-flight is set up for execution and, where it requires the
Contest Director's approval, the system records that the approval is the
Director's decision rather than granting it here.

#### AC4: New re-flyer group filled to the class minimum
**Given** an F5J re-flight that must be placed in a new group of re-flyers
**When** the Organiser prepares the group
**Then** it is filled to at least 6 pilots (4 in the other classes) by random
draw from the other competitors.

#### AC5: Which-score-counts applies on recompute
**Given** an approved re-flight flown by entitled pilot "John Brown" (original
score 850, re-flight 790) alongside filler "Jane Smith" (original 920,
re-flight 960)
**When** the re-flight results are captured
**Then** scoring recomputes with John Brown's official score the re-flight
(790, even though worse) and Jane Smith's the better of her two results
(960), consistently across the affected group and round.

#### AC6: Lone-pilot group gets a dummy, not an automatic 1000
**Given** a non-F3B group that resolves to a single scoring pilot and the
draw could not avoid it
**When** the group is scored
**Then** a randomly-chosen dummy from the other pilots is inserted for the
lone pilot to be normalised against — the lone pilot is not auto-awarded
1000 — and the dummy's flight does not count toward the dummy pilot's own
score.

#### AC7: F3B annuls instead unless the Director overrides
**Given** an F3B group in which only one competitor has a valid result
**When** the lone-pilot situation arises
**Then** the dummy is not applied automatically; the system warns that F3B
annuls a one-valid-result group and requires the Contest Director's explicit
per-contest approval before any dummy override proceeds.

### INVEST Check

Independent of capture implementation · Valuable (contests survive
disruption with rule-correct results) · At the size limit (5 days, 3
functional points: group moves/splits, re-flight preparation + scoring rule,
lone-pilot safeguard) · Testable.
