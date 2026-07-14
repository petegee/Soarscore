# [STORY-001-027] Authorise a Mid-Contest Configuration Change

> Source: `docs/user-stories/02-contest-director.md` §3 (mid-contest) ·
> `docs/requirements/high-level-requirements.md` Area 3 (Competition Setup &
> Configuration, 3.5–3.8) · `docs/requirements/decisions.md` D1 (authority
> recorded, not enforced), D4 (immutable event log) ·
> `docs/requirements/rules/00-general-rules.md` §3–5 (normalisation, final
> classification) · builds on STORY-001-025 (Start Proceedings — the
> configuration-authority boundary) and STORY-001-024 (lifecycle state)
> Module: 001 (Organiser MVP) · Estimated effort: **4 days**

### Background

STORY-001-025 established **where** the configuration-authority boundary sits:
before Start Proceedings, scoring/running configuration (3.5–3.8) is freely
editable; after Start, any such change requires Contest-Director authority and is
recorded in the event log. STORY-001-025 wired that boundary into task
configuration (3.7) only, and its scope-out explicitly deferred **what a
post-Start change actually does** to the owning stories. This story delivers that
behaviour for the general case: the **authorisation flow** a mid-contest
configuration change runs through, and the **recompute consequences** stated
before it applies.

The problem it solves is silent rescoring. If a wrong target time is discovered
in round 3 and simply corrected, every already-flown round could be re-normalised
underneath the field without anyone deciding that should happen. This story makes
that impossible: after Start, a change to draw options, scoring options, task
rules or field-aid timings (3.5–3.8) does **not take effect without the Contest
Director's authorisation**, and before it applies the system **states which
rounds' scores would recompute**. The default is forward-only — the change
applies **from the next round onward**; recomputing already-flown rounds happens
only on the Contest Director's **explicit opt-in**, never silently. Every change,
authorisation and refusal lands in the immutable event log (D4) so the result
stays defensible, and a change that would **contravene a class rule** warns before
it is authorised (the same guardrail as the Organiser's setup-time
STORY-001-007).

This is distinct from a **manual score override** (Area 5.8), which corrects a
captured value rather than the rules it was scored under; and from **roster
changes** after the draw, which are handled by retirement (STORY-001-030), not
here.

### Business Value

- Provide the Contest Director with a single gate through which every mid-contest
  configuration change passes, so already-flown rounds are never silently
  rescored.
- Support an informed decision: the recompute consequences are stated *before*
  anything applies, so the Contest Director sees exactly which rounds are at risk.
- Enable a defensible result — every mid-contest change, and the authority under
  which it was made or refused, is on the immutable record.

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-025 (Start Proceedings and the past-Start
  configuration-authority predicate this story shares), STORY-001-024 (lifecycle
  state — the change flow runs only in Running), STORY-001-007 (scoring
  computation and its class-rule guardrails), the owning configuration stories for
  each 3.5–3.8 area (which fields exist to change).
- **Data assumptions**: which rounds are already flown is derivable from the event
  log (D4); actor identity arrives with the request (companion name-pick) and
  Contest-Director authority is **recorded, not enforced** (D1); the class model
  (STORY-001-016) supplies the rule constraints a change is checked against.
- **Integration points**: shares STORY-001-025's past-Start predicate; a
  recompute of flown rounds invokes the same normalisation/aggregation path as any
  other recompute (STORY-001-007); driven from the companion app, base is
  headless.
- **Business constraints**: the rule docs under `docs/requirements/rules/` are
  authoritative and read-only — a change that contravenes them is wrong, not the
  rule; class-agnostic core (CLAUDE.md); offline-first (D6).

### Scope In

- **The authorisation gate**: after Start, any change to scoring/running
  configuration (draw options, scoring options, task rules, field-aid timings —
  3.5–3.8) is held pending Contest-Director authorisation and does not take effect
  without it.
- **The recompute-consequences statement**: before a proposed change applies, the
  system states **which rounds' scores would recompute** as a consequence.
