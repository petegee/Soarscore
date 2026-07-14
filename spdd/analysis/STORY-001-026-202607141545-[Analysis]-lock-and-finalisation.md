# SPDD Analysis: Lock & Finalisation — Freeze the Contest and Resolve Its Validity

## Original Business Requirement

# [STORY-001-026] Lock & Finalisation — Freeze the Contest and Resolve Its Validity

> Source: `docs/requirements/high-level-requirements.md` Area 2.3 (Lock), Area 2
> state machine (BetweenGroups → Locked; the minimum-rounds guard branch to
> OfficialResults / NoContest) · `docs/requirements/decisions.md` D3 (failure
> policy — pen-and-paper, CD reconciles at the base), D4 (immutable event log) ·
> Areas 5.6 (score validation), 5.8 (manual entry), 7 (reports) ·
> `docs/requirements/rules/00-general-rules.md` §5 (final classification) and the
> per-class rule docs' minimum-rounds-for-a-valid-contest rule
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

Area 2.3 is the **close-boundary** of a competition — the deliberate act that
mirrors Start Proceedings' begin-boundary (Area 2.2, STORY-001-025). The
lifecycle state machine (STORY-001-024) already governs **when** Lock may fire —
only from **BetweenGroups**, never mid-group — and treats **Locked** as
terminal. Neither STORY-001-024 nor STORY-001-025 computes what Lock actually
does; that resolution was deliberately left unstoried. This story closes that
gap by delivering the **Lock action itself** and the **finalisation** it drives.

Lock does three things. First, it **freezes the competition** against any
further change while keeping reports available — after Lock, no score
correction, no manual entry, no penalty edit is admitted (existing stories
already respect "locked competitions reject changes": STORY-001-012 AC5,
STORY-001-013). Second, Lock is **gated by the Contest Director's end-of-contest
validation pass** (D3): the CD reviews the flagged anomalies surfaced by score
validation (5.6, STORY-001-012), enters any missing scores and overrides
known-incorrect ones via manual entry (5.8), and only then locks — Lock is the
seal placed on top of that pass, not a bypass around it.

Third, at the moment of Lock the **minimum-rounds validity guard** resolves the
terminal Locked state into one of two outcomes:

- **OfficialResults** — the completed rounds **meet** the class's minimum for a
  valid contest, so final results are produced. Reports state the rounds
  actually flown, and drop-worst applies only once the flown count passes the
  class's drop-worst threshold (general-rules §5).
- **NoContest** — the completed rounds fall **short** of the class minimum, so
  the competition is finalised as a **no-contest**: locked, but with **no
  official results** produced. The captured data and the full event log are
  retained (nothing is destroyed — deletion was already barred once proceedings
  started, STORY-001-003 AC5).

