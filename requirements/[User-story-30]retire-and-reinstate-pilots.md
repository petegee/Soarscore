# [STORY-001-030] Retire and Reinstate Pilots, Re-Drawing Remaining Rounds

> Source: `docs/user-stories/02-contest-director.md` §5.5 ·
> `docs/requirements/high-level-requirements.md` Area 5.5 ·
> `docs/requirements/decisions.md` D1 (authority recorded, not enforced), D4
> (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §1 (draw/anti-repeat), §5–6
> (final classification, drop-worst, penalties) · the per-class rule docs
> (drop-worst counts) · reuses STORY-001-009 (draw generation) and STORY-001-016
> (class model); contrasts STORY-001-028 (readiness move — no re-draw)
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

A pilot may have to stop competing mid-contest — injury, equipment loss, a
personal emergency. The Contest Director **retires** them, and can **reinstate**
them if circumstances change. Retirement's defining behaviour is that it
**re-draws the remaining, unflown rounds** to exclude the pilot, while everything
**already scored is preserved unchanged**. This is the sharp contrast with a
**readiness move** (STORY-001-028), which never re-draws — keeping the two
observably distinct is the point, because they recompute results in opposite ways.

The re-draw of remaining rounds honours the same fairness / anti-repeat intent as
the original draw (STORY-001-009, reused) for the pilots who remain, and avoids
creating a single-scoring-pilot group where it can — falling back to the
lone-pilot safeguard only where it cannot. A retired pilot's already-scored rounds
**still count** in their aggregate and any **penalties they incurred are
retained** (STORY-001-029); a group they were already normalised within is
unaffected.

Reinstatement re-draws the remaining unflown rounds again to re-include them,
still preserving all scored rounds. The subtle rule — resolved with the user (CD
doc item 3) — is that rounds **flown while the pilot was retired** (and re-drawn
to exclude them) are **not eligible as a drop-worst round** for that pilot and are
**excluded from their aggregate**: they had no opportunity to fly those rounds, so
the class drop-worst count applies only to rounds they could fly. The class
drop-worst count itself comes from the Contest Class Model (STORY-001-016), read
generically.

### Business Value

- Provide the Contest Director with the authority to retire and reinstate pilots
  so the field reflects who is actually competing.
- Support fairness for the pilots who remain — the remaining rounds are re-drawn
  with the same anti-repeat intent rather than left with a stale draw.
- Enable a correct aggregate for a retired/reinstated pilot — scored rounds and
  penalties are preserved, and rounds they had no chance to fly neither count
  against them nor absorb their drop-worst.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw generation, reused for the remaining-round
  re-draw), STORY-001-016 (class model — drop-worst count), STORY-001-007 (scoring
  and aggregate), STORY-001-029 (penalty retention), STORY-001-024 (lifecycle —
  retirement happens while Running).
- **Data assumptions**: which rounds are flown vs unflown, and which rounds a
  pilot was retired across, are derivable from the event log (D4); actor identity
  arrives with the request and Contest-Director authority is **recorded, not
  enforced** (D1); the class model exposes the drop-worst count.
- **Integration points**: the remaining-round re-draw reuses STORY-001-009's
  generation and anti-repeat matrix; the Organiser's roster view **reflects** the
  retired state (STORY-001-005) and does not silently re-add a retired pilot;
  re-draw that would isolate a pilot routes to the lone-pilot safeguard
  (STORY-001-028 / STORY-001-011).
- **Business constraints**: anti-repeat/fairness intent and drop-worst counts come
  from the read-only rule docs / class model; class-agnostic core (CLAUDE.md);
  offline-first (D6).

### Scope In

- **Retire** a pilot: re-draw the remaining, unflown rounds to exclude them,
  honouring the original draw's fairness/anti-repeat intent for the remaining
  pilots, while preserving all already-scored rounds unchanged.
- **Preserve the retired pilot's record**: their scored rounds still count in
  their aggregate and their penalties are retained; a group they were normalised
  within is unaffected.
- **Reinstate** a pilot: re-draw the remaining unflown rounds again to re-include
  them, still preserving all scored rounds.
- **Retired-window exclusion**: rounds flown while a (now reinstated) pilot was
  retired are excluded from their aggregate and are **not eligible as a drop-worst
  round** for them — the class drop-worst count applies only to rounds they could
  fly.
