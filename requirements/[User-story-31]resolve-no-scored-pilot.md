# [STORY-001-031] Resolve a No-Scored (Did-Not-Fly) Pilot

> Source: `docs/user-stories/02-contest-director.md` §5.7 ·
> `docs/requirements/high-level-requirements.md` Area 5.7 ·
> `docs/requirements/decisions.md` D4 (immutable event log), D10
> (operator-driven progression) · reuses STORY-001-028 (readiness move),
> STORY-001-030 (retirement), STORY-001-032 (run-control / prep-gate release);
> relates to round advance (Area 6.4)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

A **no-score** is *did-not-fly* — a pilot who never flew their group. It is a
different thing from a **zero**, which is *flew and scored zero*. The line between
them matters for results, and this story governs how a no-score is resolved so
that "did not fly" does not silently become a zero while the pilot could still get
a fair chance to fly the round.

A no-score arises two ways: a Scorer marks *cannot make the group* at the
pre-group confirmation guard (5.0.4), or the Contest Director releases the prep
gate as **"pilot unconfirmed"** (STORY-001-032). Once a pilot holds a no-score for
the round and **groups remain** in that round, the Contest Director can resolve it
using tools they already have: a **readiness move** into a later group (no
re-draw, STORY-001-028) so the pilot flies the round, or — if the pilot cannot
continue — **retirement** (STORY-001-030). The only **automatic** step is the
end-of-round conversion: a no-score that is **not** resolved and for which **no
groups remain** in the round **auto-converts to a zero** when the round ends —
this is the single point at which *did-not-fly* legitimately crosses into a
scored zero. While the pilot could still be moved into a remaining group, the
round **cannot be advanced** (Area 6.4), so a no-score is never stranded as a
silent zero prematurely.

This story is the **resolution policy** — it wires the no-score state to the
existing readiness-move and retirement tools and defines the end-of-round
conversion. It does not build those tools, and it does not create the no-score
(that is the Scorer's device action or the CD's prep-gate release).

### Business Value

- Ensure "did not fly" never silently becomes a zero while the pilot still has a
  group to fly in — the result stays fair.
- Support the Contest Director in resolving a no-score with tools they already
  use (readiness move, retirement) rather than a bespoke mechanism.
- Enable an honest, automatic end-of-round outcome: a genuinely unresolvable
  no-score becomes a zero only when no group remains for that pilot.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-028 (readiness move — the no-re-draw group move),
  STORY-001-030 (retirement), STORY-001-032 (run-control / the "pilot
  unconfirmed" prep-gate release that can create a no-score), the Scorer's
  *cannot make the group* action (5.0.4), and round-advance blocking (Area 6.4).
- **Data assumptions**: a no-score is a distinct per-(pilot, round) state, not a
  score value; whether groups remain in the round is derivable from the running
  state and event log (D4); a zero is a scored value, observably different from a
  no-score.
- **Integration points**: resolution reuses STORY-001-028 / STORY-001-030; the
  end-of-round conversion is the same round-end that the advance gate (Area 6.4)
  guards; the "device offline" prep-gate release (STORY-001-032) creates **no**
  no-score and so never enters this flow.
- **Business constraints**: operator-driven progression — nothing converts a
  no-score to a zero except the defined end-of-round step (D10); offline-first
  (D6); class-agnostic core (CLAUDE.md).

### Scope In

- **Recognise a no-score** (did-not-fly) for a (pilot, round) as distinct from a
  zero, however it arose (Scorer *cannot make the group*, or CD "pilot
  unconfirmed" prep-gate release).
- **Resolve while groups remain**: the Contest Director can move a no-scored pilot
  into a later group via a **readiness move** (no re-draw, STORY-001-028) so they
  fly the round, or **retire** them (STORY-001-030).
- **End-of-round auto-conversion**: an unresolved no-score for which **no groups
  remain** converts to a **zero** when the round ends — the one automatic
  crossing from did-not-fly to a scored zero.
- **Advance block**: while a no-scored pilot could still be moved into a remaining
  group, the round **cannot be advanced** (Area 6.4).
- **Audit**: the resolution taken (moved / retired / auto-zeroed) is recorded (D4).

### Scope Out

- **Creating** the no-score — the Scorer's *cannot make the group* device action
  (5.0.4) and the CD's prep-gate release (STORY-001-032); this story consumes the
  resulting state.
- **The readiness-move and retirement mechanics** themselves — STORY-001-028 /
  STORY-001-030; this story routes to them.
- **The round-advance gate's other conditions** (missing scores, unflown
  re-flights) — Area 6.4 / STORY-001-032; this story contributes only the
  "no-score still movable" block.
- **The "advance anyway" override** that force-converts unresolved no-scores to
  zeros mid-round — STORY-001-032; this story owns only the *normal* end-of-round
  conversion.
- The **"device offline"** prep-gate release, which applies **no** no-score and is
  outside this flow (STORY-001-032).

### Acceptance Criteria

#### AC1: A no-score is recognised as distinct from a zero
**Given** pilot "John Brown" whom a Scorer marked *cannot make the group* in round
4 (5.0.4)
**When** his round-4 state is examined
**Then** it is a **no-score** (did-not-fly), observably distinct from a scored
zero — not yet any points.

#### AC2: The Contest Director moves a no-scored pilot into a later group
**Given** John Brown holds a no-score in round 4 and later groups remain in the
round
**When** the Contest Director moves him into a remaining group via a readiness
move
**Then** the move applies **without** a re-draw (STORY-001-028) and John gets to
fly round 4, clearing the no-score.

#### AC3: The Contest Director may retire a no-scored pilot who cannot continue
**Given** a no-scored pilot the Contest Director judges cannot continue
**When** the Contest Director retires him (STORY-001-030)
**Then** retirement applies (remaining rounds re-drawn to exclude him) and the
no-score is resolved by retirement rather than a later group.

#### AC4: An unresolved no-score with no groups remaining auto-zeroes at round end
**Given** John Brown still holds an unresolved no-score in round 4 and **no**
groups remain in the round for him
**When** the round ends
**Then** the no-score **auto-converts to a zero** — the single automatic crossing
from did-not-fly to a scored zero — and it is recorded.

#### AC5: The round cannot advance while a no-score is still movable
**Given** a no-scored pilot who could still be moved into a remaining group in the
round
**When** a round advance is attempted
**Then** it is blocked (Area 6.4) because the no-score is unresolved and still
resolvable — the pilot is not stranded as a premature silent zero.

#### AC6: A resolved no-score does not later auto-zero
**Given** a no-score already resolved by a readiness move (the pilot flew and was
scored) or by retirement
**When** the round ends
**Then** no end-of-round zero is applied for that pilot — the auto-conversion only
ever touches an **unresolved** no-score with no groups remaining.

#### Non-Functional Expectations
- Nothing converts a no-score to a zero except the defined end-of-round step —
  the system never silently zeroes a did-not-fly mid-round (D10).
- No-score recognition and resolution carry no knowledge of any specific
  competition class (CLAUDE.md class-model law) and operate on the base offline
  (D6).

### INVEST Check

Independent (a resolution policy wiring the no-score state to existing
readiness-move and retirement tools) · Valuable (keeps did-not-fly from silently
becoming a zero while the pilot could still fly) · Small (3 days, 3 functional
points: no-score recognition, resolve-via-move/retire, end-of-round auto-zero +
advance block) · Testable (the no-score/zero distinction, each resolution path
and the auto-conversion are observable).
