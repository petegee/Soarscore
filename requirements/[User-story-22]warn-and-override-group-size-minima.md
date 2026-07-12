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
