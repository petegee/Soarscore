# [STORY-001-033] Publish Official Results

> Source: `docs/user-stories/02-contest-director.md` §7 ·
> `docs/requirements/high-level-requirements.md` Area 7 (Reports) ·
> `docs/requirements/decisions.md` D1 (authority recorded, not enforced), D4
> (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §5 (final classification,
> drop-worst, penalties) · gated on STORY-001-026 (Lock & finalisation);
> distinct from STORY-001-014 / STORY-001-015 (report production)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

The Organiser *produces* results and draw reports at any stage (STORY-001-014 /
STORY-001-015); the Contest Director's distinct act is to **publish** the
**official** result — declaring the authoritative outcome they stand behind.
Publishing is the counterpart to Lock: it is only meaningful over a **frozen**
computation, so this story's central rule is that **publishing requires a locked
competition** (STORY-001-026). An unlocked competition cannot be published, which
guarantees the official result is always a snapshot that can no longer drift.

Publishing does three things. It requires the lock **first** — a publish attempt
on an unlocked (or NoContest) competition is refused. It **marks the result as
official**, distinct from the in-progress reports the Organiser can produce as the
contest proceeds. And it presents the result in **final classification order,
winner first, with drop-worst applied and penalties retained** per the rules —
reading the same locked computation the finalisation produced (STORY-001-026), so
the published output can never disagree with what the system computed.

"Publish" here means **declaring the authoritative result**, not any specific
distribution mechanism — output channels (PDF/CSV/online), email distribution and
badges are Future Enhancements. Because Locked is **terminal** in the MVP state
machine (STORY-001-024 / STORY-001-026), there is no unlock→correct→re-publish
cycle in scope; that path depends on an unlock capability that is **post-MVP**
(see open questions).

### Business Value

- Provide the Contest Director with a single act that declares the official, final
  result pilots and the public can rely on.
- Support trust in the result — publishing is only possible over a locked, frozen
  computation, so an official result can never silently drift after it is
  declared.
- Enable a clear distinction between the Organiser's in-progress reports and the
  Contest Director's authoritative, official outcome.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-026 (Lock & finalisation — publish is gated on
  Locked and reads the finalised classification, incl. drop-worst and retained
  penalties), STORY-001-007 (score computation), STORY-001-014 / STORY-001-015
  (report production this publish marks as official), STORY-001-024 (lifecycle —
  Locked state).
- **Data assumptions**: the final classification, drop-worst application and
  penalty retention come from the locked finalisation (STORY-001-026); actor
  identity arrives with the request and Contest-Director authority is **recorded,
  not enforced** (D1); a NoContest lock produces no official result to publish.
- **Integration points**: publish consumes the OfficialResults output of
  STORY-001-026 and marks the corresponding report (STORY-001-014) as the official
  result; recorded in the event log (D4). Distribution over a channel is
  connectivity-gated and out of scope.
- **Business constraints**: publish **requires** a prior lock; the final
  classification obeys the read-only rule docs; class-agnostic core (CLAUDE.md);
  offline-first for the declaration, with any future distribution being a separate
  connectivity-gated step (D6).

### Scope In

- **Lock-gated publish**: publishing is refused unless the competition is
  **Locked** with an OfficialResults outcome; the official result is therefore
  always a frozen snapshot.
- **Mark official**: a published result is marked as the **official** result,
  distinct from the Organiser's in-progress reports (STORY-001-014 /
  STORY-001-015).
- **Correct presentation**: the published result is in **final classification
  order, winner first, with drop-worst applied and penalties retained** per the
  rules, and matches the locked computation exactly — the published output cannot
  disagree with what the system computed.
- **In-progress reads remain**: per-round results remain readable as the contest
  proceeds; publishing the **official** result is the Director's distinct, final
  act.
- **Audit**: the publish is recorded with the acting person and Contest-Director
  authority (D1/D4).

### Scope Out

