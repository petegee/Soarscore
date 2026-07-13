# Soarscore — Recorded Decisions

Durable, cross-cutting decisions that shape the requirements but are not
derivable from the rule docs or the area index. Each is a settled position —
revisit deliberately, don't re-litigate session by session. Decided
**2026-07-07** with the project owner.

---

## D1 — Trust model: small, known, trusted group

The system is intended, initially, for local use in New Zealand among a small
group of well-known, well-trusted individuals, and operates on individual
integrity and honesty. There is no intention at this stage to allow other
groups access.

**Consequences**
- No user authentication, no Scorer identity capture, and no physical or
  electronic score sign-off in the MVP. (The event log still carries an
  **actor-identity field** on every event; see
  [D4](#d4--immutable-event-log). *Amended 2026-07-08:* on **companion-app
  clients** the field is populated by an unauthenticated operator
  **name-pick** — identity capture, not authentication; on Scorer devices
  it remains "unknown". See [D4 attribution](#d4--immutable-event-log).)
- The FAI signed-score-card rule
  ([general-rules §2](rules/00-general-rules.md#2-data-the-timer--helper-collects)
  — an unsigned card scores zero in classes that require it) is **consciously
  waived**: these are club-level contests, not FAI-sanctioned events. This is
  a scoping decision recorded here — the rule docs are unchanged, per the
  house-keeping rules.
- Auditability comes from the event log ([D4](#d4--immutable-event-log)), not
  from signatures.
- *(Added 2026-07-08.)* The FAI **helper/official separation** — a helper is
  a fellow pilot assisting the flying pilot, while the timer/scorer is an
  official who offers no help — is likewise **consciously waived**: with a
  small club-level pool of people, **the Scorer is the helper**. The term
  "helper" is therefore not used in the requirements (the former 3.5
  "helper assignment" draw constraint is removed).
- *(Added 2026-07-08.)* The FAI **two-timekeeper practice** (e.g. F3J's two
  stopwatches per competitor) is **consciously waived**: at club level the
  **one Scorer's device time is official** ([D2](#d2--scorer-device-dedicated-esp32-stopwatch-style-handheld)/[D9](#d9--per-flight-timestamps-on-the-base-clock)).
  The dangling "timekeeper count" parameter is removed from 3.7; if
  per-discipline work ever needs FAI officiating fidelity, it reopens this
  deliberately. As with the signed-card waiver, the rule docs are unchanged.
- *(Added 2026-07-11.)* **A flying group is capped at half the roster.**
  Because the Scorer is a non-flying pilot (the waiver above) and there is
  **one Scorer per flying competitor**
  ([general domain model](../../CLAUDE.md); [Area 5](high-level-requirements.md#area-5--scoring)),
  a group of *G* flyers needs *G* scorers drawn from the *(roster − G)* pilots
  not flying it — so **G ≤ roster ÷ 2**, i.e. **every qualifying round has at
  least two groups**. (Fly-offs — a single group of the top qualifiers — are a
  [Future Enhancement](high-level-requirements.md#future-enhancements) and are
  not subject to this floor.) This is an **MVP operational constraint derived
  from this waiver**,
  not an FAI rule (the FAI assumes dedicated officials, so a single all-play
  group is theoretically possible there); the rule docs are unchanged. It
  bounds the draw's groups-per-round from below
  ([4.1](high-level-requirements.md#area-4--draw--rounds-generation)). The
  **exception** — when spare, dedicated non-flying people are present to score —
  relaxes the cap and is expressed as an explicit draw-specification override.

## D2 — Scorer device: dedicated ESP32 stopwatch-style handheld

Scorer hand-held devices are **ESP32 dev-board, round stopwatch-type devices
running custom firmware** (to be developed and integrated as part of this
project). No other devices are catered for or permitted — no BYOD phones or
tablets. **The Scorer's device is the stopwatch** — flight timing is performed
on the device itself, not transcribed from a separate watch.

**Consequences**
- The Scorer-device interaction model must fit a small round display with
  no-look, stopwatch-style operation — not a phone-style touch UI
  ([users.md §3](users.md#3-scorer)).
- The device's hardware/firmware requirements are drafted in
  [scorer-device.md](scorer-device.md) (capture model, on-device/base split,
  sync, fleet; open items listed there).

## D3 — Failure policy: pen and paper, reconcile at the base

At **any point of system failure**, the field reverts to **pen and paper**;
results are manually entered into the Base Station afterwards — via the
companion app's manual entry ([companion-app.md §3.5](companion-app.md#35-manual-entry-and-the-paper-fallback--any-operator-58-d3));
the base itself is headless — to compute final standings and reports. At the end of the contest the Contest Director (or
Organiser under CD authority) **validates the entered scores**, manually enters
missing scores, and overrides entered scores known to be incorrect.

**Consequences**
- Base-station **manual score entry** is a first-class MVP path
  ([5.8](high-level-requirements.md#area-5--scoring)).
- Blank **scoring sheets must be printable in advance** of any round, as the
  standing fallback kit ([7.3](high-level-requirements.md#area-7--reports)).
- A **CD end-of-contest validation pass gates Lock**
  ([2.2](high-level-requirements.md#area-2--competition-lifecycle)).

## D4 — Immutable event log

The system records **all mutations as an immutable, write-only log of events**,
so it is always possible to know what happened, when, and how the contest
evolved. This is the MVP's auditability mechanism (in place of sign-off, D1)
and its dispute/debugging record. Current state must be derivable from the
log. This constrains the domain-model design and should be decided together
with the flexible task-model NFR
([non-functional.md NFR-1](non-functional.md#nfr-1--one-centralised-flexible-task-model)).

**Accepted risk — single copy** *(owner-decided 2026-07-08)*: in the MVP the
event log exists as **one copy on the Base Station's storage**. Loss of
already-captured data (e.g. storage corruption on day two of a two-day
event losing day one) is an **explicitly accepted risk** at club level; all
backup — including a minimal mirror-to-companion-client — stays a
[Future Enhancement](high-level-requirements.md#future-enhancements).
Printing round results as the contest proceeds ([7.1](high-level-requirements.md#area-7--reports))
is the informal paper hedge.

**Attribution** *(decided 2026-07-08; identity amended later the same
day)*: wherever the requirements say an action is "attributable", it means
the event carries the **originating client** (device/laptop), the
**authority under which the action was taken** (e.g. a Contest-Director
action), and an **actor-identity field**. On **companion-app clients** the
field is populated by a lightweight **operator name-pick** — a "who is
operating?" selection from a people list, changeable at any time, with
**no password or verification** (identity capture, not authentication —
D1's no-auth stance stands; see
[companion-app.md §1](companion-app.md#1-role-and-shape-d8)). On **Scorer
devices** the field defaults to **"unknown"** — attribution there is by
originating device, and Scorer identity capture stays a
[Future Enhancement](high-level-requirements.md#future-enhancements).
**Authentication** of any kind (login, OIDC) remains deferred; note OIDC
conflicts with offline-first operation ([D6](#d6--offline-first-buffer-and-sync-publish-when-connected))
unless an identity provider runs locally.

## D5 — End of working time does not stop the device stopwatch

There is **no requirement for the end of working time to stop the hand-held
stopwatch devices**. The Scorer times through to the model's **first ground
contact, even when that falls after the horn** *(amended 2026-07-08 by
[D9](#d9--per-flight-timestamps-on-the-base-clock) — originally "stops on
the horn")*. The horn, by ear, remains the field authority telling pilots
the working time has ended
([6.2](high-level-requirements.md#area-6--display-timer--audio-field-aids)).

**Consequences**
- [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids) no
  longer auto-stops flight timing.
- Class rules still cap countable flight time at the end of working time; the
  system applies that cap — and derives any **overfly** and its magnitude —
  from the per-flight timestamps (D9), rather than the Scorer judging it at
  the line or the base flagging bare durations.

## D6 — Offline-first; buffer and sync; publish when connected

The system must run **entirely offline from the internet**, but be able to
**publish results when internet connectivity is available** (publishing
channel to be defined later). Hand-held devices that lose sync with the Base
Station **continue to capture data/scores/metrics and sync when the link
returns**. A live-scoring public web page for real-time contest progress is a
**future enhancement**, not MVP.

**Consequences**
- No MVP feature may depend on internet connectivity.
- Device↔base sync conflict policy: **never auto-resolve** — both captures
  are event-logged and the conflict surfaces as an anomaly in the CD
  validation pass
  ([scorer-device.md §5](scorer-device.md#5-sync-and-conflict-policy-a2)).

## D7 — Scale bounds and multi-day operation

A typical event is **single-day or two-day**, with **up to 20 pilots** and
**up to ~8 rounds per day**. Two-day events are routine, so **suspend at end
of day / resume next day is MVP scope**
([2.3](high-level-requirements.md#area-2--competition-lifecycle)). These
bounds size everything: device fleet ≈ max group size plus spares, report
volumes are small, draw computation is trivial at this scale.

## D8 — Physical shape: headless authoritative base, companion laptop

*(Decided 2026-07-08.)* The Base Station is a **headless embedded controller
at the flight line** that owns all contest state, the event log (D4), the
shared clock and the radio; the **field board and loudspeakers are wired to
it** (so the horn — the timing authority, D5 — can never be stale); the
**master laptop runs a companion app as a detachable client** holding no
state; **pilots' phones** may read an **MVP-optional, strictly read-only
draw/standings web page** served by the base over local Wi-Fi — no native
app. Full detail and implications:
[physical architecture](../architecture/physical-architecture.md).

**Consequences**
- A running group survives the laptop leaving, sleeping or failing; but
  run-control and round advance need a connected operator client.
- *(Added 2026-07-08.)* **Multiple companion clients may connect
  concurrently, last-action-wins** — no control-session lock; every action
  is event-logged with its originating client and exercised authority (D4).
  Coordination is by convention within the trusted group (D1).
- Pilot-phone and laptop traffic must not be able to degrade the
  scorer-device link.
- The base is a deliberate single point of failure — D3 is the answer.
- *(Added 2026-07-08.)* There is **one companion app** serving all the
  operator hats (Organiser, Contest Director, Announcer/Timekeeper) through
  **role-oriented views**, with no per-role apps and no enforced
  authorisation in the MVP — the hats swap freely at club scale
  ([users.md](users.md)). **Scorers and pilots have no companion-app write
  path**: Scorers interact only through their handhelds (D2), pilots only
  through the read-only page; a pilot or Scorer needing a closed-group
  correction **asks the Contest Director**, who makes it via the companion
  app's score administration ([D11](#d11--the-devices-scope-is-the-current-group)).
  Detail: [companion-app.md](companion-app.md).
- *(Added 2026-07-08.)* The companion app is a **base-served web app**: the
  base's web server serves the operator UI to any browser-equipped client —
  nothing to install, so any spare laptop takes over. The **run-control
  view must work at phone size**, giving the Contest Director a flight-line
  client on a phone. Publishing (D6) works by the app **exporting results
  to the operator's machine**, which publishes over its own internet
  connection — the base still never touches the internet.

## D9 — Per-flight timestamps on the base clock

*(Decided 2026-07-08.)* Every per-flight record carries **start and stop
timestamps on the base's shared clock**, stamped automatically by the device
at the Scorer's start/stop actions — never entered by hand — buffered offline
and reconciled on sync (D6). The Scorer stops the watch at the model's
**first ground contact even after the horn** (amending D5): the raw capture
is release→touchdown, and **the system derives the countable (capped) flight
time, any overfly and its magnitude, and launch-before-working-time** from
the timestamps against the group's working-time window.

**Why:** an overfly cannot be derived from a duration alone — a pilot who
launches mid-window can overfly with a flight time far shorter than the
working time — and the graded overfly consequences (e.g. F3J's −30 within a
minute, zero beyond) need to know *how long after the horn* the model
landed. Timestamps also give the system launch-before-working-time detection
(F3K) and corroborate flight ordering.

**Consequences**
- Device↔base clock sync becomes **scoring-relevant**, not just display: the
  ±0.5 s mirror bound also bounds timestamp accuracy
  ([scorer-device.md §7](scorer-device.md#7-countdown-staleness-bound-a6));
  stamps that cannot be reconciled within it are flagged for the CD
  validation pass rather than presented as exact.
- Paper-fallback / manual entries
  ([5.8](high-level-requirements.md#area-5--scoring)) carry no timestamps;
  any overfly there is the Contest Director's call in the validation pass
  (D3).
- [6.1](high-level-requirements.md#area-6--display-timer--audio-field-aids)'s
  earlier "flag any captured time exceeding the working time" heuristic is
  replaced by this derivation.

## D10 — Operator-driven progression; automation runs only inside a group

*(Decided 2026-07-08.)* **Nothing crosses a group or round boundary without
an operator action.** The Announcer/Timekeeper starts every group; at a
round boundary the same action is the round advance
([6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids)).
The automatic phased sequence (prep → working → landing) runs only
**inside** a started group, and only for tasks whose shape fits it —
**duration-shaped tasks**. Tasks that do not fit (e.g. F3B Distance and
Speed, F3K all-up) are **manual-run**: starting the group marks it current
and pushes the devices their group context for normal capture, but no
automated clock, callouts or prep-gate countdown run. Whether a task is
sequence-driven or manual-run **derives from the task type** — it is not a
per-competition switch — and the operator's interaction is identical either
way, so nobody needs to remember which tasks self-advance: **none do**.

**Interlocks.** An advance with outstanding items — missing scores,
unresolved no-scores, granted-but-unflown re-flights — always **blocks with
the items listed**; only the Contest Director's explicit, attributed
**"advance anyway" override** proceeds, converting outstanding missing
scores into flagged anomalies for the end-of-contest validation pass (D3),
unresolved no-scores into zeros per
[5.7](high-level-requirements.md#area-5--scoring), and lapsing any unflown
re-flight entitlement (the original result stands, flagged). There is no
strictness setting: strict is the only mode, and the override is the
per-incident relief valve.

**Consequences**
- Automatic group start after an inter-group gap is removed from
  [6.5](high-level-requirements.md#area-6--display-timer--audio-field-aids);
  the **inter-group gap setting is dropped** from 3.8 (nothing consumes it).
- The CD's "pause the inter-group progression" run-control action is moot
  (nothing progresses on its own) and is removed; prep
  pause/fast-forward/add-time, the split prep-gate releases and
  abort/restart are unchanged.
- The round-completeness gate and the Scorer correction window
  ([Area 5](high-level-requirements.md#area-5--scoring)) are **always on** —
  they are scoring integrity, not field-aid automation. *(The correction
  window was later narrowed to the group boundary by
  [D11](#d11--the-devices-scope-is-the-current-group).)*
- Manual-run groups have no base-clock working-time window, so D9's overfly
  derivation does not apply to them; their timing structures are per-class
  (deferred per-discipline work) and any overrun is the CD's call in the
  validation pass. The device-side pre-group confirmation guard
  ([5.0](high-level-requirements.md#area-5--scoring)) still applies; the
  T−1:00 prep-gate pause exists only where the automated sequence runs.

## D11 — The device's scope is the current group

*(Decided 2026-07-08.)* A Scorer device's world is **the current group** —
from the base's group-context push to the start of the next group. Nothing
on the device reaches backward past a group boundary; anything that must is
base-side work.

**Consequences**
- **Group entry requires sync.** A device enters a group only via the
  base's **group-context push** (pilot short-list, working time, and the
  **current task descriptor**); an offline device that missed the push
  cannot capture for that group until it syncs — pen and paper (D3) covers
  the meanwhile. A device that received the push and *then* dropped offline
  continues normally, buffering (D6).
- **Descriptor changes apply at group boundaries.** A CD-authorised
  mid-contest configuration change
  ([Area 3](high-level-requirements.md#area-3--competition-setup--configuration))
  re-issues the task descriptor; each device applies it at its **next group
  entry, never mid-group** — so a Scorer's screen never changes under their
  thumbs, and every capture is made under the descriptor current at its
  group's start.
- **On-device corrections end with the group** *(narrowing the earlier
  round-bounded Scorer correction window)*. A Scorer may correct a value
  they captured only while its group is current — **up to the start of the
  next group**. After that, any change to a flown group's data is
  base-side: mid-contest score administration
  ([5.3](high-level-requirements.md#area-5--scoring)/[5.4](high-level-requirements.md#area-5--scoring))
  via the companion app, or the Contest Director's end-of-contest
  validation (D3). The base **rejects and surfaces** a buffered correction
  that syncs after its group has closed — never applies it silently.
- The **round-completeness gate**
  ([6.4](high-level-requirements.md#area-6--display-timer--audio-field-aids))
  is unchanged, but it no longer bounds Scorer self-correction (that ends
  earlier, with the group) — it is purely scoring integrity.

## D12 — Contest classes are modelled as seeded, cloneable definitions

*(Decided 2026-07-10.)* A **contest class** is not a bare `discipline` enum
with its numbers scattered across configuration — it is a first-class
**Contest Class Model**: a definition holding the class's group-score basis,
drop-worst rule, points-per-second, and its **own** landing table (later,
additively, its tasks, metrics and penalties). The application **defers to the
model** rather than switching on discipline; a competition **references** a
model. Each of the six MVP classes ships as a **read-only stock model**; a
club-level variation is a **named custom model cloned** from a stock one (e.g.
"F5L – local rule"). This is the concrete realisation of
[NFR-1](non-functional.md#nfr-1--one-centralised-flexible-task-model) (one
central place that knows a class's shape) and
[NFR-2](non-functional.md#nfr-2--additive-only-extensibility-for-new-competition-types)
(a new class is a new seeded model, not a code change).

**Derived, not authoritative (house rule 1).** The stock models are a
**derived encoding** of the read-only rule docs
([rules/](rules/)) — regenerated when those docs change, never authoritative
over them, and never permitted to contravene them. `discipline` on a
competition becomes a *reference to a model*, which is consistent with — and
supersedes the wording of — the earlier "a key into the rule corpus, not a
copy of any rule number" note in the competition configuration. Copying rule
numbers into the product was always going to happen *somewhere* (NFR-1 demands
it); D12 fixes that somewhere as the one class model, under the rule docs'
authority.

**Consequences**

- A **deliberate rule deviation is a named custom model**, not a silent
  per-field override. The clone records how it differs from its stock source,
  giving reports an auditable "ran class X, a custom variant of F5L, drop-worst
  beyond 3 rounds (FAI: 5)" — the [D4](#d4--immutable-event-log) log carries the
  cloning as an attributed mutation.
- The class model **owns its landing table outright**. This **supersedes the
  standalone landing-table library** of the original STORY-001-002: tables are
  managed *within* class definitions, not selected independently per
  competition. Existing landing-table events remain in the immutable log (D4);
  this is a repurpose, not a purge.
- **STORY-001-016** delivers the model; **STORY-001-004** (discipline →
  class-model selection), **STORY-001-007** (scoring options read from the
  model; deviation = clone-and-edit) and **STORY-001-008** (tasks/penalties as
  additive slots on the model) are reshaped to depend on it.
- Stock models are **read-only and never deletable**; a model referenced by a
  competition cannot be deleted. Extending the class set is **additive**
  (NFR-2) — a new seeded model, no edit to existing behaviour, data or results.

## D13 — Multi-task classes draw each task independently

*(Decided 2026-07-13.)* A **round's groups are per task, not per round**, for
any class that flies more than one task per round. F3B flies Duration,
Distance and Speed within one round, and F3B.1.8b fixes a **different**
per-group minimum for each (5, 3, and 8-or-all-competitors respectively) —
strong textual evidence, reinforced by Task C's starting order being allowed
to derive from cumulative results-so-far, that Speed's grouping is a distinct
decision from Duration's and Distance's, not a shared one. Collapsing this to
one grouping per round (the original STORY-001-009 implementation) forces
every task in the round to satisfy whichever task needs the most competitors
per group — for F3B, Speed's minimum of 8 — which is stricter than the rule
requires for Duration and Distance, and structurally prevents Speed from ever
having its own composition or order.

**Consequences**

- A `RoundDraw` for a multi-task class holds one group composition **per
  task**; a single-task class continues to hold exactly one, unchanged
  (additive, NFR-2 — no branch on discipline elsewhere in the draw pipeline).
- Fairness evidence is reported **per task** where a class draws more than
  one, so a task with a materially different group size does not blend into
  or mask another task's fairness figure.
- Draw acceptance ([4.3](high-level-requirements.md#area-4--draw--rounds-generation))
  remains **one decision for the whole round's draw** — the Contest Director
  accepts or re-draws all of a round's task groupings together, not task by
  task.
- **STORY-001-020** delivers the per-task domain model, generation and
  validation; **STORY-001-021** delivers its presentation in the draw
  workflow screen. Downstream consumers that assumed one grouping per round —
  draw acceptance evidence, group management, draw reports — must be updated
  to read per-task groupings for multi-task classes as follow-on work before
  F3B contests can run end-to-end on this model.

## D14 — Rule-fixed group-size minima are advisory: warn and require override

*(Decided 2026-07-13.)* Every class's rule-fixed per-group minimum (D13's
per-task minima; F3J 6; F3K 5; F5J 6) is **advisory, not a hard wall**.
Soarscore's primary use case ([D1](#d1--trust-model-small-known-trusted-group))
is small local club contests, which routinely cannot field a
Championship-scaled roster — a club with 6 pilots wanting to fly F3B Speed
(rule minimum 8, or all competitors) should not be locked out of running the
task at all. When a roster cannot meet a task's minimum for the requested
groups-per-round, the system **generates the closest compliant grouping
anyway**, attaches a warning naming the task and the specific rule clause it
falls short of, and requires the Contest Director's **explicit
acknowledgement, scoped to that one contest,** before the draw can be
accepted. This is the same warn-and-approve shape already established for
the lone-pilot safeguard and the F3B one-valid-result annulment
([5.3](high-level-requirements.md#area-5--scoring)) — extended here from
scoring-time group anomalies to draw-time group-size shortfalls.

**Relationship to D12.** This is **not** the "silent per-field override" D12
rules out. D12's concern is a *standing* rule deviation (a club that always
runs smaller groups) being buried in an unnamed per-field tweak instead of a
named, auditable custom class model. D14 is for the opposite case: an
*occasional, per-event* shortfall (this week's roster is short a few pilots)
that a Contest Director consciously accepts for one contest, fully logged
with its warning and acknowledgement ([D4](#d4--immutable-event-log)). A club
that structurally and permanently cannot meet a class's minimum should still
clone a named custom model with a lower `minGroupSize` (D12's path); D14
exists for the day-to-day variability a standing model change is the wrong
tool for.

**Consequences**

- Draw generation ([4.2](high-level-requirements.md#area-4--draw--rounds-generation))
  never refuses to produce a round solely because a task's rule-fixed minimum
  can't be met by the roster on hand; only the roster-derived two-groups
  floor ([D1](#d1--trust-model-small-known-trusted-group)) remains a hard
  bound at save time.
- Draw acceptance ([4.3](high-level-requirements.md#area-4--draw--rounds-generation))
  gains a new precondition: a draw carrying an unacknowledged group-size
  warning cannot be accepted.
- The pre-emptive numeric `minGroupSizeOverride` field (STORY-001-009) is
  **superseded** by this mechanism as the primary route past a minimum — it
  required the Organiser to guess a number in advance and left no record of
  *why*; D14's warning is generated from the actual attempted specification
  and is self-explaining in the log.
- The general D1 floor (every group needs ≥ 2 scoring pilots) is **not**
  affected by D14 — it already has its own warn-not-block precedent (the
  lone-pilot flag) and is a scoring-integrity constraint, not an FAI rule
  number.
- **STORY-001-022** delivers the detection, warning and acknowledgement
  mechanism (**done**); STORY-001-020's AC4 (F3B Speed's roster-of-6
  scenario) depends on it. **STORY-001-023** delivers its companion-app
  presentation (**done**) — displaying and acknowledging a warning in the
  draw workflow screen, and retiring the now-superseded
  `minGroupSizeOverride` field from the draw specification editor —
  mirroring how STORY-001-021 presents STORY-001-020.
