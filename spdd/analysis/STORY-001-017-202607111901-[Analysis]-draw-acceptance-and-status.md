# SPDD Analysis: Draw Acceptance, Cancellation and Status

> **The story that closes the Area 4.3 gap STORY-001-009 deliberately left open.**
> STORY-001-009 built the draw up to and including *generation* — a validated
> spec (`draw.specSaved`), a materialised candidate outcome (`draw.generated`),
> a `DrawEvidenceView` read-model, and the fairness algorithm — but stopped
> exactly at the decision boundary: *"Accepting/re-drawing (4.3) is the Contest
> Director's story, not this one."* Three seams were planted for this story to
> fill: (1) the `NoAcceptedDrawProvider` stub that hardcodes
> `hasAcceptedDraw = false`, (2) the roster remove/replace gates that read it and
> are therefore currently *inert*, and (3) the draw routes that hardcode
> `authority: "organiser"` where accept/cancel are Contest-Director authority.
> This story adds two new durable facts (`draw.accepted`, `draw.cancelled`), a
> three-value acceptance status on the view, and the *real* `DrawStateProvider`
> — and in doing so it **activates** those previously-inert roster gates. That
> activation is the analysis's central strategic and risk theme: the change is a
> small state machine, but its blast radius reaches a neighbouring aggregate.

## Original Business Requirement

> Reproduced verbatim from
> `requirements/[User-story-17]draw-acceptance-and-status.md`.

# Story Decomposition: Draw Acceptance, Cancellation and Status (Backend)

## INVEST Analysis

### Abstract Task: "Draw Acceptance Layer"

**Analysis Dimensions**:
- **Core Responsibility**: turn a generated draw candidate into a durable,
  authoritative **accepted draw** — or discard it — and make that acceptance
  status readable so every downstream capability knows whether a draw exists to
  work on. This is Area 4.3 (Validate Draw → accept / re-draw), which
  STORY-001-009 explicitly deferred to "the Contest Director's story".
- **Primary Operations**: accept the current generated candidate; cancel /
  discard the current candidate; report acceptance status on the draw view.
- **Key Constraints**: acceptance and re-draw are **Contest Director
  authority** (Area 4.3); every mutation lands in the immutable event log with
  originating client, authority and actor identity (D4); nothing downstream
  (lanes, groups, reports, scoring) may treat a draw as usable until it is
  accepted; generation itself already exists (STORY-001-009) and is reused
  unchanged for re-draw.
- **Technical Complexity**: Medium (new durable acceptance fact and status in
  the event-sourced draw aggregate; replacing the "no accepted draw" stub that
  downstream currently reads, which activates gates that were previously inert).
- **Business Complexity**: Low–Medium (a small, well-defined state machine:
  generated → accepted, generated → discarded).

### INVEST Evaluation
- ✅ **Independent**: sits directly on the completed STORY-001-009 generation
  backend; needs no UI and no other unfinished story.
- ✅ **Negotiable**: how status is surfaced and how an accepted draw is exposed
  to downstream is open.
- ✅ **Valuable**: closes the Area 4.3 gap — three already-written stories
  (lanes, groups, reports) list "an accepted draw" as a prerequisite that
  nothing currently produces.
- ✅ **Estimable**: a bounded acceptance layer over a known aggregate.
- ✅ **Small**: ~3 days, three cohesive functional points.
- ✅ **Testable**: acceptance, discard and status are each observable facts.

**Conclusion**: Ready as-is — single backend story. It was carved out of the
original companion-app draw story once analysis showed STORY-001-009 had
deferred, and never built, the accept / cancel / status backend that the UI
(STORY-001-018) and three downstream stories assume exists.

---

## [STORY-001-017] Draw Acceptance, Cancellation and Status

> Source: `docs/requirements/high-level-requirements.md` Area 4.3 (Validate
> Draw — matchup distribution, fairness metric, allow re-draw) ·
> `docs/requirements/decisions.md` D4 (immutable event log), D1 (trust model —
> no auth, authority recorded not enforced) ·
> `docs/requirements/rules/00-general-rules.md` §1 (draw)
> Module: 001 (Organiser MVP) · Estimated effort: **3 days**

### Background

