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
