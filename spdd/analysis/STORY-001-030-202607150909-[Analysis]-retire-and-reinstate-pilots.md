# SPDD Analysis: STORY-001-030 — Retire and Reinstate Pilots, Re-Drawing Remaining Rounds

> Strategic-level enriched context for `/spdd-reasons-canvas`. Grounded in the
> repo state at analysis time: a `RetirementStateProvider` seam and
> `NothingRetiredProvider` stub already exist (roster reads retired state at
> read time), and the pure scoring aggregate (`computeFinalAggregate`) already
> applies drop-worst per series with penalties tracked outside the series. This
> story fills the retirement seam and feeds the aggregate the right per-pilot
> counting series.

## Original Business Requirement

_Verbatim from `requirements/[User-story-30]retire-and-reinstate-pilots.md`._

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

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Retirement state seam** (`apps/base/src/roster/state-providers.ts`,
  `RetirementStateProvider` / `NothingRetiredProvider`; wired in
  `apps/base/src/app.ts` as `retirementStateProvider`). Retired state is already
  modelled as **owned by Area 5.5 outright** — "never stored on the roster entry;
  views query it at read time". `RosterService.toView` already stamps
  `RosterEntryView.retired` from `getRetiredEntryIds(competitionId)`, and the
  roster remove/replace guards already refuse to touch a retired entry
  (`roster/errors.ts`: "roster editing can never touch a retired entry… that path
  is CD retirement + re-draw, Area 5.5"). **This story supplies the real provider
  and the retire/reinstate write surface** the seam was planted for — no roster
  reshape, AC7's "roster reflects the state" is already structurally provided once
  the provider answers from real events.
- **Draw generation & anti-repeat matrix** (`packages/shared/src/draw.ts`;
  `apps/base/src/draw/service.ts`, STORY-001-009). The `DrawSpecification`
  (fairness metric, anti-repeat intent, lane policy) and the materialised
  `GeneratedDraw` / `RoundDraw` / `FlightGroup` outcome. Keys on **`rosterEntryId`**
  (RD4), and `FlightGroup.lonePilotFlagged` already marks an arithmetically
  unavoidable singleton. The remaining-round re-draw **reuses this generator over
  the reduced/expanded pilot set** for the unflown rounds only.
- **Effective-composition overlay** (`draw.ts` `EffectiveRound` /
  `EffectiveGroupsView`; `DrawProjection`, STORY-001-011). The "latest overlay
  wins, never rewrite the stored `draw.generated`/`draw.accepted`" discipline —
  the natural home for "these rounds' groups were regenerated to exclude/include a
  pilot" without mutating the accepted draw.
- **Final aggregate** (`packages/shared/src/scoring.ts`,
  `computeFinalAggregate` / `AggregateInput`). Already applies drop-worst
  **per series** (`series.length > dropWorst.threshold` → drop one lowest) with
  `penaltyTotal` tracked **outside** the series. Because the threshold test is
  per-series, a pilot with fewer counting rounds naturally gets no drop — the
  retired-window exclusion (AC5) is expressed by **which round scores enter that
  pilot's series**, not by new arithmetic.
- **Contest Class Model** (`packages/shared/src/class-model.ts`,
  `dropWorst: DropWorstRule`). The generic drop-worst count AC5/NFR read; F3J is
  `{7, round}`. No discipline branch.
- **Captured results & per-pilot binding** (`scoring.ts` `CapturedFlightResult`;
  `EntryScoresProvider` contract). Results record the **pilotId at capture time**
  and "aggregate per pilot, never transfer with a replaced seat" — the same
  discipline that lets a retired pilot's already-scored rounds keep counting (AC3).
- **Immutable event log & attribution** (`packages/shared/src/events.ts`,
  `attribution.ts`, D4/D1). Per-competition content facts file under
  `scope = competitionId`; actor + CD-authority ride the record, recorded not
  enforced.
- **Lone-pilot behaviour** (`class-model.ts` `LonePilotBehaviour`; `scoring.ts`
  `eligibleOtherPilots`; `events.ts` `LonePilotResolvedPayload`,
  `AnnulmentOverrideRequestedPayload`, STORY-001-011). The dummy/annul safeguard
  the re-draw falls back to (AC6).

### New Concepts Required

- **Retirement / Reinstatement fact**: an attributable event pair
  (`(competitionId, rosterEntryId, actor, CD-authority, effective-from-round,
  reason?, timestamp)`) recorded in the log, from which `getRetiredEntryIds` and
  the "retired across which rounds" window are **derived on read** (never a stored
  flag — mirrors how the draw acceptance and lone-pilot facts are projected).
  Relates the existing roster seat to a lifecycle-scoped retired/active status.
- **Remaining-round re-draw fact**: the materialised regeneration of the
  **unflown** rounds' groups over the changed pilot set, recorded so replay
  reproduces it (Safeguard 3 — the full outcome, never an RNG seed, matching
  `draw.generated`). Overlays the accepted draw for those rounds; never touches
  scored rounds. Relates to `GeneratedDraw`/`EffectiveRound`.
- **Retired-window round eligibility (per pilot)**: the derived set of rounds a
  given pilot **could fly** — all rounds minus those flown wholly within a window
  where they were retired. This set, not the raw round list, is what assembles
  that pilot's `series` into `computeFinalAggregate` (AC5). A read-side selector,
  not stored state.

### Key Business Rules

- **Retire re-draws only the unflown remaining rounds; scored rounds are frozen**
  (AC1) — governs the re-draw scope and the overlay-not-rewrite discipline.
- **Re-draw honours the original anti-repeat/fairness intent for remaining pilots**
  (AC2) — governs reuse of STORY-001-009 generation/spec, not a new algorithm.
- **Retired pilot's scored rounds and penalties are retained; prior normalisation
  unaffected** (AC3) — governs the per-pilot series assembly and penalty carry
  (STORY-001-029 interplay).
- **Reinstate re-draws the still-unflown rounds to re-include** (AC4) — symmetric
  to retire; only unflown rounds change.
- **Retired-window rounds are excluded from aggregate AND not drop-worst-eligible**
  (AC5) — governs the round-eligibility selector feeding each pilot's series;
  drop-worst count read generically from the model.
- **Re-draw avoids a lone scoring pilot where it can, else the class safeguard**
  (AC6) — governs the re-draw's group-feasibility handling and the dummy/annul
  fallback.
- **Every retire/reinstate is attributable; roster reflects retired state and does
  not silently re-add** (AC7) — governs the event payload and the roster view.

## Strategic Approach

### Solution Direction

Add a thin **retirement authority layer** that records retire/reinstate as
immutable, attributable events, and (b) an implementation of the already-planted
`RetirementStateProvider` that projects those events, and (c) a
**remaining-round re-draw** that reuses STORY-001-009's generator over the changed
pilot set for the **unflown** rounds only, recorded as an overlay/regeneration
fact that never rewrites the accepted draw or any scored round. The retired-window
exclusion (AC5) is delivered on the **read side**: a per-pilot round-eligibility
selector filters which round scores enter that pilot's `series` before it is
handed to the existing `computeFinalAggregate` — no new arithmetic, and the
per-series drop-worst test the pure function already performs then naturally
applies the class count only to rounds the pilot could fly. Data flow mirrors the
rest of the base: append attributable event → replay/project → derive current
retired set, effective draw, and final classification (never a stored total, D4).

### Key Design Decisions

- **Retired state as projected events vs. a stored roster flag**: → events,
  projected through the existing `RetirementStateProvider` seam. The seam's own
  comment mandates "never stored on the roster entry; views query it at read time",
  and D4 makes the log authoritative. Trade-off: recompute-on-read vs.
  auditability/replay — at ≤20 pilots/≤8 rounds the cost is negligible.
- **Re-draw as an overlay/regeneration fact vs. rewriting `draw.accepted`**: →
  overlay, matching STORY-001-011's "latest overlay wins, never rewrite the stored
  payload". Preserves the accepted draw and every scored round verbatim (AC1) and
  keeps replay honest. Trade-off: the effective-composition read must compose the
  base draw with retirement re-draw facts for unflown rounds; the overlay
  machinery for that already exists.
- **Retired-window exclusion on the read/series-assembly side vs. writing zeros**:
  → exclude the round from the pilot's series entirely; **do not** write a zero.
  This is the resolved rule (CD doc item 3): a retired pilot had no slot, unlike a
  did-not-fly no-score (Area 5.7) which *does* zero at round end. Modelling it as
  "round not in this pilot's eligible set" makes AC5 fall out of the existing
  per-series drop-worst test. Trade-off: the series-assembly projection must know
  each pilot's retired window; that window is derivable from the same retirement
  events.
- **Reuse STORY-001-009 generation unchanged vs. a bespoke partial-redraw**: →
  reuse. The story explicitly scopes the algorithm out; feeding the generator the
  reduced/expanded pilot set and the unflown round range is the integration, not a
  new draw engine. The generator already emits `lonePilotFlagged` and the spec
  carries the fairness metric, so AC2/AC6 reuse existing surfaces.
- **Effective-from-round boundary**: → retire/reinstate takes effect from the next
  **unflown** round; already-scored (and in-progress, see risks) rounds are the
  boundary. Keeps AC1/AC4 unambiguous at clean round boundaries.

### Alternatives Considered

- **Store a `retired` boolean on `RosterEntry`**: rejected — contradicts the seam
  contract and D4, and would desync from reinstatement; the read-time projection is
  the established pattern.
- **Zero the retired-window rounds instead of excluding them**: rejected — AC5 is
  explicit that those rounds must not count and must not be drop-worst-eligible; a
  zero *would* count as a flown round toward the drop-worst threshold and could be
  absorbed by the drop, defeating the had-no-chance-to-fly intent.
- **Regenerate the whole draw (all rounds) on retirement**: rejected — would
  disturb scored rounds and every remaining pilot's history, contradicting AC1 and
  the anti-repeat continuity AC2 wants preserved.
- **Treat retirement as a readiness move (no re-draw)**: rejected — that is
  STORY-001-028's deliberate opposite; the two must stay observably distinct
  because they recompute in opposite ways.

## Risk & Gap Analysis

### FAI-rule conformance (house rule 1)

The FAI source docs (`docs/requirements/rules/`) are **silent on mid-contest
retirement and reinstatement** — `00-general-rules.md` scopes only the draw
(§1), captured data (§2), normalisation (§3), round/final classification and
drop-worst (§4–5), penalties (§6) and re-flights (§7). Retire/reinstate is
therefore a **product-level running decision**, constrained only by the draw and
scoring rules that *do* exist. Checked against those:

| Rule | Story behaviour | Conforms? |
|------|-----------------|-----------|
| §1 draw / anti-repeat ("group composition changes every round… any two pilots meet as few times as possible") | Remaining-round re-draw reuses the same anti-repeat generation for the pilots who remain | Yes — honours the same intent, does not contravene |
| §3 no auto-1000 / lone-pilot | Re-draw avoids a single scoring pilot where it can, else the class dummy/annul safeguard | Yes — never hands an unearned 1000 |
| §5 aggregate = sum of round scores; drop-worst once "more than N rounds flown"; penalties retained even if the round is dropped | Scored rounds sum; penalties retained (AC3); per-pilot series feeds the same drop test | Yes |
| §6 penalties cumulative, deducted from final, floor at zero | Retained for a retired pilot (delegated to STORY-001-029) | Yes |

The one interpretive point is **AC5**: whether "more than N rounds flown" counts
rounds the *contest* flew or rounds the *pilot* could fly for a reinstated pilot.
The rule docs do not address a pilot who was formally removed from the draw for
part of the contest, so neither reading contravenes them. The story chooses "only
rounds they could fly", which was **explicitly resolved with the user (CD user-story
doc item 3, marked resolved-and-applied)** and matches the code's per-series drop
test. **No FAI-rule contradiction.**

