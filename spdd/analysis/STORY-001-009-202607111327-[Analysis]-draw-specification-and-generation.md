# SPDD Analysis: Draw Specification and Generation

> **First algorithmic, per-competition-content story after the master-data /
> configuration run (003–008, 016).** Everything before this produced *setup*
> state — pilots, competitions, class models, rosters, task config. STORY-001-009
> is the first story that **derives new contest content** (flight groups over N
> rounds) from that setup by running a fairness algorithm, and the first to make
> a *randomised* decision that the immutable event log must capture rather than
> recompute. Two seams planted by earlier stories land here: the roster's
> `DrawStateProvider.hasAcceptedDraw` (RD3/RD4) and the task-config overlay's
> round-keyed overrides that were "tolerated… the draw is STORY-001-009". This
> analysis's central jobs are (a) to place the draw as a persisted *decision*
> aggregate in the existing event-sourced substrate, (b) to separate **generate**
> (this story) from **accept / re-draw** (Area 4.3, the Contest Director's, out
> of scope), and (c) to surface a real data gap: **group-size bounds have no home
> in the current model**, yet AC1 turns on them.

> ## Resolved Design Decisions (interactive, 2026-07-11)
>
> The three questions this analysis flagged were settled with the user before
> REASONS Canvas; they are **inputs, not open questions**:
>
> 1. **Group-size bounds: model default + spec override, plus a derived 50 % cap
>    (confirmed).** A rule-fixed `minGroupSize` slot is added to `TaskParameterSet`
>    (additive, NFR-2), seeded from the rule docs (house rule 1) — **F3B per task
>    5 / 3 / 8** (`F3B.1.8b`), **F3J 6** (`F3J.6.1`, preferred 8–10),
>    **F3K 5** (`F3K.9.1`), **F5J 6** (`5.5.11.14.1`); F5K/F5L state none. The
>    draw spec may **override** the minimum with an explicit deviation warning
>    (the 3.6 guardrail pattern). **New hard maximum — 50 % of the roster:** under
>    D1 the Scorer *is* the timekeeper and Scorers are drawn from the non-flying
>    pilots, so a flying group of *G* needs *G* scorers from the remaining
>    *(roster − G)* pilots ⇒ **G ≤ roster / 2**, i.e. **≥ 2 groups per round**.
>    This is an **MVP operational constraint derived from D1** (which waives the
>    FAI helper/official separation), *not* a rule-doc number — so it is recorded
>    in the requirements/decisions docs, never in `rules/`. It aligns with the
>    FAI "prefer fewest groups, most per group / 8–10" at MVP scale (16–20 pilots
>    → 2 groups of 8–10). The **exception** — spare, dedicated non-flying timers —
>    relaxes the cap and is expressed as the same spec override. **Consequence:**
>    AC1's bound is now fully defined (min from task/spec, max from roster/2), and
>    the roster-14/groups-4 example resolves cleanly (only 2 groups of 7 is valid).
>    *Recorded 2026-07-11:* the 50 % cap is now written up as a D1 consequence
>    (`decisions.md`) and surfaced in Area 4.1 (`high-level-requirements.md`),
>    scoped to **qualifying** rounds (fly-offs, a single group, stay a Future
>    Enhancement not subject to the floor).
>
> 2. **Fairness metric is Organiser-selected, one of three (confirmed).** The
>    metric becomes a **draw-specification choice** set at competition/draw-config
>    time — an enum of: (a) **min-max-meets then min-total-excess** (lexicographic —
>    minimise the worst repeat, tiebreak on summed excess meetings); (b)
>    **min-total-excess** (summed repeat pairings only); (c) **min-variance**
>    (evenness of the meet-count distribution). Generation runs its *K* attempts
>    and retains the fairest **by the Organiser's chosen metric**; the evidence
>    read-model reports both the chosen metric's value and the raw matchup
>    distribution (AC4). This is an additive spec field — no code branch on
>    discipline.
>
> 3. **`hasAcceptedDraw` stays false until Area 4.3 (confirmed).** This story
>    generates **candidate** draws only; nothing accepts one yet, so the real
>    provider keeps returning `false` and roster editing stays freely open. The
>    seam's documented "accepted, not merely generated" contract is honoured with
>    zero scope creep; the positive `DrawStateProvider` wiring lands with the CD's
>    accept/re-draw story (4.3). No `draw.accepted` event in this story.
>
> 4. **Round count N lives on the draw spec, validated ≤ 8 (confirmed).** N is
>    part of the saved, validated specification (D7 cap), so AC1/AC2 feasibility
>    checks reason about it and it is template-friendly. Re-generating with a
>    different N edits the spec first. This is the story that finally gives the
>    round numbers task-config's `roundOverrides` have been speculatively keyed
>    against a concrete range (1..N).
>
> 5. **Consecutive-flight is a configurable toggle, default OFF (confirmed).**
>    The club's normal, accepted practice is **not** to avoid back-to-back
>    flights, so the constraint ships **disabled by default** and is an opt-in
>    spec flag. When **enabled**, it uses the (always-present) group flying order
>    to forbid a pilot appearing in the **last group of round r and the first
>    group of round r+1** (one group's rest across the boundary). **Groups are
>    stored ordered regardless of the toggle** — the flying order of groups is set
>    by the draw for the board/audio sequence (Area 6) and to anchor lane spots
>    (Decision #6); the toggle only adds the boundary-rest rule. This reframes
>    AC3's "with a consecutive-flight constraint enabled" as the opt-in path, not
>    the default behaviour.
>
> 6. **Lane = explicit per-slot spot number + policy enum (confirmed).** Each
>    group membership carries an explicit **lane** (flight-line launch/landing
>    spot index, `users.md:221` "in which lane"; `f3j.md:117` "launching/landing
>    spots"), and the draw spec holds a **lane-allocation policy** enum (e.g.
>    rotate-across-rounds / fixed-by-contest-number / random). This is the full
>    model STORY-001-010 (manual lane reassignment) and the pilot-facing "your
>    lane" reports build directly on — lanes are materialised **now**, not
>    deferred.
>
> 7. **Latest candidate wins — supersede, never overwrite (confirmed).** Each
>    successful generation appends a `draw.generated` event; the projection
>    surfaces the **most recent** as the current candidate. Regeneration
>    supersedes; the immutable log retains prior attempts for audit (D4). Mirrors
>    the roster supersede-not-overwrite idiom; the read model holds one current
>    candidate, not a comparison set (multi-attempt comparison, if ever wanted,
>    is the CD's Area 4.3 concern).

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-9]draw-specification-and-generation.md`.

# [STORY-001-009] Draw Specification and Generation

> Source: `docs/user-stories/01-organiser.md` §3.5, §4.1, §4.2 · `docs/requirements/high-level-requirements.md` Areas 3.5, 4.1, 4.2 · `docs/requirements/rules/00-general-rules.md` §1
> Module: 001 (Organiser MVP) · Estimated effort: **5 days**

### Background

A contest is a sequence of rounds, each split into groups that fly a shared
working time and are scored man-on-man. Fairness rests on the draw: a random
initial order, group composition changing every round so any two pilots meet
as few times as possible (an anti-repeat matrix), a lane-allocation policy,
and a consecutive-flight constraint so nobody flies back-to-back groups
without a break. The Organiser specifies the draw, generates it — keeping the
fairest of several attempts — and presents its fairness evidence to the
Contest Director, whose authority it is to accept or re-draw. The draw
should also avoid producing a group with only one scoring pilot, because a
lone pilot would otherwise bank an automatic 1000.

### Business Value

- Provide the Organiser with a generated draw that is fair and defensible for
  a roster of up to 20 pilots over up to 8 rounds per day.
- Support fairness evidence (matchup distribution, fairness metric) the
  Contest Director uses to accept or reject the draw.
- Enable clear failure instead of a silently unfair or invalid draw.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-005 (roster), STORY-001-004 (discipline —
  group-size bounds are class-informed, e.g. F3J prefers 8–10 per group).
- **Data assumptions**: MVP assumes all competitors on 2.4 GHz and no teams,
  so frequency and team-separation constraints are out of scope.
- **Integration points**: the accepted draw feeds lane adjustment
  (STORY-001-010), group management (STORY-001-011) and draw reports
  (STORY-001-015). Accepting/re-drawing (4.3) is the Contest Director's
  story, not this one.
- **Business constraints**: progressive/seeded draws (fly-off re-draws) are
  Future Enhancements.

### Scope In

- Draw specification: draw mode (random initial order + anti-repeat intent),
  groups-per-round within roster/task bounds, consecutive-flight constraint,
  lane-allocation policy.
- Generation for N rounds over multiple attempts, retaining the fairest by
  the matchup-distribution metric.
- Fairness evidence review; lone-pilot-group avoidance; clear failure when no
  valid draw exists.

### Scope Out

- Draw acceptance / re-draw decision — Contest Director (Area 4.3).
- Manual lane reassignment (STORY-001-010).
- Frequency and team-separation constraints — Future Enhancements.

### Acceptance Criteria

#### AC1: Groups-per-round bounds are enforced
**Given** a roster of 14 pilots and a task whose groups need at least 5
pilots each
**When** the Organiser sets groups-per-round to 4 (which would force groups
below 5)
**Then** the system rejects the value and explains the bound implied by
roster size and group limits.

#### AC2: Constraint conflicts warn instead of silently degrading
**Given** a draw specification whose constraints cannot all be satisfied for
this roster and task
**When** the Organiser saves it
**Then** the system warns which constraints cannot be met rather than later
generating a silently unfair draw.

#### AC3: Generation honours the constraints
**Given** a valid specification for 8 rounds with a consecutive-flight
constraint enabled
**When** the Organiser generates the draw
**Then** flight groups are produced for all 8 rounds, no pilot is drawn into
back-to-back groups where the constraint forbids it, and group composition
varies round to round per the anti-repeat intent.

#### AC4: Fairest of several attempts is retained
**Given** generation runs multiple attempts
**When** it completes
**Then** the retained draw is the fairest attempt by the
matchup-distribution metric, and the Organiser can see that metric and the
matchup distribution for the Contest Director's accept/re-draw decision.

#### AC5: Lone-pilot groups are avoided where possible
**Given** a roster whose size allows every group at least two scoring pilots
**When** the draw generates
**Then** no group contains only one scoring pilot; **and given** a roster
that makes a single-pilot group unavoidable, **then** the draw is produced
with the lone-pilot group flagged so the STORY-001-011 safeguard applies at
scoring time.

#### AC6: Impossible draws fail clearly
**Given** a roster or specification for which no valid draw exists
**When** the Organiser generates
**Then** the system reports a clear failure with the reason, and no invalid
draw is stored.

### INVEST Check

Independent (algorithmic feature over the roster) · Valuable (the fairness
backbone of the contest) · Small enough (5 days, 3 functional points:
specification, generation with fairness retention, evidence/failure
handling) · Testable.

---

## Domain Concept Identification

The story splits into three concerns the codebase treats differently: a
**specification** (persisted operator input, validated like every other
config aggregate), a **generation** (a one-shot randomised algorithm whose
*outcome* — not its process — is the durable fact), and **fairness evidence**
(a derived read-model over the retained outcome). The dominant architectural
question is therefore not "what algorithm" but **"what is the persisted unit of
truth, and how does it survive event-log replay"**, because the draw is the
project's first non-deterministic decision.

The existing substrate is a textbook event-sourced CQRS stack:
`EventStore` (the sole writer of the `events` table, D4) → typed events keyed
by a `scope` discriminator → per-module in-memory **projections** rebuilt from
the log on boot → **services** that guard invariants and append events →
Fastify **routes**. Per-competition content aggregates (roster, task-config)
file under `scope = competitionId`; master data files under fixed scopes
(`competitions`, `master-data`). The draw is unambiguously per-competition
content, so it follows the **roster / task-config template** for a
`scope = competitionId` aggregate.

### Existing Concepts (from codebase)

- **RosterEntry** (`packages/shared/src/roster.ts`, projection in
  `apps/base/src/roster/`): the input population for the draw. Crucially it
  carries a **stable seat id** (`RosterEntry.id`) that survives pilot
  replacement (RD4 — "the seat carries draw slots forward"). The draw's group
  membership must key on **`rosterEntryId`, not `pilotId`**, so a replacement
  entrant inherits the drawn slot with no draw rewrite — this is an explicit,
  already-documented contract in `roster/state-providers.ts`.
- **`DrawStateProvider` / `NoAcceptedDrawProvider`**
  (`apps/base/src/roster/state-providers.ts`): the planted seam this story
  fills. Its contract is load-bearing and precise — *"exists means an
  **accepted** draw (not merely generated) — that is what flips free roster
  editing off"* and it is *read-only by design*. This tells us two things: (a)
  generating a draw here must **not** by itself report `hasAcceptedDraw = true`
  (acceptance is 4.3), and (b) the roster's remove/replace gates
  (`RosterRemoveRequiresReplacementError`, the replace confirmation) are the
  downstream consumers that will start firing once a draw is *accepted*.
- **Competition** (`packages/shared/src/competition.ts`): the aggregate the
  draw hangs off (`competitionId`), and the carrier of `classModelId`. Note its
  `competitionConfigurationFields` comment: *"Any field added here must be added
  to the template snapshot and seed mapping in the same change
  (STORY-001-007/008/009 obligation)"* — an explicit forward-reference to this
  story, relevant **if** the draw specification is deemed template-snapshottable
  (see Risks — it likely is *not*, as it is roster-dependent).
- **ContestClassModel / TaskParameterSet**
  (`packages/shared/src/class-model.ts`): the class's rule-fixed shape. This is
  where AC1's *"group limits"* and STORY-001-004's *"group-size bounds are
  class-informed (F3J 8–10)"* would naturally live — **but no such field
  exists today** (the model carries basis, drop-worst, per-task precision/rate/
  landing/penalty/NLH, and nothing about grouping). This is the story's primary
  data gap (see Risks & Gap Analysis).
- **CompetitionTaskConfig** (`packages/shared/src/task-config.ts`): already
  holds `roundOverrides: Record<number, number>` keyed by **round number**, with
  the comment *"Overrides for not-yet-created or later-removed rounds are
  tolerated (the draw is STORY-001-009)."* This story is what finally gives
  round numbers real identity — the draw is the authority on **how many rounds
  exist and what a round number denotes**.
- **Event-sourcing substrate** (`EventStore`, `buildApp` wiring, the
  projection/service/routes triad, the `setErrorHandler` domain-error → HTTP
  mapping): the fixed pattern the draw module slots into. Every new domain error
  needs a branch in `app.ts`'s error handler; every new projection must be
  rebuilt from `eventStore.readAll()` on boot.
- **`Attribution`** (`packages/shared/src/attribution.ts`): every mutation
  records actor/origin/authority. The generate action is an attributed Organiser
  command like any other.

### New Concepts Required

- **Draw specification** — the persisted operator-chosen policy: draw mode
  (random initial order + anti-repeat intent), **groups-per-round**, the
  **consecutive-flight constraint** toggle, and the **lane-allocation policy**.
  A per-competition aggregate (one spec per competition), validated against
  roster size and group bounds. Relates to `Competition` (1:1 overlay) and reads
  bounds from the class model / task.
- **Round count (N)** — the number of qualifying rounds to generate, **on the
  draw spec, validated ≤ 8** (Decision #4 / D7). Gives task-config's round-keyed
  overrides a concrete range (1..N) for the first time.
- **Generated draw (the outcome)** — the durable result: for each round, an
  **ordered** sequence of groups (flying order, always present — Decision #5),
  each an ordered list of memberships carrying an explicit **lane** spot number
  and a `rosterEntryId` (Decision #6), plus the retained attempt's **chosen
  fairness metric value** and **matchup distribution**. The event payload
  captures this verbatim so replay reproduces the *same* draw without
  re-randomising; regeneration supersedes (Decision #7).
- **Anti-repeat matrix / matchup distribution** — the pairwise
  "how many times have pilots X and Y shared a group" count across rounds; the
  objective the generator minimises and the evidence surface for the CD (AC4). A
  derived, presentable structure.
- **Fairness metric (Organiser-selected)** — the scalar that ranks attempts
  (AC4), now an **enum chosen on the draw spec**: min-max-meets-then-total-excess
  (lexicographic) / min-total-excess / min-variance (Resolved Decision #2).
  Generation retains the fairest attempt *by the chosen metric*; the evidence
  read-model reports its value plus the raw distribution.
- **Consecutive-flight constraint (opt-in toggle, default OFF)** — a
  configurable spec flag (Decision #5); the club's normal practice does not avoid
  back-to-back flights. When enabled it forbids a pilot in the **last group of
  round r and the first group of round r+1**, using the always-present group
  flying order. Groups are stored **ordered** whether or not the toggle is on.
- **Lane + lane-allocation policy** — greenfield but now modelled (Decision #6):
  a **lane** is an explicit flight-line launch/landing spot index on each group
  membership; the spec carries a **policy** enum (rotate / fixed-by-contest-
  number / random). Lanes are materialised in the draw here; manual reassignment
  is STORY-001-010.
- **Group-size bounds (min/max per group)** — the limits AC1 enforces against
  (Resolved Decision #1). **Minimum:** a rule-fixed `minGroupSize` slot on
  `TaskParameterSet` (F3B per task 5/3/8; F3J/F5J 6; F3K 5; F5K/F5L none),
  overridable on the spec with a deviation warning. **Maximum:** derived from the
  roster — `G ≤ roster/2` (D1: non-flying pilots score the flying group), i.e.
  ≥ 2 groups per round, with a spec override for the spare-timer exception. An
  MVP operational constraint (D1-derived), recorded in requirements, not `rules/`.
- **Generation failure** — a first-class, *non-persisted* outcome (AC6): a clear
  reason with **no** draw event stored. Distinct from a saved-but-flagged draw
  (AC5's unavoidable lone-pilot case, which **is** stored).
- **Lone-pilot flag** — a per-group marker on the stored draw when a
  single-scoring-pilot group was unavoidable, so the STORY-001-011 safeguard
  (insert a random dummy to normalise against; F3B annuls instead) fires at
  scoring time. Here we only *avoid where possible* and *flag where not*.

### Key Business Rules

- **Draw = anti-repeat over rounds (general-rules §1):** initial order is a
  random draw (`C.16.2.6`); group composition changes every round so any two
  pilots meet as few times as possible. This is the algorithm's objective and is
  authoritative — the software must not contravene it (house rule 1).
- **Man-on-man grouping, MVP simplifications (general-rules §1 + CLAUDE.md):**
  frequency-follows-frequency (F3B/F3J/F3K) and team separation are **retained
  as sport reference but out of MVP software scope** (all-2.4 GHz, no teams). The
  draw must not implement them; scoping them out is legitimate and already
  recorded — do **not** edit the rule docs.
- **No lone scoring pilot (general-rules §3 + Area 5.3):** a one-pilot group
  would auto-bank 1000 under best-raw=1000 normalisation. Avoid it in generation;
  where unavoidable, flag for the 5.3 dummy safeguard. Note F3B's variant — it
  **annuls** a one-valid-result group rather than inserting a dummy — but that is
  a *scoring-time* consequence (5.3), not a draw-time branch here.
- **Generate ≠ accept (Area 4.2 vs 4.3):** this story produces and presents;
  acceptance/re-draw is the CD's authority (out of scope). The stored draw is a
  *candidate* until 4.3 accepts it — so `hasAcceptedDraw` must stay driven by an
  **acceptance** fact, not mere existence of a generated draw.
- **Scale bounds (D7):** ≤ 20 pilots, ≤ 8 rounds/day. The multi-attempt search
  runs comfortably within these bounds — no performance concern at MVP scale.
- **Immutable log / derived projections (D4/D7):** the draw *outcome* is a
  decision and must be an event payload; the projection is pure replay and must
  **never** re-run the randomiser. This is the load-bearing determinism rule.
- **Seat-keyed membership (RD4):** groups reference `rosterEntryId`, so a
  post-draw pilot replacement inherits the slot without a draw rewrite.

---

## Strategic Approach

### Solution Direction

Model the draw as **two persisted facts plus one derived read-model**, all on a
new per-competition aggregate filed under `scope = competitionId`, reusing the
roster / task-config module template end-to-end:

1. **Draw specification** — an operator-saved policy aggregate (draw mode,
   groups-per-round, consecutive-flight toggle, lane policy, round count if it
   lives here). Its **save-time validation** enforces AC1 (groups-per-round
   against roster size and group-size bounds) and AC2 (warn which constraints
   cannot be jointly satisfied). This mirrors how `CompetitionTaskConfigService`
   validates against a sibling aggregate (the class model) that Zod cannot see —
   structural checks in the schema, cross-aggregate/roster checks in the service.

2. **Generated draw outcome** — a `draw.generated` event whose payload is the
   **fully materialised result**: ordered groups per round (lists of
   `rosterEntryId`), the retained fairness metric, the matchup distribution, and
   any lone-pilot flags. Generation is a service method that: reads the live
   roster + spec + bounds, runs *K* randomised attempts of the anti-repeat/
   consecutive-flight/lane algorithm, scores each by the fairness metric, retains
   the best, and appends the outcome. **On failure (AC6) it appends nothing** and
   throws a clear domain error. The projection replays the stored outcome
   verbatim — **no RNG in the projection** (the determinism rule).

3. **Fairness evidence read-model** — derived from the retained outcome for the
   CD's accept/re-draw decision (AC4). Presented via a GET route; consumed later
   by Area 4.3 and draw reports (STORY-001-015).

General data flow (consistent with existing modules): REST route → service
(validate spec against roster + bounds / run generation, append event) →
projection (replay outcome) → read-model consumed by evidence, reports, and the
real `DrawStateProvider`.

The real `DrawStateProvider` is wired here but **keyed on acceptance**: until
Area 4.3 exists there is no accept event, so it can legitimately continue to
report `hasAcceptedDraw = false` (a generated-but-unaccepted candidate does not
lock roster editing). The seam swap is real but its *positive* answer waits for
4.3 — this must be stated explicitly so the wiring isn't mistaken for "draw
exists ⇒ locked".

### Key Design Decisions

- **Where group-size bounds live — RESOLVED (Decision #1):** rule-fixed
  `minGroupSize` on `TaskParameterSet` (grounded in the rule docs — F3B 5/3/8,
  F3J/F5J 6, F3K 5), spec-overridable with a deviation warning, plus a
  D1-derived **max = roster/2** (spare-timer exception via the same override).
  The rule docs *do* fix per-class minima, so the model slot honours house rule 1
  without invention; the maximum is an operational constraint, not a rule number.
- **Randomness persistence: outcome vs. seed** — persist the fully materialised
  draw vs. persist only an RNG seed + parameters and recompute on replay.
  *Trade-off:* a seed is compact but couples replay to the *exact* algorithm
  version forever (any generator change silently alters historical draws — a D4
  violation in spirit); a materialised outcome is larger but is the actual
  immutable fact and is algorithm-version-independent. → **Recommendation:**
  persist the **materialised outcome** (groups + metric + distribution). The
  projection is a pure loader. (Strongly aligns with the existing "payloads are
  denormalised for audit" convention.)
- **Where round count N lives — RESOLVED (Decision #4):** on the saved spec,
  validated ≤ 8 (D7), so AC1/AC2 reason about it and it is template-friendly; a
  re-generate with a different N edits the spec first.
- **Consecutive-flight semantics & group ordering — RESOLVED (Decision #5):**
  groups are stored as an **ordered sequence** (flying order — needed for lanes,
  the board/audio, and the constraint) *regardless* of the toggle. The
  consecutive-flight rule is an **opt-in spec flag, default OFF** (the club does
  not normally avoid back-to-back); when on, it forbids a pilot in the last group
  of round *r* and the first of *r+1*.
- **Generate as event vs. transient preview — RESOLVED (Decision #7):** persist
  each successful generation as a `draw.generated` event; the projection surfaces
  the **latest** as the current candidate (re-generation supersedes, log keeps
  prior attempts for audit — the roster idiom). Not a comparison set; acceptance
  (4.3) is a separate later event. The failure path (AC6) appends nothing.

### Alternatives Considered

- **Persist an RNG seed and recompute the draw on replay:** rejected — makes the
  immutable log's meaning depend on the current algorithm build; a later
  generator tweak would rewrite history. Contradicts D4's intent.
- **Put the draw on the class model or a global master-data scope:** rejected —
  the draw is roster-dependent, per-competition content; it belongs under
  `scope = competitionId` like roster/task-config, not on the reusable class
  shape.
- **Flip `hasAcceptedDraw` on generation:** rejected — violates the seam's
  documented contract ("accepted, not merely generated") and would prematurely
  lock roster editing before the CD has accepted (4.3).
- **Snapshot the draw spec into contest templates (per the competition-config
  comment):** rejected for the *generated draw*, and probably for the *spec* too —
  the draw depends on the concrete roster, which a reusable template does not
  carry. Groups-per-round/round-count *might* be template-snapshottable as
  defaults; treat as a separate question, not assumed.
- **Insert the lone-pilot dummy at draw time:** rejected — the dummy/annulment is
  a *scoring-time* safeguard (Area 5.3 / STORY-001-011). Here we only avoid, and
  flag when unavoidable.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **~~Group-size bounds have no home (blocks AC1)~~ — RESOLVED (Decision #1):**
  rule-fixed `minGroupSize` on `TaskParameterSet` (F3B 5/3/8, F3J/F5J 6, F3K 5),
  spec-overridable, plus a D1-derived **max = roster/2** (≥ 2 groups per round;
  spare-timer exception via override). AC1's bound is now fully defined and the
  roster-14/groups-4 example resolves (only 2 groups of 7 is valid). *Recorded
  2026-07-11* in `decisions.md` (D1 consequence) and Area 4.1, scoped to
  qualifying rounds.
- **~~Fairness metric is undefined~~ — RESOLVED (Decision #2):** an
  **Organiser-selected** enum on the draw spec — min-max-meets-then-total-excess
  (lexicographic) / min-total-excess / min-variance. Generation retains the
  fairest by the chosen metric; evidence reports its value + the distribution.
- **~~Consecutive-flight "back-to-back" reading~~ — RESOLVED (Decision #5):**
  opt-in spec toggle, default OFF; when on, forbids last-of-*r* → first-of-*r+1*.
  Groups are stored ordered regardless.
- **~~What a "lane" is, and what lane policies exist~~ — RESOLVED (Decision #6):**
  a lane is an explicit flight-line spot index per group membership; the spec
  carries a policy enum (rotate / fixed-by-contest-number / random). Materialised
  in the draw now; STORY-001-010 does manual reassignment.
- **~~Round count ownership and default~~ — RESOLVED (Decision #4):** on the draw
  spec, validated ≤ 8 (D7).
- **~~Generation persistence policy~~ — RESOLVED (Decision #7):** latest candidate
  wins (supersede); the read model holds one current candidate, the log retains all.
- **"Scoring pilot" definition (AC5) — still open (low-stakes).** With no teams
  and retirement out of scope here, every rostered entrant is a scoring pilot, so
  a lone-pilot group is a pure arithmetic artifact (roster size vs.
  groups-per-round × group sizes). Worth confirming there is no other
  "non-scoring" category at draw time; safe to carry into REASONS Canvas.
- **Generation persistence policy.** Whether every successful generation persists
  as a candidate (log keeps all attempts) or only the latest is retained is
  unspecified; AC6 only governs the failure path.

### Edge Cases

- **Replay must not re-randomise.** If the projection recomputes the draw from a
  seed or re-runs generation, a rebuild produces a *different* draw and silently
  corrupts a running contest. The stored outcome must be replayed verbatim — the
  single most important correctness constraint.
- **Roster changes after generation.** A generated (unaccepted) draw references
  `rosterEntryId`s; if a pilot is added/removed on the roster before acceptance,
  the candidate draw is stale. Seat-keying (RD4) covers *replacement*, but
  add/remove changes the population — needs a stale/regenerate story (likely: the
  Organiser re-generates; acceptance in 4.3 is what freezes it).
- **Indivisible roster (unavoidable lone pilot, AC5 second branch).** E.g. an odd
  count that any grouping leaves a singleton — must **store** the draw with the
  group flagged (not fail). Distinct from AC6's *no valid draw* (store nothing).
- **Impossible specification (AC6).** Groups-per-round that cannot satisfy the
  min group size for the roster, or a consecutive-flight constraint unsatisfiable
  for the round count — must fail clearly with a reason, storing nothing.
- **Anti-repeat infeasibility at MVP scale.** With ≤ 20 pilots and up to 8
  rounds, some pairs *must* repeat once group count is small; the metric must
  degrade gracefully (minimise repeats) rather than fail — "fewest possible", not
  "zero".
- **Attempt count K.** Too few attempts under-explores; the retained-fairest
  guarantee (AC4) is only "fairest of the attempts run", not global optimum — the
  evidence surface should make that honest.
- **F3B lone-valid-result nuance.** F3B *annuls* rather than dummies a
  one-valid-result group — but that is a scoring-time branch (5.3), not a
  draw-time one; the draw layer only flags the structural lone-pilot group.

### Technical Risks

- **Determinism under event-log replay (highest).** The randomised generator must
  live in the *service/command* path only; the projection must be a pure loader
  of the stored outcome. Any RNG leakage into replay breaks D4's guarantees.
  *Mitigation:* payload carries the full materialised draw; a rebuild test asserts
  identical groups before/after replay.
- **New aggregate wiring in `buildApp`.** The draw module must add a projection
  (rebuilt from `readAll()`), a service, routes, and **error-handler branches in
  `app.ts`** for its new domain errors (following the roster/task-config
  precedent). Missing the projection rebuild or the `scope = competitionId` filing
  breaks audit/replay; a missing error branch surfaces as a 500 instead of a 4xx.
- **The `DrawStateProvider` swap — RESOLVED (Decision #3):** the provider stays
  `NoAcceptedDrawProvider` (returns `false`) this story — generation produces
  candidates only; acceptance is Area 4.3. No accidental roster lock, no accept
  event here. The residual work is purely wiring the real provider in 4.3.
- **Group-size bounds sourced from rule docs (house rule 1) — RESOLVED
  (Decision #1):** the `minGroupSize` seed values are transcribed from the rule
  docs (F3B `F3B.1.8b` 5/3/8, F3J `F3J.6.1` 6, F3K `F3K.9.1` 5, F5J
  `5.5.11.14.1` 6; F5K/F5L none → `null`). The **max = roster/2** is D1-derived,
  not a rule number, so it lives in requirements/decisions, never in `rules/`.
  Residual: cite the rule-doc line per seeded value in code comments, as the
  existing stock models do; add `minGroupSize` to `deriveDeviations` and the
  clone deep-copy so an overridden min surfaces as a model deviation if edited.
- **Cross-aggregate validation timing.** AC1/AC2 validate the spec against the
  *live* roster and bounds; like `RosterService`/`CompetitionTaskConfigService`,
  these checks belong in the service (Zod cannot see sibling aggregates). A spec
  saved when the roster later shrinks can become invalid — decide whether that is
  re-checked at generate time (recommended) as well as save time.
- **Ordered-group structure ripples.** Introducing ordered groups + lanes now
  sets the shape STORY-001-010 (lane reassignment) and STORY-001-011 (group
  management) build on; getting the outcome payload shape right the first time
  avoids a reshape across three stories.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Reject groups-per-round that forces groups below the min size; explain the bound | Yes (Decision #1) | Bounds now defined: min from `TaskParameterSet.minGroupSize` (spec-overridable), max = roster/2 (D1). A service-level cross-aggregate check over live roster size in the `CompetitionTaskConfigService` idiom (field-named error the companion surfaces). |
| AC2 | Warn which constraints cannot be jointly satisfied at save time | Yes | A joint-feasibility check (groups-per-round × min/max bounds × the opt-in consecutive-flight toggle × N) returning *which* constraints conflict, not a boolean. A *warning*, not a hard reject — distinct from AC1's bound rejection and AC6's failure. All inputs now defined (Decisions #1/#4/#5). |
| AC3 | Generate all N rounds; no forbidden back-to-back; composition varies per anti-repeat | Yes | Core algorithm over ordered groups (Decision #5). The "constraint enabled" clause is the opt-in path (default OFF); composition-varies is the anti-repeat objective. Deterministic once the *outcome* is persisted and replayed verbatim (supersede, Decision #7). |
| AC4 | Retain fairest of K attempts; expose metric + matchup distribution | Yes (Decision #2) | Metric is an Organiser-selected enum on the spec (min-max-meets / min-total-excess / min-variance); generation retains the fairest by it. Evidence is a derived GET (chosen metric value + distribution) consumed by 4.3 and reports (015). "Fairest of the attempts run", not global optimum. |
| AC5 | Avoid lone-pilot groups; where unavoidable, store the draw with the group flagged | Yes | Two branches: avoid in generation (arithmetic on roster size vs. group sizes) and flag-and-store when unavoidable. The flag drives the STORY-001-011 dummy/annulment safeguard at scoring time. Distinct from AC6 (store nothing). |
| AC6 | Impossible draw fails clearly; nothing stored | Yes | The failure path appends **no** event and throws a clear domain error (new error type + `app.ts` branch). Must be distinguished from AC5's store-with-flag case and from AC2's save-time warning. |

---

> **Doc-hygiene note (not part of this story, surfaced per house-keeping rule 2):**
> `CLAUDE.md` still states "Requirements/design phase — **no application code
> yet**." That is stale — a working event-sourced `apps/base` + `apps/companion`
> + `packages/shared` stack exists. Recommend updating CLAUDE.md's "Project
> status" and repository map in a separate housekeeping change (not silently, and
> not inside this story).
