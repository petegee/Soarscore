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

- **Class model must carry the minimum-rounds value.** STORY-001-016 currently
  enumerates the Contest Class Model attributes as group-score basis, drop-worst
  threshold, points-per-second and landing table — it does **not** list the
  **minimum-rounds-for-a-valid-contest** value this story depends on. For the
  validity guard to be data-driven (not discipline-branched), that value must be
  added to the class model as an additional modelled attribute (additive, NFR-2;
  F5K's model records "no minimum"). **Recommendation:** add it to STORY-001-016's
  class-model definition. Flagged for the user before landing — not silently
  reconciled.
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