The minimum threshold is **not** something the core system knows. It is a
property of the **Contest Class Model** (STORY-001-016), which encodes it from
the per-class rule docs — **4 rounds** for F3J / F5J / F5L, **5 rounds** for
F3K, **1 round + 1 task** for F3B, and **no minimum** for F5K (where finalising
short is purely the Contest Director's judgement). The core reads the threshold
from the model and compares generically; it must **never** branch on discipline
to decide validity (CLAUDE.md class-model law). A locked contest can be locked
at **any** round count — Lock is never blocked by a short count; the count only
decides which of the two terminal outcomes results.

### Business Value

- Provide the Contest Director with a single deliberate act that seals the
  competition, guaranteeing published results can no longer drift.
- Support an honest end-of-contest outcome: a contest cut short below its class
  minimum is recorded as a **no-contest** rather than presented as a valid
  result, while its data survives for the record.
- Enable class-correct finalisation — the validity threshold and drop-worst both
  come from the class model, so every one of the six MVP classes (and any future
  class) finalises correctly with no discipline-specific code.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-024 (lifecycle state & the BetweenGroups→Locked
  edge — this story rides on it and does not re-implement transition legality);
  STORY-001-016 (Contest Class Model — the source of the minimum-rounds
  threshold and the drop-worst threshold); STORY-001-012 (score validation flags
  and correction, 5.6) and Area 5.8 manual entry (the validation-pass mechanism);
  STORY-001-007 (score computation, to produce the final aggregate).
- **Data assumptions**: current lifecycle state and completed-round count are
  derivable from the event log (D4); Contest Director authority is **recorded,
  not enforced** (D1) — the acting person arrives with the request; the class
  model exposes the minimum-rounds-for-valid-contest value (see open questions).
- **Integration points**: Lock is the terminal seal that STORY-001-012 (AC5) and
  STORY-001-013 already honour by rejecting changes to a locked competition;
  finalisation feeds Area 7 reports (STORY-001-014 / 015), which must render the
  OfficialResults vs NoContest distinction. Driven from the companion app; the
  base is headless.
- **Business constraints**: class-agnostic core (CLAUDE.md); MVP is
  qualifying-round only (no fly-off finalisation); offline-first (D6). The rule
  docs under `docs/requirements/rules/` are read-only and authoritative on the
  minimum numbers.

### Scope In

- **The Lock action**: from BetweenGroups the Contest Director locks the
  competition; it becomes **terminal (Locked)** and frozen — no further score
  correction, manual entry or penalty change is admitted — while **reports
  remain available**. The lock is recorded in the immutable event log with the
  acting person and Contest-Director authority (D4).
- **The validation-pass gate (D3)**: Lock is presented as the seal on the
  end-of-contest pass — before locking, the Contest Director is shown the
  outstanding flagged anomalies (5.6) so they can enter missing scores and
  override incorrect ones via manual entry (5.8); Lock proceeds once the CD
  chooses to seal.
- **The minimum-rounds validity guard**: at Lock, the completed-round count is
  compared against the **class model's** minimum-for-a-valid-contest threshold;
  the terminal state resolves to **OfficialResults** (count meets the minimum →
  final results produced, drop-worst applied only past the class threshold) or
  **NoContest** (count below the minimum → locked with no official results,
  captured data and event log retained). Where the class defines **no** minimum
  (F5K), finalising short is allowed as the Contest Director's judgement and
  always yields OfficialResults.

### Scope Out

- **When** Lock is legal and the terminality of Locked — owned by
  STORY-001-024; this story assumes Lock fires only from BetweenGroups and does
  not re-check that.
- The **mechanics** of the validation pass it gates: outlier/gap flagging and
  per-pilot correction (STORY-001-012, 5.6), and bulk manual entry / paper
  fallback (Area 5.8) — this story invokes those as the pre-Lock pass, it does
  not re-implement them.
- **Score computation and drop-worst arithmetic** (STORY-001-007 and the class
  model, STORY-001-016) — finalisation *triggers* the final aggregate and reads
  the drop-worst threshold from the model; it does not define the maths.
- The **content and layout of final reports** — Area 7 (STORY-001-014 / 015);
  this story establishes only that finalisation yields OfficialResults vs
  NoContest for reports to reflect.
- **Unlock / re-open** of a locked competition — Locked is terminal in the MVP
  state machine; any un-lock is out of scope (see open questions).
- Encoding the minimum-rounds threshold **into** the class model — that is
  STORY-001-016's data (see open questions); this story only *reads* it.

### Acceptance Criteria

#### AC1: Locking freezes the competition and keeps reports
**Given** a running F5J competition at a group boundary (BetweenGroups) with 6
rounds completed and all scores captured
**When** the Contest Director locks it
**Then** the competition becomes terminal (Locked), the lock is recorded in the
event log with who locked it and the Contest-Director authority, no further score
correction, manual entry or penalty change is admitted, and its reports remain
available.

#### AC2: Lock is the seal on the end-of-contest validation pass
**Given** a competition with two flagged anomalies outstanding — a missing score
for one pilot and an outlier flight time on another (5.6)
**When** the Contest Director works the pre-Lock pass — enters the missing score
and overrides the incorrect one via manual entry (5.8) — and then locks
**Then** the corrections are recorded and the competition locks with those
resolutions in place; the validation pass and the Lock are distinct steps, Lock
being the final seal (D3).

#### AC3: A full-length contest finalises as official results
**Given** an F3J competition (class minimum 4 rounds, drop-worst beyond 7) with 8
rounds completed
**When** the Contest Director locks it
**Then** it resolves to **OfficialResults** — final results are produced, the
report states 8 rounds flown, and drop-worst applies because 8 exceeds the
class's threshold; the threshold and drop-worst rule are read from the class
model, not hard-coded.

#### AC4: A short contest finalises as a no-contest
**Given** an F3K competition (class minimum 5 rounds) that is stopped after only
3 rounds are completed
**When** the Contest Director locks it
**Then** it resolves to **NoContest** — the competition is locked with **no
official results** produced, and the captured scores and the full event log are
retained; Lock itself is not blocked by the short count.

#### AC5: The validity threshold is class-driven, not discipline-branched
**Given** two competitions each stopped after 4 completed rounds — one F5J
(minimum 4) and one F3K (minimum 5)
**When** each is locked
**Then** the F5J resolves to **OfficialResults** (4 meets its minimum) and the
F3K resolves to **NoContest** (4 is below its minimum), the difference coming
solely from each class model's minimum-rounds value with no discipline-specific
logic in the core.

#### AC6: F3B's mixed round-and-task minimum is honoured
**Given** an F3B competition whose class minimum for a valid contest is **1 round
and 1 task** (per the F3B rule doc)
**When** it is locked after completing 1 full round
**Then** it resolves to **OfficialResults**; **and given** an F3B competition
locked before any round completes, **then** it resolves to **NoContest**.

#### AC7: A class with no defined minimum finalises at the CD's judgement
**Given** an F5K competition (its class defines **no** minimum-rounds validity
rule) stopped after only 2 completed rounds
**When** the Contest Director locks it
**Then** the system does **not** force a no-contest — it resolves to
**OfficialResults** on the Contest Director's judgement, since the class supplies
no minimum to test against.

#### AC8: Lock is recorded whichever outcome results
**Given** any lock — whether it resolves to OfficialResults or NoContest
**When** the event log is examined
**Then** it records the lock with the acting person, the Contest-Director
authority and the resolved outcome, so the finalisation is auditable and the
no-contest determination is itself on the record (D4).

#### Non-Functional Expectations
- The minimum-rounds threshold and the drop-worst threshold are read from the
  Contest Class Model; the core carries no per-class knowledge of either
  (CLAUDE.md class-model law, NFR-1/NFR-2).
- Lock and finalisation operate entirely on the base with no internet connection
  (offline-first, D6); publishing the resulting reports is a separate,
  connectivity-gated step (Area 7).

### INVEST Check

Independent (a single terminal action over the STORY-001-024 state layer, reading
the STORY-001-016 class model) · Valuable (the deliberate close-boundary and the
honest valid/no-contest determination the whole result depends on) · Small (4
days, 3 functional points: the Lock freeze + event-log seal, the validation-pass
gate, the class-driven minimum-rounds OfficialResults/NoContest guard) · Testable
(the freeze, each finalisation outcome per class, and the logged record are all
observable).

### Open questions / conflicts flagged (house rule 2)

- **Class model must carry the minimum-rounds value.** ✅ **RESOLVED (2026-07-14,
  user-approved "amend story 16 first").** The Contest Class Model now carries a
  structured `minimumForValidContest: MinimumForValidContest | null` attribute
  (`packages/shared/src/class-model.ts`), seeded for all six stock classes —
  `{ rounds: 4, tasks: null }` for F3J/F5J/F5L, `{ rounds: 5, tasks: null }` for
  F3K, `{ rounds: 1, tasks: 1 }` for F3B (compound round-and-task), and `null`
  for F5K ("no minimum", semantically distinct from `rounds: 0`). It is
  rule-fixed identity metadata (like `groupSizeMinimumClause`): inherited
  verbatim through clone/edit, never in the editable surface, never a deviation.
  Round-trips through the created/updated payload and the projection copy;
  covered by two new AC5 tests in `class-models.service.test.ts`. This story now
  simply **reads** the value — the data-driven validity guard is unblocked.
- **"Locked is terminal" vs STORY-001-003's "unlock" aside.** The state machine
  makes Locked terminal (no unlock edge, honoured here). STORY-001-003's scope-out
  mentions "Lock/unlock — Contest Director authority (respected, not implemented
  here)", which could read as implying a future unlock. No contradiction for the
  MVP (both agree Lock is respected and not un-doable here), but the wording is
  worth tidying so "unlock" is clearly a non-MVP concept. Minor — flagged, no
  change made.