STORY-001-009 built the draw up to and including generation: a fair candidate
draw and its fairness evidence (matchup distribution and fairness metric). It
deliberately stopped short of the decision — *"Accepting/re-drawing (4.3) is
the Contest Director's story, not this one"* — and that story was never
written. As a result the system can generate a draw but cannot **commit** one:
there is no accepted-draw fact, no way to discard a candidate, and everything
downstream behaves as though no draw will ever exist. Three already-specified
stories — lane adjustment (STORY-001-010), group management (STORY-001-011)
and draw reports (STORY-001-015) — all name "an accepted draw" as a
prerequisite, so the whole contest-setup chain is blocked on this missing
layer.

This story adds the acceptance layer. The Contest Director (whose authority
this is) accepts the current generated candidate, making it the contest's
authoritative accepted draw; or cancels it, leaving the contest with no
accepted draw. Re-drawing before acceptance is simply re-running the existing
STORY-001-009 generation, which supersedes the current candidate; this story
does not re-implement generation. Every acceptance or cancellation is recorded
in the immutable event log with who acted and the authority under which they
acted (D4/D1). Finally, the draw's **acceptance status** becomes readable, and
an accepted draw becomes genuinely available to the downstream stories that
have been waiting for it.

### Business Value

- Provide the Contest Director with the authority to commit a generated draw as
  the contest's accepted draw, or to discard it.
- Support an auditable record of the accept / re-draw decision — who accepted,
  under what authority — as the trust model requires (D1/D4).
- Enable the blocked downstream chain — lane adjustment, group management, draw
  reports and scoring — by producing the accepted draw and its status they all
  depend on.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-009 (draw specification, generation and fairness
  evidence — **done**). A generated candidate must exist before it can be
  accepted or cancelled.
- **Data assumptions**: the draw is an event-sourced aggregate on the base;
  acceptance and cancellation are new durable facts in that aggregate's event
  log. Actor identity arrives with the request (companion name-pick) — there is
  no login; authority is recorded, not enforced (D1).
- **Integration points**: exposes acceptance status and the accepted draw to
  STORY-001-010 (lanes), STORY-001-011 (groups) and STORY-001-015 (reports),
  replacing the current placeholder that reports "no accepted draw". The
  companion-app draw screen (STORY-001-018) drives the accept / cancel actions
  and reads the status. Enabling the real accepted-draw signal will make
  roster-change gates that guard an accepted draw (STORY-001-005) active where
  they were previously inert — that behaviour is expected, not a regression.
- **Business constraints**: acceptance and re-draw are Contest Director
  authority (Area 4.3). Offline-first — no internet required (D6).

### Scope In

- **Accept** the current generated draw candidate, committing it as the
  contest's single authoritative accepted draw, recorded with actor identity
  and Contest Director authority.
- **Cancel / discard** the current generated candidate so the contest has no
  accepted draw, likewise recorded.
- **Acceptance status** readable on the draw view (no draw / generated
  candidate awaiting decision / accepted), and the accepted draw made available
  to downstream consumers in place of the current "none" placeholder.

### Scope Out

- The draw-generation algorithm, constraint enforcement and fairness
  computation, and re-draw as re-generation — STORY-001-009 (done); this story
  reuses it unchanged.
- The companion-app screen that presents the draw and its decision controls —
  STORY-001-018.
- Re-drawing **after** a draw has been accepted, and pilot-retirement re-draw
  (Area 5.5) — separate concerns / Future Enhancement; this story's acceptance
  is a one-time commit for the MVP.
- Enforcing that only a Contest Director may accept (no authorisation in MVP —
  authority is recorded, not enforced, D1).

### Acceptance Criteria

#### AC1: Accepting commits the candidate as the accepted draw
**Given** a competition whose draw has been generated into a candidate awaiting
a decision
**When** the Contest Director accepts it
**Then** that candidate becomes the contest's single authoritative accepted
draw, and the acceptance is recorded with who accepted it and the Contest
Director authority under which they acted.

#### AC2: Acceptance status is readable
**Given** a competition at each stage of the draw
**When** a client reads the draw
**Then** the reported status distinguishes **no draw generated**, **a candidate
generated and awaiting a decision**, and **a draw accepted** — so any client or
downstream capability can tell where the draw stands.

#### AC3: An accepted draw becomes available downstream
**Given** a draw has just been accepted
**When** lane adjustment, group management or draw reports ask the system for
the accepted draw
**Then** they receive it, whereas before any acceptance the system reports that
no accepted draw exists.

