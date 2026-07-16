# SPDD Analysis: Contest Director Authority over Re-Flights, Group Moves and the Lone-Pilot Dummy

> **The decision layer that closes the loop STORY-001-011 deliberately left
> open.** When STORY-001-011 was analysed, the codebase had no captured-result
> aggregate at all. It has since been built out in full: `apps/base/src/
> scoring/` now records `scoring.resultCaptured`, recomputes group scores on
> demand (which-score-counts, lone-pilot dummy, F3B annulment), and — the pivot
> for *this* story — **records the pending Contest-Director approvals as facts
> it never resolves**. `draw.reflightPrepared` and
> `scoring.annulmentOverrideRequested` both carry
> `approvalStatus: "pending-contest-director-approval"`, and STORY-001-011's own
> Safeguard 6 is explicit: *"this story never appends a second event flipping
> approvalStatus."* STORY-001-028 **is** that second event. Its central,
> code-verified finding is that the mechanics and the *pending* records already
> exist; what does not exist anywhere is the **resolution action** (approve /
> decline / override) that transitions them, the `ApprovalStatus` union member
> to transition them *to* (`ApprovalStatus` is today a single-member union), and
> any CD-attributed write path into the draw or scoring modules (every existing
> scoring route is Organiser/system-attributed by construction).

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-28]contest-director-group-and-reflight-authority.md`.

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
**Then** the dummy is **not** applied automatically; the system warns that F3B
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

## Domain Concept Identification

This story is unusual among its siblings in that **its dependency has already
been built and specifically instrumented to receive it.** STORY-001-011's
implementation left three explicit seams for exactly this story: a
single-member `ApprovalStatus` union whose comment says *"a future story adds
'approved'/'rejected' as its own supersede event"*; a `draw.reflightPrepared`
fact carrying `approvalStatus`; and a `scoring.annulmentOverrideRequested` fact
carrying the same. Nearly every existing concept this story needs already
exists as code; what is genuinely new is a small, well-shaped set of
**resolution** concepts.

#### Existing Concepts (from codebase)

- **`draw.reflightPrepared` / `ReflightPreparedPayload`**
  (`packages/shared/src/draw.ts`, `DrawService.prepareReflight`): the prepared
  re-flight fact AC1 approves or declines. Already carries
  `entitledRosterEntryId`, the new `reflightGroupFlyingOrder`, its
  `fillerRosterEntryIds`, `approvalStatus` (currently only
  `"pending-contest-director-approval"`) and a human-readable `reason`. This is
  the exact record AC1's approve/decline must transition.
- **`draw.groupMoved` / `draw.groupSplit`** (`GroupMovedPayload` /
  `GroupSplitPayload`, `DrawService.moveGroup` / `splitGroup`): the topology
  overlay facts. **Important nuance discovered in the code:** these apply
  **immediately** on the Organiser's action and **throw** on a clash
  (`GroupMoveClashError` for a group-size-minimum breach or a
  consecutive-flight breach) — they do *not* currently carry an `approvalStatus`
  or any pending state. This directly shapes AC1/AC2 (see Strategic Approach and
  Risks): the story's "approve / decline a prepared … move" language does not
  match the current immediate-apply behaviour of moves/splits.
- **`scoring.annulmentOverrideRequested` / `AnnulmentOverrideRequestedPayload`**
  (`packages/shared/src/events.ts`, `ScoringService.resolveLonePilot`): the
  pending F3B annulment fact AC6 resolves. Records `groupFlyingOrder`,
  `approvalStatus`, and a `reason` naming F3B's rule. Appended by the *system*
  (`SYSTEM_ATTRIBUTION`) the first time a recompute observes an F3B singleton.
- **`scoring.lonePilotResolved` / `LonePilotResolvedPayload`** and
  `ScoringService.scoreLonePilotGroup` / `resolveLonePilot`: AC4's and AC5's
  general-safeguard dummy path — **already fully built and requiring no CD
  approval**, exactly as AC5 specifies. The dummy is randomly drawn from
  eligible other pilots (`eligibleOtherPilots`, excluding other lone pilots),
  materialised once (RNG never re-rolled, Safeguard 3), and the dummy's own
  score is never surfaced from the lone group's view.
- **`ContestClassModel.lonePilotBehaviour`** (`packages/shared/src/
  class-model.ts`): the `"dummy" | "annul"` field that makes AC5-vs-AC6 a
  data-driven branch, F3B's stock model seeded to `"annul"`, every other class
  `"dummy"`. Already wired into `deriveDeviations` (clone auditing) and the Zod
  schema. This is the field the Non-Functional Expectation ("read from the class
  model; the core never branches on discipline") is satisfied by — it already
  exists, so this story consumes it and must not reintroduce a class branch.
- **`GroupScoreView` recompute** (`ScoringService.getGroupScore`): the on-demand
  recompute AC1's "its recompute follows" and AC6's outcome both flow through.
  Already returns `lonePilotMode` and `pendingAnnulmentOverride` — the read
  surface a companion client renders AC6's warning from. After a CD dummy
  override for F3B, this recompute must stop returning `pendingAnnulmentOverride:
  true` and instead score the group against a dummy.
- **`Attribution` and the CD-authority precedent** (`DrawService.accept` /
  `cancel`, STORY-001-017): the only existing CD-attributed write path. Every
  *scoring* route, by contrast, is hardcoded `authority: "organiser"`
  (`apps/base/src/routes/scoring.ts`) with a comment stating so. This story
  introduces the **first CD-attributed writes into the scoring module**, and
  new CD-attributed writes into the draw module beyond accept/cancel.
- **`EffectiveGroupsView` / `GroupCompositionProvider.getEffectiveGroups`**: the
  overlay-aware effective composition that a readiness move (AC3) already
  produces without touching the draw generator — confirming AC3's "no re-draw"
  is *structurally already true* of `moveGroup` (it is an overlay event, never a
  re-invocation of `runAttempt`/`computeDistribution`).
- **The immutable event log & projections** (`EventStore`, `DrawProjection`,
  `ScoringProjection`): the supersede-on-repeat, replay-from-log substrate every
  new resolution event must obey (D4).

#### New Concepts Required

- **Approval resolution (the second event).** A CD decision fact that
  supersedes a pending `draw.reflightPrepared` or
  `scoring.annulmentOverrideRequested` — e.g. `draw.reflightApproved` /
  `draw.reflightDeclined` and `scoring.annulmentOverrideApproved` /
  `scoring.annulmentOverrideDeclined`, or a smaller generic decision event
  keyed to the pending fact. This is the concept STORY-001-011 named as
  out-of-scope future work and instrumented for. It is the story's spine.
- **Expanded `ApprovalStatus`.** The union is deliberately single-member today.
  This story adds `"approved"` and `"declined"` (names to settle in REASONS
  Canvas), and the projection must derive the *current* status of a prepared
  item from the latest superseding decision event (D4 replay), never mutate the
  original pending payload.
- **Contest-scoped dummy override (AC6/AC7).** The approval that flips an F3B
  annulment to a dummy insertion, recorded with an explicit **contest-only
  scope** marker so it "is not silently reused elsewhere." Concretely: an
  approval fact that both (a) supersedes the pending annulment request and (b)
  triggers/permits a `scoring.lonePilotResolved` (`mode: "dummy"`) for that
  group. Its contest scope is implicit in the event's `scope = competitionId`
  filing, but AC7 asks it be *recorded as* contest-scoped explicitly.
- **Decline-as-revert for a prepared re-flight.** AC1's decline path
  ("running order unchanged and no re-flight is pending") has no representation
  today: `prepareReflight` already created and filled a re-flyer group as an
  overlay. Declining must neutralise that overlay (a revert/withdraw fact the
  projection honours), not merely mark a status — otherwise the re-flyer group
  lingers in the effective composition.
- **Readiness-move authority framing (AC3/AC4).** The mechanic
  (`moveGroup`) exists; what is new is (a) exercising it under **CD
  attribution** as a first-class "readiness move" rather than an Organiser edit,
  and (b) the guarantee, already true structurally, that it never re-draws —
  this story's value is largely in *asserting and testing* that invariant and
  attributing the action, not in new mechanics. AC4's lone-pilot consequence is
  already delivered by the scoring recompute; the new work is confirming the
  readiness move *routes into* that same path.
- **Approve-over-a-flagged-clash (AC2).** A path by which a CD can knowingly
  approve a change a clash check flagged, recorded as a *deliberate* act. Today
  a clash **throws and blocks** in `moveGroup`; there is no "flag, show, let the
  CD override" path. This is genuinely new decision surface.

#### Key Business Rules

- **Preparation ≠ approval, and approval is a *separate superseding event*
  (D4).** The pending fact is never mutated; a decision is a new event whose
  replay yields the current status. Governs every resolution event.
- **Decline restores the status quo ante (AC1).** After a decline, the effective
  running order and pending-set must be indistinguishable from before the
  preparation — governs the decline-as-revert concept.
- **A readiness move is not a re-draw (AC3, general-rules §1 / Area 4).** It must
  not invoke the anti-repeat matrix and must leave all other pilots' groupings
  untouched — the sharp contrast with retirement (STORY-001-030). Governs the
  readiness-move path; already honoured by the overlay design and must stay so.
- **No lone pilot auto-1000 (general-rules §3 / Area 5.3).** A single scoring
  pilot is normalised against a dummy (general classes) — governs AC4/AC5, built.
- **F3B annuls a one-valid-result group unless the CD overrides, contest-scoped
  (f3b.md §1, authoritative & read-only).** The dummy is never applied against
  the class rule without explicit, contest-scoped CD approval. Governs AC6/AC7.
- **Class behaviour is read from the model, never branched on discipline
  (CLAUDE.md law, D12).** `lonePilotBehaviour` is the only signal consulted —
  governs AC4/AC6; the existing code already complies and this story must not
  regress it.
- **Every decision is attributable under CD authority (D1/D4).** The event
  carries actor, origin client and `authority`; the dummy override additionally
  records its contest-only scope. Governs AC7 and every new event.
- **A granted-but-unflown re-flight blocks round advance (Area 6.4 /
  STORY-001-032).** An *approved* re-flight becomes an outstanding item the
  round-advance interlock (D10) lists until flown or overridden away — governs
  the downstream integration point, not built here but must be consistent with.

## Strategic Approach

#### Solution Direction

- **Build the two "second events" the codebase was pre-shaped for, plus their
  projection-derived status, and nothing more.** The dominant slice is:
  1. **Re-flight approve/decline (AC1/AC2/AC7):** add CD-attributed
     `DrawService` methods that append a resolution event superseding a pending
     `draw.reflightPrepared`. Approve marks it approved (the re-flyer group
     stays; its result becomes capturable via the existing `captureResult`).
     Decline appends a revert fact the `DrawProjection` honours by dropping the
     re-flyer-group overlay. The evidence/effective-groups read-model exposes
     each prepared item's *derived* status and any clash reason so AC2 can show
     it before the decision.
  2. **F3B dummy-override approve/decline (AC6/AC7):** add a CD-attributed
     `ScoringService` method that supersedes a pending
     `scoring.annulmentOverrideRequested`. Approve appends a
     `scoring.lonePilotResolved` (`mode: "dummy"`, a dummy drawn by the same
     `eligibleOtherPilots` rule) *and* records the contest-scoped override;
     `getGroupScore` then scores the group against the dummy and stops
     reporting `pendingAnnulmentOverride`. Decline (or no action) leaves the
     annulment standing. This is the first CD-attributed write into the scoring
     module.
- **Treat the readiness move (AC3/AC4) as an attribution-and-assertion slice,
  not new mechanics.** `moveGroup` already performs a no-re-draw overlay whose
  lone-pilot consequence the scoring recompute already handles. The work is to
  expose/route a **CD-attributed** readiness-move entry point (the same event,
  different authority and intent), and to lock in AC3/AC4 with tests proving the
  anti-repeat matrix is untouched and that isolating a pilot routes into the
  existing dummy/annul path.
- **Data flow (mirrors 017's accept/cancel exactly):** CD-attributed REST route
  → `DrawService` / `ScoringService` resolution method → validate the pending
  fact still exists and is unresolved → append the superseding decision event →
  projection derives new status / drops overlay / triggers recompute → updated
  evidence or group-score view. No RNG in the projection (any dummy pick is
  materialised in the service, Safeguard 3, matching the existing lone-pilot
  path).

#### Key Design Decisions

- **How to reconcile AC1/AC2's "approve/decline a prepared move or split" with
  the code's immediate-apply, throw-on-clash `moveGroup`/`splitGroup`.**
  *Trade-off:* the story frames moves/splits as prepared-then-approved, but the
  built mechanics apply them at once and hard-block clashes. Retrofitting a
  full pending/approval lifecycle onto moves/splits is a large change and
  arguably over-builds against D1 (*authority recorded, not enforced*) and D8
  (*multiple clients, last-action-wins, no session lock*). → **Recommendation:**
  scope the genuine two-phase approve/decline to the items that **already carry
  a pending fact** — re-flights and the F3B annulment override. For moves/splits,
  lean on D1: they apply immediately under recorded attribution (making the move
  itself the attributed authority act), and (a) add the "approve-over-a-flagged-
  clash" path by converting the current hard *throw* into a **flag the CD can
  knowingly override with a recorded, deliberate act** (AC2), and (b) represent
  "decline" of a move as a subsequent compensating move rather than a rollback
  state machine. Confirm this framing in REASONS Canvas; it keeps the story to
  its 4-day / 3-point size and avoids re-litigating D1/D8.
- **Event shape for the resolution: dedicated per-item events vs. a generic
  decision event.** → **Recommendation:** dedicated, self-describing events
  (`draw.reflightApproved` / `draw.reflightDeclined`;
  `scoring.annulmentOverrideApproved` / `…Declined`) matching this codebase's
  strongly-typed, one-payload-per-event-type discipline and its
  supersede-on-repeat idiom — rather than a polymorphic "approval" event that
  would force a discriminated payload. Each new event type needs its
  `setErrorHandler` branch in `app.ts` (Safeguard 8) for its rejection reasons
  ("nothing pending to approve", "already resolved").
- **Where "current approval status" lives.** → **Recommendation:** derive it in
  the projection from the latest superseding event (D4), never by mutating the
  stored `ReflightPreparedPayload.approvalStatus` — consistent with how
  `DrawProjection` already treats overlays as "latest wins" and never rewrites
  `draw.generated`.
- **Recording the contest-only scope (AC7).** → **Recommendation:** the event's
  `scope = competitionId` filing already binds it to one contest; add an
  explicit scope marker on the override payload so the *audit reads* self-explain
  ("dummy override, this contest only") rather than relying on the reader
  knowing the filing convention. Cheap, and it is precisely what AC7 asks for.

#### Alternatives Considered

- **Retrofitting a full prepare→approve lifecycle onto group moves and splits**
  (a pending state, a decline rollback, an approve commit): rejected as
  over-scoped for a 4-day story and in tension with D1 (authority recorded, not
  enforced) and D8 (last-action-wins, no control-session lock). The pending
  lifecycle earns its keep only where a fact is genuinely *withheld* pending a
  ruling — re-flights (which create a re-flyer group that shouldn't stand if
  declined) and the F3B annulment (which must not silently override a class
  rule). A plain move/split has no such "must not take effect yet" hazard at
  club scale.
- **Mutating `approvalStatus` in place on the prepared payload when the CD
  decides:** rejected — violates D4 (write-only log, state derived from events)
  and the codebase's explicit supersede-not-mutate discipline; the projection
  must derive status from a second event.
- **Inferring the F3B override target from `sourceClass === "F3B"` or
  `basis === "separate-per-task"`:** rejected — CLAUDE.md's core law; the
  `lonePilotBehaviour` field already exists precisely so no class branch is
  needed. The pending `scoring.annulmentOverrideRequested` fact already tells the
  approval action which group needs overriding, class-agnostically.

## Risk & Gap Analysis

#### Requirement Ambiguities

- **"A group in which only one competitor holds a valid result" (AC6) is broader
  than the built trigger.** The current `getGroupScore` only takes the
  annulment/dummy path when a group's **membership is literally one seat**
  (`group.members.length === 1`). But AC6, f3b.md §1, *and* the CD user story
  (`02-contest-director.md` 5.3 dummy-override, final AC) all define the trigger
  as **one *valid result*** — explicitly including "a full group where everyone
  else scored zero/invalid (e.g. all landed out)." A full F3B group of 5 where 4
  land out and score zero is a one-valid-result group the current code would
  score as an ordinary multi-pilot group, never raising the annulment. This is
  the single most material gap: the story's F3B slice, done to the letter of
  AC6, requires **broadening the annulment trigger from "structural singleton"
  to "one competitor with a valid result"** — a valid-result predicate over
  captured results (what counts as "valid" per task: a non-zero raw / a landed
  flight). Addressable in design (the requirement text is unambiguous about the
  intent), but it must be surfaced so the trigger is not left at membership==1.
- **"Declining leaves the running order unchanged / no re-flight pending"
  (AC1)** presumes a revert the codebase does not yet have. Needs a concrete
  decline-as-revert design (drop the re-flyer-group overlay), not just a status
  flag — otherwise the filled re-flyer group survives a decline.
- **"Approve over a flagged clash is a deliberate, recorded act" (AC2)** implies
  clashes become *overridable warnings*, whereas today they are hard errors that
  block the move. The requirement wants show-then-allow-override; reconciling
  this with the existing throw is a design choice (recommendation given).
- **What "valid result" means per task is not spelled out here.** For F3B the
  per-task rules define invalidity (e.g. Task C: a model that fails to complete
  or lands early scores 0; whole flight = 0 if not landed on the defined area).
  The valid-result predicate should read these from the class/task model, not
  hardcode "raw > 0" — though at MVP a captured `raw === 0` is a reasonable
  proxy for "no valid result" and can be confirmed in REASONS Canvas.

#### Edge Cases

- **A readiness move (AC4) that isolates a pilot in an *F3B* task** must route
  into the annul-and-warn path, not the dummy path — the same
  `lonePilotBehaviour` branch, but now reached via a move rather than an
  unavoidable draw singleton. Confirms AC4's "(the F3B annul-and-warn path for
  F3B)" clause depends on the same broadened trigger as AC6.
- **Declining a re-flight whose result was *already captured*.** Capture
  (`captureResult`) only checks the seat is currently seated; nothing stops a
  re-flight result being captured before the CD approves. Declining then must
  reconcile an orphaned captured `reflight` result (leave it, ignore it in
  recompute, or surface an anomaly). Unaddressed by the ACs.
- **Approving a re-flight that leaves the round with a granted-but-unflown
  entitlement** — feeds the Area 6.4 round-advance interlock (D10). Out of
  scope to *build* here, but the approval event must be shaped so
  STORY-001-032 can detect "approved but unflown."
- **Two CDs (or a CD and Organiser) acting concurrently (D8, last-action-wins).**
  A second approval/decline of an already-resolved item must be a clean no-op or
  a clear rejection, not a double-append that confuses the derived status.
- **Contest-scoped override reuse.** AC7's whole point: an override approved for
  round 3 group 2 must not leak to round 5 group 1. The per-group keying of
  `scoring.annulmentOverrideRequested`/`…Resolved` already isolates this; the
  test must prove a later F3B singleton still raises its own fresh warning.

#### Technical Risks

- **First CD-attributed write into the scoring module.** Every scoring route is
  currently `authority: "organiser"` by construction (with a comment). This
  story adds CD-attributed scoring writes; the route/attribution plumbing (an
  `x-authority`/CD header path, mirroring how `draw.accept` is CD-attributed)
  must be added without weakening the D1 "recorded, not enforced" stance.
- **Broadening the annulment trigger touches recompute correctness.** Changing
  the lone-pilot detection from membership==1 to a valid-result count changes
  how *every* F3B group scores, not just singletons — the multi-pilot scoring
  path and the lone-pilot path must be unified around the valid-result predicate
  carefully, with tests covering "full group, one valid result" and "full group,
  several valid results" so no ordinary group is falsely annulled.
- **Derived-status projection vs. append-only replay.** The projection must
  fold each pending fact together with its (possibly later) resolution and
  default cleanly on replay of older logs that have no resolution event — the
  same additive-field discipline `DrawAcceptedPayload.acknowledgedWarningIds`
  already models (default missing → unresolved/pending).
- **Missing `setErrorHandler` branches (Safeguard 8).** Each new rejection
  reason ("nothing pending here", "already resolved", "approve over a
  non-existent clash") needs its own domain-error subclass wired in `app.ts`.
- **No FAI-rule or cross-requirement contradiction found.** The story upholds
  f3b.md §1 (annulment stands unless explicitly overridden), general-rules §3
  (no auto-1000) and §7 (which-score-counts, unchanged), and aligns with the CD
  user story 5.3 (all three sub-stories), high-level Area 5.3, and D1/D4/D12. The
  lone-pilot dummy is a documented product safeguard for a case the FAI rules do
  not legislate (they assume properly sized groups), applied only where the class
  model permits — no rule is overridden without the explicit, contest-scoped CD
  consent the rule-authority house-rule requires. This is a clean cross-reference.

#### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Approve takes effect / decline leaves order unchanged (re-flight) | Yes | Approve = supersede the pending `draw.reflightPrepared`; the re-flyer group and `captureResult` already exist. Decline needs a **new decline-as-revert** fact that drops the re-flyer-group overlay — not built, but a clean addition on the existing overlay pattern. |
| 2 | Clash-flagged change shown with its reason before the decision | Partial | Clash detection exists (`GroupMoveClashError` — group-size-minimum, consecutive-flight). But it currently **throws/blocks**; AC2 wants it *shown* and *overridable as a deliberate recorded act*. Requires converting the hard block into a flag-and-override path. Reason strings already exist. |
| 3 | Readiness move does not re-draw | Yes | Structurally already true: `moveGroup` is an overlay event, never re-invokes the anti-repeat generator. Work is CD-attribution framing + tests asserting the matrix is untouched and other groupings unchanged. |
| 4 | Readiness move isolating a pilot engages the lone-pilot safeguard | Yes | The dummy/annul recompute (`scoreLonePilotGroup`) already handles isolation. Depends on the same broadened valid-result trigger as AC6 for the F3B branch. |
| 5 | Dummy automatic for a general-safeguard class, no approval | Yes (built) | Already delivered by STORY-001-011 (`lonePilotBehaviour: "dummy"`, `scoring.lonePilotResolved`, dummy's own score excluded). This story consumes and tests it; no new code required beyond confirming it. |
| 6 | F3B annuls unless CD overrides, contest-scoped | Partial | The pending `scoring.annulmentOverrideRequested` fact and the annul path exist. New: the CD **override action** (the second event) that flips to a dummy, plus the **broadened trigger** ("one valid result", not membership==1). Both addressable; the trigger broadening is the key gap. |
| 7 | Every decision attributable; override contest-scoped | Yes | New CD-attributed events carry actor/origin/authority (mirrors `draw.accept`); the override event records an explicit contest-only scope marker. First CD-attributed scoring write — plumbing to add. |

## Summary of Key Points for REASONS Canvas

1. **This story is the "second event" STORY-001-011 was built to receive.** The
   pending facts (`draw.reflightPrepared.approvalStatus`,
   `scoring.annulmentOverrideRequested.approvalStatus`) and the single-member
   `ApprovalStatus` union already exist and are commented as awaiting exactly
   this story. Build the resolution events + projection-derived status; do not
   rebuild the mechanics (AC5 is already done).
2. **The one material gap: broaden the F3B annulment trigger** from
   "structural singleton" (`group.members.length === 1`, as built) to
   "one competitor with a valid result" (AC6 / f3b.md / CD user story), covering
   a full group where everyone else scored zero/invalid. Requires a valid-result
   predicate read from the task model.
3. **Scope the true prepare→approve lifecycle to re-flights and the F3B
   override only** (the items that carry a pending fact and a "must not take
   effect yet" hazard). Handle group moves/splits under D1's recorded-not-enforced
   authority — immediate apply with CD attribution, converting the current
   clash *throw* into a flag the CD can knowingly override (AC2).
4. **Decline needs a revert**, not just a status flag, so a declined re-flight's
   filled re-flyer group does not linger in the effective composition.
5. **First CD-attributed writes into the scoring module** — add the
   authority plumbing (mirror `draw.accept`), keep D1's "recorded, not enforced".
6. **No FAI-rule or existing-requirement conflict** — the story is consistent
   with f3b.md, general-rules §3/§7, the CD user story 5.3, Area 5.3, and
   D1/D4/D12; class behaviour stays read from `lonePilotBehaviour`, never a
   discipline branch.