- **NoContest and drop-worst are mutually exclusive by construction:** a contest
  below the class minimum produces no official results, so drop-worst is never
  applied to a no-contest. Confirmed consistent with general-rules §5; noted so
  the two branches are not accidentally combined downstream.

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Lifecycle state / state machine** (`packages/shared/src/lifecycle.ts`,
  `apps/base/src/lifecycle/{projection,guard}.ts`): the single authoritative
  state per competition, derived purely from the event log. `LifecycleStateName`
  already includes `"Locked"`, and `LifecycleAction` already includes `"Lock"`.
  The `LifecycleGuard` already admits `Lock` *only* from
  `Running/BetweenGroups` and treats `Locked` as terminal (nothing admissible
  from it). This story is the **emitter** of the transition the guard already
  polices; it does not re-implement legality (Scope Out, STORY-001-024 owns it).

- **`competition.locked` lifecycle event** (`packages/shared/src/events.ts`):
  the event type and `CompetitionLockedPayload` are **already declared** (with
  the note that emission is "owned by the Lock story"). `LifecycleProjection`
  **already folds** `competition.locked` into its `locked` set and `getState`
  already returns `{ state: "Locked" }` in strict precedence. So the state
  transition mechanics exist; this story wires the action that appends the
  event and enriches the payload with the finalisation outcome.