#### AC4: Cancelling leaves no accepted draw
**Given** a generated candidate awaiting a decision, with no draw yet accepted
**When** the Contest Director cancels it
**Then** the candidate is discarded, the contest has no accepted draw, the
cancellation is recorded with who acted, and generating again is possible.

#### AC5: Only a generated candidate can be accepted
**Given** a competition whose draw has never been generated (no candidate
exists)
**When** an accept is attempted
**Then** the system rejects it and explains that there is no generated draw to
accept, and no accepted draw is recorded.

#### AC6: Re-draw before acceptance replaces the candidate cleanly
**Given** a generated candidate that has **not** been accepted
**When** the draw is generated again (re-draw)
**Then** the new candidate supersedes the previous one as the awaiting-decision
draw, and no draw is left in an accepted state from the superseded attempt.

#### AC7: The acceptance decision is auditable
**Given** a draw has been accepted and later a fresh event-log review is done
**When** the draw's history is examined
**Then** the accept (and any prior cancellations) appear in the immutable event
log, each carrying the acting person and the authority under which it was
taken.

#### Non-Functional Expectations
- Accept, cancel and status operate entirely on the base with no internet
  connection (offline-first, D6).
- The accepted draw is a single, unambiguous fact — downstream consumers never
  see two competing accepted draws for one competition.

### INVEST Check

Independent (an acceptance layer over the finished STORY-001-009 generation
backend) · Valuable (closes the Area 4.3 gap and unblocks three downstream
stories) · Small (3 days, 3 functional points: accept, cancel, status +
downstream availability) · Testable (each is an observable, logged fact).

---

## Domain Concept Identification

This story is a thin, well-bounded **state layer over an existing aggregate**.
The generation machinery — the algorithm, the spec validation, the materialised
outcome, the fairness evidence — is finished and untouched. What is missing is
the *decision*: a durable fact that says "this candidate is the one", its
mirror ("discard this candidate"), and a status the whole system can read. The
draw aggregate today has exactly two event types (`draw.specSaved`,
`draw.generated`) and a `DrawProjection` holding two maps (`specs`,
`candidates`). This story adds a **third state dimension** — accepted-or-not —
expressed as two new events and a third projection map, plus a status the
`DrawEvidenceView` surfaces.

The dominant architectural insight is that the draw aggregate already models
"latest candidate wins" via supersede-not-overwrite (Decision #7 of 009). An
**acceptance** is a *different kind* of fact from a generation: it does not
produce new content, it *promotes* existing content and *freezes* the roster
gate. So the state machine has a subtlety the ACs make explicit — **AC6**:
generating again after acceptance-less candidacy simply supersedes; the
acceptance state must therefore be reasoned about *relative to which candidate*
it accepted, so that a stale acceptance can never silently attach to a
superseded candidate.

### Existing Concepts (from codebase)

- **DrawProjection** (`apps/base/src/draw/projection.ts`): the pure-loader
  projection holding `specs` and `candidates` maps keyed by `competitionId`.
  Rebuilds from `eventStore.readAll()` on boot; guards by event type; drops both
  maps on `competition.deleted`. This story adds a third map (the accepted
  draw / acceptance state) and two new `case` branches. It is a **pure loader**
  (Safeguard 2 / Norm 5) — the accept/cancel branches must remain pure replay,
  no logic beyond promoting the stored payload.
- **DrawService** (`apps/base/src/draw/service.ts`): the single writer of
  `draw.*` events, holding cross-aggregate references (competition, class model,
  roster projections). Owns `getEvidence`, `saveSpec`, `generate`. This story
  adds `accept` and `cancel` methods and extends `getEvidence` to compute
  status. The service is where the "only a generated candidate can be accepted"
  invariant (AC5) and the "which candidate is accepted" binding (AC6) live.
- **GeneratedDraw / `draw.generated` event** (`packages/shared/src/draw.ts`):
  the materialised candidate outcome, carrying a stable `id` per generation.
  That `id` is the natural anchor for acceptance — an accept fact references the
  `GeneratedDraw.id` (and/or `specId`) it promotes, which is exactly what makes
  AC6's "no draw left accepted from a superseded attempt" enforceable.
- **DrawEvidenceView** (`packages/shared/src/draw.ts`): the read-model returned
  by `GET /api/competitions/:id/draw` — currently `{ spec, candidate, warnings }`.
  This story adds an **acceptance status** field (and the accepted draw / an
  `accepted` reference) to it. This is the surface AC2 and AC3 are read through.
- **DrawStateProvider / NoAcceptedDrawProvider**
  (`apps/base/src/roster/state-providers.ts`): the planted seam. Its contract is
  load-bearing and precise — *"'exists' means an **accepted** draw (not merely
  generated) — that is what flips free roster editing off"*, and it is
  **read-only by design**. STORY-001-009 left it as `NoAcceptedDrawProvider`
  (returns `false`) because generation ≠ acceptance. This story provides the
  **real** implementation, answering from the accepted-draw state. This is the
  single most consequential wiring change: it is the moment `hasAcceptedDraw`
  can return `true`.
