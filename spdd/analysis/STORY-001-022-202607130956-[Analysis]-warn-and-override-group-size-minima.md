# SPDD Analysis: Warn-and-Override for Rule-Fixed Group-Size Minima

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-22]warn-and-override-group-size-minima.md`.

# Story Decomposition: Warn-and-Override for Rule-Fixed Group-Size Minima

## INVEST Analysis

### Abstract Task: "Warn-and-Override for Group-Size Minima"

**Analysis Dimensions**:
- **Core Responsibility**: replace the current silent, numeric
  `minGroupSizeOverride` with a policy that tries a draw specification as the
  Organiser actually entered it, and — only when a task's rule-fixed
  per-group minimum genuinely cannot be met by the roster on hand — generates
  the closest compliant grouping anyway, surfaces a warning that names the
  task and cites the FAI rule clause it falls short of, and requires an
  explicit acknowledgement before the draw can be accepted. This applies
  across all six MVP classes, not just F3B.
- **Primary Operations**: attempt generation against the roster as given;
  detect when a task's group-size minimum cannot be met; generate the closest
  available grouping instead of refusing outright; attach a named,
  rule-citing warning to that task's result; require the Contest Director's
  explicit override acknowledgement before such a draw can be accepted.
- **Key Constraints**: this is a trust-model decision (CLAUDE.md: "club-level
  tool for a small, trusted NZ group... an immutable event log of all
  mutations provides auditability instead" of strict enforcement) —
  Soarscore's primary use case is small local club contests that often
  cannot field FAI-Championship-sized rosters, so the rule-fixed minima
  should be advisory with an audited override, not a hard wall. This mirrors
  the precedent already set by STORY-001-009 AC5, which flags rather than
  blocks an unavoidable lone-pilot group. The general D1 floor (every group
  needs ≥ 2 scoring pilots) is a different category of constraint — it is
  about man-on-man scoring being meaningful at all, not an FAI-specific rule
  number — and is explicitly **not** in scope for this relaxation; AC5's
  existing lone-pilot flag already covers that case.
- **Technical Complexity**: Medium — replaces one validation/override code
  path (`DrawService.resolveMin`/`assertGroupBound`) with a warn-and-generate
  path; the generation algorithm itself already tolerates producing a
  best-effort result (it does so for the anti-repeat/consecutive-flight
  soft-warning path today).
- **Business Complexity**: Low — the business intent (favour running the
  contest over blocking it, with a visible, audited deviation) is
  unambiguous; the complexity is enumerating which minima this applies to.

### INVEST Evaluation
- ✅ **Independent**: a validation/generation policy change behind the
  existing save/generate endpoints; touches the same code as STORY-001-020
  but is conceptually separable (it governs *how a shortfall is reported*,
  not *how many groupings a round has*).
- ✅ **Negotiable**: the exact override UX (a checkbox at generate time vs. an
  acknowledgement dialog vs. a persisted per-spec flag) is open for design.
- ✅ **Valuable**: without this, small club rosters below any class's
  rule-fixed group minimum cannot generate a draw at all today except by
  guessing a numeric override in advance — this makes the deviation visible,
  audited and a conscious choice instead of a silent workaround or a hard
  block.
- ✅ **Estimable**: the six classes' minima are already fully enumerated (see
  table below); the policy is one mechanism applied uniformly.
- ✅ **Small**: one mechanism, one warning shape, applied to existing
  validation call sites — no new domain concepts beyond a warning and an
  override acknowledgement.
- ✅ **Testable**: each class's minimum, the warning's content, and the
  override acknowledgement gate on accept are all directly observable.

**Conclusion**: Ready as-is — a single cross-cutting story. Identified while
reviewing STORY-001-020's draft AC4 (F3B Speed's roster-of-6 scenario), but
the same silent-override gap exists for every other class's single rule-fixed
minimum, so it is scoped here as one policy applied everywhere rather than
folded into STORY-001-020 alone.

**Split strategy**: not split further — one mechanism (warn, generate anyway,
require override acknowledgement) applied consistently is itself the
right-sized unit; splitting per class would fragment one policy into six
near-identical stories with no independent business value.

---

## [STORY-001-022] Warn-and-Override for Rule-Fixed Group-Size Minima

> Source: `CLAUDE.md` (trust model — audited deviation over hard
> enforcement) · `docs/requirements/rules/f3b.md` §1, `f3j.md`, `f3k.md`,
> `f5j.md` (per-class rule-fixed group-size minima) ·
> `docs/requirements/high-level-requirements.md` Area 4.1 (the existing
> `minGroupSizeOverride` mechanism this story supersedes) ·
> STORY-001-009 AC5 (the lone-pilot-group flag precedent this story extends
> the same warn-not-block philosophy from) · `docs/requirements/decisions.md`
> (no existing decision covers advisory vs. hard rule-fixed minima — this
> story should add one)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

Every class in the MVP fixes a minimum number of scoring pilots per group,
transcribed onto the class model: F3B Duration ≥ 5, Distance ≥ 3, Speed ≥ 8
(or all competitors); F3J ≥ 6; F3K ≥ 5; F5J ≥ 6 (F5K and F5L currently fix no
minimum). Soarscore's primary use case is small local club contests, which
often cannot field a roster that reaches these Championship-scale numbers.
Today the only way past a minimum is `minGroupSizeOverride` — a numeric field
the Organiser must pre-emptively set correctly before attempting to save a
specification, with no warning that doing so deviates from the class's rule,
and no record of *why* the deviation was made beyond the raw number in the
event log. This story replaces that silent workaround: the Organiser
specifies the draw they actually want, generation is attempted against the
real roster, and only when a task's own rule-fixed minimum genuinely cannot
be met does the system generate the closest available grouping anyway,
attach a warning naming the task and the rule clause it falls short of, and
require the Contest Director's explicit acknowledgement before the draw can
be accepted — consistent with the lone-pilot-group flag STORY-001-009 AC5
already established for the more general D1 floor.

### Business Value

- Provide small clubs a way to actually run contests their roster size
  wouldn't otherwise permit under the class's rule-fixed minimum, without
  requiring the Organiser to pre-guess a numeric override.
- Support the Contest Director's authority (D1) with a visible, specific,
  audited deviation — naming the task and rule clause — rather than a silent
  number in a form field.
- Enable the same trust-model principle (audit trail over hard enforcement)
  already applied to lone-pilot groups to cover every rule-fixed group
  minimum consistently.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw specification, storage, generation
  and the existing `minGroupSizeOverride`/`ConstraintWarning` mechanisms —
  **done**); STORY-001-020 (per-task minima for multi-task classes), which
  this story's warning must be able to name a *specific task* within, not
  just a round — this story and STORY-001-020 should land together or with
  this story first, since STORY-001-020's own AC4 depends on this policy.
- **Data assumptions**: a class's rule-fixed minimum (`TaskParameterSet.
  minGroupSize`) and the F3B Speed "or all competitors" escape
  (`minGroupSizeAllCompetitorsFallback`) are already correctly modelled per
  task; this story changes how a shortfall against them is handled, not the
  numbers themselves.
- **Integration points**: supersedes `minGroupSizeOverride` as the primary
  route past a rule-fixed minimum; draw acceptance (STORY-001-017) gains a
  new precondition (the override acknowledgement) when a warned draw is
  accepted; the immutable event log (D4) must retain both the warning and the
  acknowledgement so the deviation is auditable after the fact.
- **Business constraints**: the general D1 floor (every group needs ≥ 2
  scoring pilots) is unaffected — that already has its own warn-not-block
  precedent (the lone-pilot flag) and is a scoring-integrity constraint, not
  an FAI rule number, so it stays out of this story's scope.

### Scope In

- Detecting, per task, whether the roster on hand can meet that task's
  rule-fixed minimum (including F3B Speed's "or all competitors" escape)
  for the requested groups-per-round.
- Generating the closest available grouping for a task that cannot meet its
  minimum, instead of refusing to generate the round at all.
- A warning that names the task and cites the specific rule clause the
  generated grouping falls short of (e.g. "Speed: F3B.1.8b requires 8 or all
  competitors; this roster of 6 in 2 groups cannot meet either").
- Requiring the Contest Director to explicitly acknowledge each such warning
  before the draw can be accepted (STORY-001-017); an unacknowledged warning
  blocks acceptance, not generation.
- Removing (or deprecating in favour of this mechanism) the pre-emptive
  numeric `minGroupSizeOverride` field, since it is no longer the primary
  route past a minimum.

### Scope Out

- The general D1 "≥ 2 scoring pilots per group" floor and its existing
  lone-pilot-group flag — unchanged, out of scope.
- Presenting the warning and override acknowledgement in the companion app —
  a follow-on UI story analogous to STORY-001-021, not built here.
- Any change to the rule-fixed minimum numbers themselves — those remain
  exactly as transcribed from the FAI rule docs (house rule 1); this story
  only changes what happens when a roster falls short of them.
- Frequency and team-separation constraints — remain Future Enhancements.

### Acceptance Criteria

#### AC1: A roster below a single-task class's minimum still generates, with a named warning
**Given** an F3J competition (rule-fixed minimum 6 per group) with a roster
of 5 pilots
**When** the Organiser generates a draw
**Then** the round generates with all 5 pilots in one group, and a warning
states that this roster of 5 falls short of F3J.6.1's minimum of 6.

#### AC2: F3B Speed's shortfall is named distinctly from Duration's and Distance's
**Given** an F3B roster of 6 pilots and a specification requesting 2 groups
per round
**When** the Organiser generates the round
**Then** Duration and Distance generate normally with no warning (their
minimums of 5 and 3 are met by 2 groups of 3... [continues per
STORY-001-020's per-task generation]), and Speed alone carries a warning
naming F3B.1.8b's 8-or-all-competitors requirement.

#### AC3: A draw with an unacknowledged warning cannot be accepted
**Given** a generated draw carrying a group-size-minimum warning
**When** the Contest Director attempts to accept it without acknowledging
the warning
**Then** the system rejects the acceptance and states which warning must be
acknowledged first.

#### AC4: Acknowledging the warning permits acceptance, and the deviation is recorded
**Given** the same generated draw and warning
**When** the Contest Director acknowledges the warning and accepts the draw
**Then** the draw is accepted, and the event log records both the warning
that was raised and the Contest Director's acknowledgement, so the deviation
from the rule-fixed minimum is auditable after the contest.

#### AC5: A roster that meets every task's minimum generates with no warning
**Given** an F3J roster of 12 pilots and a specification requesting 2 groups
of 6
**When** the Organiser generates the draw
**Then** the round generates with no group-size-minimum warning, because 6
meets F3J.6.1's minimum exactly.

#### AC6: Classes with no rule-fixed minimum are unaffected
**Given** an F5J or F5L competition, whose class model fixes no per-group
minimum
**When** the Organiser generates a draw for any roster size (subject only to
the general D1 ≥ 2 floor)
**Then** no group-size-minimum warning is ever raised, because the class
fixes no such minimum to fall short of.

#### Non-Functional Expectations
- The warning must name the specific task and quote or reference the exact
  rule clause (e.g. "F3B.1.8b"), not a generic "below minimum" message, so
  the Contest Director can judge the deviation on its merits.

### INVEST Check

Independent (a validation/generation policy change behind existing
save/generate/accept endpoints) · Valuable (lets small club rosters actually
run contests their FAI-Championship-scaled rule minima would otherwise block,
with an audited, conscious deviation) · Small (3 days, 2 functional points:
detect-and-warn during generation, acknowledge-and-record during acceptance)
· Testable (each class's minimum, the warning's content, and the
acknowledgement gate on accept are all directly observable).

## Domain Concept Identification

#### Existing Concepts (from codebase)

- **`TaskParameterSet.minGroupSize` / `minGroupSizeAllCompetitorsFallback`**
  (`packages/shared/src/class-model.ts:96,103`): the class's rule-fixed
  per-group minimum, and the F3B-Speed-style "or all competitors" escape,
  already modelled per task. This story does not change these numbers — it
  changes what happens when the roster can't reach them.
- **`DrawSpecification.minGroupSizeOverride`**
  (`packages/shared/src/draw.ts:53`, wired through
  `saveDrawSpecRequestSchema`, `DrawService.resolveMin`,
  `DrawService.assertGroupBound`, `apps/base/src/draw/service.ts:94,120,160,310`):
  the numeric pre-emptive override this story supersedes/deprecates as the
  primary route past a minimum. Currently the *only* mechanism past a
  rule-fixed minimum; the story's Scope In explicitly calls for removing or
  deprecating it.
- **`ConstraintWarning`** (`packages/shared/src/draw.ts:120`, produced by
  `DrawService.computeWarnings`, `apps/base/src/draw/service.ts:374-420`): the
  existing soft, non-blocking warning shape (`{ constraint, message }`) already
  used for anti-repeat and consecutive-flights infeasibility. This is the
  natural home for the new group-size-minimum warning kind — the shape
  already rides the success response on both `saveSpec` and (via
  `getEvidence`) is recomputed live, never an error.
- **`DrawEvidenceView.warnings`** (`packages/shared/src/draw.ts:141`): the
  read-model array the CD reviews before deciding; this is where a
  group-size warning must be visible for the CD to judge and acknowledge.
- **`GroupSizeOutOfBoundsError`** (`apps/base/src/draw/errors.ts:24-29`, code
  `DRAW_GROUP_SIZE_OUT_OF_BOUNDS`): the current *hard* rejection thrown by
  `assertGroupBound` when a resolved minimum can't be met. This story's Scope
  In ("generate the closest available grouping instead of refusing outright")
  directly targets this throw path for the rule-fixed-minimum case — it must
  stop being the way a rule-fixed shortfall is reported. Note `assertGroupBound`
  conflates two different bounds under one error/message: the rule-fixed
  minimum (this story's concern) and the D1 two-scoring-pilots floor (out of
  scope, must remain a hard bound per D14's "Consequences").
- **`DrawService.resolveMin`** (`apps/base/src/draw/service.ts:310-316`): today
  folds the Organiser's override and the model's task minima into one scalar
  "binding minimum" for the whole round. Per STORY-001-020 (D13) this is
  already slated to become per-task, not per-round — this story's warning
  must be able to name a specific task's shortfall, which only makes sense
  once (or as) the resolution is per-task.
- **`DrawService.accept`** (`apps/base/src/draw/service.ts:229-252`): the
  Contest Director's acceptance action (STORY-001-017). Currently has no
  precondition beyond "a matching candidate is awaiting decision" — this
  story adds the override-acknowledgement precondition here.
- **Immutable event log** (D4; `draw.specSaved`, `draw.generated`,
  `draw.accepted` event types, `packages/shared/src/events.ts:328-330`): the
  auditability substrate. AC4 requires both the warning and the
  acknowledgement to be durably recorded so the deviation is reconstructable
  after the contest — this is an existing, well-established pattern (every
  mutation is an event), not a new one.
- **D14 — "Rule-fixed group-size minima are advisory: warn and require
  override"** (`docs/requirements/decisions.md:409-460`): a decision record
  already exists in the working tree (uncommitted) that documents almost
  exactly this story's mechanism — generate-anyway, named warning citing the
  rule clause, CD acknowledgement scoped to one contest, `minGroupSizeOverride`
  superseded, D1 floor unaffected. This is direct, already-authored
  confirmation of the intended design, not something this analysis needs to
  invent.
- **STORY-001-009 AC5 lone-pilot flag / `FlightGroup.lonePilotFlagged`**
  (`packages/shared/src/draw.ts:77`, set in
  `apps/base/src/draw/service.ts:537`): the existing warn-not-block precedent
  for the D1 floor this story explicitly does *not* touch, but whose shape
  (flag lives on the materialised outcome, not just the pre-generation
  warnings list) is a useful sibling pattern to compare against for where a
  group-size-minimum flag should live.

#### New Concepts Required

- **Group-size-minimum warning kind**: a `ConstraintWarning` (or an extension
  of it) that names the specific task and cites the specific rule clause
  (e.g. "F3B.1.8b"), distinct from the existing anti-repeat/consecutive-flight
  constraint strings. Relates to `ConstraintWarning` as a new `constraint`
  value/message convention, not a new type.
- **Override acknowledgement**: a Contest-Director action/fact that a named
  warning has been consciously accepted, gating `DrawService.accept`. Its
  exact shape (per-warning acknowledgement vs. one acknowledgement covering
  all warnings on a candidate) is a REASONS Canvas design decision, not
  resolved here. Relates to `DrawEvidenceView.warnings` (what must be
  acknowledged) and `draw.accepted` (what it gates).
- **Rule-clause citation table**: a mapping from task/class to the specific
  FAI clause string to quote in the warning (F3J.6.1, F3K's clause, F5J's
  clause, F3B.1.8b for Speed, plus Duration/Distance's own clauses) — needs
  enumerating from `docs/requirements/rules/` per-class docs; not yet present
  as a lookup anywhere in the codebase (today `minGroupSize` carries only the
  number, no clause reference).

#### Key Business Rules

- **Generate-anyway, never block on a rule-fixed minimum**: draw generation
  must never refuse solely because a task's rule-fixed minimum can't be met —
  governs `DrawService.generate` / `assertGroupBound`'s rule-fixed-minimum
  branch (D14 consequence 1).
- **D1's two-scoring-pilot floor stays a hard bound**: unaffected by this
  story; governs the other half of `assertGroupBound` (the `maxByD1` bound),
  which must remain a rejection, not a warning.
- **Acceptance is blocked by an unacknowledged group-size warning**: governs
  `DrawService.accept`'s new precondition (D14 consequence 2, AC3).
- **The warning must name the task and cite the rule clause specifically**:
  governs the warning's content contract (Non-Functional Expectations,
  AC1/AC2) — a generic "below minimum" message does not satisfy the story.
  This is the same content-specificity requirement STORY-001-020's AC4 leans
  on this story to deliver.
- **`minGroupSizeOverride` is superseded, not the deciding mechanism**:
  governs `saveSpec`/`resolveMin` — the numeric override stops being the
  primary route past a rule-fixed minimum (D14 consequence 3); Scope In
  allows removing or merely deprecating it, which is a design decision for
  the Canvas phase.
- **No warning where no rule-fixed minimum exists (F5K, F5L)**: governs
  `computeWarnings`/its successor — must consult `minGroupSize === null` per
  task, not assume every class has one (AC6).
- **Acknowledgement is scoped to one contest's deviation, per warning
  instance, and is itself audited**: governs the event log payload for
  `draw.accepted` (or a new event) — D14 explicitly says "scoped to that one
  contest," ruling out a standing organiser-level or class-model-level
  bypass.

## Strategic Approach

#### Solution Direction

- Move the rule-fixed-minimum shortfall out of `assertGroupBound`'s hard
  rejection path and into the existing soft-warning path
  (`computeWarnings`/`ConstraintWarning`), which already rides the success
  response on save and is recomputed live in `getEvidence` — this is a
  narrowing of an existing mechanism, not a new pipeline. `assertGroupBound`
  itself is not deleted; it is split so the D1 two-scoring-pilot floor
  remains a hard throw while the rule-fixed-minimum branch becomes
  warn-and-proceed.
- Generation (`DrawService.generate`/`runAttempt`/`materialise`) needs a
  fallback path for a task whose minimum genuinely cannot be met by any
  achievable grouping under the requested groups-per-round: instead of
  discarding all 200 attempts and throwing `DrawGenerationFailedError`, fall
  back to "the closest available grouping" (per AC1/AC2, effectively a single
  group of the whole roster, or the achievable groups-per-round split,
  whichever the rule-clause table says is closest) and attach the warning to
  that outcome.
- Data flow: `saveSpec`/`generate` compute per-task (or per-round, pending
  STORY-001-020) shortfall → produce a named, clause-citing
  `ConstraintWarning` → ride it on `DrawEvidenceView.warnings` and/or the
  generated draw's stored outcome → `accept` reads the same
  warnings/acknowledgement state and rejects if any group-size-minimum
  warning is unacknowledged → on successful accept, the event log records
  both the warning and the acknowledgement (extending `draw.accepted`'s
  payload, or introducing a companion event).
- Leverage the D14 decision record already present in
  `docs/requirements/decisions.md` (uncommitted in the working tree) as the
  settled cross-cutting policy statement; this story implements it rather
  than deciding it afresh.

#### Key Design Decisions

- **Where the warning lives (pre-generation `computeWarnings` vs. attached to
  the generated outcome)**: `computeWarnings` runs against a *hypothetical*
  even split (`Math.floor(R / groupsPerRound)`), which is adequate for the
  existing anti-repeat/consecutive-flight warnings but not sufficient once
  per-task minima and the "closest available grouping" fallback are in play
  (the actual generated grouping may differ from the naive even split,
  especially under STORY-001-020's per-task escape logic). → Recommend the
  authoritative group-size-minimum warning be computed from the *actual*
  materialised outcome inside `generate` (attached to `GeneratedDraw`/its
  per-task result), with `saveSpec`'s `computeWarnings` retained only as an
  early best-effort heads-up before a roster/task combination is attempted.
  This mirrors `lonePilotFlagged`, which is also set post-materialisation,
  not predicted in advance.
- **How acknowledgement is structured (checkbox-at-accept-time vs. per-warning
  acknowledgement vs. persisted spec-level flag)**: left explicitly
  Negotiable by the story. → Recommend a per-candidate acknowledgement
  parameter on `accept` that must reference/cover every group-size-minimum
  warning present on that candidate (not a blanket "I acknowledge everything"
  toggle), since AC3 requires the rejection to *state which warning* is
  unacknowledged — implying the mechanism must track warnings individually,
  not just a single yes/no flag. Trade-off: slightly more request/response
  shape than a single boolean, but the auditability requirement (AC4: "the
  event log records... the warning that was raised and the... acknowledgement")
  needs a traceable link between the two, which a single flag can't provide
  when a draw carries other, unrelated warning kinds simultaneously (e.g. an
  anti-repeat warning that doesn't need acknowledgement at all — see Risk
  below).
- **`minGroupSizeOverride`: remove entirely vs. deprecate-in-place**: Scope In
  allows either. → Recommend deprecate-in-place for this story (mark
  unused/no-op, stop it from suppressing the new warning path) rather than a
  destructive schema removal, since STORY-001-009's existing tests and any
  already-saved specs reference the field, and a hard removal is a breaking
  schema change better sequenced as its own follow-up once the new mechanism
  is proven — the story's own wording ("removing (or deprecating...)") leaves
  this open.
- **Sequencing against STORY-001-020 (resolves the circular dependency)**:
  020's own Dependencies section says its AC4 depends on 022; 022's
  Background wants to "name a specific task," which on its face needs 020's
  per-task resolution first. Both story docs, however, explicitly permit
  either order ("should land together or with this story first" — 022;
  "should land before or alongside this story" — 020), so the circularity is
  in the story numbering, not a hard technical requirement. **Decision:
  sequence 022 first**, scoped to today's per-round model. Build the generic
  mechanism (detect shortfall → generate the closest available grouping
  anyway → named warning → acknowledgement gate on `accept` → event-log
  record) against the existing per-round `resolveMin`, which already computes
  one binding minimum per round even for multi-task classes. This fully
  satisfies AC1, AC3, AC4, AC5 and AC6 — covering all five single-task
  classes completely — while AC2 (Speed named distinctly from
  Duration/Distance) is explicitly deferred, not silently dropped, until
  STORY-001-020 lands. When 020 lands second, its only interaction with 022's
  mechanism is swapping `resolveMin`'s granularity from per-round to
  per-task; the warning shape, acknowledgement tracking and event-log
  recording built in 022 are reused unchanged and simply start firing
  per-task instead of per-round. This avoids both a hidden per-task
  prerequisite inside 022's scope and a throwaway interim warning shape that
  020 would have to discard. Trade-off: 022 ships with one AC (AC2) knowingly
  unmet for multi-task classes until 020 follows — this must be flagged to
  the Contest Director/PO as a scoped, deliberate gap, not treated as
  complete.

#### Alternatives Considered

- **Keep `minGroupSizeOverride` as a required pre-emptive gate and simply add
  a warning label to it**: rejected — this does not remove the "guess a
  number in advance" burden the story's Business Value section explicitly
  targets; it would only decorate the existing silent workaround rather than
  replace it.
- **Block acceptance globally whenever any warning of any kind is
  unacknowledged** (folding anti-repeat/consecutive-flight warnings into the
  same acknowledgement gate): rejected for this story's scope — Scope In only
  asks for the group-size-minimum warning to gate acceptance; the existing
  anti-repeat/consecutive-flight `ConstraintWarning`s have no such
  precedent and folding them in would silently expand this story's blast
  radius beyond what the ACs describe.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **What exactly is "the closest available grouping" when a task's minimum
  can't be met?** AC1 says "all 5 pilots in one group" for a single-task
  class below its minimum; AC2/AC4 (via STORY-001-020) describe Speed
  falling back to "a single group of all 6." Both examples collapse to "one
  group of the whole roster," but the story never states this as a general
  rule for classes with `groupsPerRound` > 1 requested — e.g. if a roster of
  9 requests 3 groups against a minimum of 6, is "closest" one group of 9, or
  the largest groupsPerRound that still clears the minimum (here, still only
  1 group is possible)? Needs clarification: is "closest available grouping"
  always "the largest achievable group size ≤ the requested split, falling
  back toward fewer/one group(s) until the minimum is met or a single group
  is reached," or something else?
- **Does the group-size-minimum warning apply at `saveSpec` time, `generate`
  time, or both?** AC1/AC2/AC5/AC6 are all phrased "when the Organiser
  generates a draw" — but `computeWarnings` today also runs inside `saveSpec`
  (riding the save response) and inside `getEvidence` (live recompute). The
  story doesn't say whether saving a spec that will predictably fall short
  should warn immediately (parallel to today's anti-repeat warning at save)
  or only after an actual generate attempt.
- **Does the acknowledgement apply per warning, per candidate, or per
  contest?** D14 says "scoped to that one contest," but AC3/AC4 talk about
  "the warning" singular tied to "the same generated draw" — unclear whether
  re-generating (which supersedes the candidate, per `DrawCandidateSupersededError`)
  requires a fresh acknowledgement, or whether an acknowledgement persists
  across re-generates within the same contest.

#### Edge Cases

- **A multi-task round where some tasks warn and others don't** (AC2): the
  acknowledgement UX/data model must let the CD accept a round where only
  Speed is warned, without appearing to require blanket acknowledgement of
  Duration/Distance too — important because AC4's audit record must show
  *which* task's deviation was accepted.
- **Roster shrinks between generate and accept**: `generate` re-checks
  `assertGroupBound` against the live roster (Safeguard 6 comment at
  `apps/base/src/draw/service.ts:162`), but `accept` currently does no
  roster re-check at all — it only validates the candidate id. If the roster
  changes between generate and accept such that a previously-unwarned task
  now would warn, is the stale candidate still acceptable as-is, or must it
  be regenerated? The story doesn't address this, and the existing `accept`
  code has no re-validation hook to extend.
  Roster changes are Safeguard-6-adjacent behaviour, so any re-validation
  added at accept for this concern should be judged against how
  Safeguard 6 already handles it for the hard bound, to keep the two paths
  consistent.
- **F3K/F5K/F5L specifics**: F3K has a rule-fixed minimum (5) per the
  Background section but the story text's enumerated list of minima
  ("F3J ≥ 6; F3K ≥ 5; F5J ≥ 6") doesn't list a rule clause number for F3K or
  F3J the way it does for F3B Speed ("F3B.1.8b") — the Non-Functional
  Expectation requires citing "the exact rule clause," so the specific clause
  strings for F3J, F3K, F5J (and Duration/Distance's own F3B clauses) must be
  sourced from `docs/requirements/rules/f3j.md`, `f3k.md`, `f5j.md`, `f3b.md`
  before the warning messages can be written — not yet done in this analysis
  (house-keeping rule 1: those docs are read-only reference material to pull
  the exact clause numbers from, not to be altered).
- **`minGroupSizeOverride` already saved on an existing spec**: what happens
  to a spec that already has a non-null override value once this mechanism
  supersedes it? Does the override still relax the bound (backward
  compatible), get ignored outright, or trigger a migration/warning of its
  own? Not addressed.

#### Technical Risks

- **STORY-001-020 is not yet implemented — resolved by sequencing, not by
  building it inside this story.** Neither `spdd/analysis/` nor
  `spdd/prompt/` contains a STORY-001-020 file, and `apps/base/src/draw/service.ts`
  still resolves one shared minimum per round via `resolveMin`'s
  max-across-tasks logic — there is no per-task grouping in the codebase
  today. Per the sequencing decision above (Strategic Approach → Key Design
  Decisions), this story proceeds against today's per-round model and
  explicitly defers AC2 (which needs `RoundDraw`/`FlightGroup`/`GeneratedDraw`,
  `packages/shared/src/draw.ts:74-115`, to know results per-task — they
  currently hold one grouping per round, not one per task) to when
  STORY-001-020 lands. The residual risk is process, not technical: AC2 must
  be tracked as a known-incomplete AC on this story's delivery, not silently
  marked done, and STORY-001-020's own AC4 (which depends on 022's mechanism)
  should be re-verified once both stories are in, since 022 will have been
  built against a narrower (per-round) shortfall model than 020 ultimately
  needs.
- **`assertGroupBound` currently conflates two different bounds in one
  function and one error type** (`GroupSizeOutOfBoundsError`,
  `apps/base/src/draw/service.ts:335-370`): the rule-fixed minimum
  (`maxByMin`) and the D1 floor (`maxByD1`) are combined into a single
  `upper = Math.min(maxByMin, maxByD1)` bound and a single thrown message.
  Splitting these so only the D1 branch still throws, while the
  rule-fixed-minimum branch instead returns/signals a warning, is a
  non-trivial refactor of both the bound arithmetic and the two call sites
  (`saveSpec`, `generate`) — and this same function is exactly what
  STORY-001-020 says it must "reshape" too (its own Key Constraints:
  "the domain model... and the generation/fairness algorithm... are
  currently built around one grouping per round; this reshapes both").
  Sequencing which story touches `assertGroupBound`/`resolveMin` first
  matters to avoid two overlapping rewrites of the same function landing out
  of order.
- **Generation currently either fully succeeds or fully fails** (`generate`,
  `apps/base/src/draw/service.ts:148-219`): `runAttempt` returns `null` on a
  dead-ended attempt and the loop simply discards it; if *all* 200 attempts
  return null the whole generate call throws `DrawGenerationFailedError` with
  nothing appended. Producing "the closest available grouping" for a task
  that can't meet its minimum is a different code path than today's
  all-or-nothing attempt loop — it needs the algorithm to knowingly relax the
  group-count/size target for that task (not just tolerate a worse fairness
  score, which is what the anti-repeat soft-warning path already does) and
  still produce a materialisable result. This is more than a
  message-and-bound change; it touches `runAttempt`'s capacity/candidate
  logic (`groupCapacities`, the `candidates` filter).
- **Event payload extension for the acknowledgement is a schema change on an
  append-only log** (D4): extending `draw.accepted`'s payload (currently
  `{ competitionId, drawId, specId }`,
  `apps/base/src/draw/service.ts:247`) or introducing a new event type to
  carry the acknowledgement must not break replay of already-appended
  `draw.accepted` events from STORY-001-017's existing tests/fixtures — an
  additive field with a safe default (e.g. `acknowledgedWarnings: []` when
  absent) is the low-risk direction, but this needs to be an explicit design
  decision in the Canvas phase, not assumed.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Roster below a single-task class's minimum still generates, with a named warning | Yes | Achievable against today's single-grouping model; needs the rule-clause lookup for F3J (F3J.6.1 is cited in the AC itself, confirming the clause exists to reference) and the "closest available grouping" fallback in `runAttempt`/`assertGroupBound`. |
| 2 | F3B Speed's shortfall named distinctly from Duration's/Distance's | Deferred (by design) | Per the sequencing decision, this AC is knowingly out of reach until STORY-001-020's per-task grouping lands — today's `RoundDraw` has one grouping per round, so Duration/Distance/Speed cannot currently carry independent results or independent warnings. Track as an explicit known-incomplete AC on this story's delivery, closed out when 020 lands. |
| 3 | Unacknowledged warning blocks acceptance | Yes | `DrawService.accept` has a clear extension point (new precondition before the `eventStore.append` call); needs the acknowledgement-tracking design decided in Canvas. |
| 4 | Acknowledging permits acceptance and is recorded | Yes | Needs the event payload extension (Technical Risk above) and a way to pass the acknowledgement into `accept`'s signature/route. |
| 5 | Roster meeting every task's minimum generates with no warning | Yes | Directly testable against existing `computeWarnings`-style logic once the group-size-minimum warning kind is added; must confirm the boundary is inclusive (`R === minGroupSize * groups` → no warning), matching `assertGroupBound`'s existing `<` vs `<=` conventions. |
| 6 | Classes with no rule-fixed minimum unaffected | Yes | Straightforward — `TaskParameterSet.minGroupSize === null` for F5K/F5L already exists as a check point (mirrors `resolveMin`'s existing `.filter((v): v is number => v !== null)`). |