- **Report content and layout** and their production — STORY-001-014 /
  STORY-001-015; publish only *marks* a produced result as official.
- **The lock and finalisation** (freeze, minimum-rounds OfficialResults/NoContest
  resolution, drop-worst arithmetic) — STORY-001-026; publish reads its output.
- **Unlock → correct → re-publish** — depends on an unlock capability that is
  **post-MVP** (Locked is terminal, STORY-001-024 / STORY-001-026); out of scope
  here (see open questions).
- **Distribution mechanisms** — output channels (PDF/CSV/online), email, badges
  are Future Enhancements; publish means declaring the authoritative result, not
  distributing it.
- **Publishing a NoContest** — a below-minimum lock produces no official result;
  there is nothing to publish.
- Enforcing that only a Contest Director may publish (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: Publishing requires a lock first
**Given** a competition whose results the Contest Director judges final but which
is **not** locked
**When** they attempt to publish
**Then** the publish is refused because the competition must be locked first — so
the official result is always a frozen snapshot.

#### AC2: Publishing a locked competition marks the result official
**Given** a competition Locked with an OfficialResults outcome (STORY-001-026)
**When** the Contest Director publishes it
**Then** the result is marked as the **official** result, distinct from the
in-progress reports the Organiser can produce at any stage.

#### AC3: The published result is correctly ordered and rule-consistent
**Given** a published F5J result
**When** it is presented
**Then** it is in final classification order, **winner first**, with **drop-worst
applied** and **penalties retained** per the rules, matching the locked
computation.

#### AC4: The published output cannot disagree with the computed result
**Given** a published result
**When** a pilot reads it
**Then** it matches the locked computation exactly — the published output is never
allowed to diverge from what the system computed.

#### AC5: In-progress results remain readable; publish is the distinct final act
**Given** a contest still proceeding
**When** a round completes
**Then** its results are available to read as the contest proceeds, while
publishing the **official** result remains the Contest Director's separate, final
act taken only after Lock.

#### AC6: A NoContest lock has no official result to publish
**Given** a competition Locked as **NoContest** (below the class minimum,
STORY-001-026)
**When** a publish is attempted
**Then** it is refused because a no-contest produces no official result to
publish.

#### AC7: The publish is attributable
**Given** the Contest Director publishes
**When** the event log is examined
**Then** the publish is recorded with the acting person and the Contest-Director
authority (D1/D4).

#### Non-Functional Expectations
- The published classification is read from the locked finalisation and the class
  model (drop-worst, penalties); publish carries no per-class knowledge (CLAUDE.md
  class-model law).
- Declaring the official result operates on the base with no internet connection;
  any future distribution over a channel is a separate, connectivity-gated step
  (D6).

### INVEST Check

Independent (a publish/declare-official layer gated on STORY-001-026's lock,
reading its finalised classification) · Valuable (the authoritative, frozen
outcome pilots and the public rely on, distinct from in-progress reports) · Small
(3 days, 3 functional points: lock-gated publish, mark-official + correct
presentation, in-progress-read distinction + audit) · Testable (the lock gate,
the official marking, the rule-consistent presentation and the NoContest refusal
are all observable).

### Open questions / conflicts flagged (house rule 2)

- **Unlock → re-publish is post-MVP, and the CD user-story doc needs a walk-back.**
  `docs/user-stories/02-contest-director.md` (resolved items 1–2) grants the
  Contest Director attributable **unlock → correct → re-lock → re-publish**
  authority, with §7 AC4 requiring a re-publish after a post-lock correction. That
  contradicts STORY-001-024 / STORY-001-026, which make **Locked terminal** (no
  unlock edge). Per the user's decision, **Locked stays terminal for the MVP**, so
  this story omits the re-publish path. **Recommendation:** update
  `02-contest-director.md` §2.2 and §7 (and conflicts items 1–2) to record unlock
  and re-publish as **post-MVP** rather than resolved-in. Flagged for the user
  before any doc edit — not silently reconciled.
