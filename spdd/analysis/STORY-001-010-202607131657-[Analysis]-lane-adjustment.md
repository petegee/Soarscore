# SPDD Analysis: Manual Lane Adjustment After the Draw

## Original Business Requirement

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

## Domain Concept Identification

#### Existing Concepts (from codebase)

- `GeneratedDraw` (`packages/shared/src/draw.ts`): the fully materialised
  draw outcome — `rounds[].groups[].members[]` and, since STORY-001-020,
  `rounds[].taskGroups[].groups[].members[]`. This is the object whose
  `lane` values AC2/AC3 want adjusted. It is promoted, not copied, into the
  `accepted` slot of `DrawProjection` when `draw.accepted` fires — the
  service and projection currently treat it as a read-only, fully-formed
  snapshot once accepted.
- `GroupMembership` (`packages/shared/src/draw.ts`): `{ rosterEntryId, lane }`
  — one seat's group membership plus its explicit integer lane. This is the
  exact field the story mutates; `rosterEntryId` (group membership) must stay
  untouched.
- `FlightGroup` (`packages/shared/src/draw.ts`): one group within a round,
  `{ flyingOrder, members, lonePilotFlagged }`. Lane adjustment is scoped to
  the `members` array of one `FlightGroup`, identified by round + group.
- `LaneAllocationPolicy` (`packages/shared/src/draw.ts`): `"rotate" |
  "fixed-by-contest-number" | "random"` — the policy that produced the
  *initial* lanes at generation time (`assignLanes` in
  `apps/base/src/draw/service.ts`). The story's background comment
  ("the lane-allocation policy configured in the draw specification produced
  the initial lanes") explicitly frames STORY-001-010 as the place that gives
  this policy "a concrete anchor" for manual override.
- `DrawService` / `DrawProjection` (`apps/base/src/draw/`): the existing
  append-only event-sourced pattern — `draw.specSaved`, `draw.generated`,
  `draw.accepted`, `draw.cancelled` — each event fully re-derivable, no RNG
  outside `generate()`, immutable log with supersession via new events
  (never in-place mutation of a stored payload). Lane adjustment must follow
  this same pattern: a new event type layered on top of the accepted draw,
  not a rewrite of the `draw.accepted`/`draw.generated` payload.
- `DrawEvidenceView` (`packages/shared/src/draw.ts`): the read-model served
  to clients (`spec`, `candidate`, `accepted`, `status`, `warnings`). AC1
  ("review lanes per group and round") is naturally an extension of this
  view or a sibling read-model over `accepted`.
- `DrawAcceptanceStatus` (`packages/shared/src/draw.ts`): `"no-draw" |
  "awaiting-decision" | "accepted"`. Lane adjustment is explicitly gated on
  `"accepted"` (AC1: "Given an accepted draw...").
- Roster / `rosterEntryId` (`apps/base/src/roster/`): group membership keys
  on `rosterEntryId`, never `pilotId` (RD4, noted in `draw.ts`) so a
  post-draw pilot replacement inherits the slot. Lane adjustment must
  identify pilots the same way.
- `Attribution` / authority (`apps/base/src/routes/draw.ts`): existing
  `organiser` vs `contest-director` attribution split. The story assigns
  lane adjustment to the **Organiser** (matching Area 4.4), distinct from
  the Contest Director actions (`accept`/`cancel`) already in the module.
- `DomainError` / per-domain error classes (`apps/base/src/draw/errors.ts`):
  the established idiom — one subclass per rejection reason, each wired to
  exactly one `setErrorHandler` branch in `app.ts` (missing branch = release
  blocker, "Safeguard 8"). A new "lane clash" rejection needs its own error
  class in this style.
- Draw reports (STORY-001-015, not yet implemented — no code found under
  that name): explicitly named as a downstream consumer that "must reflect
  adjustments" and "reprints reflecting current lane allocations." Confirms
  lane adjustment output must be visible to whatever reads the accepted draw
  for printing.
- Per-task grouping (STORY-001-020, `TaskGroupSet`): each task
  (e.g. F3B's Duration/Distance/Speed) now carries its **own independent**
  `FlightGroup[]` with its own `members[].lane` values, computed by its own
  independent draw attempt. `RoundDraw.groups` is a back-compat flat view
  that always equals `taskGroups[0].groups` "by construction." This is a
  concept that postdates the original story text (which predates
  STORY-001-020) and is not addressed by it at all — see Risk & Gap
  Analysis.

#### New Concepts Required

- **Lane Adjustment (event/record)**: a new, explicitly-scoped mutation of
  one seat's `lane` within one round's one group of the accepted draw,
  leaving `rosterEntryId` membership, `flyingOrder`, and every other round
  untouched. Needs its own event type (e.g. `draw.laneAdjusted`) appended to
  the existing per-competition event scope, applied by `DrawProjection` as a
  layered overlay on the promoted `accepted` `GeneratedDraw` — not a rewrite
  of the `draw.accepted`/`draw.generated` payloads (those remain the
  historical, replayable record of what was generated/accepted).
- **Lane Clash Check**: a new validation concept — "two pilots in one lane"
  and "a required lane left empty" — that does not exist anywhere in the
  codebase yet (`grep` for "clash" found only requirement/user-story prose,
  no implementation). Needs a definition of "required lane": is it the
  group's `1..size` contiguous range (implied by `assignLanes`' `1..size`
  lane numbering), or something configurable? The story assumes lanes are a
  fixed, enumerable set per group that must be fully and uniquely occupied.
- **Lane Adjustment read-model / evidence**: AC1's "review lanes per group
  and round" implies either extending `DrawEvidenceView` or a new endpoint
  that exposes the *current effective* lanes (accepted draw's original
  lanes, overlaid with any adjustments) — distinct from the raw accepted
  payload, so a client never has to reconstruct the overlay itself.

#### Key Business Rules

- **Membership immutability**: a lane adjustment must never change
  `rosterEntryId` membership of any `FlightGroup` — governs
  `GroupMembership`/`FlightGroup`.
- **Round isolation**: a lane adjustment to round 3 must not affect any
  other round's stored lanes — governs `RoundDraw`.
- **Uniqueness within a group**: no two `GroupMembership` entries in the
  same `FlightGroup` may share a `lane` value after the adjustment —
  governs `FlightGroup.members`.
- **Completeness within a group**: every lane in the group's required lane
  set must be occupied (no gaps) after the adjustment — governs
  `FlightGroup.members`, and requires a definition of the group's lane set
  (see New Concepts above).
- **Accepted-draw gating**: lane adjustment operates only on an accepted
  draw (`DrawAcceptanceStatus === "accepted"`); it is implicitly a
  post-acceptance workflow distinct from the pre-acceptance
  generate/accept/cancel cycle — governs `DrawEvidenceView.status`.
- **Anti-repeat matrix untouched**: because membership never changes, the
  `MatchupDistribution`/`MeetCount` evidence the Contest Director already
  accepted remains valid and does not need recomputation after a lane
  adjustment — governs `MatchupDistribution`.
- **Auditability**: per CLAUDE.md's trust model ("immutable event log of all
  mutations provides auditability"), every lane adjustment must be its own
  attributed event, not an edit to the `draw.accepted` record — governs the
  event-sourcing pattern across `DrawService`/`DrawProjection`.

## Strategic Approach

#### Solution Direction

- Extend the existing `apps/base/src/draw/` module (service + projection +
  routes + errors) rather than create a new module — lane adjustment is a
  narrow, tightly-coupled extension of the accepted-draw concept the draw
  module already owns.
- Data flow mirrors the existing accept/cancel pattern: `PUT`/`POST`
  `/api/competitions/:competitionId/draw/lanes` (or similar) → `DrawService`
  method → clash-check against the *current effective* lane state (accepted
  draw + prior adjustments) → on success, append a new `draw.laneAdjusted`
  event (Organiser attribution) → `DrawProjection` applies it as an overlay
  → return the updated evidence/read-model. On failure (clash), append
  nothing and throw a new domain error (mirroring
  `DrawGroupSizeWarningUnacknowledgedError`'s 409-style "conflicts with
  current state" idiom).
- The projection should **not** mutate the historical `draw.accepted`
  snapshot in place. Instead it should track adjustments as a separate,
  replayable overlay (e.g. a map keyed by competitionId → round → group →
  rosterEntryId → lane) and compose the *effective* draw
  (accepted-with-adjustments) on read — consistent with the "pure loader,
  no mutation of stored facts" discipline already documented in
  `DrawProjection`'s header comment.

#### Key Design Decisions

- **Scope of adjustment relative to per-task grouping (STORY-001-020)**:
  since a round now carries `taskGroups[]` (one independent grouping per
  task, each with its own lanes), lane adjustment must decide whether it
  targets (a) the single flat `RoundDraw.groups` view only (pre-020
  semantics, now stale for multi-task classes), (b) one specific task's
  `TaskGroupSet.groups`, or (c) all tasks' groupings simultaneously via some
  shared lane concept. → **Recommendation**: target one task's
  `TaskGroupSet.groups` per adjustment call (parameterised by `taskId`,
  defaulting to the class's single task for single-task classes), because
  each task's groups are independently drawn and a pilot's `rosterEntryId`
  membership — and therefore lane numbering range — legitimately differs
  per task for F3B. This must be confirmed with the user/product owner
  since the original story predates STORY-001-020 and never mentions tasks.
- **Overlay vs. rewrite persistence**: append lane adjustments as their own
  event type layered over `draw.accepted`'s promoted snapshot, vs.
  re-appending a full `draw.accepted`-equivalent payload with the lane
  changed. → **Recommendation**: overlay (small, targeted event per
  adjustment: `{ competitionId, drawId, roundNumber, taskId?, rosterEntryId,
  fromLane, toLane }`), because it (a) keeps the event log human-auditable
  ("Jane Smith moved lane 2→5 in round 3"), (b) avoids re-serialising the
  entire `GeneratedDraw` payload on every lane tweak, and (c) matches the
  codebase's existing preference for small, purpose-named events
  (`draw.specSaved`, `draw.generated`, `draw.accepted`, `draw.cancelled`)
  over monolithic snapshot replacement.
- **"Required lane" definition for clash detection**: AC3 says "a required
  lane left empty" is a clash. → **Recommendation**: define the group's
  required lane set as `1..members.length` (the same contiguous range
  `assignLanes` already produces at generation time), so completeness means
  every seat in the group occupies a distinct lane in that range — this
  needs no new configuration concept and is derivable purely from the
  group's existing member count.
- **Where lane adjustment is exposed to the Organiser**: as a dedicated
  lane-review screen/read-model vs. folded into the existing draw evidence
  view. → **Recommendation**: a dedicated read-model/endpoint
  (`GET .../draw/lanes` or an extension field on `DrawEvidenceView`) that
  returns the *effective* per-round, per-group lane assignment (accepted +
  overlaid adjustments), because `DrawEvidenceView` today is oriented around
  the pre-acceptance generate/accept/cancel workflow and mixing in a
  fundamentally different post-acceptance capability would blur that
  read-model's existing single purpose.

#### Alternatives Considered

- **Rewriting the accepted draw's stored payload directly** (mutate
  `GroupMembership.lane` inside the `draw.accepted` event's referenced
  `draw.generated` payload): rejected — the event log is documented as
  immutable/append-only (CLAUDE.md trust model, `DrawProjection`'s own
  "never overwrite in place" convention for candidates), and the
  `draw.generated` payload is also the historical evidence of what the
  fairness algorithm actually produced; overwriting it would corrupt replay
  history and the audit trail.
- **Treating lane adjustment as a special case of STORY-001-011's group
  management**: rejected — the story explicitly scopes this out ("Moving
  pilots between groups (STORY-001-011)... group membership changes are
  STORY-001-011, not here") and frames itself as deliberately narrower and
  Organiser-authority rather than Contest-Director-approval-gated, unlike
  most of 011's scope.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Interaction with STORY-001-020 per-task groups is entirely unaddressed.**
  The story (and its source `docs/user-stories/01-organiser.md` §4.4) was
  written before per-task grouping existed. All three ACs use singular
  "group B" language with no task qualifier. For F3B (three independently
  drawn tasks per round, each with its own group composition and lanes),
  it is unclear whether "group B" in round 3 means the same set of pilots
  across all three tasks (it generally will not, since each task's grouping
  is independently optimised) or a specific task's grouping. This is the
  single largest open question and should block starting the REASONS Canvas
  until resolved.
- **Multi-task lane identity**: if lane adjustment is task-scoped, does the
  Organiser adjust lanes once per task per round (3× for F3B), or is there
  an intended single "lane" concept spanning all of a round's tasks (e.g.
  physical PA/speaker lane position that's stable across tasks even though
  group *membership* differs per task)? The background text ("a pilot who
  can't hear the speakers from lane 1") suggests lane is a **physical field
  position**, which argues for a single lane concept per round independent
  of task — but the data model (`GroupMembership.lane` lives inside each
  task's own `FlightGroup.members`) currently ties lane to task-specific
  group membership. This is a real tension between the physical domain
  intent and the current data shape that needs a product decision.
- **"Required lane left empty" — what counts as required?** AC3 states this
  as a clash condition but never defines the required lane set explicitly.
  The recommendation above (contiguous `1..groupSize`) is inferred from
  `assignLanes`, not stated in the requirement.
- **Scope relative to acceptance state**: the story says "after a draw is
  accepted," but does not address whether lane adjustment should also be
  available on a not-yet-accepted **candidate** draw (before CD acceptance)
  — arguably more useful there since it's cheaper to fix pre-acceptance.
  AC1's "Given an accepted draw" wording suggests accepted-only, but this
  should be confirmed rather than assumed.
- **Persistence lifetime of adjustments across a subsequent re-draw**: Area
  4.3 re-draw is Contest Director authority and out of scope here, but the
  requirement doesn't say what happens to previously-applied lane
  adjustments if the Contest Director later re-draws or the accepted draw
  is superseded. Given the current model has no "un-accept" path, this may
  be moot for MVP, but should be explicitly confirmed as out of scope rather
  than silently assumed.

#### Edge Cases

- Adjusting a pilot's lane to the lane currently vacated by another pilot's
  simultaneous move (a same-request swap) — is this one atomic operation
  (swap both lanes) or two sequential single-pilot moves where the
  intermediate state would itself clash? AC2's example only covers "lane 5
  free," not a genuine two-pilot swap.
- Adjusting a lane for a `lonePilotFlagged` group (a group with a single
  scoring pilot, per STORY-001-009/011): the "required lane left empty"
  rule presumably reduces to a group of size 1, but this should be verified
  against how `lonePilotFlagged` groups are handled elsewhere (e.g.
  STORY-001-011's lone-pilot dummy insertion).
- A `rosterEntryId` that was replaced post-draw (RD4: replacements inherit
  slots) — does an in-flight lane adjustment still resolve correctly against
  the current occupant, given lane adjustment presumably references
  `rosterEntryId` too?
- Concurrent lane adjustments from two Organiser sessions on the same
  round/group — no optimistic-concurrency precedent exists yet for this
  kind of overlay event (contrast with `draw.accepted`'s `drawId` staleness
  check, `DrawCandidateSupersededError`); a similar staleness guard may be
  needed here.
- Lane adjustment after draw reports (STORY-001-015, not yet built) have
  already been printed — out of scope for this story's implementation but
  worth flagging since the story explicitly claims reprints will reflect
  adjustments, implying report generation must always read the *effective*
  (adjusted) lane state, not the original accepted snapshot.

#### Technical Risks

- **Read-model composition cost**: computing the "effective" lane state
  (accepted snapshot + N adjustment events) on every read is cheap at MVP
  scale (≤ 20 pilots, ≤ 8 rounds) but the overlay-map design needs to be
  keyed carefully (competitionId → roundNumber → taskId → rosterEntryId) to
  avoid cross-task or cross-round leakage, mirroring the scoping care
  already visible in `DrawProjection.apply`.
- **New error/HTTP-status class needed**: a "lane clash" rejection doesn't
  map cleanly onto any existing `apps/base/src/draw/errors.ts` class; a new
  `LaneClashError` (or similar) needs its own `setErrorHandler` branch in
  `app.ts`, and the existing codebase treats a missing branch as a release
  blocker ("Safeguard 8") — this must not be forgotten during generation.
- **Backward compatibility on replay**: like `DrawProjection.copyDraw`'s
  existing `?? []` guards for pre-STORY-001-020/022 payloads, any new
  overlay-map projection state must default cleanly when replaying an event
  log that predates the lane-adjustment event type (D4's replay-safety
  discipline).
- **Denormalised `taskName`/`taskId` consistency**: if adjustments are
  task-scoped, the event payload should probably carry `taskId` (and
  possibly `taskName`, matching the codebase's existing denormalisation
  precedent for `TaskGroupSet`/`TaskMatchupDistribution`) so the event
  remains self-describing even if the class model is later edited.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Review each pilot's lane within their group, for every round of an accepted draw | Partial | Addressable for single-task classes; for multi-task classes (F3B) the requirement's "their group" is ambiguous per the per-task grouping gap above — needs resolution before the read-model shape can be finalized. |
| 2 | Reassigning a pilot's lane changes only that lane; group membership and other rounds are unaffected | Yes | Directly addressable via the overlay-event design; "group membership... unchanged" is satisfied by construction since the design never touches `rosterEntryId`. Still subject to the task-scoping ambiguity above. |
| 3 | Lane clashes (duplicate lane, or a required lane left empty) are flagged and the change is prevented until resolved | Partial | Addressable once "required lane" is defined (recommended: contiguous `1..groupSize`); the requirement itself doesn't define this, so it's an inferred rule rather than a stated one — should be confirmed with the product owner rather than silently assumed. |

## Summary of Open Questions Requiring Human Decision Before REASONS Canvas

1. **(Blocking)** How does lane adjustment interact with STORY-001-020's
   per-task grouping? Is "lane" per-task, or a single physical-field concept
   spanning a round's tasks? This changes the data model and API shape
   materially and the original requirement is silent on it (predates 020).
2. Is lane adjustment available on a not-yet-accepted candidate draw, or
   strictly accepted-only as AC1's wording implies?
3. What is the precise definition of a group's "required lane set" for
   clash detection (recommended: `1..groupSize`, not stated in the
   requirement)?
4. Should a same-request two-pilot lane swap be supported as an atomic
   operation, or must the Organiser perform sequential single moves (which
   would transiently clash under a naive check)?
5. Is any optimistic-concurrency/staleness guard needed for concurrent lane
   adjustments, mirroring `DrawCandidateSupersededError`'s pattern for
   accept/cancel?

## Resolution (2026-07-13, confirmed with product owner)

- **Question 1 (blocking) — resolved.** Lane stays scoped **per task**:
  `GroupMembership.lane` inside each `TaskGroupSet.groups[].members[]`, per
  the existing data model — no change to STORY-001-020's shape. Rationale:
  because each task's group *composition* is drawn independently, a pilot's
  physical field position legitimately differs across Duration/Distance/Speed
  within the same round even though "lane" is a genuine physical thing on the
  field (not just a bookkeeping index) — the physical station a pilot sits at
  is a function of which group (and therefore which task) they're in for that
  flight, not a single value fixed for the whole round.
- **F3B UX consequence — resolved.** The Organiser selects a task
  (Duration/Distance/Speed) before adjusting lanes for a multi-task class;
  single-task classes have no selector (degenerate case, `model.tasks.length
  === 1`). **No automatic cross-task propagation** — if the same physical
  concern (e.g. "can't hear speakers from lane 1") applies across all three
  tasks, the Organiser applies the fix separately in each task's grouping.
  This matches the original story's 2-day/2-point INVEST estimate; cross-task
  propagation as a convenience is explicitly deferred (Future Enhancement),
  not built now.
- **Questions 2–5 — not separately blocked.** Proceed into REASONS Canvas
  using this analysis's existing recommendations as explicit, stated
  assumptions rather than silent ones: accepted-draw-only (Q2, per AC1's
  literal wording and the "Accepted-draw gating" business rule above);
  required lane set = contiguous `1..groupSize` (Q3); sequential single-move
  semantics with no special atomic-swap operation for MVP (Q4, matching the
  story's "Small/2-day" INVEST sizing); no optimistic-concurrency staleness
  guard for MVP given the trusted-single-Organiser-club scale (Q5, consistent
  with CLAUDE.md's trust model — reversible via a follow-up correction, not
  gated by locking). Canvas should state each of these as a named assumption
  so it's visible and revisitable, not buried.