- **`LockStateProvider` seam** (`apps/base/src/competitions/state-providers.ts`):
  the codebase already carries a `LockStateProvider` interface with the stub
  `AlwaysUnlockedProvider`, explicitly annotated "the CD-lock story will supply a
  real provider." Several freeze behaviours already consult it — e.g.
  `CompetitionService.update`/`delete` reject a class change or delete on a
  locked competition. This story is the intended real provider (backed by the
  lifecycle projection's locked membership), which activates those existing
  freeze gates for free.

- **Contest Class Model** (`packages/shared/src/class-model.ts`,
  `apps/base/src/class-models/projection.ts`): the single authoritative
  per-class scoring shape. It already exposes `dropWorst: { threshold, unit }`
  (the drop-worst threshold this story reads) but — confirmed by reading the
  source — carries **no minimum-rounds-for-a-valid-contest field**. This is the
  core gap behind open question #1.

- **Attribution** (`packages/shared/src/attribution.ts`): every appended event
  carries `{ actorName, originClient, authority }`. The competitions route
  already has a `cdAttributionFromHeaders` helper (built for Start Proceedings)
  that stamps `authority: "contest-director"` — the exact attribution Lock needs
  (D1, recorded-not-enforced). Reused directly.

- **CompetitionService command idiom** (`apps/base/src/competitions/service.ts`):
  the `start()` method is the direct sibling pattern — not-found → read derived
  state → guard-assert → append one event → apply → return the fresh
  `LifecycleStateResponse`. Lock follows the same shape.

- **Captured flight results / scoring projection**
  (`apps/base/src/scoring/projection.ts`): the raw per-pilot/round/task results
  that finalisation's aggregate reads. It exposes per-key result lookups and
  `hasCapturedResults`, but **no completed-round count** query (see risks).

### New Concepts Required

- **Lock action (the command)**: a new `CompetitionService` method that verifies
  admissibility, resolves the finalisation outcome, appends the enriched
  `competition.locked` event, and returns the new lifecycle state — the emitter
  that has been deliberately left unstoried until now.

- **Finalisation outcome (`OfficialResults` | `NoContest`)**: a new resolved
  value that the minimum-rounds guard produces at Lock and records on the event.
  Relates to the lifecycle state as its *refinement* — both outcomes are the
  `Locked` state, distinguished by the recorded outcome, which Area 7 reports
  read. Additive string union, per the NFR-2 discipline the shared enums follow.

- **Minimum-rounds validity guard (the comparison)**: a class-agnostic predicate
  that compares completed-round count against the class model's
  minimum-for-a-valid-contest value, yielding the finalisation outcome. Reads the
  threshold from the model; never branches on discipline. F3B's "1 round + 1
  task" and F5K's "no minimum" are the two shapes that stress the generality.

- **Class-model minimum-rounds attribute** (in STORY-001-016, *read* here): the
  data the guard compares against. Does not yet exist on `ContestClassModel`
  (open question #1). Must model both a numeric threshold and a "no minimum"
  case, and F3B's compound round-and-task form.

- **Completed-round count (a derived read)**: the number of fully completed
  rounds, needed by the guard. The requirement asserts it is "derivable from the
  event log," but no projection currently exposes it and the round-completion
  facts themselves are not yet emitted (see risks).

### Key Business Rules

- **Lock only from BetweenGroups; Locked is terminal** — already enforced by
  `LifecycleGuard`; this story must not duplicate the check, only invoke it.
- **Freeze on Lock**: no score correction, manual entry, or penalty change after
  Lock, while reports stay available. Enforced by other stories consulting the
  (now-real) `LockStateProvider`.
- **Lock is never blocked by a short round count** — the count only selects the
  outcome; a below-minimum contest still locks (as NoContest).
- **Class-driven validity, never discipline-branched** (CLAUDE.md law): the
  threshold and the drop-worst rule both come from the class model.
- **No-minimum class ⇒ always OfficialResults** (F5K): absence of a threshold is
  a modelled state, not a code special-case.
- **NoContest ⇒ no official results, but data + log retained** — nothing is
  destroyed; the no-contest determination is itself logged.
- **Drop-worst applies only past the class threshold, and only for
  OfficialResults** — the two branches are mutually exclusive by construction.
- **Everything auditable** (D4): the lock records actor, CD authority, and the
  resolved outcome.

## Strategic Approach

### Solution Direction

Add the **Lock command** to `CompetitionService`, mirroring the existing
`start()` command idiom exactly: resolve not-found, read the derived lifecycle
state, delegate transition legality to the existing `LifecycleGuard` (`Lock`
admissible only from `Running/BetweenGroups`), then — the new work — run the
**minimum-rounds validity guard** to resolve the finalisation outcome, append a
single enriched `competition.locked` event carrying that outcome under
Contest-Director attribution, apply it, and return the fresh
`LifecycleStateResponse`. Expose it as `POST /api/competitions/:id/lock`
alongside the sibling `/start` route, reusing `cdAttributionFromHeaders`.

The validity guard is a small **class-agnostic** function: read the class
model's minimum-rounds value via the class-model projection, read the
completed-round count, compare generically, and emit `OfficialResults` or
`NoContest`. A "no minimum" model value short-circuits to `OfficialResults`.
Data flow: **companion POST → CompetitionService.lock → (guard: read class
model + completed rounds) → append competition.locked{outcome} → lifecycle
projection folds it → Locked state + recorded outcome for Area 7 reports**.

Activate the **freeze** by swapping the production `AlwaysUnlockedProvider` for a
real `LockStateProvider` backed by the lifecycle projection's locked membership
(a thin adapter mirroring `ProjectionStartStateProvider`). This lights up the
freeze gates already coded against the seam (class-change/delete rejection, and
the score-correction/manual-entry/penalty gates other stories built against
"locked rejects changes") with no rework — the intended payoff of the existing
seam design.

The **validation-pass gate (D3, AC2)** is presentational/sequential, not a new
enforcement: the pre-Lock pass (5.6 flagging, 5.8 manual entry/override) is
owned by STORY-001-012 and Area 5.8; this story treats Lock as the distinct
final seal *after* that pass, and does not re-implement flagging or correction.

### Key Design Decisions

- **Emit the finalisation outcome onto the `competition.locked` event vs
  re-deriving it on read**: The event log is authoritative (D4) and AC8 requires
  the *outcome itself* to be on the record and auditable. Trade-off: writing a
  derived value onto an event risks staleness if the class model changes later —
  but a locked contest is terminal and its round count is fixed at Lock, so the
  outcome is immutable by construction. **Recommendation:** record the resolved
  outcome on the event (satisfies AC8 directly; the terminal, frozen nature
  removes the staleness concern). Enrich `CompetitionLockedPayload` additively
  (NFR-2) with the outcome (and, if useful for reports, the completed-round
  count at lock).

- **Where the minimum-rounds value lives**: it must be a **class-model
  attribute**, not core knowledge (CLAUDE.md law, AC5). This is a hard
  constraint, not a trade-off — the alternative (a `switch (discipline)` in the
  guard) is explicitly forbidden. The open decision is only *how* STORY-001-016
  models it (see alternatives) — this story just reads it.

- **Real `LockStateProvider` sourced from the lifecycle projection**: the
  projection already tracks `locked` membership and exposes `isStarted` /
  `isDeleted` accessors; add a parallel `isLocked` accessor (or a thin
  provider). Trade-off: none material — it mirrors the established
  `ProjectionStartStateProvider` seam and avoids the competitions module
  importing lifecycle internals. **Recommendation:** add the adapter and wire it
  as the production `lockStateProvider` default in `app.ts`.

- **Completed-round count source**: the guard needs it, but no round-completion
  fact is currently emitted (see risks). **Recommendation direction:** define a
  class-agnostic completed-round read derived from the log; but its *feasibility
  depends on which round/group facts are actually being appended by the time
  this story lands* — resolve in the REASONS Canvas phase against the then-live
  event set, and surface the dependency now.

### Alternatives Considered

- **Re-derive the outcome on every read instead of recording it**: rejected —
  AC8 wants the determination on the record; and a separate read path would risk
  drift from the frozen count. Recording on the terminal event is simpler and
  audit-correct.

- **A dedicated `finalisation.*` / `competition.finalised` event separate from
  `competition.locked`**: rejected for the MVP — Lock and finalisation happen
  atomically at one instant, `competition.locked` is already declared and folded,
  and one event keeps the log and the projection simple. The outcome rides the
  lock event additively.

- **Modelling the minimum as a plain integer with `0`/`null` meaning "no
  minimum"** (for STORY-001-016): a candidate, but F3B's "1 round **and** 1
  task" is compound and F5K's "no minimum" is semantically distinct from "minimum
  0". Flagged to STORY-001-016 as needing a shape richer than a bare integer;
  not decided here.

- **Blocking Lock when the count is short**: explicitly rejected by the
  requirement — Lock always succeeds; the count only selects OfficialResults vs
  NoContest.

## Risk & Gap Analysis

### Requirement Ambiguities

- **The minimum-rounds value has no home in the class model yet** (open question
  #1, confirmed against `class-model.ts`): `ContestClassModel` exposes
  `dropWorst` but no minimum-rounds-for-valid-contest field. The story *reads*
  this value but STORY-001-016 does not yet *carry* it. This must be resolved
  (added additively to the model, including F3B's compound form and F5K's "no
  minimum") **before** the guard can be data-driven. Flagged for the user per
  house rule 2 — not silently reconciled.

- **F3B's "1 round + 1 task" minimum shape is under-specified for modelling**:
  AC6 requires OfficialResults after "1 full round" and NoContest before any
  round completes, but the compound round-and-task criterion needs a concrete
  representation in the class model and a concrete "what counts as complete"
  definition. Coupled to open question #1.

- **"Completed round" is not defined operationally**: the ACs count "completed
  rounds," but the codebase has no definition of when a round is complete (all
  its groups scored? a `roundAdvanced` fact? end-of-contest snapshot?). Needs a
  precise, class-agnostic definition.

### Edge Cases

- **Zero completed rounds** (F3B "before any round completes" in AC6; also
  general): must resolve to NoContest for classes with a minimum, and — for F5K
  (no minimum) — the requirement implies even a zero/low count yields
  OfficialResults at CD judgement. The `0` vs "no minimum" distinction must not
  collapse.

- **Exactly-at-threshold** (AC5: 4 rounds vs minimum 4 → OfficialResults; vs
  minimum 5 → NoContest): the comparison boundary is inclusive of the minimum —
  must be "meets or exceeds," not "exceeds."

- **Drop-worst threshold vs minimum threshold are different numbers** (AC3: F3J
  minimum 4, drop-worst beyond 7): the guard must not conflate the two class-model
  fields.

- **Lock attempted from a non-BetweenGroups state** (GroupInProgress, Suspended,
  Setup, already-Locked): already rejected by `LifecycleGuard`; the story must
  route through the guard and surface `TransitionNotAllowedError` (409) rather
  than inventing its own check. Double-lock falls out for free (Locked is
  terminal).

- **Locking with outstanding flagged anomalies (AC2)**: the requirement frames
  the validation pass as a *distinct prior step*, not a hard precondition Lock
  enforces — Lock does not itself block on unresolved flags. Confirm the intended
  strictness (advisory vs blocking) so the boundary with STORY-001-012 is clean.

### Technical Risks

- **No emitter for completed-round facts**: confirmed by search —
  `competition.roundAdvanced`, `group.opened`, and `group.scored` are *declared*
  event types but **nothing in the codebase appends them** (their emission is
  assigned to "the round story" / Area 6, not yet built). The lifecycle
  projection counts open groups but has no completed-round count. So the "count
  derivable from the log" assumption is **not yet satisfied by shipped code** —
  the guard's input source is a live dependency risk. Mitigation: pin down the
  completed-round derivation against the actually-emitted facts in the REASONS
  Canvas phase; if none exist yet, this story may need a minimal completed-round
  read or a documented dependency on the round story.

- **Payload evolution on an append-only log** (NFR-2): enriching
  `CompetitionLockedPayload` with the outcome must be additive — older
  (hypothetical) lock events without the field must replay without throwing
  (default on read), matching the pattern already used for `acknowledgedWarningIds`.

- **Class-model law leak risk**: the minimum-rounds comparison is the exact place
  a discipline `switch` could sneak in. The guard must read only the model value
  and compare generically; a lint-of-the-mind test (AC5) covers it, mirroring the
  existing `lifecycle.class-agnostic.test.ts`.

- **Provider swap side-effects**: making `LockStateProvider` real activates
  freeze gates across multiple existing stories (update/delete class-change,
  score correction, manual entry, penalty edits). Regression surface is broad —
  the change is small but its blast radius is every "locked rejects changes"
  path; those need coverage confirming they now trip on a genuinely-locked
  competition.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Lock freezes competition, records who + CD authority, reports remain | Yes | Freeze relies on activating the real `LockStateProvider`; attribution via existing `cdAttributionFromHeaders`. "All scores captured" precondition ties to completed-round read. |
| 2 | Lock is the seal on the validation pass (distinct step) | Partial | Pre-Lock pass (5.6/5.8) is owned by STORY-001-012 / Area 5.8 — must exist for the full flow. Need to confirm Lock is advisory (not hard-blocking) on outstanding flags. |
| 3 | Full-length contest → OfficialResults, 8 rounds stated, drop-worst applied | Partial | Needs the class-model minimum field (OQ#1) and a completed-round count source (no emitter yet). Drop-worst threshold already on the model. |
| 4 | Short contest → NoContest, data + log retained, Lock not blocked | Partial | Needs minimum field (OQ#1) and completed-round count. Retention is inherent (log is append-only). |
| 5 | Threshold class-driven, not discipline-branched (F5J 4 vs F3K 5) | Partial | Blocked on OQ#1 (the value must be modelled). Class-agnostic comparison is straightforward once the field exists. |
| 6 | F3B "1 round + 1 task" minimum; 1 round → Official, 0 → NoContest | Partial | Compound minimum shape must be modelled in STORY-001-016 (OQ#1); "completed round/task" definition needed. |
| 7 | No-minimum class (F5K) → always OfficialResults at CD judgement | Partial | Needs a modelled "no minimum" value distinct from "minimum 0" (OQ#1). |
| 8 | Lock recorded with actor + CD authority + resolved outcome | Yes | Requires additively enriching `CompetitionLockedPayload` with the outcome (NFR-2). |
| NFR | Thresholds read from class model; offline-only; publish separate | Partial | Drop-worst already model-sourced; minimum-rounds blocked on OQ#1. Offline-first holds (all base-local, event-log driven). |