- **RosterService remove/replace gates** (`apps/base/src/roster/service.ts`
  lines 134, 174): the *currently-inert* consumers of `hasAcceptedDraw`.
  `remove` throws `RosterRemoveRequiresReplacementError` and `replace` throws
  `RosterReplaceNeedsConfirmationError` **only when `hasAcceptedDraw` is true** —
  which today it never is. Activating the real provider makes these gates fire
  for the first time. This is the "previously-inert gates" activation the story
  flags as *expected, not a regression*.
- **Attribution** (`packages/shared/src/attribution.ts`): `{ actorName,
  originClient, authority }` recorded on every appended event. AC1/AC4/AC7 rest
  on this: accept/cancel record the acting person (`actorName`) and the
  **authority** under which they acted. This is where the organiser-vs-CD
  authority distinction is stamped.
- **Draw routes** (`apps/base/src/routes/draw.ts`): the Fastify routes. Every
  one currently builds attribution with a hardcoded `authority: "organiser"`
  via `attributionFromHeaders`. This story adds accept/cancel routes that must
  stamp **`authority: "contest-director"`** (Area 4.3) — a departure from the
  shared organiser idiom used by every other route in the app.
- **EventStore** (`apps/base/src/eventstore/event-store.ts`): the sole writer,
  `readAll()` returns every event ordered by `seq`. AC7's auditability is
  satisfied automatically — the accept/cancel events are in `events` with their
  attribution columns (`actor_name`, `authority`), no new mechanism needed.
