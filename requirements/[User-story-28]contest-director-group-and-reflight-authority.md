# [STORY-001-028] Contest Director Authority over Re-Flights, Group Moves and the Lone-Pilot Dummy

> Source: `docs/user-stories/02-contest-director.md` §5.3 (approve re-flights and
> group changes; readiness move; dummy override) ·
> `docs/requirements/high-level-requirements.md` Area 5.3 ·
> `docs/requirements/decisions.md` D1 (authority recorded, not enforced), D4
> (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §3, §7 ·
> `docs/requirements/rules/f3b.md` · decision layer over STORY-001-011 (group
> management & re-flight preparation mechanics)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

STORY-001-011 built the **mechanics** of running-order adaptation: the Organiser
moves pilots between groups, creates and splits groups, prepares re-flights
(filling new re-flyer groups to the class minimum), applies the which-score-counts
rule on capture, and inserts the lone-pilot dummy — recording, but not granting,
the Contest Director's approval where one is needed. This story delivers the
**decision layer** that sits on top: the Contest Director's authority to
**approve or decline** those prepared changes, the **readiness-move** authority
that must **not** re-draw, and the **F3B dummy-override** approval scoped to a
single contest.

Three distinct authorities live here, unified by being decisions rather than
mechanics:

1. **Approve/decline re-flights and group changes.** The Organiser prepares a
   re-flight, group creation, split or move with its clash checks run; the
   Contest Director approves it (it takes effect) or declines it (the running
   order is unchanged). A clash the checks flagged is shown with its reason before
   the decision, so no invalid change is approved unknowingly. On approval the
   which-score-counts recompute (STORY-001-011) follows.
2. **Readiness move (no re-draw).** Reassigning a pilot who is not ready to fly
   their drawn group to another group in the same round is explicitly **not** a
   re-draw — it does not invoke the Area 4 anti-repeat matrix and leaves every
   other pilot's grouping untouched. This is the key contrast with retirement
   (STORY-001-030), which *does* re-draw.
3. **F3B dummy-override approval.** Where a class uses the general lone-pilot
   safeguard, the dummy is inserted with **no** Director approval. Where a class
   rule dictates a different outcome — F3B **annuls** a one-valid-result group —
   the system warns and blocks until the Contest Director gives **explicit
   approval scoped to this one contest**; absent approval, the class's annulment
   stands (whose consequence is a re-flight of the group).

Every decision is attributable (D1/D4) so the result stays defensible.

### Business Value

- Provide the Contest Director with the authority to approve or decline the
  running-order adaptations the Organiser prepares, so the order changes only
  under authority.
- Support keeping the event moving without corrupting the draw — a readiness move
  is deliberately distinguished from a re-draw.
- Enable the lone-pilot safeguard to be applied against a class that would annul
  **only** where the Contest Director explicitly permits it, never silently
  against a class rule.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-011 (the mechanics: prepared re-flights, group
  moves/splits with clash checks, which-score-counts recompute, dummy insertion),
  STORY-001-007 (group-score computation), STORY-001-017 (accepted draw exists).
- **Data assumptions**: a re-flight result is a **distinct working-time result**
  for the same round — two results for one pilot is legitimate, never a
  sync-conflict (scorer-device §5); actor identity arrives with the request and
  Contest-Director authority is **recorded, not enforced** (D1); whether a class
  annuls a one-valid-result group is a property of the class model
  (STORY-001-016), read generically.
- **Integration points**: approvals record the handoff STORY-001-011 already
  anticipates (its AC3/AC7); a granted-but-unflown re-flight blocks round advance
  (STORY-001-032 / Area 6.4) until flown or overridden away; a readiness move that
  would leave a lone scoring pilot triggers the same dummy/annul path as any
  lone-pilot group.
- **Business constraints**: the F3B annulment rule is authoritative and read-only
  (`rules/f3b.md`); class-agnostic core (CLAUDE.md); offline-first (D6).

### Scope In

- **Approve / decline** a prepared re-flight, group creation, split or move: on
  approval it takes effect (and its recompute follows via STORY-001-011); on
  decline the running order is unchanged. A clash-flagged change is shown with its
  reason before the decision.
- **Readiness move authority**: authorise reassigning a not-ready pilot to another
  group in the same round **without** re-drawing — the anti-repeat matrix is not
  invoked and other pilots' groupings are untouched; only where the move would
  leave a lone scoring pilot does the dummy/annul safeguard engage.
- **F3B dummy-override approval**: where a class annuls a one-valid-result group,
  warn and block; apply the dummy override only on the Contest Director's explicit
  **contest-scoped** approval, otherwise let the annulment stand.
- **Audit**: every approval, decline and override is attributable to the Contest
  Director and, for the dummy override, scoped to this contest only.

### Scope Out

- **The mechanics** the Contest Director authorises — moving pilot data, running
  clash checks, filling re-flyer groups, executing dummy insertion, and the
  which-score-counts recompute — all STORY-001-011.
- **Live capture** of the re-flight itself (Scorer scope, 5.0–5.2).
- **Retirement and its re-draw** (Area 5.5) — STORY-001-030; a readiness move is
  explicitly *not* a re-draw.
- **The F3B annulment's consequence** (re-flighting the annulled group) beyond
  routing it through the same warning path — the re-flight then runs via
  STORY-001-011 mechanics.
- Enforcing that only a Contest Director may approve (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: Approving a prepared re-flight takes effect; declining leaves order unchanged
**Given** the Organiser has prepared a re-flight for pilot "John Brown" with its
clash checks run (STORY-001-011)
**When** the Contest Director **approves** it, **then** it takes effect and its
result becomes capturable; **when** instead the Contest Director **declines** it,
**then** the running order is unchanged and no re-flight is pending.

#### AC2: A clash-flagged change is shown with its reason before the decision
**Given** a prepared group change that a clash check flagged as violating a draw
constraint (e.g. back-to-back groups for one pilot)
**When** the Contest Director reviews it
**Then** the reason is shown before the decision and the change is not approved
unknowingly — an approval over a flagged clash is a deliberate, recorded act.

#### AC3: A readiness move does not re-draw
**Given** pilot "Jane Smith" cannot fly her drawn group in round 4
**When** the Contest Director authorises moving her to another group in the same
round
**Then** the move takes effect **without** regenerating the draw — the Area 4
anti-repeat matrix is not invoked and every other pilot's grouping is unchanged;
only Jane's group membership changes.

#### AC4: A readiness move that isolates a pilot engages the lone-pilot safeguard
**Given** a readiness move that would leave a group with a **single scoring
pilot**
**When** the Contest Director applies it
**Then** the lone-pilot safeguard engages (random dummy for a general-safeguard
class; the F3B annul-and-warn path for F3B) rather than the pilot being
auto-awarded 1000.

#### AC5: The dummy is automatic for a general-safeguard class, no approval needed
**Given** a non-F3B group that resolves to a single scoring pilot the draw could
not avoid
**When** the group is scored
**Then** a randomly-chosen dummy is inserted for that pilot to be normalised
against with **no** Contest-Director approval required, and the dummy's flight
does not count toward the dummy pilot's own score.

#### AC6: F3B annuls unless the Contest Director overrides, contest-scoped
**Given** an F3B group in which only one competitor holds a valid result
**When** the lone-pilot situation arises
**Then** the dummy is **not** applied automatically — the system warns that F3B
annuls a one-valid-result group and blocks until the Contest Director gives
**explicit approval scoped to this one contest**; with approval the dummy override
applies to that group, without it the annulment stands.

#### AC7: Every decision is attributable
**Given** any approval, decline or dummy override the Contest Director makes
**When** the event log is examined
**Then** it records the decision, the acting person and the Contest-Director
authority — and the dummy override additionally records that it is scoped to this
contest only, so it is not silently reused elsewhere (D1/D4).

#### Non-Functional Expectations
- Whether a class annuls a lone-pilot group or uses the general dummy safeguard is
  read from the class model; the core never branches on discipline (CLAUDE.md
  class-model law).
- All decisions operate on the base with no internet connection (offline-first,
  D6).

### INVEST Check

Independent (a decision layer over the finished STORY-001-011 mechanics) ·
Valuable (the running order changes only under authority, the draw is protected
from an accidental re-draw, and no class rule is overridden without explicit
consent) · Small (4 days, 3 functional points: approve/decline, no-re-draw
readiness move, F3B dummy-override approval) · Testable (each decision and its
recorded, scoped outcome is observable).