- **Forward-default with explicit opt-in**: an authorised change applies from the
  **next round onward** by default; recomputing **already-flown rounds** happens
  only on the Contest Director's explicit opt-in, and when opted in the affected
  groups re-normalise and round/final scores update consistently.
- **Class-rule guardrail**: a proposed change that would contravene a class rule
  warns before it can be authorised.
- **Audit**: every mid-contest change, authorisation and refusal is recorded in
  the immutable event log with the acting person and authority.

### Scope Out

- **The location of the boundary** (Setup vs Running) and the Start action itself
  — STORY-001-025; this story assumes the boundary and only defines what a change
  past it does.
- **The specific fields and validation of each configuration area** (which draw
  options, which task rules) — the owning 3.5–3.8 configuration stories; this
  story is the authorisation/recompute wrapper around them.
- **The normalisation and aggregation arithmetic** a recompute triggers —
  STORY-001-007 and the class model (STORY-001-016); this story decides *whether
  and which* rounds recompute, not the maths.
- **Manual score override** (Area 5.8) and **roster/retirement** changes
  (STORY-001-030) — different mutation classes, not configuration changes.
- Enforcing that only a Contest Director may authorise (authority recorded, not
  enforced, D1).

### Acceptance Criteria

#### AC1: A post-Start configuration change is held pending authorisation
**Given** a Running F5J competition in which round 3 has been flown, and a wrong
target working time is discovered on a task
**When** anyone attempts to change that task's working time (3.7)
**Then** the change does **not** take effect on its own — it is held pending the
Contest Director's authorisation, and the same change made before Start would have
required no authorisation.

#### AC2: The recompute consequences are stated before anything applies
**Given** a proposed change to a scoring option after 3 rounds have been flown
**When** the Contest Director reviews it
**Then** the system states which rounds' scores would recompute as a consequence
(e.g. "rounds 1–3 would re-normalise if applied to flown rounds") **before**
anything is applied, so the decision is made with the consequence in view.

#### AC3: An authorised change applies forward-only by default
**Given** the Contest Director authorises a change without opting in to recompute
flown rounds
**When** the change applies
**Then** it takes effect **from the next round onward** (round 4 in a
3-rounds-flown contest) and the already-flown rounds' scores are **unchanged**.

#### AC4: Recomputing flown rounds happens only on explicit opt-in
**Given** the Contest Director authorises the same change **and** explicitly opts
in to recompute the already-flown rounds
**When** the change applies
**Then** the affected groups in the flown rounds re-normalise (best raw result =
1000) and the affected pilots' round and final scores update consistently — and
absent that explicit opt-in, no flown round is ever recomputed silently.

#### AC5: Every mid-contest change is recorded and attributable
**Given** any mid-contest change — whether authorised (forward-only or with
flown-round recompute) or refused
**When** the event log is examined
**Then** the change, the decision and the acting person with Contest-Director
authority are recorded, so the result stays defensible (D4).

#### AC6: A change that contravenes a class rule is warned
**Given** a proposed mid-contest change that would set a value outside what the
class rule permits (e.g. a landing-bonus table the class does not allow)
**When** the Contest Director reviews it
**Then** the system warns that the change would contravene the class rule before
it can be authorised — the rule docs are authoritative (same guardrail as
STORY-001-007).

#### Non-Functional Expectations
- The gate, the consequence statement and any recompute carry no knowledge of any
  specific competition class — the rule constraints and normalisation come from
  the class model (CLAUDE.md class-model law, NFR-1/NFR-2).
- The change flow operates entirely on the base with no internet connection
  (offline-first, D6).

### INVEST Check

Independent (an authorisation/recompute wrapper over STORY-001-025's boundary and
STORY-001-007's scoring) · Valuable (guarantees no silent rescoring of flown
rounds — the whole point of gating mid-contest change) · Small (4 days, 3
functional points: the authorisation gate, the recompute-consequence statement +
forward-default/opt-in, the class-rule guardrail + audit) · Testable (held
change, stated consequence, forward-vs-opt-in outcomes and the logged record are
all observable).