- **app.ts wiring** (`apps/base/src/app.ts`): constructs the `DrawService`,
  `DrawProjection`, the `drawStateProvider` (currently defaulting to
  `NoAcceptedDrawProvider` at line 174), and the `setErrorHandler` domain-error
  → HTTP map. This story rewires the default `drawStateProvider` to the real
  implementation and adds error-handler branches for any new domain errors
  (AC5's "no candidate to accept").
- **DomainError base + setErrorHandler idiom** (`apps/base/src/draw/errors.ts`,
  `app.ts`): each new domain error code needs exactly one `setErrorHandler`
  branch; a missing branch surfaces as a 500 (Safeguard 8).

### New Concepts Required

- **Draw acceptance (the fact)** — a new durable event (`draw.accepted`)
  promoting the current candidate to the contest's single authoritative accepted
  draw. Its payload references the accepted `GeneratedDraw` (by id, and by
  `specId`) so the acceptance is unambiguously bound to *which* candidate it
  committed. Relates 1:1 to a `GeneratedDraw`; carries CD attribution.
- **Draw cancellation (the fact)** — a new durable event (`draw.cancelled`)
  discarding the current candidate so the contest has no accepted draw. Records
  who cancelled. Note the semantic question this raises (see Risks): does
  "cancel" discard the *candidate* (so a re-generate is required) or merely the
  *acceptance*? AC4 says "the candidate is discarded, … and generating again is
  possible", pointing at discarding the candidate.
- **Acceptance status (three-valued)** — a derived status on the view
  distinguishing **no-draw** (no candidate generated), **awaiting-decision** (a
  candidate exists, not yet accepted), and **accepted** (a candidate has been
  committed). Derived in the service from the projection's three maps; the
  surface AC2 reads.
- **Accepted draw (the promoted outcome)** — the `GeneratedDraw` that has been
  accepted, exposed to downstream consumers (AC3) in place of the current "none"
  placeholder. Conceptually this is *the candidate, once accepted* — likely the
  same materialised outcome, now flagged/promoted, not a re-copied structure.
- **Real DrawStateProvider** — the concrete implementation of the existing
  `DrawStateProvider` interface, answering `hasAcceptedDraw(competitionId)` from
  the draw aggregate's acceptance state (the projection). Replaces
  `NoAcceptedDrawProvider` as the app default. Must respect the interface's
  read-only, "accepted-not-generated" contract.
- **"No candidate to accept" failure (AC5)** — a first-class domain error when
  accept is attempted with no generated candidate. Distinct from AC4's legitimate
  cancel and from 009's generation-failure error. Needs an error type and an
  `app.ts` branch (likely 409/422).

### Key Business Rules

- **Accept ≠ generate (Area 4.2 vs 4.3):** generation produces a *candidate*;
  acceptance *commits* it. `hasAcceptedDraw` must be driven by an **acceptance**
  fact, never by mere candidate existence — the exact contract STORY-001-009
  preserved and this story finally satisfies positively.
- **Single unambiguous accepted draw (NFR):** a competition has **at most one**
  accepted draw at any time. Downstream consumers must never see two competing
  accepted draws. The projection's accepted map is single-valued per
  competition; a re-accept (if permitted) supersedes.
- **Contest-Director authority (Area 4.3 / D1):** accept and cancel are recorded
  under CD authority — recorded, **not enforced** (D1: no auth in MVP). The
  authority string on the attribution is the audit record, not an access gate.
- **Acceptance binds to a specific candidate (AC6):** re-generation before
  acceptance supersedes the candidate and must leave **no** accepted state from
  the superseded attempt. If acceptance references a candidate id, a superseding
  `draw.generated` cannot inherit a prior (non-existent) acceptance.
- **Cancel restores the generatable state (AC4):** after cancel, the contest has
  no accepted draw and generation is possible again — the state machine returns
  to a clean pre-decision (or no-candidate) state.
- **Immutable log / pure projection (D4):** accept/cancel are events; the
  projection replays them as pure promotion/demotion of stored payloads — no
  logic, no RNG (inherits 009's determinism rule).
- **Roster gate activation is intended (STORY-001-005):** once
  `hasAcceptedDraw` can return true, the roster remove-requires-replacement and
  replace-needs-confirmation gates begin firing. This is the *designed* coupling
  (RD4: the seat carries draw slots forward), not a side effect to suppress.

---

## Strategic Approach

### Solution Direction

Extend the existing draw aggregate with a **third state dimension** — an
acceptance fact — reusing the 009 module template end-to-end (shared types →
event → service method → pure projection branch → route → error-handler branch),
then flip the roster's `DrawStateProvider` seam to a real implementation. No new
aggregate, no new scope: acceptance is another `draw.*` event under
`scope = competitionId`.

Concretely, three cohesive slices:

1. **Accept / cancel facts** — two new event types (`draw.accepted`,
   `draw.cancelled`) appended by two new `DrawService` methods. `accept` reads
   the current candidate; if none, throws the AC5 "no candidate" error; else
   appends `draw.accepted` referencing that candidate's id under **CD
   attribution**. `cancel` discards the current candidate (AC4), appending
   `draw.cancelled`. The `DrawProjection` gains an accepted map (and clears/updates
   candidate state per the cancel semantics resolved below), applied as pure
   replay. Two new POST routes (`…/draw/accept`, `…/draw/cancel`) stamping
   `authority: "contest-director"`.

2. **Acceptance status on the view** — extend `DrawEvidenceView` with a
   three-valued `status` (`no-draw` / `awaiting-decision` / `accepted`) and an
   `accepted` reference (the promoted `GeneratedDraw`, or a pointer to it).
   Computed in `getEvidence` from the projection's maps. This is the AC2/AC3
   read surface — one read-model, already served at
   `GET /api/competitions/:id/draw`, so no new read route.

3. **Real DrawStateProvider** — a concrete provider answering
   `hasAcceptedDraw` from the draw projection's accepted state, wired as the
   `app.ts` default in place of `NoAcceptedDrawProvider`. This is the one change
   that reaches outside the draw module — it activates the roster gates by
   design.

General data flow (identical to every existing module): REST route (attribution
from headers, CD authority for accept/cancel) → `DrawService` (guard invariants,
append event) → `DrawProjection` (pure replay) → `DrawEvidenceView` /
`DrawStateProvider` consumed by evidence, downstream stories, and the roster
gates. Auditability (AC7) is free — the events land in the immutable log with
attribution columns.

### Key Design Decisions

- **Acceptance shape — flag-on-candidate vs. separate accepted map.** Option A:
  the projection keeps a `candidates` map and a parallel `acceptedDrawId` (or a
  boolean-per-competition) — acceptance is a lightweight pointer to the already-
  stored candidate. Option B: a separate `accepted` map holding a copy of the
  promoted `GeneratedDraw`. *Trade-off:* A avoids duplicating the outcome and
  keeps a single source of truth for the materialised draw, but couples the
  accepted state to the candidate map's lifecycle (what happens to the pointer
  when a new candidate supersedes?); B is self-contained and immune to candidate
  churn but duplicates a large payload. → **Recommendation:** the *event payload*
  should carry enough to identify the accepted candidate unambiguously (its
  `id`/`specId`) so replay is self-describing (the 009 "denormalised payload"
  convention); the *projection* can hold the accepted draw as a distinct entry so
  downstream reads (AC3) get the outcome directly without chasing the candidate
  map. Resolve during REASONS Canvas, but bias toward an id-referencing payload +
  a resolved accepted entry in the projection.

- **Cancel semantics — discard candidate vs. discard acceptance.** AC4 is
  explicit: cancel applies to *a generated candidate awaiting a decision, with no
  draw yet accepted* → "the candidate is discarded … and generating again is
  possible". So **cancel operates on an unaccepted candidate and removes it**,
  returning the contest to no-draw/generatable. *Open sub-question:* is cancel
  legal when there is **no** candidate (a no-op or an error), and is there any
  notion of cancelling an *accepted* draw (Scope Out says re-draw after
  acceptance is a Future Enhancement)? → **Recommendation:** cancel targets the
  awaiting-decision candidate; with no candidate it is rejected or a no-op (flag
  for confirmation); cancelling an *accepted* draw is out of scope this story.

- **AC6 supersede vs. acceptance binding.** Re-generation already supersedes the
  candidate (009 Decision #7). The risk is a *stale acceptance* attaching to a
  new candidate. → **Recommendation:** bind acceptance to the candidate `id` in
  the payload; on `draw.generated` the projection sets the new candidate and, if
  the story permits accept-only-once, this is moot; if re-accept is allowed,
  a new generation must clear any acceptance whose referenced id is no longer the
  current candidate. AC6 says the pre-condition is an *unaccepted* candidate, so
  the simplest correct rule is: **generation is only reached before acceptance;
  a superseding generation leaves acceptance state empty.**

- **Authority stamping — CD vs. organiser.** Every existing route hardcodes
  `authority: "organiser"`. Accept/cancel are Area 4.3 CD actions. →
  **Recommendation:** the accept/cancel routes stamp
  `authority: "contest-director"` (recorded, not enforced — D1). Do **not**
  refactor the shared organiser helper; add a CD-specific attribution for these
  two routes. This is a deliberate, story-scoped divergence from the app-wide
  organiser default, and AC1/AC7 depend on it being correct.

- **Where status is computed.** The three-valued status is a pure function of
  the projection's maps (candidate present? accepted present?). → **Recommendation:**
  compute it in `DrawService.getEvidence` (service owns cross-map reasoning),
  not in the projection (which stays a pure loader). Add the field to the shared
  `DrawEvidenceView` type + its deep-copy helper.

- **Real provider placement.** The `DrawStateProvider` interface lives in
  `roster/state-providers.ts` (a roster-owned seam). The real implementation
  needs the draw projection. → **Recommendation:** implement the real provider
  reading the `DrawProjection` (or a narrow accessor), wired in `app.ts`,
  honouring the interface's read-only contract. Keep `NoAcceptedDrawProvider`
  as the test seam.

### Alternatives Considered

- **A new `accepted-draw` aggregate / scope:** rejected — acceptance is another
  fact about the *same* per-competition draw; splitting it into its own scope
  breaks the 009 aggregate cohesion and complicates replay/deletion (the draw
  projection already drops on `competition.deleted`).
- **Boolean `accepted` flag mutated in place on the candidate:** rejected —
  violates immutability/supersede-not-overwrite (D4); acceptance must be its own
  appended event, not an edit to the `draw.generated` payload.
- **Flip `hasAcceptedDraw` on candidate existence:** rejected — this is the
  exact contract violation 009 guarded against; only an *accepted* draw locks
  roster editing.
- **Refactor the shared `attributionFromHeaders` to take an authority
  parameter for all routes:** deferred — a wider change than this story needs;
  the story only requires CD attribution on two new routes. Flag as a possible
  small tidy, not in-scope.
- **Suppress/soften the newly-active roster gates:** rejected — the gate
  activation is the *intended* behaviour (RD4 seat-carries-slots); softening it
  would contradict STORY-001-005's design.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **Cancel with no candidate (underspecified).** AC4 describes cancel of an
  *awaiting-decision candidate*. It does not say what happens if cancel is
  invoked when no candidate exists (idempotent no-op, or an error like AC5's
  accept path?). Needs a decision — recommend symmetry with AC5 (reject with a
  clear "nothing to cancel") or an explicit no-op.
- **Accept-once vs. re-accept.** The story frames acceptance as "a one-time
  commit for the MVP" (Scope Out), and re-draw after acceptance is a Future
  Enhancement. But it does not say whether a second `accept` (e.g. after a cancel
  and re-generate) is permitted within the pre-acceptance window. Recommend:
  accept is permitted whenever a candidate is awaiting decision; "one-time"
  refers to not *re-drawing after* acceptance, not to a single lifetime accept.
- **Does cancel discard the candidate or the acceptance?** Resolved by AC4 text
  (discards the candidate; no draw yet accepted) — but worth pinning explicitly
  in REASONS Canvas so the projection's cancel branch is unambiguous.
- **Downstream "accepted draw" shape.** AC3 says downstream "receive it" — the
  accepted `GeneratedDraw`. Whether downstream reads it via `DrawEvidenceView`
  or a dedicated accessor/provider is open (STORY-001-010/011/015 are not yet
  built). Recommend exposing it on the view *and* via a narrow accessor the
  future stories can consume, without over-designing for unbuilt consumers.
- **Status vocabulary.** The three states are described but not named; the exact
  enum values (`no-draw` / `awaiting-decision` / `accepted` or similar) are a
  REASONS Canvas detail. AC2 only requires the three be *distinguishable*.

### Edge Cases

- **Accept after a superseding re-generate (AC6).** A candidate is generated,
  then re-generated (supersede), then accepted — acceptance must bind to the
  *current* candidate, never a superseded one. The acceptance payload must
  reference the live candidate id at accept time.
- **Roster shrinks/changes after acceptance.** Once accepted, `hasAcceptedDraw`
  is true and the roster remove gate forces replace-instead-of-remove (RD4).
  This is intended, but the *interaction* (an accepted draw referencing
  `rosterEntryId`s, then a replace) is the exact scenario STORY-001-005's gates
  exist for — verify the activated gates behave as their tests expect.
- **Cancel then re-generate then accept.** The state machine must cleanly cycle
  awaiting-decision → (cancel) → no-draw → (generate) → awaiting-decision →
  (accept) → accepted, with no residual accepted state from the cancelled arm.
- **Replay ordering.** `draw.specSaved`, `draw.generated`, `draw.accepted`,
  `draw.cancelled`, and `competition.deleted` must replay to the correct final
  state regardless of interleaving; e.g. accepted then competition.deleted must
  drop the accepted map entry too (extend the existing delete branch).
- **Double-accept / accept-cancel-accept idempotency.** If two accepts arrive
  for the same candidate, the single-accepted-draw invariant must hold
  (supersede or reject the second) — not two accepted facts producing ambiguity.
- **Concurrency at MVP scale.** Single base process, in-memory projection, one
  writer (EventStore) — no real concurrency risk; note it as low.

### Technical Risks

- **Activating previously-inert roster gates (highest strategic risk).** The
  real `DrawStateProvider` flips `hasAcceptedDraw` from always-false to
  sometimes-true, which turns on `RosterRemoveRequiresReplacementError` and
  `RosterReplaceNeedsConfirmationError` for the first time. Any existing roster
  test that assumed free remove/replace under a generated-but-unaccepted draw is
  unaffected (generation ≠ acceptance), but tests that set up an accepted-draw
  scenario via the test seam will now also exercise the real path. *Mitigation:*
  keep `NoAcceptedDrawProvider` as the roster tests' seam; add explicit tests for
  the accepted-draw → gate-active path; treat gate activation as an intended,
  documented outcome (the story says so).
- **Authority stamping divergence (organiser vs CD).** Every route in the app
  hardcodes `authority: "organiser"`. Accept/cancel must stamp
  `contest-director`. A copy-paste of the existing `attributionFromHeaders`
  helper would silently record the wrong authority, failing AC1/AC7 invisibly
  (no test catches an audit-string value unless one is written). *Mitigation:*
  a CD-specific attribution builder for the two routes and an explicit assertion
  on the recorded `authority` in the accept/cancel tests.
- **Projection purity under the new branches.** The accept/cancel `apply`
  branches must be pure promotion/demotion of stored payloads — no derivation,
  no candidate re-materialisation. A logic leak here breaks D4 replay parity.
  *Mitigation:* a rebuild test asserting identical accepted/candidate state
  before and after `readAll()` replay (mirrors the 009 determinism test).
- **Missing error-handler branch → 500.** AC5's new "no candidate to accept"
  domain error needs a `setErrorHandler` branch in `app.ts` (Safeguard 8);
  omitting it surfaces a 500 instead of a 4xx. *Mitigation:* add the branch with
  the error type; a test asserting the status code.
- **`DrawEvidenceView` shape change ripples.** Adding `status`/`accepted` to the
  shared view type touches its deep-copy helper and any current consumer
  (companion STORY-001-018 is not built, so blast radius is small now, but the
  companion draw screen will read these fields — get the shape right once).
- **Provider ↔ projection coupling.** The real `DrawStateProvider` needs the
  `DrawProjection`, but the interface lives in the roster module. Wiring must not
  create a circular module dependency (roster → draw). *Mitigation:* the provider
  implementation can live on the draw side and be injected into the roster
  service via `app.ts` (the existing seam already supports this — the interface
  is roster-owned, the implementation is not).

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Accepting commits the candidate as the single accepted draw, recorded with actor + CD authority | Yes | New `draw.accepted` event via `DrawService.accept`, CD attribution on the route. Depends on the authority-stamping divergence being correct (assert the recorded `authority`). |
| AC2 | Three-valued acceptance status readable on the draw view | Yes | Add `status` to `DrawEvidenceView`, computed in `getEvidence` from candidate/accepted maps. Enum names are a REASONS Canvas detail; three states must be distinguishable. |
| AC3 | Accepted draw available downstream (was "none" before) | Yes | Expose the accepted `GeneratedDraw` on the view and/or a narrow accessor. Downstream consumers (010/011/015) unbuilt — expose without over-designing for them. |
| AC4 | Cancelling discards the candidate, leaves no accepted draw, generate-again possible, recorded | Yes | New `draw.cancelled` event; projection clears the candidate/accepted state. Ambiguity: cancel with no candidate (recommend reject/no-op decision). |
| AC5 | Accept with no candidate is rejected with a clear reason; nothing recorded | Yes | New "no candidate to accept" domain error + `app.ts` branch (Safeguard 8). Distinct from 009's generation-failure error. |
| AC6 | Re-draw before acceptance supersedes cleanly; no accepted state from the superseded attempt | Yes | Reuses 009 supersede (Decision #7); acceptance binds to candidate id so a superseding `draw.generated` leaves no stale acceptance. Pre-condition is an *unaccepted* candidate. |
| AC7 | Accept (and prior cancellations) appear in the immutable log with actor + authority | Yes | Free from the EventStore — events carry `actor_name`/`authority` columns; `readAll()` exposes them. Contingent on AC1's correct authority stamping. |

---

> **Cross-cutting note (surfaced per house-keeping rule 2):** this story's real
> `DrawStateProvider` is the trigger that makes STORY-001-005's roster gates
> live. That coupling is *intended* and documented in this story's Dependencies
> ("expected, not a regression"), so no conflict to flag — but the REASONS Canvas
> and its tests must treat the roster-gate activation as a **first-class,
> asserted behaviour of this story**, not an incidental side effect, and must not
> weaken the STORY-001-005 gate design to accommodate it.
