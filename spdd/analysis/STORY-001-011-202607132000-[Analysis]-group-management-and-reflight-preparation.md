# SPDD Analysis: Group Management and Re-Flight Preparation

> **The story that reaches past the draw's edge into scoring territory the
> codebase has not built yet.** STORY-001-009 (draw generation) and
> STORY-001-017 (draw acceptance) together produce and commit an accepted
> `GeneratedDraw`; STORY-001-010 (lane adjustment, most recent sibling) showed
> the "overlay a new event type on the accepted draw, never rewrite it"
> pattern this story should also follow for group moves/splits. But three of
> this story's seven ACs (AC5, AC6, AC7) are not really about the draw at
> all — they are about **recomputing scores** once a re-flight or a lone-pilot
> group is captured. That is `packages/shared/src/scoring.ts` territory
> (STORY-001-007's pure normalisation functions), and this analysis's central,
> verified finding is that **nothing in the codebase yet captures a flight
> result or calls `scoring.ts` in anger** — the aggregate those three ACs
> presuppose does not exist. This is not a hunch; it is directly visible in
> the code (see Risk & Gap Analysis) and it materially bounds what this story
> can build now.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-11]group-management-and-reflight-preparation.md`.

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

## Domain Concept Identification

This story splits into two families of very different technical maturity in
the codebase. **Group topology changes** (AC1–AC4) sit squarely on top of the
finished, well-understood draw aggregate (STORY-001-009/010/017) and can
reuse its event-sourced overlay pattern almost verbatim. **Scoring-time
consequences** (AC5–AC7) reference a "captured score" / "which score counts"
/ "group is scored" world that **has no implementation anywhere in the
codebase** — only a pure, uncalled function library (`scoring.ts`) and a
single planted-but-unfilled seam (`EntryScoresProvider`). Both families are
explicit in the requirement's own scope boundaries: this story *prepares* and
*applies rules on capture*, but capture itself, and CD approval itself, are
both scoped out.

#### Existing Concepts (from codebase)

- **`GeneratedDraw` / `RoundDraw` / `TaskGroupSet` / `FlightGroup` /
  `GroupMembership`** (`packages/shared/src/draw.ts`): the materialised,
  per-task, per-round group structure this story's moves/splits operate on.
  Group membership keys on `rosterEntryId` (RD4), lanes are explicit integers,
  `lonePilotFlagged` already exists as a **draw-time** marker on a group
  ("an arithmetically unavoidable singleton", per STORY-001-009's comment) —
  this is the exact flag AC6/AC7's *lone-pilot group* condition should key
  off, though the requirement frames it as discovered "when the group is
  scored" (post-draw disruption), which is a superset of the draw-time flag
  (see New Concepts).
- **`DrawService` / `DrawProjection` / `apps/base/src/draw/errors.ts`**
  (`apps/base/src/draw/`): the event-sourced module (`draw.specSaved`,
  `draw.generated`, `draw.accepted`, `draw.cancelled`, and — per
  STORY-001-010's still-pending recommendation — `draw.laneAdjusted`) this
  story's group-move/split/re-flight-prep events should extend, keyed on
  `scope = competitionId`, one domain-error subclass per rejection reason,
  each wired to a `setErrorHandler` branch in `app.ts`.
- **`DrawEvidenceView` / `DrawAcceptanceStatus`** (`packages/shared/src/
  draw.ts`): the read-model gating everything post-generation on `"accepted"`
  status. Group management (per STORY-001-010's precedent and this story's
  own "accepted draw" prerequisite) operates only on an accepted draw.
- **`MatchupDistribution` / anti-repeat matrix** (`packages/shared/src/
  draw.ts`, `DrawService`'s `computeDistribution`): the fairness evidence a
  group move/split can *violate* — AC2's "draw constraint" (e.g. the
  consecutive-flight no-back-to-back rule from STORY-001-009 Decision #5) is
  exactly the machinery already built for generation; this story needs to
  *check against* it for a manual edit, not recompute it wholesale.
- **`ContestClassModel` / `TaskParameterSet`** (`packages/shared/src/
  class-model.ts`): `minGroupSize` / `minGroupSizeAllCompetitorsFallback`
  per task is the exact "class minimum" AC4 fills a new re-flyer group to
  (F3B 5/3/8, F3J/F5J 6, F3K 5) — reuses STORY-001-009's `resolveMin`/
  `resolveGroupPlanForTask` machinery. `basis` (`"single-group"` vs
  `"separate-per-task"`) is the only existing signal that distinguishes F3B
  from every other class — **there is no explicit "annuls on lone pilot"
  field**; see Risks.
- **`RosterEntry` / `rosterEntryId`** (`apps/base/src/roster/`,
  `packages/shared/src/roster.ts`): the seat identity every group-membership
  concept in the codebase keys on. Re-flight preparation ("filled... by
  random draw from the other competitors") must draw from `RosterProjection`
  seats not already in the re-flight group, mirroring the draw generator's
  `seatIds` sourcing.
- **`Attribution`** (`packages/shared/src/attribution.ts`) and the
  organiser-vs-contest-director authority split (`apps/base/src/routes/
  draw.ts`, cemented by STORY-001-017's CD-specific attribution for
  accept/cancel): this story is explicitly **Organiser-authority for
  preparation**, but AC3/AC7 require *recording* that an action needs
  Contest-Director approval **without granting it** — a new pattern this
  codebase has not built yet (existing CD actions, accept/cancel, are
  themselves the approval; this story needs to record a *pending, unapproved*
  request under CD authority-to-be, distinct from anything built so far).
- **`packages/shared/src/scoring.ts`** (STORY-001-007): `normaliseGroup`,
  `deriveRoundScore`, `computeFinalAggregate` — pure functions taking
  `GroupEntry[]` (`{ id, raw }`) and a class model's shape, producing
  normalised scores. **Confirmed via `grep`: the only importer of
  `scoring.ts` outside its own test file is `packages/shared/src/index.ts`'s
  barrel re-export** (`export * from "./scoring.js"`). No service, route, or
  event handler in `apps/base/src` calls any of these functions. This is the
  library AC5/AC6/AC7's "recompute"/"normalised against" language implies,
  but it is currently **dead code from the app's point of view** — proven,
  not assumed (see Risk & Gap Analysis for the full trace).
- **`EntryScoresProvider` / `NoEntryScoresYetProvider`**
  (`apps/base/src/roster/state-providers.ts`): a seam **explicitly planted
  for "the scoring story"** with a load-bearing comment: *"every captured
  score must record the pilotId of the seat's occupant at capture time
  alongside the rosterEntryId, and results aggregate per pilot... This
  provider exists so a flown seat can never be replaced."* This confirms two
  things: (a) the codebase's own authors anticipated a captured-score
  aggregate as a **future, separate story**, not this one, and (b) it does
  not exist yet — the provider is still the no-op stub, `hasCapturedScores`
  always returns `false`.

#### New Concepts Required

- **Group Move / Split (event)**: a new overlay event (or pair of events)
  analogous to STORY-001-010's proposed `draw.laneAdjusted` — moves a
  `rosterEntryId` between `FlightGroup`s within a round/task, or splits one
  `FlightGroup` into two, without rewriting the historical `draw.generated`
  payload. Must be task-scoped for the same reason STORY-001-010 concluded
  lane adjustment is (F3B's independent per-task groupings) — the original
  requirement predates STORY-001-020 and is silent on this, exactly as
  STORY-001-010's was.
- **Clash Check (for group moves)**: a new validation family, related to but
  broader than STORY-001-010's lane-clash check — must cover (a) lane clashes
  in the destination group, (b) violated draw constraints (the
  consecutive-flight no-back-to-back rule, reusing STORY-001-009's
  constraint), and per AC1's own wording, "e.g." implies the list is not
  exhaustive. No implementation of any of this exists yet (STORY-001-010's
  lane-clash check is itself still only a recommendation, not built).
- **Re-Flight Entitlement / Preparation (record)**: a new durable fact that a
  named pilot is "entitled to a re-flight" for a given round/task and that
  the Organiser has *prepared* it (built the re-flyer group, filled to
  minimum) — distinct from *approving* it. Needs its own event type and a
  status distinguishing "prepared, awaiting CD approval" from "approved" (the
  latter explicitly out of scope, so this story only ever produces the
  former state, plus recording the fact that approval is CD's to grant).
- **Approval-Handoff Record**: the "records that the approval is the
  Director's decision rather than granting it here" concept (AC3) and the
  "requires the Contest Director's explicit per-contest approval before any
  dummy override proceeds" concept (AC7) are the same shape — a first-class,
  **unapproved** pending-decision marker. No precedent exists in the
  codebase: every existing CD-authority action (draw accept/cancel) *is* the
  decision itself, recorded after the fact; this story needs to record a
  *request for* a decision that has not yet happened. This is architecturally
  new, not a variant of an existing pattern.
- **Which-Score-Counts Rule (computation)**: "the re-flight pilot's official
  score is the re-flight even if worse; everyone else's is the better of
  their two results" — a selection rule over **two captured raw results for
  the same pilot/round**, feeding into `scoring.ts`'s existing
  `normaliseGroup`/`deriveRoundScore`. This rule itself does not exist
  anywhere (no captured-result concept to select over — see Risks).
- **Lone-Pilot Dummy Insertion (scoring-time)**: "when the group is scored", a
  randomly-chosen *other* pilot is inserted as a normalisation anchor whose
  own flight is excluded from *their* score. This is conceptually adjacent to
  but distinct from the draw-time `lonePilotFlagged` marker (STORY-001-009) —
  that marker is set when generation *could not avoid* a singleton; AC6/AC7
  additionally cover lone-pilot situations that arise **after** the draw from
  disruption (a pilot's group empties down to one via retirement, no-show, or
  a re-flight split), which the draw-time flag cannot have anticipated. No
  dummy-selection or dummy-exclusion logic exists in `scoring.ts` or anywhere
  else.
- **F3B Annulment Marker + Override**: a first-class rule that a class can
  *annul* a one-valid-result group instead of dummying it. **No field on
  `ContestClassModel` encodes this today** — the only class-identifying
  signal is `basis: "separate-per-task"`, which happens to be unique to F3B
  in the stock models but is *not itself* an annulment rule; branching on
  `sourceClass === "F3B"` in code, or even inferring annulment from `basis`,
  would violate CLAUDE.md's core architectural law ("the core system must not
  know about any specific competition class... if adding/changing a class
  requires editing code outside that class's own model, the design is
  wrong"). This needs a genuinely new, additive `ContestClassModel` field
  (e.g. `lonePilotBehaviour: "dummy" | "annul"`), which is itself a small but
  real schema change this story must make, not just consume.
- **Captured Flight Result (the missing foundation)**: the aggregate AC5/AC6/
  AC7 all implicitly recompute over — one raw result per pilot per round (or
  per task for F3B), keyed so a re-flight can legitimately produce a *second*
  result for the same pilot/round (explicitly called out in Dependencies:
  "two results for one pilot here is legitimate, never a capture conflict").
  **This does not exist in the codebase in any form** — no event type in
  `events.ts`, no service, no route, no projection. See Risk & Gap Analysis —
  this is the story's central, verified gap.

#### Key Business Rules

- **Move/split immutability of the historical draw**: like lane adjustment,
  a group move/split must not rewrite `draw.generated`/`draw.accepted`
  payloads — it is a new overlaid fact (auditability, CLAUDE.md trust model)
  — governs the new Group Move/Split event.
- **Clash-before-apply**: AC1 explicitly orders clash checking *before* any
  change lands — governs the new group-topology events' validation sequence.
- **Preparation ≠ approval**: the Organiser can *prepare* a re-flight, a
  group change, or a dummy override, but never *grant* the approval itself
  (Scope Out) — governs the new Approval-Handoff Record and every route this
  story adds; every mutating endpoint must stop at "recorded as pending",
  never flip to "approved," for these three concepts.
- **Re-flight official score is the re-flight, even if worse** (AC5) —
  governs the which-score-counts selection rule; the *entitled* pilot's
  worse re-flight result still wins over their better original.
- **Non-entitled pilots score the better of their two results** (AC5) —
  governs the same selection rule for everyone else caught in a re-flight
  group's re-run.
- **No lone pilot auto-1000 (general-rules §3 / Area 5.3)**: a single
  scoring pilot must never be normalised to an automatic 1000 — governs the
  dummy-insertion rule; the dummy's own score must exclude the dummy flight
  itself, so the dummy is never penalised or rewarded for standing in.
- **F3B annuls instead of dummying (f3b.md)**: a class-specific override of
  the dummy rule, requiring an explicit new class-model field per the
  architectural law (core system must stay class-agnostic) — governs the
  new `ContestClassModel` field and the scoring-time branch that reads it,
  never a hardcoded class check.
- **Class minimum for re-flyer groups** (AC4): reuses the existing
  `TaskParameterSet.minGroupSize` / `minGroupSizeAllCompetitorsFallback`
  machinery (F3B per-task, F3J/F5J 6, F3K 5) — governs the new group's fill
  logic, filled by random draw from non-re-flying competitors.

## Strategic Approach

#### Solution Direction

- **Split the story cleanly along its own scope boundary** into two
  implementable slices with very different risk profiles:
  1. **Group topology (AC1–AC4)**: extend the existing `apps/base/src/draw/`
     module with new overlay event types (group move, group split, re-flight
     group preparation) following the STORY-001-010 pattern exactly —
     service method validates against the live accepted draw + roster +
     class-model bounds, appends an event on success, throws a domain error
     on a clash with no event appended. Read-model: extend
     `DrawEvidenceView` (or a sibling read-model) to expose the *effective*
     group composition (accepted draw + overlaid moves/splits/re-flight
     groups), mirroring the "effective lanes" read-model STORY-001-010
     recommended.
  2. **Scoring-time consequences (AC5–AC7)**: this is genuinely **not
     buildable as a working, end-to-end feature today** because there is no
     captured-result aggregate to recompute over, and no scoring service to
     wire `scoring.ts`'s pure functions into. The realistic strategic options
     are (a) descope AC5–AC7 to *rule specification and structural
     readiness* only — i.e. build the which-score-counts selection function
     and the dummy/annulment logic as pure, testable functions (extending
     `scoring.ts`, following its existing "no I/O, no class branching"
     style) plus the new `ContestClassModel.lonePilotBehaviour` field, but
     stop short of wiring them into a live capture/scoring pipeline that
     does not exist; or (b) treat "captured flight result" as an
     unstated prerequisite story this one silently depends on and flag it as
     a blocking gap before REASONS Canvas. Recommendation below.
- **Data flow (topology slice)**: mirrors 009/010/017 exactly — REST route
  (Organiser attribution for prepare/move/split; a CD-attribution-shaped
  *recording*, not an action, for the approval-handoff) → `DrawService` (or
  a sibling `GroupManagementService`) → clash-check against effective draw
  state → append event → `DrawProjection` overlay → updated evidence.
- **Data flow (scoring slice, recommended scope)**: pure functions only —
  `selectOfficialScore(original, reflight, isEntitled): number` and
  `resolveLonePilotNormalisation(group, model, otherPilots): {mode: "dummy"
  | "annul", dummyId?: string}` — added to `scoring.ts` alongside the
  existing `normaliseGroup`/`deriveRoundScore`, unit-tested against AC5–AC7's
  literal numbers, but with **no route, no event, no live recompute**, since
  there is nothing to recompute *from* yet. This keeps the story's
  deliverable honest about what "done" means given the missing foundation.

#### Key Design Decisions

- **Whether to build the capture/scoring pipeline as part of this story vs.
  treat it as an unstated blocking prerequisite.** *Trade-off:* building it
  here would make AC5–AC7 genuinely end-to-end, but it is a large,
  architecturally significant addition (a new event-sourced aggregate for
  captured flight results, keyed to support "two results per pilot per
  round" per the Data Assumptions) that the story's own Dependencies section
  attributes to "STORY-001-007 (group-score computation)" as if it already
  exists as a *system*, when in fact only its pure math (`scoring.ts`) does.
  → **Recommendation: do not build the capture pipeline inside this story.**
  Implement the topology slice fully (AC1–AC4) and the *rule logic* for
  AC5–AC7 as pure, tested functions extending `scoring.ts` plus the new
  class-model field, explicitly flagged as **not wired to live data** because
  no capture aggregate exists to wire it to. Recommend this gap be raised to
  the user/product owner as a likely missing story between STORY-001-007 and
  STORY-001-011 (a "flight result capture" aggregate) before REASONS Canvas,
  since AC5/AC6/AC7 cannot be *fully* satisfied without it — see Risk & Gap
  Analysis.
- **F3B annulment signal**: add a new additive field on `ContestClassModel`
  (e.g. `lonePilotBehaviour: "dummy" | "annul"`, default `"dummy"`, F3B's
  stock model seeded to `"annul"`) rather than branching on `basis` or
  `sourceClass` anywhere in code. → **Recommendation**: this is a small,
  clean, NFR-2-compliant addition (mirrors how `speedInverted`,
  `minGroupSizeAllCompetitorsFallback` etc. already encode per-class rule
  variance as data, not code branches) and should be done regardless of how
  the scoring-pipeline question above is resolved, since even the
  pure-function slice needs somewhere to read "does this class annul or
  dummy" from.
- **Approval-handoff shape**: a genuinely new "pending, unapproved decision"
  record vs. reusing the existing CD-attribution-after-the-fact idiom (draw
  accept/cancel). → **Recommendation**: a new, explicit status field (e.g.
  `approvalStatus: "pending-contest-director-approval"`) on whatever new
  re-flight-preparation / group-change / annulment-override event this story
  introduces, rather than inventing a separate "requests" aggregate — keeps
  it inside the same overlay-event pattern the draw module already uses, and
  keeps the audit trail in one place. A later story (out of scope here) adds
  the actual `approve`/`reject` action, following the accept/cancel
  precedent from STORY-001-017.
- **Task-scoping of group moves/splits**: per STORY-001-010's now-resolved
  precedent (lane adjustment is scoped per task, no cross-task propagation),
  group moves/splits should almost certainly follow the same resolution for
  consistency — a group move in F3B's Duration task does not imply the same
  move in Distance or Speed. → **Recommendation**: carry the same resolved
  assumption forward explicitly rather than re-litigating it, but confirm
  with the user since STORY-001-011 predates STORY-001-020 exactly as
  STORY-001-010 did.

#### Alternatives Considered

- **Building a minimal captured-flight-result aggregate as a hidden
  prerequisite inside this story** (not asking, just doing it): rejected —
  it is a substantial, class-model-touching, event-sourced aggregate in its
  own right (raw capture, per-task vs per-round semantics, the
  "two-results-legitimate" re-flight case, retirement interactions) that
  deserves its own REASONS Canvas and its own risk analysis, not a
  side-effect of a 5-day group-management story. Silently scope-creeping it
  in would also violate this project's house-keeping rule 2 (cross-reference
  before adding requirements) since no story currently owns "capture a
  flight result."
- **Inferring F3B annulment from `basis === "separate-per-task"`**: rejected
  — conflates two independent concerns (how scores are normalised structurally
  vs. what happens on a lone-pilot group) and directly violates CLAUDE.md's
  "core system must not know about any specific class" test, since a future
  class could plausibly want `separate-per-task` basis without F3B's
  annulment rule, or vice versa.
- **Treating "prepared" and "approved" as the same event with a flag flipped
  later by a future story**: considered viable but recommended against for
  this analysis in favour of the explicit `approvalStatus` field approach,
  since it more directly matches AC3/AC7's language ("records that the
  approval is the Director's decision rather than granting it here") as a
  first-class, queryable state rather than an implicit absence of a second
  event.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **Task-scoping is unaddressed, again.** Like STORY-001-010, this story
  predates STORY-001-020's per-task grouping and never mentions tasks. "Group
  A" language throughout the ACs is ambiguous for F3B. This should be
  resolved the same way STORY-001-010 was (confirm per-task scoping, no
  cross-task propagation) rather than silently assumed.
- **"When the group is scored" (AC6) is not defined anywhere in the
  codebase.** There is no "scoring a group" operation, service, or event.
  This phrase is load-bearing for both AC6 and AC7's trigger condition and
  needs a concrete technical definition before it can be built — see
  Technical Risks below for the deeper version of this gap.
- **Relationship between draw-time `lonePilotFlagged` and this story's
  lone-pilot trigger is unstated.** STORY-001-009 already flags an
  unavoidable singleton at generation time. This story's AC6/AC7 say "the
  draw could not avoid it" too — is this story handling the *same* flagged
  groups (in which case why is a *new* mechanism needed, since the
  Organiser already knows from evidence review?), or *post-draw* singletons
  from disruption (retirement, no-show, a group move emptying a group down
  to one) that the draw-time flag never captured? The requirement's framing
  ("a group ends up with a single scoring pilot" in Background, listed
  alongside "a pilot isn't ready" and "a mid-air collision") strongly
  suggests the latter — a *runtime* condition, not the draw-time one. This
  needs explicit confirmation; if it's the runtime case, the trigger
  mechanism (what evaluates "is this group now down to one?" and when) is
  entirely unspecified.
- **What "the other pilots" means for dummy selection (AC6) and re-flyer
  group filling (AC4) is unqualified.** Are dummies/fillers drawn only from
  pilots not flying at that moment, only from the same round, excluding
  pilots already flagged for their own lone-pilot situation, excluding
  retired pilots? None of this is stated.
- **"4 pilots (6 for F5J)" (AC4) directly cites numbers that already live as
  data on `TaskParameterSet.minGroupSize`** (F5J 6, F3J 6, F3K 5, F3B
  5/3/8) — but the AC's own text ("4 pilots... in the other classes") doesn't
  match F3K's rule-fixed 5 or F3B's per-task minima, suggesting the AC's
  prose is a simplification/example rather than the authoritative number.
  Confirm the class-model fields, not the AC prose, are authoritative (this
  matches the codebase's existing "rule docs are authoritative on numbers"
  house rule).

#### Edge Cases

- **A group move that itself creates a new lone-pilot group** (moving the
  second-to-last pilot out of a group of two) — does this trigger AC6/AC7
  immediately, or only "when scored"? Interacts directly with the
  undefined-trigger ambiguity above.
- **Re-flight group filler who is later also entitled to their own
  re-flight** — does a filler's own re-flight entitlement conflict with
  having just filled someone else's re-flyer group? Unaddressed.
- **A pilot moved between groups after already being captured/scored in
  their original group** — since capture doesn't exist yet, this can't be
  concretely reasoned about, but it's the kind of interaction a capture-aware
  design would need to handle (does the move invalidate a prior capture, or
  do captures key on round/task rather than group?).
- **F3B annulment override interacting with the three-task structure** — AC7
  says "an F3B group... only one competitor has a valid result"; is this
  per-task (Duration alone can annul independent of Distance/Speed) or
  whole-class? Given `basis: "separate-per-task"` and STORY-001-020's
  per-task independence, almost certainly per-task, but unstated.
- **Concurrent re-flight preparations for multiple pilots in the same round**
  — does each get its own re-flyer group, or can several entitled pilots
  share one re-flyer group (which would also affect AC5's "filler" scoring
  for the same round)?

#### Technical Risks

- **(Highest, confirmed) No captured-flight-result aggregate exists to
  recompute over.** Verified directly: `grep -rn "from.*scoring" apps
  packages` shows the only importer of `packages/shared/src/scoring.ts`
  outside its own test file is `packages/shared/src/index.ts`'s blanket
  barrel re-export (`export * from "./scoring.js"`) — no service, route, or
  event handler in `apps/base/src` calls `normaliseGroup`, `deriveRoundScore`,
  or `computeFinalAggregate`. Further, `packages/shared/src/events.ts` has no
  event type for a captured result (its full type-union list is `Pilot`,
  `LandingTable`, `ClassModel`, `Competition`, `Roster`, `ContestTemplate`,
  `TaskConfig`, `Draw` — nothing score/capture-shaped). Finally,
  `apps/base/src/roster/state-providers.ts` has a seam **explicitly planted
  for this**: `EntryScoresProvider.hasCapturedScores`, currently only
  implemented by the no-op `NoEntryScoresYetProvider`, with a comment
  attributing the real implementation to "the scoring story" (not this one).
  **This confirms the codebase's own prior authors already anticipated a
  separate future story for flight-result capture, and it has not been
  written or built.** AC5 ("scoring recomputes..."), AC6 ("when the group is
  scored...") and AC7 ("only one competitor has a valid result...") all
  presuppose this aggregate exists. *Impact:* these three ACs cannot be
  built as genuine, live, end-to-end behaviour within this story as
  currently scoped — only their rule logic can be built as pure, tested
  functions with nothing to wire them to. *Mitigation:* flag this
  prominently to the user before REASONS Canvas; likely resolution is either
  (a) explicitly re-scope AC5–AC7 to "rule logic only, structurally ready for
  a future capture story to call," or (b) split out and sequence a
  "flight-result capture" story ahead of this one.
- **No `ContestClassModel` field encodes F3B's annulment rule.** Building
  AC7 correctly requires an additive schema change (new field, e.g.
  `lonePilotBehaviour`) plus updating `STOCK_CLASS_MODELS`, the clone/deep-
  copy helpers, and `deriveDeviations` (the model-deviation surfacing
  pattern already used for `basis`, `dropWorst.threshold`, etc., per
  `class-model.ts`'s existing `note(...)` calls) — a real but contained
  piece of work, correctly scoped to the class model per CLAUDE.md's
  architectural law, not a hidden branch.
- **"Approval pending, not granted" has no precedent to reuse.** Every
  existing CD-authority event in the codebase (`draw.accepted`,
  `draw.cancelled`) *is* the decision, recorded after the fact. This story
  needs a genuinely new state shape (a recorded *request* with no
  corresponding decision event yet) — this is new design surface, not a
  drop-in reuse of the 017 pattern, and should be scoped carefully so a
  future "CD approves/rejects" story has a clean event to append against.
- **Group move/split clash-check reuses, but does not yet have, a lane-clash
  concept.** STORY-001-010's lane-clash check is itself still only a
  *recommendation*, not implemented — this story's AC1/AC2 need the same
  clash machinery (plus the broader "draw constraint" check, e.g.
  consecutive-flight). If STORY-001-010 and STORY-001-011 are built out of
  order, there's a real risk of duplicating or diverging clash-check logic
  between the two stories; recommend either sequencing 010 before 011, or
  building the shared clash-check logic once as a common draw-module
  utility both stories call.
- **Missing error-handler branches.** Every new domain error this story
  introduces (clash rejection, "no draw to modify," "pilot not entitled to
  re-flight," "annulment already pending," etc.) needs its own
  `setErrorHandler` branch in `app.ts` per the existing Safeguard-8
  discipline — easy to miss given how many new rejection reasons this story
  introduces relative to its siblings.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Group moves/splits run clash checks before applying | Yes | Directly buildable on the existing draw-overlay pattern (STORY-001-010 precedent); needs the clash-check logic built (not yet implemented anywhere), and task-scoping confirmed. |
| 2 | Constraint violations warn with the specific reason | Yes | Reuses the consecutive-flight / anti-repeat machinery already built for generation (STORY-001-009); needs a "check against existing constraint, don't regenerate" adaptation. |
| 3 | Re-flight preparation records the approval handoff, not the approval itself | Partial | The "prepare" half (build the re-flyer group) is addressable; the "record that CD approval is needed, without granting it" half needs a genuinely new state shape with no existing precedent in this codebase — real but buildable design work, not a blocking gap. |
| 4 | New re-flyer group filled to class minimum by random draw | Yes | Directly reuses `TaskParameterSet.minGroupSize`/`minGroupSizeAllCompetitorsFallback` and the existing seat-sourcing pattern from draw generation. AC's own "4/6" numbers are a simplification vs. the authoritative per-class/per-task fields — confirm the fields govern, not the prose. |
| 5 | Which-score-counts applies on recompute across the affected group/round | **Partial — blocked** | The *selection rule* (entitled pilot's re-flight wins even if worse; others take the better of two) is a pure, buildable function extending `scoring.ts`. But "recompute... consistently across the affected group and round" presupposes a captured-result aggregate and a live scoring pipeline that **does not exist anywhere in the codebase** (verified: no importer of `scoring.ts`, no event type, `EntryScoresProvider` still a no-op stub). Cannot be built end-to-end as this story is currently scoped. |
| 6 | Lone-pilot group gets a random dummy at scoring time, dummy's own score unaffected | **Partial — blocked** | The dummy-selection/exclusion *rule* is buildable as a pure function. "When the group is scored" has no defined trigger or pipeline to hang it on — same missing-foundation gap as AC5, compounded by an undefined trigger condition (see Requirement Ambiguities). |
| 7 | F3B annuls instead, requiring explicit CD override approval | **Partial — blocked** | Needs (a) a new additive `ContestClassModel.lonePilotBehaviour` field (buildable, clean, NFR-2-compliant) and (b) the same missing scoring-pipeline foundation as AC6, plus the new "approval pending, not granted" state shape from AC3. |

## Summary of Open Questions Requiring Human Decision Before REASONS Canvas

1. **(Blocking, confirmed by direct code inspection)** No captured-flight-
   result aggregate exists anywhere in the codebase. `packages/shared/src/
   scoring.ts`'s pure functions have zero production callers (only their own
   test file and the barrel `export *`); `events.ts` has no result/capture
   event type; `EntryScoresProvider` in `apps/base/src/roster/
   state-providers.ts` is still the no-op stub, explicitly commented as
   awaiting "the scoring story." AC5, AC6 and AC7 all presuppose this
   aggregate. Decide: (a) descope these three ACs to rule-logic-only
   (pure functions, no live wiring, explicitly documented as such), or
   (b) treat "flight-result capture" as a prerequisite story to sequence
   ahead of STORY-001-011, or (c) fold a minimal capture aggregate into this
   story's scope after all (not recommended — see Alternatives Considered).
2. Is the lone-pilot trigger in AC6/AC7 the same draw-time
   `lonePilotFlagged` marker from STORY-001-009, or a distinct runtime
   condition arising from post-draw disruption (retirement, no-show, a group
   move/split)? The Background text suggests the latter, which has no
   detection mechanism designed yet.
3. Task-scoping (per STORY-001-020): are group moves/splits, re-flight
   preparation and lone-pilot handling scoped per-task (matching
   STORY-001-010's resolution) or is there some cross-task propagation
   intended? Needs the same explicit confirmation STORY-001-010 required.
4. Should the new F3B "annuls instead of dummies" rule be modelled as a new
   `ContestClassModel` field (recommended, e.g. `lonePilotBehaviour: "dummy"
   | "annul"`) — confirm before REASONS Canvas since it's a schema change
   this story would own, not just consume.
5. What concrete state shape should "prepared, awaiting Contest Director
   approval" take, given no existing precedent in the codebase for a
   recorded-but-ungranted decision? (Recommendation given: a status field on
   the new preparation event, e.g. `approvalStatus:
   "pending-contest-director-approval"`.)
6. Sequencing risk with STORY-001-010: both stories need overlapping
   clash-check machinery (lane clashes, draw-constraint violations) that
   does not yet exist in either. Decide whether to build it once as shared
   draw-module utility both stories consume, or accept the risk of building
   it twice if the stories proceed independently.
</content>
