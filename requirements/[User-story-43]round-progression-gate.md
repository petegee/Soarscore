# [STORY-001-043] Gate Round Advance on Score Completeness

> Source: `docs/user-stories/04-announcer-timekeeper.md` §6.4 · `docs/
> requirements/high-level-requirements.md` Area 6.4 · `docs/requirements/
> decisions.md` D10 (operator-driven progression) · relates to STORY-001-031
> (no-score resolution), STORY-001-028 (re-flight entitlement), STORY-001-032
> (the Contest Director's "advance anyway" override of this gate)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

The Announcer/Timekeeper advances the contest from one round to the next,
but only once the previous round is genuinely finished: every group's scores
captured, no unresolved no-score left for a pilot who could still fly, and no
granted-but-unflown re-flight entitlement stranded by moving on. This story
delivers that gate at the round boundary — checking completeness and, when
something is outstanding, listing exactly what and blocking the advance until
it clears.

The gate does **not** decide the missing scores itself, nor resolve a
no-score or re-flight — those belong to the Organiser's oversight
(chasing/validating, [5.6](../docs/requirements/high-level-requirements.md#area-5--scoring)),
STORY-001-031 and STORY-001-028 respectively. Its only job is to hold the
boundary and show what's outstanding until those are in, or until the Contest
Director issues an explicit "advance anyway" override
(STORY-001-032) — a separate story, since that override and its
consequences are the Director's authority, not this gate's own behaviour.
This gate operates only at the **round** boundary; starting each group within
a round is a separate operator action (STORY-001-044) that is not
score-gated.

### Business Value

- Guarantee no flight is left unscored when the contest moves on to the next
  round, without the Announcer/Timekeeper having to remember to check.
- Show exactly which group(s)/competitor(s) are still outstanding, so the
  Announcer/Timekeeper knows what to chase before the round can proceed.
- Keep the decision of *what to do* about a missing score, no-score or
  re-flight with the roles that actually own it (Organiser oversight,
  no-score resolution, re-flight scheduling), while this gate only holds the
  boundary.

### Dependencies and Assumptions

- **Prerequisites**: Area 5 scoring completeness data for the previous
  round; STORY-001-031 (no-score state) and STORY-001-028 (re-flight
  entitlement) exist as the sources of the outstanding-item categories this
  gate checks.
- **Data assumptions**: for a given round, the system can determine, per
  group, whether every competitor's score is captured, whether any pilot
  holds an unresolved no-score with groups remaining that they could still
  fly, and whether any granted-but-unflown re-flight is placed at the end of
  this round.
- **Integration points**: this gate is checked when the Announcer/Timekeeper
  attempts to start the next round; the Contest Director's "advance anyway"
  override (STORY-001-032) is the only path past a block this story raises.
- **Business constraints**: operator-driven progression (D10) — the round
  advance is always a deliberate action, never automatic; this gate never
  itself resolves a no-score, chases a missing score, or overrides a
  re-flight entitlement.

### Scope In

- Checking, at an attempted round advance, that every group in the previous
  round has all its scores captured.
- Checking that no pilot holds an unresolved no-score with groups remaining
  in which they could still fly.
- Checking that no granted-but-unflown re-flight entitlement is stranded by
  advancing.
- Blocking the advance and listing the specific outstanding group(s)/
  competitor(s)/item(s) when any of the above checks fail.
- Allowing the advance to proceed, and making the next round current, once
  every check passes.

### Scope Out

- Deciding or entering the missing scores themselves — Organiser oversight
  ([5.6](../docs/requirements/high-level-requirements.md#area-5--scoring)).
- Resolving a no-score (move to a later group, or converting to zero at round
  end) — STORY-001-031.
- Scheduling or flying a re-flight — STORY-001-028.
- The Contest Director's "advance anyway" override and its consequences
  (flagged anomalies, no-score-to-zero conversion, re-flight lapse) —
  STORY-001-032.
- The deliberate action that starts each group within a round, which is not
  score-gated — STORY-001-044.
- Whether Scorer self-correction is still open on a flown group (that closes
  when the next **group**, not round, starts — D11, STORY-001-036) — this
  gate does not affect that window.

### Acceptance Criteria

#### AC1: A missing score blocks the advance and lists what's outstanding
**Given** Round 3 has one group where Mary Field's flight was never captured
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and Mary Field's group/competitor is listed
as the outstanding item.

#### AC2: An unresolved no-score with remaining groups blocks the advance
**Given** Round 3 has a pilot holding an unresolved no-score and groups
remaining in Round 3 that pilot could still fly
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and that pilot's unresolved no-score is
listed as the outstanding item.

#### AC3: A granted-but-unflown re-flight placed at round end blocks the advance
**Given** a re-flight has been granted for the end of Round 3 and has not yet
been flown
**When** the Announcer/Timekeeper attempts to start Round 4
**Then** the advance is blocked and the unflown re-flight is listed as the
outstanding item.

#### AC4: A complete round advances cleanly
**Given** every group in Round 3 has all its scores captured, no unresolved
no-score remains, and no re-flight is owed
**When** the Announcer/Timekeeper advances
**Then** Round 4 becomes the current round and its first group can be
started.

#### AC5: The gate does not resolve outstanding items itself
**Given** the advance is blocked on a missing score
**When** the Announcer/Timekeeper reviews the blocked items
**Then** the gate only lists them — it does not enter a score, resolve the
no-score, or schedule the re-flight on the Announcer/Timekeeper's behalf;
those actions belong elsewhere (Organiser oversight, STORY-001-031,
STORY-001-028).

#### AC6: Only the round boundary is gated, not each group start within it
**Given** Round 3 is still in progress with its later groups not yet run
**When** the Announcer/Timekeeper starts one of those later groups
**Then** that group start proceeds without this gate's check — the gate only
applies at the round boundary (STORY-001-044 governs group starts).

#### Non-Functional Expectations
- The gate carries no knowledge of any specific competition class — its
  completeness checks read generic scoring-completeness, no-score and
  re-flight state (CLAUDE.md class-model law).

### INVEST Check

Independent (a completeness check at one boundary, consuming but not owning
no-score/re-flight state) · Valuable (guarantees no flight is silently left
unscored as the contest proceeds) · Small (3 days, 3 functional points:
score-completeness check, no-score/re-flight outstanding-item checks, the
listing of outstanding items) · Testable (each blocking condition and the
clean-advance path are directly observable).