### Cross-reference against existing requirements (house rule 2)

- **high-level-requirements Area 5.5** ("Retire a pilot and re-draw remaining
  rounds to exclude them; reinstate if needed") — the story is a faithful,
  more-detailed expansion. **Consistent, no contradiction.**
- **CD user-story §5.5** — identical ACs (re-draw remaining, preserve scored,
  retain penalties, retired-window exclusion, lone-pilot avoidance, attributable,
  roster reflects). Its "Conflicts & questions" item 3 records the retired-window
  rule as **resolved and applied**. **Consistent.**
- **STORY-001-028 readiness move (no re-draw)** — the deliberate contrast, called
  out in both docs; high-level 5.3 explicitly says the readiness move "does not
  regenerate the draw… (contrast 5.5 Pilot Retirement, which *does* re-draw)".
  **No conflict — the distinction is intended and preserved.**
- **STORY-001-005 roster / `RosterEntryView.retired` + retirement seam** — this
  story provides the real provider the seam already expects; the roster remove/
  replace guards already defer retirement to Area 5.5. **This is the intended
  fill-in, not a duplication.**
- **STORY-001-029 penalties** — AC3 relies on penalty retention; 029 owns
  imposition and the retain-across-drop invariant. **Complementary, no overlap** —
  030 only asserts penalties survive for a retired pilot.
- **STORY-001-007/016 scoring & class model** — 030 defines round *eligibility*;
  007/016 own the maths and the drop-worst count. **Complementary.**
- **Area 5.7 no-score resolution** — a retired pilot's excluded rounds are **not**
  the same as a did-not-fly no-score that zeroes at round end. The two are
  distinct-by-design (retirement removes the pilot from the draw; a no-score is a
  pilot still in the draw who didn't fly a group). Worth surfacing so the
  series-assembly logic never routes an excluded round through the 5.7 zero path;
  **not a contradiction.**

No unresolved contradiction or duplication found.

### Requirement Ambiguities

- **Mid-round retirement boundary**: "remaining, unflown rounds" is clean when
  retirement happens at a round boundary (AC1/AC4 both use one). If a pilot retires
  while the current round is partly flown (some groups scored, some not), is that
  round "flown" for the re-draw, and is the retiring pilot's own current-round
  status a score, a no-score, or excluded? Reasonable default: the re-draw acts on
  fully-unflown rounds; the in-progress round is resolved by the existing no-score/
  readiness tools (Area 5.7). Note for REASONS Canvas; not blocking.
- **Does a permanently-retired (never reinstated) pilot appear in the final
  classification?** The story implies yes (aggregate over their scored rounds) —
  retirement is not a disqualification (contrast STORY-001-029 DQ). Reasonable
  default; note, not blocking.
- **Reinstatement re-draw and already-generated-but-unflown future rounds**: if the
  original draw materialised all rounds up front, reinstatement re-draws the
  still-unflown ones. Confirm "unflown" is derived from scored-round facts
  (group.scored / captured results), not from a fixed round pointer. Default is the
  event-derived reading; not blocking.

### Edge Cases

- **Retire then reinstate the same pilot before any intervening round is flown**:
  the retired window is empty, so no rounds are excluded — the two re-draws net out.
- **Multiple pilots retired (and some reinstated) with overlapping windows**: each
  pilot's eligible-round set is independent; the re-draw pilot set is the union of
  currently-active pilots per round.
- **Retirement that drops the roster below the class per-group minimum / two-group
  floor** (`minGroupSize`, `allowSingleGroup`): the re-draw must degrade to the
  lone-pilot safeguard or a single-group draw, reusing STORY-001-009/022 warnings —
  don't silently produce an infeasible draw.
- **F3B (`unit: "task"`, `lonePilotBehaviour: "annul"`)**: retired-window exclusion
  operates on task-partial series; the re-draw's lone-pilot fallback is annul-and-warn,
  not a dummy (AC6). Confirm the generic path carries F3B through unchanged.
- **Retired pilot who had a granted-but-unflown re-flight or a pending penalty**:
  the re-flight entitlement in an unflown round should lapse with the re-draw; the
  penalty is retained (AC3). Worth an explicit test.
- **Reinstated pilot whose eligible-round count crosses the drop-worst threshold
  differently from the field** (e.g. flies 4 of 8 rounds while others fly 8): the
  per-series drop test already handles this — verify the series contains only
  eligible rounds.
- **Contest-level minimum-for-valid-contest** interaction (STORY-001-026): the
  per-pilot exclusion does not change the contest's completed-round count; keep the
  two concerns separate.

### Technical Risks

- **The remaining-round re-draw must integrate STORY-001-009 generation without a
  new engine.** Risk: the generator is written for a from-scratch full draw; feeding
  it a subset of rounds + a changed pilot set while preserving anti-repeat continuity
  with already-flown rounds needs care (AC2). Mitigation: reuse the spec + matrix,
  seed the anti-repeat state from the scored rounds' pairings; verify the seam in
  REASONS Canvas.
- **"Flown vs unflown" and "retired across which rounds" are both derived facts.**
  Risk: no single stored round pointer — they come from group.scored / captured
  results and retire/reinstate events. Mitigation: define the derivation explicitly
  and deterministically (replay-stable, D4).
- **Series-assembly / final-classification projection may not yet exist** (per the
  STORY-001-029 analysis, `computeFinalAggregate` is unit-tested but the per-pilot
  classification projection is still being built there). Risk of building it twice.
  Mitigation: share the per-pilot series-assembly layer with 029; 030 adds the
  round-eligibility filter to it rather than a parallel projection.
- **Overlay composition order**: retirement re-draw facts, readiness moves (028),
  and re-flight prep (011) all overlay the accepted draw. Risk of conflicting
  overlays on the same round/task. Mitigation: define precedence (latest-wins is the
  existing rule) and guard against a readiness move into a round later re-drawn.
- **Actor / CD-authority recording (D1)**: recorded not enforced — payload carries
  the acting person + CD marker without a permission gate. Low risk; mirrors 027/028/029.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Retire re-draws unflown rounds 4–6, scored 1–3 preserved | Yes | Overlay/regeneration fact over unflown rounds; never rewrites accepted draw or scored rounds. |
| AC2 | Re-draw honours anti-repeat/fairness intent | Yes | Reuse STORY-001-009 spec + matrix; seed anti-repeat from scored-round pairings — verify seam in REASONS Canvas. |
| AC3 | Retired pilot's scored rounds count, penalties retained, prior normalisation unaffected | Yes | Per-pilot series over scored rounds; penalty carry via STORY-001-029; other groups untouched by construction. |
| AC4 | Reinstate re-draws remaining unflown round 6, rounds 1–5 preserved | Yes | Symmetric to AC1; "unflown" derived from event facts. |
| AC5 | Retired-window rounds excluded from aggregate and not drop-worst-eligible | Yes | Read-side round-eligibility selector feeds the series; per-series drop test already applies the class count only to eligible rounds — no new maths. |
| AC6 | Re-draw avoids lone scoring pilot, else class safeguard | Yes | Reuse `lonePilotFlagged` + `LonePilotBehaviour` (dummy / F3B annul-and-warn); no auto-1000. |
| AC7 | Retire/reinstate attributable, roster reflects state, no silent re-add | Yes | Attributable events (D1/D4); real `RetirementStateProvider` feeds the existing `RosterEntryView.retired`. |

**Overall**: all 7 ACs are addressable with the reuse-and-overlay approach. No AC
requires a human decision before design. No FAI-rule contradiction (the source
docs are silent on retire/reinstate and the draw/scoring/penalty rules that do
apply are honoured); the one interpretive point (AC5 retired-window exclusion) was
explicitly resolved with the user and recorded. No unresolved contradiction or
duplication against existing requirements — the story fills the pre-planted
retirement seam and stays complementary to STORY-001-007/016/028/029. Residual
items (mid-round boundary, projection-sharing with 029, overlay precedence) are
normal design risks for the REASONS Canvas, not blockers.