- **Lone-pilot avoidance on re-draw**: the re-draw avoids a single-scoring-pilot
  group where it can, falling back to the lone-pilot safeguard where it cannot.
- **Audit**: retire and reinstate are attributable to the Contest Director (D1/D4).

### Scope Out

- **The draw-generation algorithm and anti-repeat computation** — STORY-001-009,
  reused unchanged for the remaining-round re-draw.
- **The readiness move** (same-round group reassignment with **no** re-draw) —
  STORY-001-028; retirement is its deliberate contrast.
- **The lone-pilot dummy/annul mechanics** the re-draw may fall back to —
  STORY-001-028 / STORY-001-011.
- **Penalty imposition itself** — STORY-001-029; this story only relies on
  penalties being retained for a retired pilot.
- **The drop-worst arithmetic** — STORY-001-007 / STORY-001-016; this story defines
  which rounds are *eligible* for a retired/reinstated pilot, not the maths.
- Enforcing that only a Contest Director may retire/reinstate (authority recorded,
  not enforced, D1).

### Acceptance Criteria

#### AC1: Retiring re-draws remaining rounds and preserves scored rounds
**Given** a 6-round F3J contest in which rounds 1–3 are scored and pilot "Jane
Smith" must stop
**When** the Contest Director retires her
**Then** the remaining unflown rounds 4–6 are re-drawn to exclude her while rounds
1–3 remain exactly as scored.

#### AC2: The remaining-round re-draw honours fairness intent
**Given** the retirement re-draw of rounds 4–6
**When** it runs
**Then** it honours the same anti-repeat/fairness intent as the original draw for
the pilots who remain (reusing STORY-001-009), rather than leaving a stale or
unfair remaining draw.

#### AC3: A retired pilot's scored rounds and penalties are retained
**Given** Jane Smith retired after round 3, with a 50-point penalty from round 2
**When** results compute
**Then** her rounds 1–3 still count in her aggregate, the 50-point penalty is
retained, and any group she was already normalised within is unaffected.

#### AC4: Reinstating re-draws remaining rounds to re-include the pilot
**Given** Jane Smith was retired after round 3 and rounds 4–5 have since been
flown without her
**When** the Contest Director reinstates her before round 6
**Then** round 6 (the remaining unflown round) is re-drawn to re-include her,
while rounds 1–5 are preserved.

#### AC5: Rounds flown while retired don't count and can't be dropped for her
**Given** reinstated Jane Smith, for whom rounds 4–5 were flown while she was
retired (and re-drawn to exclude her)
**When** results compute
**Then** rounds 4–5 are **excluded from her aggregate** and are **not eligible as
a drop-worst round** for her — the class drop-worst count applies only to the
rounds she could fly (1–3 and 6).

#### AC6: A re-draw avoids isolating a pilot, else uses the safeguard
**Given** a retirement that would otherwise leave a remaining group with a single
scoring pilot
**When** the rounds are re-drawn
**Then** the re-draw avoids the single-pilot group where it can, and where it
cannot the lone-pilot safeguard applies (dummy, or F3B annul-and-warn) rather than
an auto-1000.

#### AC7: Retire and reinstate are attributable, roster reflects the state
**Given** any retire or reinstate
**When** it is applied
**Then** it is recorded with the acting person and Contest-Director authority
(D4), and the Organiser's roster view reflects the retired state without silently
re-adding a retired pilot.

#### Non-Functional Expectations
- The drop-worst count that decides retired-window eligibility is read from the
  Contest Class Model; the core never branches on discipline (CLAUDE.md
  class-model law, NFR-1/NFR-2).
- Retirement, re-draw and reinstatement operate on the base with no internet
  connection (offline-first, D6).

### INVEST Check

Independent (a retirement/re-draw layer reusing STORY-001-009 generation and
STORY-001-007 scoring) · Valuable (fairness for remaining pilots plus a correct
aggregate for the retired/reinstated pilot, including the had-no-chance-to-fly
rule) · At the size limit (5 days, 3 functional points: retire + remaining-round
re-draw preserving scored rounds, reinstate + retired-window exclusion, lone-pilot
avoidance on re-draw) · Testable (preserved scored rounds, the retired-window
exclusion and the re-draw's fairness are all observable).
