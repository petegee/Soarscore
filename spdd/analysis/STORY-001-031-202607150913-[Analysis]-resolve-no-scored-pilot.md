# SPDD Analysis: Resolve a No-Scored (Did-Not-Fly) Pilot

> **A thin resolution-policy story sitting on top of a stack that is not yet
> built.** Code exploration confirms the substrate this story needs (immutable
> event log, projections, on-demand scoring recompute) exists, but **none of the
> no-score machinery does**: there is no did-not-fly state anywhere in
> `packages/shared` or `apps/base`, no `competition.roundAdvanced` emitter (the
> lifecycle type is declared but nothing appends it, so `completedRounds` reads
> 0), and none of this story's three named collaborators — the readiness move
> (STORY-001-028), retirement (STORY-001-030), and the run-control / prep-gate
> release (STORY-001-032) plus the round-advance gate (STORY-001-043) — has
> landed. The confusingly-named `NoScoresYetProvider` in the codebase is a stub
> about *whether any captured scores exist yet*, unrelated to the did-not-fly
> "no-score" this story governs. The story's genuinely new, ownable core is
> therefore small and sharp: **a distinct per-(pilot, round) no-score state**,
> **the single end-of-round auto-conversion to zero**, and **one clause added to
> the round-advance interlock** ("no-score still movable"). Everything else it
> *routes to* rather than builds.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-31]resolve-no-scored-pilot.md`.

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

---

## Domain Concept Identification

This story is a **policy layer** that names a state (the no-score), defines the
one automatic transition out of it (end-of-round zero), and routes its manual
resolutions to two sibling stories. Code exploration shows the *substrate* is
mature but the *no-score domain itself is entirely greenfield* — and, notably,
so are all three collaborator stories it "reuses". The concept map below is
therefore heavier on new concepts than a mid-stack story usually is.

#### Existing Concepts (from codebase)

- **The immutable event log & projections** (`apps/base/src/eventstore/
  event-store.ts`, `DrawProjection`, `ScoringProjection`, `LifecycleProjection`):
  the append-only, supersede-on-repeat, replay-from-log substrate every new
  fact obeys (D4). The no-score state, its resolution and its auto-zero must all
  be **derived from events**, never a mutated row — the same discipline
  STORY-001-028's analysis emphasised.
- **`ScoringService` group-score recompute** (`apps/base/src/scoring/`,
  `getGroupScore`): records `scoring.resultCaptured`, recomputes group
  normalisation on demand (which-score-counts, lone-pilot dummy, F3B annulment).
  A **zero is already a scored raw value** here — the "observably distinct from a
  zero" half of AC1 leans on the fact that a captured zero result is a
  `scoring.resultCaptured` fact, whereas a no-score is the *absence* of any
  captured result plus a distinct did-not-fly marker.
- **`Attribution` and the CD-authority write precedent** (`DrawService.accept`/
  `cancel`; contrast every scoring route hardcoded `authority: "organiser"`):
  the resolution actions this story records (moved / retired) are
  CD-attributed, extending the same authority-recorded-not-enforced pattern
  (D1) STORY-001-028 introduces for scoring/draw writes.
- **`LifecycleEventType` incl. `"competition.roundAdvanced"`**
  (`packages/shared/src/events.ts`): the round-boundary fact. **Declared but not
  yet emitted** — `ProjectionFinalisationProgressProvider.completedRounds`
  currently reads it and returns 0 because no emitter appends it. The
  end-of-round auto-conversion (AC4) and the advance block (AC5) both hinge on a
  round-end / round-advance event that **does not exist in code yet** (owned by
  the round-advance story, STORY-001-043/044).
- **The state-provider seam pattern** (`apps/base/src/competitions/
  state-providers.ts`: `LockStateProvider`, `CapturedScoresProvider`,
  `StartStateProvider`, wired via `AppOptions`): the codebase's established way
  for one module to consume another module's state through an injected interface
  with a no-op stub, swapped for a real projection with zero rework. This is the
  idiomatic home for a `NoScoreStateProvider` this story would define and the
  round-advance gate (STORY-001-043) would consume — mirroring how Lock exposed
  `isLocked`. **Note the naming trap:** the existing `NoScoresYetProvider` is
  about *whether captured scores exist yet*, **not** the did-not-fly no-score;
  the new concept must not be conflated with it.

#### New Concepts Required

- **No-score state — a distinct per-(pilot, round) did-not-fly marker.** The
  spine of the story. A first-class state, *not* a score value, distinguishable
  from both "no result captured yet" and "captured zero result". Created
  elsewhere (Scorer 5.0.4 / CD prep-gate release, STORY-001-032) but this story
  owns its **representation, recognition predicate and lifecycle** (unresolved →
  resolved-by-move / resolved-by-retire / auto-zeroed). Likely an event
  (e.g. a `noScore.recorded`-shaped fact appended by the creators) whose current
  status the projection derives from later superseding facts — exactly the
  pending-then-resolved pattern STORY-001-028 uses for approvals.
- **"Groups remain for this pilot" predicate.** The class-agnostic derivation of
  whether the round still has a group the no-scored pilot *could be moved into
  and fly*. Governs AC2 (resolvable), AC4 (auto-zero only when none remain) and
  AC5 (advance blocked while one remains). New, and the subtlest new concept —
  it must account for groups not yet flown, groups the pilot has not already
  flown, and (interaction with STORY-001-028) capacity/clash constraints.
- **End-of-round auto-conversion to zero.** The single automatic transition:
  an unresolved no-score with no remaining group becomes a captured zero result
  at round end, recorded (D4/D10). This is the one place did-not-fly legitimately
  crosses into a scored zero, and it must be idempotent and attributable to the
  system (not a person).
- **Resolution routing (move / retire).** The wiring by which a readiness move
  that lands the pilot in a later group (and yields a captured result) **clears**
  the no-score, and a retirement **resolves** it by retirement — so AC6's
  "resolved no-scores never auto-zero" holds. New *as policy*; the mechanics live
  in STORY-001-028 / STORY-001-030.
- **The "no-score still movable" advance-block clause.** This story's single
  contribution to the round-advance interlock (Area 6.4 / STORY-001-043): an
  outstanding-item category that blocks the advance while a no-score is unresolved
  and still resolvable. New here, consumed by the gate story.

#### Key Business Rules

- **A no-score is not a zero (AC1; general-rules §5/§2).** Did-not-fly is a
  distinct state; a zero is a scored raw value. The distinction is observable and
  must survive replay.
- **Only the end-of-round step converts a no-score to a zero (AC4/AC6; D10).**
  The system never silently zeroes a did-not-fly mid-round; the conversion fires
  exactly once, only for an *unresolved* no-score with *no groups remaining*.
- **A resolved no-score is immune to auto-zero (AC6).** Resolution by move (pilot
  flew, result captured) or retirement removes the no-score from the
  auto-conversion set.
- **The round cannot advance while a no-score is still movable (AC5; Area 6.4).**
  The unresolved-and-resolvable no-score is an outstanding item for the advance
  gate — the pilot is never stranded as a premature silent zero.
- **The did-not-fly-then-zero end state is FAI-consistent (general-rules §2/§5).**
  A competitor who produces no result for the round scores zero for that round,
  and a zero round is an ordinary drop-worst candidate; this story only *defers*
  that zero until the pilot genuinely has no group left — it awards nothing the
  rules forbid.
- **Class-agnostic (CLAUDE.md law, NFR-1/2).** No-score recognition, the
  movable-group predicate, resolution and auto-zero carry no discipline branch;
  drop-worst treatment of the resulting zero is read from the class model
  generically, as elsewhere.
- **Every transition is attributable (D1/D4).** Resolution records the CD action
  (move/retire) with authority; the auto-zero records the system as actor.

---

## Strategic Approach

#### Solution Direction

- **Define the no-score as an event-derived state with a single automatic exit,
  and expose it through a provider seam — build the policy, route the
  mechanics.** Concretely:
  1. **No-score state (AC1):** introduce the did-not-fly fact and a projection
     that derives, per (pilot, round), whether an unresolved no-score stands. Its
     *creators* are STORY-001-032 (pilot-unconfirmed release) and the Scorer's
     *cannot make the group* action; this story defines the event shape and the
     recognition/derivation so those creators have a target to append to. The
     distinction from a zero is structural: a no-score is a did-not-fly marker
     with **no** `scoring.resultCaptured`; a zero **is** a captured result.
  2. **Resolution routing (AC2/AC3/AC6):** a readiness move (STORY-001-028) that
     lands the pilot in a remaining group and results in a captured score clears
     the no-score; a retirement (STORY-001-030) resolves it by retirement. The
     projection reads these as superseding facts so a resolved no-score drops out
     of both the auto-zero set and the advance-block set.
  3. **End-of-round auto-conversion (AC4):** at the round-end / round-advance
     boundary, an unresolved no-score with no remaining movable group is
     converted to a captured **zero** result, recorded with system attribution.
  4. **Advance-block clause (AC5):** expose an "unresolved no-score still movable"
     outstanding-item query the round-advance gate (STORY-001-043) consults —
     mirroring how Lock exposed `isLocked` through a provider.
- **Follow the state-provider seam idiom exactly** (`state-providers.ts`): a
  `NoScoreStateProvider`-style interface with a no-op stub today, swapped for the
  real projection via `AppOptions`, so the round-advance gate and run-control
  override (STORY-001-032's "advance anyway") consume no-score state without
  importing this module. This is the same decoupling `LockStateProvider` and
  `StartStateProvider` already model.
- **Data flow (mirrors the existing accept/cancel and lock projections):**
  creator event (elsewhere) → no-score projection derives unresolved state →
  CD-attributed resolution route (move/retire) appends a superseding fact, or the
  round-end boundary appends the auto-zero → projection recomputes the
  outstanding-item set and the scored result. No RNG, no mutation; status is
  always derived from the latest fact (D4).

#### Key Design Decisions

- **Where the round-end auto-conversion is triggered from.** The auto-zero (AC4)
  must fire "when the round ends", but the `competition.roundAdvanced` emitter
  does not exist yet (owned by STORY-001-043/044). *Trade-off:* this story could
  (a) own the conversion as a step the round-advance action calls, or (b) own only
  the *policy predicate* ("which unresolved no-scores must zero") and let the
  round-advance story invoke it at the boundary. → **Recommendation:** (b) — this
  story defines the conversion rule and exposes it; STORY-001-043/044 invokes it
  at the round boundary it owns. Keeps the story to 3 days and avoids
  co-owning the round-advance emitter. Settle the exact seam in REASONS Canvas.
- **How "groups remain for this pilot" is derived (class-agnostically).**
  *Trade-off:* a naive "any later group in the round is unflown" is too loose (the
  pilot may already have flown, or every remaining group may be full/closed); too
  tight a definition risks stranding a pilot the CD could still place. →
  **Recommendation:** derive from the effective group composition
  (`EffectiveGroupsView` / `GroupCompositionProvider`, the same overlay-aware
  read STORY-001-028's readiness move uses) — a group "remains and is movable-into"
  if it is in this round, not yet flown, and admits a move under 028's rules. This
  keeps the predicate aligned with what a readiness move can actually do.
- **No-score representation: dedicated event vs. reusing a captured-result
  sentinel.** *Trade-off:* a sentinel "no-score" value on `scoring.resultCaptured`
  would collapse the did-not-fly/zero distinction the whole story exists to keep.
  → **Recommendation:** a **dedicated fact** distinct from `scoring.resultCaptured`,
  matching the codebase's one-payload-per-event-type discipline; the zero it may
  later convert to is a separate, ordinary captured-result event. This makes AC1's
  "observably distinct" structural rather than a flag.
- **Auto-zero attribution.** → **Recommendation:** record the auto-conversion with
  **system** attribution (`SYSTEM_ATTRIBUTION`, as the annulment-request fact
  already uses), distinct from the CD-attributed resolutions, so the audit reads
  "system auto-zeroed at round end" versus "CD moved/retired".

#### Alternatives Considered

- **Model the no-score as an immediate zero and "un-zero" it on a move:**
  rejected — it inverts the story's whole premise (D10: never silently zero a
  did-not-fly), forces a mutate-then-revert on the score log, and makes AC1's
  distinction unrepresentable.
- **Let this story own the round-advance gate and its emitter outright:**
  rejected — duplicates STORY-001-043's scope, breaks the story's "contributes
  only the no-score clause" boundary, and would co-own the not-yet-built
  `competition.roundAdvanced` emitter. The provider-seam split keeps ownership
  clean.
- **Fold the "advance anyway" forced-zero (STORY-001-032) and the normal
  end-of-round zero into one path:** rejected — the two share an *outcome*
  (no-score → zero) but have different *triggers* (CD override mid-round vs.
  automatic at round end) and different attribution. Keeping them as two callers
  of one shared conversion rule (owned here) is cleaner than merging them.

---

## Risk & Gap Analysis

#### Requirement Ambiguities

- **"When the round ends" is not a defined moment in code.** There is no
  round-end or `competition.roundAdvanced` event emitted anywhere yet. AC4's
  trigger depends on the round-advance story (STORY-001-043/044) defining that
  boundary. Not a blocker for *this* analysis — the story explicitly forward-
  references Area 6.4, exactly as STORY-001-028 forward-referenced STORY-001-032 —
  but the auto-conversion cannot be exercised end-to-end until that emitter
  lands. Flag for REASONS Canvas: define the conversion as a rule invoked *by*
  the round boundary, not a self-firing timer.
- **"Groups remain in the round for that pilot" needs a precise, movable-aware
  definition.** "Remain" must mean *a group the pilot could actually be moved
  into and fly* — not merely "an unflown group exists". Underspecified in the
  story; resolvable in design by deriving from STORY-001-028's readiness-move
  admissibility (see recommendation). Must be surfaced so it is not implemented
  as a loose "any later group" check.
- **Which resolution facts count as "resolved" for AC6.** A readiness move
  resolves only once it yields a *captured result* (the pilot actually flew); a
  bare move that the pilot then still misses should not immunise them from
  auto-zero. The story says "the pilot flew and was scored" — design must key
  "resolved-by-move" on the captured result, not merely the move.

#### Edge Cases

- **Boundary with STORY-001-032's "advance anyway".** Both convert an unresolved
  no-score to a zero. This story owns the *normal end-of-round* conversion (no
  groups remain); 032 owns the *forced mid-round* conversion (CD override while a
  group might still remain). They must share one conversion primitive and not
  double-append two zeros for the same (pilot, round). Coordination point, not a
  contradiction — both stories scope the other out explicitly.
- **A pilot moved (AC2) into a remaining group who *then* also no-scores that
  group.** The move clears the first no-score, but the pilot could acquire a new
  no-score in the destination group. Each (pilot, round) no-score is a single
  state, so the second occurrence supersedes/re-raises — the predicate must
  handle re-entry, not assume one no-score per pilot per round forever.
- **Auto-zero idempotency on replay/suspend-resume.** The conversion fires "once"
  at round end; replaying the log, or an overnight suspend/resume across a round
  boundary (MVP scope), must not double-convert. Derive-from-events + supersede
  discipline handles this, but it must be tested.
- **A retired pilot who held a no-score (AC3) whose round is later a drop-worst
  candidate.** Retirement (STORY-001-030) already excludes rounds the pilot could
  not fly from their aggregate/drop-worst; a no-score resolved *by retirement*
  must not also leave a stray zero. Interaction with 030's retired-window
  exclusion — verify the no-score is cleared, not converted.
- **Concurrent CD/Organiser actions (D8, last-action-wins).** A resolution
  (move/retire) racing the round-end auto-zero must resolve deterministically —
  a resolved no-score must win over a late auto-zero attempt (AC6), which the
  "auto-zero only touches *unresolved* no-scores" rule enforces if evaluated
  against the latest state.

#### Technical Risks

- **The entire collaborator stack is unbuilt.** STORY-001-028 (readiness move),
  STORY-001-030 (retirement), STORY-001-032 (prep-gate release / advance-anyway),
  STORY-001-043 (advance gate) and the Scorer's *cannot make the group* action all
  do not exist in code yet, and neither does the `competition.roundAdvanced`
  emitter. This story can define and unit-test the no-score state, the
  auto-conversion rule and the provider seam against stubs (the codebase's
  established seam pattern), but its *integration* ACs (AC2 move, AC3 retire, AC5
  advance-block) are only fully exercisable once those siblings land. Mitigation:
  build to the injected-provider seam idiom (`state-providers.ts`) so wiring is
  zero-rework when they arrive — exactly how Lock/Start were staged.
- **First "did-not-fly" state in the scoring domain.** No prior art in
  `packages/shared` or `apps/base`; the new fact type needs its projection fold,
  its `setErrorHandler` branches for rejection reasons ("no no-score to resolve",
  "already resolved"), and additive-on-read defaults (NFR-2) — the same
  discipline `DrawAcceptedPayload.acknowledgedWarningIds` models.
- **Class-agnostic drop-worst of the resulting zero.** The auto-converted zero is
  an ordinary round score fed to the class model's drop-worst; the conversion
  itself must not branch on discipline. Low risk (the zero is just a captured
  result), but assert it.
- **No FAI-rule or cross-requirement contradiction found (house-keeping check).**
  The did-not-fly→zero end state is exactly what `00-general-rules.md §2`
  (no valid result → zero for the round) and §5 (a zero is an ordinary
  drop-worst candidate) prescribe; deferring the zero until the pilot has no
  group left awards nothing the rules forbid and matches the FAI intent of giving
  a competitor a fair chance to produce a result. The story is consistent with
  `high-level-requirements.md` Area 5.7 and `02-contest-director.md` §5.7 (both
  read verbatim — same no-score/zero distinction, same end-of-round conversion,
  same advance block), and with D4/D10. The overlap with STORY-001-032
  ("advance anyway" forced zero) and STORY-001-043 (advance gate) is a documented,
  mutually scoped-out **division of ownership**, not a duplication or conflict.
  **Clean cross-reference.**

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | No-score recognised as distinct from a zero | Yes | Structural: a dedicated did-not-fly fact with no `scoring.resultCaptured`, vs. a captured zero result. New fact + projection; created by siblings, shape owned here. |
| 2 | CD moves a no-scored pilot into a later group (no re-draw) | Partial | Policy/routing addressable now; the readiness-move mechanic is STORY-001-028 (unbuilt). "Cleared" keys on the resulting captured result. Fully exercisable once 028 lands — build to the provider seam. |
| 3 | CD may retire a no-scored pilot | Partial | Routes to STORY-001-030 (unbuilt). Must clear (not zero) the no-score; verify against 030's retired-window exclusion. |
| 4 | Unresolved no-score, no groups remaining, auto-zeroes at round end | Partial | Conversion rule ownable and unit-testable now; the round-end *trigger* (`competition.roundAdvanced`) is owned by STORY-001-043/044 (not emitted yet). Recommend this story own the rule, the round story invoke it. |
| 5 | Round cannot advance while a no-score is still movable | Partial | This story exposes the "unresolved-and-movable" outstanding-item query; the round-advance gate (STORY-001-043) consumes it. Depends on the movable-group predicate being defined precisely. |
| 6 | A resolved no-score does not later auto-zero | Yes | Enforced by "auto-zero only touches *unresolved* no-scores"; resolution supersedes the no-score before the round-end evaluation. Test replay + concurrent-race idempotency. |

---

## Summary of Key Points for REASONS Canvas

1. **The ownable core is small: a distinct no-score state, one auto-conversion
   rule, and one advance-block clause.** Everything else is *routing* to
   STORY-001-028 (move) and STORY-001-030 (retire). Build the policy and the
   provider seam; do not build the mechanics.
2. **Model the no-score as a dedicated event-derived state, never a score
   sentinel** — that is what makes AC1's did-not-fly/zero distinction structural
   and survive replay. The zero it may become is a separate ordinary captured
   result.
3. **Own the conversion *rule*, let the round-advance story (STORY-001-043/044)
   invoke it at the round boundary** — the `competition.roundAdvanced` emitter is
   declared but not yet appended; do not co-own it.
4. **Define "groups remain for this pilot" via STORY-001-028's readiness-move
   admissibility** (effective, overlay-aware composition), not a loose "any later
   group" check — it governs AC2/AC4/AC5.
5. **Use the `state-providers.ts` seam idiom** (a `NoScoreStateProvider` with a
   no-op stub, wired via `AppOptions`) so the advance gate and the "advance
   anyway" override consume no-score state with zero rework — and **do not conflate
   with the existing `NoScoresYetProvider`**, which is about captured-scores-exist,
   not did-not-fly.
6. **Share one conversion primitive with STORY-001-032's "advance anyway"** (same
   outcome, different trigger/attribution); guard against double-zeroing a
   (pilot, round). Record the normal end-of-round conversion with **system**
   attribution, CD resolutions with **CD** attribution.
7. **No FAI-rule or existing-requirement conflict** — the did-not-fly→zero end
   state matches `00-general-rules.md §2/§5`; consistent with Area 5.7, the CD
   user story §5.7, and D4/D10; the 032/043 overlap is a documented ownership
   split. Clean.
